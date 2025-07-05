const express = require("express");
const app = express();
const userRouter = require("./routes/user.routes");
const router = require("./routes/user.routes");
const indexRouter = require("./routes/index.routes");
const cookieParser = require("cookie-parser");
const dotenv = require("dotenv");
dotenv.config();
const connectToDB = require("./config/db");
connectToDB();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.set("view engine", "ejs");
app.use("/", indexRouter);
app.use("/user", userRouter);
app.use(cookieParser());
app.listen(3000, () => {
  console.log("Server runnig at port 3000");
});
