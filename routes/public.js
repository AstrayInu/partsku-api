const express = require('express')
const router = express.Router()
const public = require('../controllers/public')

router.post("/add", public.add);

module.exports = router;