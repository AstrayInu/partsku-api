const express = require('express')
const router = express.Router()
const multer = require('multer')
const seller = require('../controllers/sellers')

router.get("/", seller.getSellers)
router.get("/:sid", seller.getSellerData)
router.post("/", seller.createSeller)
router.put("/:sid", seller.updateSeller)
router.get("/check-seller-status/:uid", seller.getSellerStatus)
router.post("/approve-seller", seller.approveSeller)
router.post("/profile-picture", seller.storePicture)

module.exports = router;