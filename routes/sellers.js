const express = require('express')
const router = express.Router()
const multer = require('multer')
const seller = require('../controllers/sellers')

router.get("/", seller.getSellers)
router.get("/:sid", seller.getSellerData)
router.get("/:uid", seller.getSellerDataUID)
router.post("/", seller.createSeller)
router.post("/approve-seller", seller.approveSeller)
router.post("/profile-picture", seller.storePicture)

module.exports = router;