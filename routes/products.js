const express = require("express");
const router = express.Router();
const multer = require('multer')

const product = require("../controllers/products");
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "data/");
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

router.get("/", product.getProducts)
router.get("/:pid", product.getSingleProduct)

router.post("/images/tmp",
  upload.fields([{ name: "imgData", maxCount: 1}]),
  product.createTMPImage
)
router.post("/", product.createProduct)
router.put("/:id", product.updateProduct)

module.exports = router