// app.js
require("dotenv").config(); // Load environment variables from .env file - MUST be at the very top

const express = require("express");
const axios = require("axios"); // For making HTTP requests to TMDB
const path = require("path"); // For handling file paths
const cookieParser = require("cookie-parser"); // For handling cookies
const admin = require('firebase-admin'); // Firebase Admin SDK

// Initialize Express app
const app = express();
app.use(express.json());
// --- Firebase Admin SDK Initialization ---
// Ensure you have your service account key file
// IMPORTANT: Adjust this path if your serviceKey.json is in a different location!
// const serviceAccount = require('./config/serviceKey.json');
let serviceAccount;
try {
  // Check if the environment variable is set (for Render deployment)
  if (process.env.SERVICE_ACCOUNT_KEY_JSON) {
    // Parse the JSON string from the environment variable
    serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT_KEY_JSON);
  } else {
    // Fallback for local development: load from the local file
    // IMPORTANT: Ensure this file is in your .gitignore so it's not pushed to GitHub!
    console.warn("SERVICE_ACCOUNT_KEY_JSON environment variable not found. Attempting to load from local file for development.");
    serviceAccount = require('./config/serviceKey.json');
  }
} catch (error) {
  console.error("Error loading service account key:", error);
  // Depending on how critical this is, you might want to exit the process
  // process.exit(1);
  throw new Error("Failed to load service account key configuration.");
}
// Initialize Firebase Admin SDK once
if (!admin.apps.length) { // Prevents re-initialization in development
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        // If you were using Realtime Database, you'd add databaseURL here
        // databaseURL: "https://your-project-id.firebaseio.com"
    });
}

const db = admin.firestore(); // Get Firestore instance
const authAdmin = admin.auth(); // Get Firebase Auth Admin instance

// --- Global Middleware ---
app.use(express.json()); // This middleware parses JSON request bodies
app.use(express.urlencoded({ extended: true })); // This middleware parses URL-encoded bodies (good practice for forms)
app.use(cookieParser()); // Middleware for cookie parsing

// Serve static files (e.g., your custom logo in public/images, CSS, client-side JS)
app.use(express.static(path.join(__dirname, "public")));

// --- EJS View Engine Setup ---
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// --- TMDB API Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY;
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMAGE_BASE_URL = "https://image.tmdb.org/t/p/w500";

if (!TMDB_API_KEY) {
    console.error("Error: TMDB_API_KEY is not set in your .env file.");
    process.exit(1); // Exit if API key is missing
}

// --- Firebase Configuration for Frontend (from .env) ---
let firebaseConfig = {};
try {
    if (process.env.FIREBASE_CONFIG) {
        firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
        console.log("Parsed firebaseConfig in app.js (server-side):", firebaseConfig);
    } else {
        console.warn("Warning: FIREBASE_CONFIG is not set in your .env file. Firebase may not initialize correctly.");
    }
} catch (e) {
    console.error("Error parsing FIREBASE_CONFIG from .env:", e);
    firebaseConfig = {}; // Ensure it's an empty object if parsing fails
}

// Middleware to inject firebaseConfig and Canvas globals into all EJS responses
app.use((req, res, next) => {
    res.locals.firebaseConfig = JSON.stringify(firebaseConfig);
    // Ensure __app_id is retrieved from process.env, not a global variable
    res.locals.__app_id = process.env.FIREBASE_APP_ID || "default-app-id";
    // __initial_auth_token is typically set during specific auth flows (e.g., custom token)
    // For general page loads, it might be null, and client-side auth handles persistence.
    res.locals.__initial_auth_token = null; // Set to null by default, can be overridden by specific auth routes
    next();
});

// --- Authentication Middleware ---
// This middleware verifies the Firebase ID token from the client.
const authenticateToken = async (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (token == null) {
        // If no token, allow to proceed but mark as unauthenticated.
        // This is important for /user/list where unauthenticated users see a prompt.
        req.user = null;
        return next();
    }

    try {
        const decodedToken = await authAdmin.verifyIdToken(token);
        req.user = decodedToken; // Attach the decoded user (contains uid) to the request
        next();
    } catch (error) {
        console.error("Error verifying Firebase ID token:", error.message);
        // If token is invalid, treat as unauthenticated
        req.user = null;
        next(); // Still call next to allow client-side handling (e.g., redirect to login)
    }
};

// Apply authentication middleware to routes that require user context
app.use(['/user/list', '/movies/add-manual'], authenticateToken);


// --- EJS Page Routes (to render your templates) ---
// These routes directly render the EJS files.

// Home Page
app.get("/", (req, res) => {
    res.render("home");
});

// Movie Search Page
app.get("/search", (req, res) => {
    res.render("search", { movies: [] });
});
app.get("/about", (req, res) => {
    res.render("about");
});
app.get("/contact", (req, res) => {
    res.render("contact");
});
app.get("/faq", (req, res) => {
    res.render("faq");
});

// Movie Details Page
app.get("/movie/:id", (req, res) => {
    const movieId = req.params.id;
    res.render("search_details", { movieId: movieId });
});

// User Watchlist Page (UPDATED to fetch user-specific data)
app.get('/user/list', async (req, res) => {
    let movies = [];
    const userId = req.user ? req.user.uid : null; // Get userId from authenticated user

    if (!userId) {
        // If no user is authenticated, render the list page with an empty array
        // The client-side script will then show the auth prompt.
        return res.render('list', { movies: [] });
    }

    try {
        // Construct the user-specific collection path
        const userWatchlistRef = db.collection(`artifacts/${process.env.FIREBASE_APP_ID}/users/${userId}/watchlist`);
        // Fetch movies from the user's specific watchlist
        const moviesSnapshot = await userWatchlistRef.orderBy('added_at', 'desc').get();
        movies = moviesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.render('list', { movies: movies });

    } catch (error) {
        console.error("Error fetching movies for user's list page:", error);
        res.status(500).render('list', {
            movies: [],
            errorMessage: 'Could not load your watchlist at this time.'
        });
    }
});

// User Login Page
app.get("/user/login", (req, res) => {
    res.render("login");
});

// User Register Page
app.get("/user/register", (req, res) => {
    res.render("register");
});

// User Profile Page (Placeholder)
app.get("/user/profile", (req, res) => {
    res.render("profile");
});

// --- API Endpoints ---

// API Endpoint to Search for Movies
app.post("/search-movies", async (req, res) => {
    const query = req.body.query;

    if (!query) {
        return res.status(400).json({ error: "Movie query is required." });
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                query: query,
                include_adult: false,
            },
        });

        const movies = response.data.results.map((movie) => ({
            id: movie.id,
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path
                ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}`
                : "/images/default.png",
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids,
        }));

        res.json({ movies: movies });
    } catch (error) {
        console.error("Error fetching movies from TMDB (search):", error.message);
        if (error.response) {
            res
                .status(error.response.status)
                .json({
                    error: "Failed to fetch movies from TMDB API.",
                    details: error.response.data,
                });
        } else if (error.request) {
            res.status(500).json({ error: "No response received from TMDB API." });
        } else {
            res.status(500).json({ error: "An unexpected error occurred." });
        }
    }
});

// API Endpoint to Get Movie Genres (for frontend mapping)
app.get("/api/genres", async (req, res) => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
            params: {
                api_key: TMDB_API_KEY,
            },
        });
        res.json(response.data);
    } catch (error) {
        console.error("Error fetching genres from TMDB:", error.message);
        if (error.response) {
            res
                .status(error.response.status)
                .json({
                    error: "Failed to fetch genres from TMDB API.",
                    details: error.response.data,
                });
        } else if (error.request) {
            res.status(500).json({ error: "No response received from TMDB API." });
        } else {
            res.status(500).json({ error: "An unexpected error occurred." });
        }
    }
});

// API Endpoint to Get Detailed Movie Information
app.get("/api/movie-details/:id", async (req, res) => {
    const movieId = req.params.id;

    if (!movieId) {
        return res.status(400).json({ error: "Movie ID is required." });
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: "credits",
            },
        });

        const movieData = response.data;

        const directors = movieData.credits.crew
            .filter((crewMember) => crewMember.job === "Director")
            .map((director) => director.name);

        const cast = movieData.credits.cast
            .sort((a, b) => a.order - b.order)
            .slice(0, 5)
            .map((actor) => ({
                name: actor.name,
                character: actor.character,
                profile_path: actor.profile_path
                    ? `${TMDB_IMAGE_BASE_URL}${actor.profile_path}`
                    : null,
            }));

        const detailedMovie = {
            id: movieData.id,
            title: movieData.title,
            overview: movieData.overview,
            poster_path: movieData.poster_path
                ? `${TMDB_IMAGE_BASE_URL}${movieData.poster_path}`
                : "/images/default",
            backdrop_path: movieData.backdrop_path
                ? `${TMDB_IMAGE_BASE_URL}${movieData.backdrop_path}`
                : null,
            release_date: movieData.release_date,
            vote_average: movieData.vote_average,
            runtime: movieData.runtime,
            genres: movieData.genres.map((genre) => genre.name),
            directors: directors,
            cast: cast,
            tagline: movieData.tagline,
        };

        res.json(detailedMovie);
    } catch (error) {
        console.error(
            `Error fetching movie details for ID ${movieId}:`,
            error.message
        );
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: "Movie not found." });
        } else if (error.response) {
            res
                .status(error.response.status)
                .json({
                    error: "Failed to fetch movie details from TMDB API.",
                    details: error.response.data,
                });
        } else if (error.request) {
            res.status(500).json({ error: "No response received from TMDB API." });
        } else {
            res.status(500).json({ error: "An unexpected error occurred." });
        }
    }
});

// This endpoint is a placeholder. Watchlist fetching is handled client-side.
app.get("/api/user/watchlist", async (req, res) => {
    res
        .status(200)
        .json({
            message:
                "This endpoint is a placeholder. Watchlist fetching is handled client-side for now.",
        });
});

// API Endpoint to Add Movie Manually (UPDATED to store user-specific data)
app.post('/movies/add-manual', async (req, res) => {
    const userId = req.user ? req.user.uid : null; // Get userId from authenticated user
    console.log('Server-side: Received POST to /movies/add-manual'); // <--- ADD THIS LINE
    console.log('Server-side: req.user:', req.user ? req.user.uid : 'Not authenticated'); // <--- ADD THIS LINE
    console.log('Server-side: req.body:', req.body); // <--- ADD THIS LINE (This is crucial!)
    if (!userId) {
        return res.status(401).json({ message: 'Authentication required to add movies.' });
    }

    // Destructure all expected fields from the request body
    const {
        title,
        year,
        overview,
        status,
        type,
        genres,
        poster_path, // Could be null for manual entries
        media_type // Could be 'movie' or 'tv' for manual entries
    } = req.body;

    if (!title) {
        return res.status(400).json({ message: 'Movie title is required.' });
    }

    try {
        // Construct the user-specific collection path
        const userWatchlistRef = db.collection(`artifacts/${process.env.FIREBASE_APP_ID}/users/${userId}/watchlist`);
        const newMovieRef = userWatchlistRef.doc(); // Let Firestore generate a unique ID

        const movieData = {
            id: newMovieRef.id, // Store the Firestore document ID within the document
            title: title,
            release_date: year ? `${year}-01-01` : null, // Format as YYYY-MM-DD
            year: year ? parseInt(year, 10) : null,
            added_at: admin.firestore.Timestamp.now(), // Use server timestamp
            isManual: true, // Mark as manually added
            type: type || 'movie', // Default to 'movie' if not provided
            media_type: media_type || (type === 'series' ? 'tv' : 'movie'), // Infer media_type
            poster_path: poster_path || null, // Allow custom poster_path or null
            overview: overview || 'Manually added entry.',
            status: status || 'Plan to Watch', // Default status
            genres: genres || [], // Ensure genres is an array
            vote_average: 0, // Default for manually added
            // Add any other default fields that your frontend expects
        };

        await newMovieRef.set(movieData);
        res.status(201).json({ message: 'Movie added successfully!', movie: movieData });
    } catch (error) {
        console.error('Error adding movie manually to Firestore:', error);
        res.status(500).json({ message: 'Failed to add movie.', error: error.message });
    }
});
const PORT = process.env.PORT || 3000;
// --- Server Start ---
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
});