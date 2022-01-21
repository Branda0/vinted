require("dotenv").config();
const express = require("express");
const formidable = require("express-formidable");
const mongoose = require("mongoose");
const cors = require("cors");

const app = express();
app.use(cors());
app.use(formidable());

mongoose.connect(process.env.MONGODB_URI);

//LOCAL DB HOST
//mongoose.connect("mongodb://localhost/vinted");

const usersRoutes = require("./routes/users");
app.use(usersRoutes);

const offerRoutes = require("./routes/offers");
app.use(offerRoutes);

app.all("*", (req, res) => {
  res.status(404).json("Page not Found");
});

app.listen(process.env.PORT, () => {
  console.log("Server started 🚀");
});
