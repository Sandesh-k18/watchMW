const express = require("express");
const router = express.Router();

router.get("/", (req, res) => {
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
router.get("/list", (req,res)=>{
  res.render("list")
})

router.get("/search", (req, res) => {
  res.render("search");
});







////////////////////////////////









module.exports = router;
