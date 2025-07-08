// app.js
require('dotenv').config(); // Load environment variables from .env file (should be at the very top)

const express = require("express");
const axios = require('axios'); // For making HTTP requests to TMDB
const path = require('path');   // For handling file paths
const cookieParser = require("cookie-parser"); // Assuming you use this for user sessions/auth

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
// Make sure you have a 'public' directory in your project root
// and your logo file inside 'public/images/your_logo_filename.png'
app.use(express.static('public'))
app.use(express.static(path.join(__dirname, 'public')));


// --- EJS View Engine Setup ---
app.set("view engine", "ejs");
app.set('views', path.join(__dirname, 'views')); // Correctly set the views directory


// --- TMDB API Configuration ---
const TMDB_API_KEY = process.env.TMDB_API_KEY; // Get API key from environment variables
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE_URL = 'https://image.tmdb.org/t/p/w500'; // Base URL for movie posters

// Check if TMDB API key is loaded
if (!TMDB_API_KEY) {
    console.error('Error: TMDB_API_KEY is not set in your .env file.');
    // In a production app, you might want a more graceful error handling than process.exit(1);
    process.exit(1);
}


// --- Routes from your project structure ---
// Assuming these routers handle other parts of your application
const userRouter = require("./routes/user.routes");
const indexRouter = require("./routes/index.routes"); // Note: 'router' was also used, consolidated to indexRouter

app.use("/", indexRouter);
app.use("/user", userRouter);


// --- EJS Page Routes (to render your templates) ---

// Home Page
app.get("/", (req, res) => {
  res.render("home");
});

// Movie Search Page (to render search.ejs)
app.get('/search', (req, res) => {
    res.render('search', { movies: [] }); // Render search.ejs with an empty movies array initially
});

// Movie Details Page (to render search_details.ejs)
app.get('/movie/:id', (req, res) => {
    const movieId = req.params.id;
    res.render('search_details', { movieId: movieId }); // Pass the movie ID to the EJS template
});

// Example placeholder routes for other EJS pages if they exist
// app.get('/list', (req, res) => { res.render('list'); });
// app.get('/about', (req, res) => { res.render('about'); });
// app.get('/contact', (req, res) => { res.render('contact'); });
// app.get('/faq', (req, res) => { res.render('faq'); });
// app.get('/login', (req, res) => { res.render('login'); });
// app.get('/register', (req, res) => { res.render('register'); });


// --- API Endpoints ---

// API Endpoint to Search for Movies (Fixed: Changed from '/search' to '/search-movies' to match frontend)
app.post('/search-movies', async (req, res) => { // Renamed this route
    const query = req.body.query; // Get the movie query from the request body

    if (!query) {
        return res.status(400).json({ error: 'Movie query is required.' });
    }

    try {
        const response = await axios.get(`${TMDB_BASE_URL}/search/movie`, { // Corrected TMDB endpoint path
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
            poster_path: movie.poster_path ? `${TMDB_IMAGE_BASE_URL}${movie.poster_path}` : '/images/default.png', // Fallback to your custom logo
            release_date: movie.release_date,
            vote_average: movie.vote_average
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

// API Endpoint to Get Detailed Movie Information
app.get('/api/movie-details/:id', async (req, res) => {
    const movieId = req.params.id;

    if (!movieId) {
        return res.status(400).json({ error: 'Movie ID is required.' });
    }

    try {
        // Fetch movie details and append credits in a single request for efficiency
        const response = await axios.get(`${TMDB_BASE_URL}/movie/${movieId}`, {
            params: {
                api_key: TMDB_API_KEY,
                append_to_response: 'credits' // Request credits (cast and crew) along with details
            }
        });

        const movieData = response.data;

        // Extract director(s)
        const directors = movieData.credits.crew
            .filter(crewMember => crewMember.job === 'Director')
            .map(director => director.name);

        // Extract top 5 cast members (or fewer if less than 5)
        const cast = movieData.credits.cast
            .sort((a, b) => a.order - b.order) // Sort by billing order
            .slice(0, 5) // Take top 5
            .map(actor => ({
                name: actor.name,
                character: actor.character,
                profile_path: actor.profile_path ? `${TMDB_IMAGE_BASE_URL}${actor.profile_path}` : null // Actor image
            }));

        // Prepare the detailed movie object for the frontend
        const detailedMovie = {
            id: movieData.id,
            title: movieData.title,
            overview: movieData.overview,
            poster_path: movieData.poster_path ? `${TMDB_IMAGE_BASE_URL}${movieData.poster_path}` : '/images/your_logo_filename.png',
            backdrop_path: movieData.backdrop_path ? `${TMDB_IMAGE_BASE_URL}${movieData.backdrop_path}` : null,
            release_date: movieData.release_date,
            vote_average: movieData.vote_average,
            runtime: movieData.runtime, // Movie runtime in minutes
            genres: movieData.genres.map(genre => genre.name), // Array of genre names
            directors: directors,
            cast: cast,
            tagline: movieData.tagline // Often a short, catchy phrase
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
