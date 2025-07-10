// app.js
require("dotenv").config(); // Load environment variables from .env file - MUST be at the very top

const express = require("express");
const axios = require("axios"); // For making HTTP requests to TMDB
const path = require("path"); // For handling file paths
const cookieParser = require("cookie-parser"); // For handling cookies

// Initialize Express app
const app = express();

// Database connection (assuming connectToDB is defined in ./config/db)
// If you have a db.js file for MongoDB, keep this line.
// If you are ONLY using Firestore for data, and don't have MongoDB, you can remove these two lines.
// const connectToDB = require("./config/db");
// connectToDB();

// --- Global Middleware ---
// Middleware to parse JSON bodies (for API requests like /search-movies)
app.use(express.json());
// Middleware to parse URL-encoded bodies (for form submissions)
app.use(express.urlencoded({ extended: true }));
// Middleware for cookie parsing
app.use(cookieParser());

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

// --- Firebase Configuration for Frontend ---
let firebaseConfig = {};
try {
  if (process.env.FIREBASE_CONFIG) {
    firebaseConfig = JSON.parse(process.env.FIREBASE_CONFIG);
    console.log(
      "Parsed firebaseConfig in app.js (server-side):",
      firebaseConfig
    );
  } else {
    console.warn(
      "Warning: FIREBASE_CONFIG is not set in your .env file. Firebase may not initialize correctly."
    );
  }
} catch (e) {
  console.error("Error parsing FIREBASE_CONFIG from .env:", e);
  firebaseConfig = {}; // Ensure it's an empty object if parsing fails
}

// Middleware to inject firebaseConfig and Canvas globals into all EJS responses
app.use((req, res, next) => {
  res.locals.firebaseConfig = JSON.stringify(firebaseConfig);
  res.locals.__app_id =
    typeof __app_id !== "undefined" ? __app_id : "default-app-id";
  res.locals.__initial_auth_token =
    typeof __initial_auth_token !== "undefined" ? __initial_auth_token : null;
  next();
});

// --- EJS Page Routes (to render your templates) ---
// These routes directly render the EJS files.
// Ensure these paths match what your frontend links are expecting.

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

// User Watchlist Page
app.get("/user/list", (req, res) => {
  res.render("list");
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
  res.render("profile"); // Renders the new profile.ejs file
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
        : "/images/your_logo_filename.png",
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
        : "/images/your_logo_filename.png",
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

// --- Server Start ---
app.listen(3000, () => {
  console.log("Server running at port 3000");
});
