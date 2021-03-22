const express = require('express')
const router = express.Router()
const user = require('../controllers/users')

router.post("/", user.createUser)
router.get("/:id", user.getUserData)
router.put("/:id", user.updateUserData)

router.post("/login", user.login)
router.post("/forgot-password", user.sendEmailForgotPassword)
router.post("/reset-password", user.resetPassword)

module.exports = router;