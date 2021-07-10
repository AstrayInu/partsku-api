const passwordValidator = require('password-validator')
const _ = require("lodash")
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mv = require('mv')

const db = require('../utils/db')
const encryption = require("../utils/encryption")
const message = require("../utils/message")
const { cloudinary } = require("../utils/cloudinary")
const { response } = require('express')
const secret = process.env.secret

exports.getSellers = async (req, res) => {
  try {
    let q = req.query
      , sql = `SELECT * FROM sellers WHERE 1`
      , where = ``
      , args = []
    console.log(q)
    if(q.admin == 1) {
      let newSellers = await db.execute(db.partsku, `SELECT * FROM sellers WHERE status = 0`)
        , approved = await db.execute(db.partsku, `SELECT * FROM sellers WHERE status = 1`)

      res.json({newSellers , approved})
    }

    res.json(null)
  } catch (e) {
    console.log(e);
  }
}

exports.getSellerData = (req, res) => {
  try {
    let { sid } = req.params

    db.execute(db.partsku, `SELECT * FROM sellers WHERE sid = ?`, sid).then(result => {
      if(result.length > 0) {
        let item = _.reduce(result) // to move actual data from an array casing
        let attr = JSON.parse(item.attributes) // parse string to json so it's readable and accessible
        item.attributes = attr

        // console.log("ITEM",item)
        res.json(item)
      } else {
        res.status(400).json({err: `Seller not found`})
      }
    }).catch(e => {
      console.log("Error",e)
      res.status(400).json({err: e})
    })
  } catch (e) {
    console.log("ErroR", e)
    res.status(400).json({err: e})
  }
}

exports.createSeller = async (req, res) => {
  try {
    let { shopName, waNum, papToko, papKtp, shopAddress, uid } = req.body

    // check if shop name already exists
    let check = await db.execute(db.partsku, `SELECT sid FROM sellers WHERE attributes ->> '$.url' = ?`, shopName)
    if(check.length > 0) res.status(400).json({error: 'Nama toko sudah terdaftar'})

    let checkUid = await db.execute(db.partsku, `SELECT uid FROM sellers WHERE uid = ?`, uid)
    if(checkUid.length > 0) res.status(400).json({error: `Anda sudah terdaftar menjadi seller`})

    let userData = await db.execute(db.partsku, `SELECT * FROM users WHERE uid = ?`, uid)
    if(userData.length > 0) userData = userData[0]
    else res.status(404).json({error: 'Your user data is not found!'})

    let linkToko = shopName.toLowerCase().replace(/\.|\s/g, '-')
    let checkUrl = await db.execute(db.partsku, `SELECT sid FROM sellers WHERE attributes ->> '$.url' = ?`, linkToko)
    if(checkUrl.length > 0) linkToko += '-' + Math.floor(Math.random()*1000)

    let ktpUpload = await cloudinary.uploader.upload(papKtp, {
      upload_preset: 'ktp_default'
    })
    console.log(ktpUpload);
    if(ktpUpload.url) papKtp = ktpUpload.url

    let storePicUpload = await cloudinary.uploader.upload(papToko, {
      upload_preset: 'shop_default'
    })
    console.log(storePicUpload);
    if(storePicUpload.url) papToko = storePicUpload.url

    let attributes = {
      logo: null,
      waNum,
      shop_name: shopName,
      address: shopAddress,
      url: linkToko,
      store_pic: papToko,
      ktp_pic: papKtp
    }

    let setData = {
      email: userData.email,
      uid: uid,
      is_active: 1,
      status: 0,
      attributes: JSON.stringify(attributes),
      created_at: new Date(),
      updated_at: new Date()
    }
    db.execute(db.partsku, `INSERT INTO sellers SET ?`, setData).then( response => {
      // console.log("=====>", response)
      setData.attributes = JSON.parse(setData.attributes)
      res.json({
        msg: 'Registrasi berhasil!',
        data: setData,
        sid: response.insertId,
        response
      })
    }).catch( e => {
      console.log("ERROR", e)
    })
  } catch(e) {
    res.status(500).json(e)
    console.log("TRY ERROR", e)
  }
}

exports.approveSeller = async (req, res) => {
  try {
    let { email, type } = req.body
      , sql = type == 1 ? `UPDATE sellers SET status = 1 WHERE email = ?` : `UPDATE sellers SET status = 2 WHERE email = ?`
      , msg = type == 1 ? 'approval' : 'rejection'

    if(email) {
      db.execute(db.partsku, sql, email) // update seller status
      if(type == 1) db.execute(db.partsku, `UPDATE users SET type = 2 WHERE email = ?`, email) // update user type
      res.json({msg: `Seller ${msg} succeeded`})
    } else res.status(500).json('Whoops, something isnt right')
  } catch (e) {
    console.log(e)
    res.status(500).json(e)
  }
}

exports.storePicture = async (req, res) => {
  try {
    let { imgData, uid } = req.body

    let cloudinaryResponse = await cloudinary.uploader.upload(imgData, {
      upload_preset: 'seller_default'
    })
    console.log(cloudinaryResponse);
    if(cloudinaryResponse.url) {
      let getId = await db.execute(db.partsku, `SELECT attributes->>'$.public_id' AS public_id FROM sellers WHERE uid = ${uid}`)
        , destroy = await cloudinary.uploader.destroy(getId[0].public_id)

      db.execute(db.partsku, `UPDATE sellers SET attributes = JSON_SET(attributes, '$.public_id', ?), attributes = JSON_SET(attributes, '$.logo', ?)  WHERE uid = ?`, [cloudinaryResponse.public_id, cloudinaryResponse.url, uid]).then(resposne => {
        res.json({msg: 'Success upload new profile picture', url: cloudinaryResponse.url})
      }).catch(e => {
        console.log("DB catch", e)
        res.json(e);
      })
    }
  } catch (e) {
    console.log(e)
    res.status(400).json(e)
  }
}