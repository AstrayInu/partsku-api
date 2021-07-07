const db = require('../utils/db')
const _ = require("lodash")
const { cloudinary } = require("../utils/cloudinary")

exports.getTransaction = async (req, res) => {
  try {
    let sql = `SELECT DISTINCT transaction_id, total_price, created_at, trf_proof FROM transaction_log WHERE`

    if(req.query.tid) {
      let { tid } = req.query
        , singleData = await db.execute(db.partsku, `SELECT * FROM transaction_log WHERE status = 0 AND transaction_id = ?`, tid)

      res.json({msg: 'Data found!', singleData})
    } else if(req.query.uid) {
      let sql1 = `SELECT DISTINCT transaction_id, total_price, status, approval, created_at, trf_proof FROM transaction_log`
        , pending = await db.execute(db.partsku, `${sql1} WHERE uid = ${req.query.uid}`)

      res.json(pending)
    } else {
      let pending = await db.execute(db.partsku, `${sql} STATUS = 1 AND approval = 0`)
        , approved = await db.execute(db.partsku, `${sql} approval = 1`)

        res.json({pending, approved})
    }
  } catch (error) {
    console.log(error)
    res.status(500).json("Something went wrong :( Please contact our dev team")
  }
}

exports.newTransaction = async (req, res) => {
  try {
    let body = req.body
      , input = {transaction_id: body.transaction_id, total_price: body.total_price, uid: body.uid, type: 'BCA', status: 0, approval: 0, trf_proof: '', shipment_status: 0}
    // console.log("data",body.cartData)

    for(let x of body.cartData.data) {
      console.log(x)
      input.pid = x.pid
      input.quantity = x.quantity
      await db.execute(db.partsku, `INSERT INTO transaction_log SET ?`, input).catch(e => {
        console.log('DB CATCH', e)
        res.status(500).json(e)
      })
      db.execute(db.partsku, `DELETE FROM cart WHERE uid = ${body.uid}`).catch(e => {
        console.log('DB CATCH 2', e)
        res.status(500).json(e)
      })
    }

    res.json("Transaksi telah diterima!\nSilahkan upload bukti pembayaran di halaman berikutnya")
  } catch (e) {
    console.log('CATCH', e)
    res.status(500).json("Whoops something went wrong back there :(")
  }
}

exports.setApproval = (req, res) => {
  try {
    let data = req.body

    db.execute(db.partsku, `UPDATE transaction_log SET ? WHERE transaction_id = '${data.transaction_id}'`, data).then(result => {
      res.json("Transaction updated!")
    }).catch(e => {
      console.log('DB CATCH', e)
      res.status(500).json("Whoops something went wrong back there :(")
    })
  } catch (e) {
    console.log('CATCH', e)
    res.status(500).json("Whoops something went wrong back there :(")
  }
}

exports.uploadProof = async (req, res) => {
  try {
    let { imgData, tid } = req.body
      , check = await db.execute(db.partsku, `SELECT trf_proof FROM transaction_log WHERE transaction_id = "${tid}"`)
      , check2 = true
    for(let x of check) {
      if(x.trf_proof.length > 0) return false
    }
    // console.log("HUWIH")
    if(!check2) res.json('You have uploaded your proof, please wait until you proof is approved by the admin')// udh isi
    else { // blm ad isi
      let cloudinaryResponse = await cloudinary.uploader.upload(imgData, {
        upload_preset: 'proof_default'
      })
      // console.log(cloudinaryResponse);
      if(cloudinaryResponse.url) {
        let upload = {
          trf_proof: cloudinaryResponse.url,
          status: 1
        }
        db.execute(db.partsku, `UPDATE transaction_log SET ? WHERE transaction_id = ?`, [upload, tid]).then(response => {
          console.log(response)
          res.json({msg: 'Success upload proof. Please wait for admin to check validity', url: cloudinaryResponse.url})
        }).catch(e => {
          console.log("DB catch", e)
          res.json(e);
        })
      } else res.status(500).json("Error")
    }
  } catch (e) {
    console.log('e', e)
    res.status(500).json(e)
  }
}