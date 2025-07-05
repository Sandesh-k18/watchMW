const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minLength: [4, "Username must consist atleast 3 letters !!!"],
    lowercase: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minLength: [10, "Email must  !!!"],
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minLength: [8, "Password must consist atleast 8 characters !!!"],
    // lowercase: true,
  },
});
const user = mongoose.model("user", userSchema);
module.exports = user;
