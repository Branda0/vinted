const express = require("express");
const router = express.Router();
const cloudinary = require("cloudinary").v2;

const User = require("../models/User");
const Offer = require("../models/Offer");

//Parametrage cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// AUTHENTIFICATION FUNCTION USED FOR ROUTES THAT REQUIRE A VALIDE TOKEN
const isAuthenticated = async (req, res, next) => {
  try {
    //Check in DB if a USER exists with the TOKEN given by client
    if (req.headers.authorization) {
      const userByToken = await User.findOne({ token: req.headers.authorization.replace("Bearer ", "") });
      if (userByToken) {
        req.tokenUser = userByToken;
        next();
      } else {
        res.status(401).json({ error: "Unauthorized access, you have to be logged in to acces this page" });
      }
    } else {
      res.status(401).json({ error: "Unauthorized access, you have to be logged in to acces this page" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

//OFFER PUBLISH ROUTE
router.post("/offer/publish", isAuthenticated, async (req, res) => {
  try {
    if (req.fields.price > 100000 || req.fields < 0)
      return res.status(400).json({
        error: { message: "Invalid price, must be set beetween 0€ - 100.000€" },
      });
    if (req.fields.title.length > 50)
      return res.status(400).json({
        error: { message: "Invalid title, 50 characters maximum" },
      });
    if (req.fields.description.length > 500)
      return res.status(400).json({
        error: { message: "Invalid description, 50 characters maximum" },
      });

    const newOffer = new Offer({
      product_name: req.fields.title,
      product_description: req.fields.description,
      product_price: req.fields.price,
      product_details: [
        { MARQUE: req.fields.brand },
        { TAILLE: req.fields.size },
        { ÉTAT: req.fields.condition },
        { COULEUR: req.fields.color },
        { EMPLACEMENT: req.fields.city },
      ],
      owner: req.tokenUser,
    });

    await newOffer.save();

    if (req.files.picture) {
      const imageUploaded = await cloudinary.uploader.upload(req.files.picture.path, {
        folder: "/vinted/offers",
        public_id: newOffer._id,
      });
      newOffer.product_image = imageUploaded;
      await newOffer.save();
    }
    res.status(200).json({
      _id: newOffer._id,
      product_name: newOffer.product_name,
      product_description: newOffer.product_description,
      product_price: newOffer.product_price,
      product_details: newOffer.product_details,
      owner: {
        account: {
          username: req.tokenUser.account.username,
          phone: req.tokenUser.account.phone,
          avatar: {
            secure_url: req.tokenUser.account.avatar.secure_url,
            original_filename: req.tokenUser.account.avatar.original_filename,
          },
        },
        _id: req.tokenUser._id,
      },
      product_image: {
        secure_url: newOffer.product_image.secure_url,
        original_filename: newOffer.product_image.original_filename,
      },
    });
  } catch (error) {
    res.status(400).json(error.message);
  }
});

//DELETE AN OFFER AND THE IMAGE ASSOCIATED ON DB
router.delete("/offers/delete", isAuthenticated, async (req, res) => {
  try {
    const offerToDelete = await Offer.findById(req.query.id).populate("owner");
    //const offerToDelete = await Offer.findById(req.query.id);

    // CHECK IF AN OFFER WITH THE QUERY ID EXISTS IN DB
    if (offerToDelete) {
      //CHECK IF USER OWNS THE OFFER TO DELETE
      if (req.tokenUser.id === offerToDelete.owner.id) {
        //if (req.tokenUser.id === offerToDelete.owner.toString());

        //DELETE IMAGE ON CLOUDINARY THEN DELETE OFFER ON DB
        await cloudinary.api.delete_resources_by_prefix(`vinted/offers/${req.query.id}`);
        await Offer.deleteOne({ _id: req.query.id });
        res.status(200).json({ message: "Offer successfuly deleted" });
      } else {
        res.status(401).json({
          error: { message: "Acces denied, Invalid Offer" },
        });
      }
    } else {
      res.status(401).json({
        error: { message: "Acces denied, Invalid Offer" },
      });
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

//MODIFY AND UPDATE AN OFFER
router.put("/offers/modify", isAuthenticated, async (req, res) => {
  try {
    const offerToModify = await Offer.findById(req.query.id).populate("owner");

    //Check if an offer with the query ID exists on DB
    if (offerToModify) {
      //Check if user owns the offer to modify (OFFER OWNER = USER TRYING TO MODIFY)
      if (req.tokenUser.id === offerToModify.owner.id) {
        if (req.fields.title) offerToModify.product_name = req.fields.title;
        if (req.fields.description) offerToModify.product_description = req.fields.description;
        if (req.fields.price) offerToModify.product_price = req.fields.price;
        if (req.files.picture) {
          const imageUploaded = await cloudinary.uploader.upload(req.files.picture.path, {
            folder: "/vinted/offers",
            public_id: req.query.id,
          });
          offerToModify.product_image = imageUploaded;
        }

        if (req.fields.brand) offerToModify.product_details[0].MARQUE = req.fields.brand;
        if (req.fields.size) offerToModify.product_details[1].TAILLE = req.fields.size;
        if (req.fields.condition) offerToModify.product_details[2].ÉTAT = req.fields.condition;
        if (req.fields.color) offerToModify.product_details[3].COULEUR = req.fields.color;
        if (req.fields.city) offerToModify.product_details[4].EMPLACEMENT = req.fields.city;

        offerToModify.markModified("product_details");

        await offerToModify.save();

        res.status(200).json({ message: "Offer successfuly modified" });
      } else {
        res.status(401).json({
          error: { message: "Acces denied Invalid Offer" },
        });
      }
    } else {
      res.status(401).json({
        error: { message: "Acces denied Invalid Offer" },
      });
    }
  } catch (error) {
    res.status(400).json(error.message);
  }
});

//SEARCH ON DB FOR OFFERS
router.get("/offers", async (req, res) => {
  //const filters = req.filters;
  try {
    const find = {};
    if (req.query.title) find.product_name = new RegExp(req.query.title, "i");
    if (req.query.priceMin || req.query.priceMax) {
      const price = {};
      if (req.query.priceMin) price.$gte = req.query.priceMin;
      if (req.query.priceMax) price.$lte = req.query.priceMax;
      find.product_price = price;
    }

    const sort = {};
    if (req.query.sort) {
      if (req.query.sort === "price_desc") {
        sort.product_price = -1;
      } else if (req.query.sort === "price_asc") {
        sort.product_price = 1;
      }
    }

    const limit = req.query.limit ? req.query.limit : 2;
    const page = req.query.page ? req.query.page : 1;

    const offers = await Offer.find(find)
      .sort(sort)
      .limit(limit)
      .skip((page - 1) * limit)
      .populate({
        path: "owner",
        select: "account.username account.phone account.avatar.original_filename account.avatar.secure_url",
      })
      //.select("product_details product_price");
      .select(
        " product_details product_name product_price  product_image.original_filename product_image.secure_url"
      );

    if (offers) {
      const count = await Offer.countDocuments(find);

      res.status(200).json({ count: count, offers: offers });
    } else {
      res.status(400).json({ message: "No offers matching your search filters" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

//GET OFFER DETAILS
router.get("/offer/:id", async (req, res) => {
  try {
    const offer = await Offer.findById(req.params.id)
      .populate({
        path: "owner",
        select: " account.username account.phone account.avatar.original_filename account.avatar.secure_url", //-email -token -hash -salt -_id -__v ",
      })
      .select(
        "product_details product_name product_price product_image.secure_url product_image.original_filename "
      );
    if (offer) {
      res.status(200).json(offer);
    } else {
      res.status(400).json({ error: "Inexistant offer" });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
