const express = require("express");
const { body, validationResult } = require("express-validator");
const router = express.Router();
const userModel = require("../models/user.models");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

router.get("/test", (req, res) => {
  res.send("User Route1");
});

router.get("/register", (req, res) => {
  res.render("register");
});
router.post(
  "/register",
  body("email").trim().isEmail().isLength({ min: 10 }),
  body("username").trim().isLength({ min: 4 }),
  body("password").trim().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
      return res.status(400).json({
        errors: errors.array(),
        message: "Invalid Data",
      });
    }

    const { email, username, password } = req.body;
    const hashPassword = await bcrypt.hash(password, 10);
    const newUser = await userModel.create({
      email,
      username,
      password: hashPassword,
    });
    res.json(newUser);
  }
);
router.get("/login", (rew, res) => {
  res.render("login");
});
router.post(
  "/login",
  body("username").trim().isLength({ min: 4 }),
  body("password").trim().isLength({ min: 8 }),
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        error: errors.array(),
        message: "Invalid Data",
      });
    }
    const { username, password } = req.body;
    const user = await userModel.findOne({
      username: username,
    });
    if (!user) {
      return res.status(400).json({
        message: "Username or Password is wrong",
      });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({
        message: "Username or Password is wrong",
      });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        email: user.email,
        username: user.username,
      },
      process.env.JWT_SECRET
    );
    console.log(req.body);
    res.cookie("token", token);
    res.send("Logged in");
  }
);

module.exports = router;
