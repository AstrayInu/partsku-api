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
        // , tidList = await db.execute(db.partsku, `SELECT DISTINCT transaction_id FROM transaction_log WHERE uid = ${req.query.uid} AND NOT shipment_status = 3 ORDER BY created_at DESC`)
        // , tidList_done = await db.execute(db.partsku, `SELECT DISTINCT transaction_id FROM transaction_log WHERE uid = ${req.query.uid} AND shipment_status = 3 ORDER BY created_at DESC`)
        // , sellerList = await db.execute(db.partsku, `SELECT DISTINCT s.sid, s.attributes ->> '$.shop_name' as shop_name FROM transaction_log t
        //     INNER JOIN products p ON t.pid = p.pid
        //     INNER JOIN sellers s ON s.sid = p.sid
        //     WHERE t.uid = ${req.query.uid} AND NOT shipment_status = 3`)
        // , sellerList_done = await db.execute(db.partsku, `SELECT DISTINCT s.sid, s.attributes ->> '$.shop_name' as shop_name FROM transaction_log t
        //     INNER JOIN products p ON t.pid = p.pid
        //     INNER JOIN sellers s ON s.sid = p.sid
        //     WHERE t.uid = ${req.query.uid} AND shipment_status = 3`)
        // , status = await db.execute(db.partsku, `SELECT DISTINCT transaction_id AS tid, p.sid, t.status, approval, shipment_status, trf_proof FROM transaction_log t
        //     INNER JOIN products p ON t.pid = p.pid
        //     WHERE t.uid = ${req.query.uid} AND NOT shipment_status = 3`)
        // , status_done = await db.execute(db.partsku, `SELECT DISTINCT transaction_id AS tid, p.sid, t.status, approval, shipment_status, trf_proof FROM transaction_log t
        //     INNER JOIN products p ON t.pid = p.pid
        //     WHERE t.uid = ${req.query.uid} AND shipment_status = 3`)
        // , final = []
        // , final_done = []

      pending.forEach(x => {
        x.attr = JSON.parse(x.attr)
        x.imgUrl = x.attr.imgUrl[0]
        delete x.attr
      });
      // tidList.forEach(tids => final.push({tid: tids.transaction_id}))
      // final.forEach(x => x.data = sellerList)
      // final.forEach(x => {
      //   x.data.forEach(seller => {
      //     if(!seller.data) seller.data = []
      //     pending.forEach(async pend => {
      //       delete pend.id
      //       delete pend.type
      //       if(String(pend.transaction_id) === String(x.tid) && pend.sid === seller.sid) {
      //         await seller.data.push(pend)
      //       }
      //     })
      //   })
      // })

      done.forEach(x => {
        x.attr = JSON.parse(x.attr)
        x.imgUrl = x.attr.imgUrl[0]
        delete x.attr
      });
      // tidList_done.forEach(tids => final_done.push({tid: tids.transaction_id}))
      // final_done.forEach(x => x.data = sellerList_done)
      // final_done.forEach(x => {
      //   x.data.forEach(seller => {
      //     if(!seller.data) seller.data = []
      //     done.forEach(async pend => {
      //       delete pend.id
      //       delete pend.type
      //       if(pend.transaction_id === x.tid && pend.sid === seller.sid) {
      //         await seller.data.push(pend)
      //       }
      //     })
      //   })
      // })

      // res.json({tidList_done, final_done, final, status, status_done, pending, final, tidList})
      res.json({pending, done})
    } else if(req.query.sid) {
      let tidList = await db.execute(db.partsku, `SELECT DISTINCT transaction_id AS tid FROM transaction_log t
            INNER JOIN products p ON p.pid = t.pid
            INNER JOIN sellers s ON s.sid = p.sid
            WHERE s.sid = ${req.query.sid} AND t.approval = 1`)
        , userList = await db.execute(db.partsku, `SELECT DISTINCT u.attributes->>'$.name' AS name, t.uid, u.attributes AS attr, u.phone_number FROM transaction_log t
            INNER JOIN products p ON p.pid = t.pid
            INNER JOIN sellers s ON s.sid = p.sid
            INNER JOIN users u ON u.uid = t.uid
            WHERE s.sid = ${req.query.sid} AND t.approval = 1`)
        , pending = await db.execute(db.partsku, `SELECT t.*, p.attributes AS attr, p.name, p.sku FROM transaction_log t
            INNER JOIN products p ON p.pid = t.pid
            INNER JOIN sellers s ON s.sid = p.sid
            INNER JOIN users u ON u.uid = t.uid
            WHERE s.sid = ${req.query.sid} AND t.approval = 1`)
        , status = await db.execute(db.partsku, `SELECT DISTINCT transaction_id AS tid, t.status, t.approval, trf_proof, t.shipment_status FROM transaction_log t
            INNER JOIN products p ON p.pid = t.pid
            INNER JOIN sellers s ON s.sid = p.sid
            WHERE s.sid =  ${req.query.sid} AND t.approval = 1`)

        pending.forEach(x => {
          x.attr = JSON.parse(x.attr)
          x.imgUrl = x.attr.imgUrl[0]
          delete x.attr
        });

        userList.forEach(x => {
          x.attr = JSON.parse(x.attr)
          delete x.attr.imgUrl
          delete x.attr.dob
          delete x.attr.phone_number
        })

        res.json({tidList, userList, pending, status})
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
    // console.log("data",body.cartData)

    for(let x of body.cartData.data) {
      console.log(x)
      input.pid = x.pid
      input.sid = x.sid
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

exports.setApproval = async (req, res) => {
  try {
    let data = req.body
      , sql = `UPDATE transaction_log SET ? WHERE transaction_id = '${data.transaction_id}'`

    if(data.sid) {
      let pids = await db.execute(db.partsku, `SELECT DISTINCT t.pid FROM transaction_log t INNER JOIN products p ON p.pid = t.pid WHERE p.sid = ${data.sid} AND t.transaction_id = '${data.transaction_id}'`)

      for(let x of pids) {
        sql += ` AND pid = ${x.pid}`
      }
      delete data.sid
    }
    // console.log(sql)
    db.execute(db.partsku, sql, data).then(result => {
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