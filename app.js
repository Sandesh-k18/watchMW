// app.js
require('dotenv').config(); // Load environment variables from .env file - MUST be at the very top

const express = require("express");
const axios = require('axios'); // For making HTTP requests to TMDB
const path = require('path');   // For handling file paths
const cookieParser = require("cookie-parser"); // For handling cookies

// Initialize Express app
const app = express();

// Database connection (assuming connectToDB is defined in ./config/db)
const connectToDB = require("./config/db");
connectToDB();

// --- Global Middleware ---
// Middleware to parse JSON bodies (for API requests like /search-movies)
app.use(express.json());
// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));
// Middleware for cookie parsing
app.use(cookieParser());

// Serve static files (e.g., your custom logo in public/images, CSS, client-side JS)
// This makes files in the 'public' directory accessible directly from the root URL.
// Example: public/images/my_logo.png -> /images/my_logo.png
app.use(express.static(path.join(__dirname, 'public')));


// --- EJS View Engine Setup ---
app.set("view engine", "ejs");
// Correctly set the views directory. Assumes 'views' folder is at the same level as app.js
app.set('views', path.join(__dirname, 'views'));


// --- TMDB API Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY; // Get API key from environment variables
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; // Base URL for movie posters

// Check if TMDB API key is loaded
if (!TMDB_API_KEY) {
    console.error('Error: TMDB_API_KEY is not set in your .env file.');
    process.exit(1);
}

// --- Firebase Configuration for Frontend ---
// Parse Firebase config from environment variable
let firebaseConfig = {};
try {
    if (process.env.FIREBASE_CONFIG) {
        firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
        // Debugging: Log the parsed Firebase config on the server
        console.log('Parsed firebaseConfig in app.js (server-side):', firebaseConfig);
    } else {
        console.warn('Warning: FIREBASE_CONFIG is not set in your .env file. Firebase may not initialize correctly.');
    }
} catch (e) {
    console.error('Error parsing FIREBASE_CONFIG from .env:', e);
    firebaseConfig = {}; // Ensure it's an empty object on parse error
}

// Middleware to inject firebaseConfig into all EJS responses
app.use((req, res, next) => {
    // Make firebaseConfig available to all EJS templates as a local variable
    res.locals.firebaseConfig = JSON.stringify(firebaseConfig);
    // Also pass __app_id and __initial_auth_token if they exist (for Canvas environment)
    res.locals.__app_id = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    res.locals.__initial_auth_token = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;
    next();
});


// --- Routes from your project structure ---
const userRouter = require("./routes/user.routes");
const indexRouter = require("./routes/index.routes");

app.use("/", indexRouter);
app.use("/user", userRouter);


// --- EJS Page Routes (to render your templates) ---

// Home Page - Renders views/home.ejs
app.get("/", (req, res) => {
  res.render("home");
});

// Movie Search Page - Renders views/search.ejs
app.get('/search', (req, res) => {
    res.render('search', { movies: [] });
});

// Movie Details Page - Renders views/movie_details.ejs
app.get('/movie/:id', (req, res) => {
    const movieId = req.params.id;
    res.render('search_details', { movieId: movieId });
});


// --- API Endpoints ---

// API Endpoint to Search for Movies
app.post('/search-movies', async (req, res) => {
    const query = req.body.query;

    if (!query) {
        return res.status(400).json({ error: 'Movie query is required.' });
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, {
            params: {
                api_key: TMDB_API_KEY,
                query: query,
                include_adult: false
            }
        });

        const movies = response.data.results.map(movie => ({
            id: movie.id,
            title: movie.title,
            overview: movie.overview,
            poster_path: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : '/images/default.png',
            release_date: movie.release_date,
            vote_average: movie.vote_average,
            genre_ids: movie.genre_ids
        }));

        res.json({ movies: movies });

    } catch (error) {
        console.error('Error fetching movies from TMDB (search):', error.message);
        if (error.response) {
            res.status(error.response.status).json({ error: 'Failed to fetch movies from TMDB API.', details: error.response.data });
        } else if (error.request) {
            res.status(500).json({ error: 'No response received from TMDB API.' });
        } else {
            res.status(500).json({ error: 'An unexpected error occurred.' });
        }
    }
});

// NEW API Endpoint to Get Movie Genres (for frontend mapping)
app.get('/api/genres', async (req, res) => {
    try {
        const response = await axios.get(`${TMDB_BASE_URL}/genre/movie/list`, {
            params: {
                api_key: TMDB_API_KEY
            }
        });
        res.json(response.data);
    } catch (error) {
        console.error('Error fetching genres from TMDB:', error.message);
        if (error.response) {
            res.status(error.response.status).json({ error: 'Failed to fetch genres from TMDB API.', details: error.response.data });
        } else if (error.request) {
            res.status(500).json({ error: 'No response received from TMDB API.' });
        } else {
            res.status(500).json({ error: 'An unexpected error occurred.' });
        }
    }
});


// API Endpoint to Get Detailed Movie Information (Existing route)
app.get('/api/movie-details/:id', async (req, res) => {
    const movieId = req.params.id;

    if (!movieId) {
        return res.status(400).json({ error: 'Movie ID is required.' });
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'credits'
            }
        });

        const movieData = response.data;

        const directors = movieData.credits.crew
            .filter(crewMember => crewMember.job === 'Director')
            .map(director => director.name);

        const cast = movieData.credits.cast
            .sort((a, b) => a.order - b.order)
            .slice(0, 5)
            .map(actor => ({
                name: actor.name,
                character: actor.character,
                profile_path: actor.profile_path ? `${TMDB_IMAGE_BASE_URL}${actor.profile_path}` : null
            }));

        const detailedMovie = {
            id: movieData.id,
            title: movieData.title,
            overview: movieData.overview,
            poster_path: movieData.poster_path ? `${TMDB_IMAGE_BASE_URL}${movieData.poster_path}` : '/images/default.png',
            backdrop_path: movieData.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${movieData.backdrop_path}` : null,
            release_date: movieData.release_date,
            vote_average: movieData.vote_average,
            runtime: movieData.runtime,
            genres: movieData.genres.map(genre => genre.name),
            directors: directors,
            cast: cast,
            tagline: movieData.tagline
        };

        res.json(detailedMovie);

    } catch (error) {
        console.error(`Error fetching movie details for ID ${movieId}:`, error.message);
        if (error.response && error.response.status === 404) {
            res.status(404).json({ error: 'Movie not found.' });
        } else if (error.response) {
            res.status(error.response.status).json({ error: 'Failed to fetch movie details from TMDB API.', details: error.response.data });
        } else if (error.request) {
            res.status(500).json({ error: 'No response received from TMDB API.' });
        } else {
            res.status(500).json({ error: 'An unexpected error occurred.' });
        }
    }
});


// --- Server Start ---
app.listen(3000, () => {
  console.log("Server running at port 3000");
});
