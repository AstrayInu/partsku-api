const express = require('express')
const router = express.Router()
const public = require('../controllers/public')

// router.post("/add-admin", public.addAdmin);
router.post('/send-email', public.sendEmail)

module.exports = router;