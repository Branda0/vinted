require("dotenv").config();
const express = require("express");
const formidable = require("express-formidable");
const mongoose = require("mongoose");
const cors = require("cors");
const cloudinary = require("cloudinary").v2;

const app = express();
app.use(cors());
app.use(formidable());

mongoose.connect(process.env.MONGODB_URI);

//Cloudinary parameters
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//LOCAL DB HOST
// mongoose.connect("mongodb://localhost/vinted");

const usersRoutes = require("./routes/users");
app.use(usersRoutes);

const offerRoutes = require("./routes/offers");
app.use(offerRoutes);

const paymentRoutes = require("./routes/payments");
app.use(paymentRoutes);

app.all("*", (req, res) => {
  res.status(404).json("Page not Found");
});

app.listen(process.env.PORT, () => {
  console.log("Server started 🚀");
});
