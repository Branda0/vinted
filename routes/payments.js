const express = require("express");
const formidable = require("express-formidable");
const router = express.Router();
const createStripe = require("stripe");

router.use(formidable);

const stripe = createStripe(process.env.STRIPE_API_SECRET);

router.post("/payment", async (req, res) => {
  try {
    const { status } = await stripe.charges.create({
      source: req.fields.token,
      amount: (req.fields.amount * 100).toFixed(0),
      description: `paiement pour l'article vinted : ${req.fields.title}`,
      currency: "eur",
    });
    res.status(200).json({ status });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

module.exports = router;
