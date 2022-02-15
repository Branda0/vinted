const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

const uid2 = require("uid2");
const SHA256 = require("crypto-js/sha256");
const encBase64 = require("crypto-js/enc-base64");

const User = require("../models/User");
const Offer = require("../models/Offer");

// SIGNUP -> Create USER -> has password -> give token
router.post("/user/signup", async (req, res) => {
  //CHECK IF USER ALREADY EXISTS -> MAIL IS UNIQUE
  try {
    if (await User.findOne({ email: req.fields.email })) {
      res.status(400).json({ error: { message: "This email is already associated with an account" } });
    } else if (!req.fields.email || req.fields.email === "") {
      res.status(400).json({
        error: { message: "Valid Email is needed for account creation" },
      });
    } else {
      const salt = uid2(64);

      const newUser = new User({
        email: req.fields.email,
        account: {
          username: req.fields.username,
          phone: req.fields.phone,
          //avatar: ajouté après création de l'objet,
        },
        token: uid2(64),
        salt: salt,
        hash: SHA256(req.fields.password + salt).toString(encBase64),
      });

      await newUser.save();
      const imageUploaded = await cloudinary.uploader.upload(req.files.avatar.path, {
        folder: "/vinted/users",
        public_id: newUser._id,
      });
      newUser.account.avatar = imageUploaded;
      await newUser.save();

      res.status(200).json({
        _id: newUser._id,
        token: newUser.token,
        account: {
          username: newUser.username,
          phone: newUser.phone,
          avatar: {
            secure_url: newUser.account.avatar.secure_url,
            original_filename: newUser.account.avatar.original_filename,
          },
        },
      });
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

// LOGIN - > CHECK TOKKEN
router.post("/user/login", async (req, res) => {
  try {
    const user = await User.findOne({ email: req.fields.email });
    if (user) {
      if (SHA256(req.fields.password + user.salt).toString(encBase64) === user.hash) {
        const userFiltered = (({ _id, token, account }) => ({
          _id,
          token,
          account,
        }))(user);
        res.status(200).json({
          _id: user._id,
          token: user.token,
          account: {
            username: user.username,
            phone: user.phone,
            avatar: {
              secure_url: user.account.avatar.secure_url,
              original_filename: user.account.avatar.original_filename,
            },
          },
        });
        console.log(`${user.email} just logged in`);
      } else {
        res.status(400).json({ message: "User not found" });
      }
    } else {
      res.status(400).json({ message: "User not found" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
