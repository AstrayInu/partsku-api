const db = require('../utils/db')
const _ = require("lodash")
const { cloudinary } = require("../utils/cloudinary")

exports.getTransaction = async (req, res) => {
  try {
    let all = `SELECT * FROM transaction_log WHERE`
      , admin = `SELECT DISTINCT transaction_id, total_price, status, approval, shipment_status, trf_proof FROM transaction_log WHERE`

    if(req.query.tid) { // get single transaction
      let singleData = await db.execute(db.partsku, `${all} status = 0 AND transaction_id = ?`, req.query.tid)

      res.json({msg: 'Data found!', singleData})
    } else if(req.query.uid) { // get users transaction
      let pending = await db.execute(db.partsku, `SELECT t.*, p.name, p.attributes AS attr, p.price, s.sid, s.attributes->>'$.shop_name' AS shop_name FROM transaction_log t
            INNER JOIN products p ON t.pid = p.pid
            INNER JOIN sellers s ON s.sid = p.sid
            WHERE t.uid = ${req.query.uid} AND NOT shipment_status = 3 ORDER BY t.created_at DESC`)
        , done = await db.execute(db.partsku, `SELECT t.*, p.name, p.attributes AS attr, p.price, s.sid, s.attributes->>'$.shop_name' AS shop_name FROM transaction_log t
            INNER JOIN products p ON t.pid = p.pid
            INNER JOIN sellers s ON s.sid = p.sid
            WHERE t.uid = ${req.query.uid} AND shipment_status = 3 ORDER BY t.created_at DESC`)

      pending.forEach(x => {
        x.attr = JSON.parse(x.attr)
        x.imgUrl = x.attr.imgUrl[0]
        delete x.attr
      });

      done.forEach(x => {
        x.attr = JSON.parse(x.attr)
        x.imgUrl = x.attr.imgUrl[0]
        delete x.attr
      });

      res.json({pending, done})
    } else if(req.query.sid) {

      let pending = await db.execute(db.partsku, `SELECT t.*, p.name, p.attributes AS pattr, p.price, u.phone_number, u.attributes AS uattr FROM transaction_log t
            INNER JOIN products p ON t.pid = p.pid
            INNER JOIN sellers s ON s.sid = p.sid
            INNER JOIN users u ON u.uid = t.uid
            WHERE s.sid = ${req.query.sid} AND t.approval = 1 AND NOT shipment_status = 3 ORDER BY t.created_at DESC`)
        , done = await db.execute(db.partsku, `SELECT t.*, p.name, p.attributes AS pattr, p.price, u.phone_number, u.attributes AS uattr FROM transaction_log t
            INNER JOIN products p ON t.pid = p.pid
            INNER JOIN sellers s ON s.sid = p.sid
            INNER JOIN users u ON u.uid = t.uid
            WHERE s.sid = ${req.query.sid} AND shipment_status = 3 ORDER BY t.created_at DESC`)

        pending.forEach(x => {
          x.pattr = JSON.parse(x.pattr)
          x.uattr = JSON.parse(x.uattr)
          x.imgUrl = x.pattr.imgUrl[0]
          delete x.pattr
        });
        done.forEach(x => {
          x.pattr = JSON.parse(x.pattr)
          x.uattr = JSON.parse(x.uattr)
          x.imgUrl = x.pattr.imgUrl[0]
          delete x.pattr
        });

        res.json({pending, done})
    } else { // get All (admin)
      let pending = await db.execute(db.partsku, `${admin} STATUS = 1 AND approval = 0`)
      , approved = await db.execute(db.partsku, `${admin} approval = 1`)

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
    // console.log("data",body)

    if(body.buynow) {
      let data = body.cartData
        , d = new Date()
      input.pid = data.pid
      input.sid = data.sid
      input.quantity = data.quantity

      db.execute(db.partsku, `INSERT INTO transaction_log SET ?`, input).catch(e => {
        console.log('DB CATCH', e)
        res.status(500).json(e)
      })
      db.execute(db.partsku, `DELETE FROM cart WHERE uid = ${body.uid}`).catch(e => {
        console.log('DB CATCH 2', e)
        res.status(500).json(e)
      })
    } else {
      for(let x of body.cartData.data) {
        // console.log(x)
        input.pid = x.pid
        input.sid = x.sid
        input.quantity = x.quantity
        await db.execute(db.partsku, `INSERT INTO transaction_log SET ?`, input).catch(e => {
          console.log('DB CATCH', e)
          res.status(500).json(e)
        })
        await db.execute(db.partsku, `DELETE FROM cart WHERE uid = ${body.uid}`).catch(e => {
          console.log('DB CATCH 2', e)
          res.status(500).json(e)
        })
      }      
    }

    res.json("Transaksi telah diterima!\nSilahkan upload bukti pembayaran di halaman berikutnya")
  } catch (e) {
    console.log('CATCH ==============', e)
    res.status(500).json("Whoops something went wrong back there :(")
  }
}

exports.setApproval = async (req, res) => {
  try {
    let data = req.body
      , quantity = data.quantity
      , pid = data.pid
      , sql = `UPDATE transaction_log SET ? WHERE transaction_id = '${data.transaction_id}'`
      , join = ''
      , cont
    console.log(data)
    delete data.quantity
    if(data.sid) {
      let pids = await db.execute(db.partsku, `SELECT DISTINCT t.pid FROM transaction_log t INNER JOIN products p ON p.pid = t.pid WHERE p.sid = ${data.sid} AND t.transaction_id = '${data.transaction_id}'`)

      for(let x of pids) {
        join += `${x.pid} `
      }
      cont = join.trim().split(' ').join()
      sql += `AND pid IN (${cont})`
      delete data.sid
    }
    // console.log(sql)
    // console.log(cont)
    db.execute(db.partsku, sql, data).then(async result => {
      if(data.shipment_status == 1) {
        await db.execute(db.partsku, `UPDATE products SET stock = stock - ${quantity}, sold = sold + ${quantity} WHERE pid = ${pid}`)
      }
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