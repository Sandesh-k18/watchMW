const express = require("express");
const app = express();
const userRouter = require("./routes/user.routes");
const router = require("./routes/index.routes");
const indexRouter = require("./routes/index.routes");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const connectToDB = require("./config/db");
connectToDB();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//useless sala --> app.use(express.static('public')); //// serve static files like css, js

app.use('/public', express.static('public'));




app.set("view engine", "ejs");
app.set('views', __dirname + '/views'); // adjust if needed



app.use("/", indexRouter);
app.use("/user", userRouter);



app.get("/", (req, res) => {
  res.render("home");
});









app.use(cookieParser());
app.listen(3000, () => {
  console.log("Server runnig at port 3000");
});
