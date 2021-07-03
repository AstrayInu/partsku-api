const express = require('express')
const router = express.Router()
const public = require('../controllers/public')

// router.post("/add-admin", public.addAdmin);
router.post('/send-email', public.sendEmail)
router.get('/', public.testGetAPI)


router.get("/get-brands", public.getBrands)
router.get("/get-category", public.getCategory)
module.exports = router;