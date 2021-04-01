const express = require("express");
const router = express.Router();

const product = require("../controllers/products");

router.get("/", product.getProducts)
router.get("/:id", product.getProducts)

module.exports = router