const express = require('express')
const router = express.Router()
const multer = require('multer')
const user = require('../controllers/users')
const storage = multer.diskStorage({
  destination: function(req, file, cb) {
    cb(null, "data/");
  },
  filename: function(req, file, cb) {
    cb(null, file.originalname);
  }
});
const upload = multer({ storage: storage });

router.post("/", user.createUser)
router.get("/:id", user.getUserData)
router.get("/checkUser", user.checkUser)
router.put("/:id", user.updateUserData)
// router.post("/profilePicture", 
//   upload.fields([{ name: "imgData", maxCount: 1}]), 
//   user.profilePicture
// );
router.post("/profilePicture", user.profilePicture)

router.post("/login", user.login)
router.post("/logout", user.logout)
router.post("/forgot-password", user.sendEmailForgotPassword)
router.post("/reset-password", user.resetPassword)

router.get("/cart/:id", user.getCartData)
router.post("/cart/add", user.updateCart)
router.delete("/cart/delete", user.deleteCartItem)

module.exports = router;