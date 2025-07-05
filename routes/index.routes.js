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
router.get("/movies", (req, res) => {
  res.render("movies");
});
router.get("/anime", (req, res) => {
  res.render("anime");
});
router.get("/series", (req, res) => {
  res.render("series");
});


module.exports = router;
