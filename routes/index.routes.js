const express = require("express");
const router = express.Router();

router.get("/home", (req, res) => {
  res.render("home");
});

router.get("/about", (req, res) => {
  res.render("about");
});
router.get("/contact", (req, res) => {
  res.render("contact");
});
router.get("/faq", (req,res)=>{
  res.render("faq")
})










////////////////////////////////
router.get('/search', async (req, res) => {
  const searchTerm = req.query.q || '';
  try {
    if (!searchTerm) {
      return res.render('movies', { movies: [], searchTerm, error: null });
    }

    const response = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchTerm)}`);
    const data = await response.json();
    const movies = data.results || [];

    res.render('movies', { movies, searchTerm, error: null });
  } catch (error) {
    console.error(error);
    res.render('search', { movies: null, searchTerm, error: 'Error fetching movies' });
  }
});








module.exports = router;
