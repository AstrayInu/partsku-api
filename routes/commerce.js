const express = require('express')
const router = express.Router()
const commerce = require('../controllers/commerce')

router.get("/transaction", commerce.getTransaction)
router.post("/transaction/new", commerce.newTransaction)
router.put("/transaction/update", commerce.setApproval)

router.put("/transaction/upload-proof", commerce.uploadProof)


module.exports = router;