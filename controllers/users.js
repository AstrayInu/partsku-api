const passwordValidator = require('password-validator')
const _ = require("lodash")
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mv = require('mv')
const { response } = require('express')

const db = require('../utils/db')
const encryption = require("../utils/encryption")
const message = require("../utils/message")
const { cloudinary } = require("../utils/cloudinary")
const secret = process.env.secret


exports.createUser = async (req, res) => {
  try {
    const schema = new passwordValidator();
    const { fname, lname, email, pass } = req.body

    // check if email is registered already
    let check = await db.execute(db.partsku, `SELECT * FROM users WHERE email = ?`, email)

    if(check.length > 0) {
      res.status(400).json({
        error: 'Email sudah terdaftar!'
      })
    } else {
      if(!email.match(/^[a-zA-Z0-9.+_-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,4}$/)) {
        res.status(400).json({
          error: 'Format email tidak valid!'
        })
      }

      // password validaion
      schema
      .is().min(8)                                    // Minimum length 8
      .is().max(100)                                  // Maximum length 100
      .has().uppercase()                              // Must have uppercase letters
      .has().lowercase()                              // Must have lowercase letters
      .has().digits()                                 // Must have digits
      .has().not().spaces()                           // Should not have spaces
      .is().not().oneOf(['Passw0rd', 'Password123'])  // Blacklist these values
      .is([/[^A-Za-z0-9]/]);

      if(schema.validate(pass)) {
        const attributes = {
          dob: null,
          name: `${fname.trim()} ${lname.trim()}`,
          phone_number: 0,
          address: null,
        }

        // encrypt pass
        const encryptedPass = encryption.createPassword(pass)

        // save user data
        const data = {
          email,
          pass: encryptedPass,
          is_active: 1,
          type: 1,
          attributes: JSON.stringify(attributes),
          created_at: new Date(),
          updated_at: new Date()
        }
        db.execute(db.partsku, `INSERT INTO users SET ?`, data).then(async result => {
          // commented for future use, perhaps
          // send success email
          // const emailSubject = `Halo, Registrasi Kamu di partsku.id Berhasil!`
          // const msg = `Hai ${email}!, selamat bergabung di partsku.id tempat belanja parts mobile no.1 di Indonesia!`
          // try {
          //   await message.sendMail(email, emailSubject, msg)
          // } catch (e) {
          //   res.status(400).json(e)
          // }

          // return success
          const returnData = {
            msg: `Registrasi berhasil!`
          }
          res.json(returnData)
        }).catch(e => {
          console.log(e)
          // res.status(400).json(e)
        })

      } else {
        res.status(400).json({
          error: '*Password minimal 8 karakter dan harus mengandung setidaknya 1 huruf besar, 1 huruf kecil, dan 1 digit angka.'
        })
      }
    }

  } catch (e) {
    console.log(e)
    res.status(400).json(e)
  }
}

exports.getUserData = (req, res) => {
  try {
    const { id } = req.params

    // check if uid is sent
    if(id) {
      //check if uid exist or not
      const check = `SELECT * FROM users WHERE uid = ?`

      db.execute(db.partsku, check, id).then((data) => {
        if(data.length > 0) {
          console.log("==>", data)
          let item = _.reduce(data) // to move actual data from an array casing
          let attr = JSON.parse(item.attributes) // parse json so it's readable and accessible
          item.attributes = attr
          delete item.pass

          res.json(item)
        } else res.status(404).json(`User with UID ${id} is not found!`)
      }).catch((e) => {
        res.status(400).json(e)
      })
    } else {
      res.status(400).json("ID is missing")
    }
  } catch (e) {
    res.status(400).json(e)
  }
}

exports.checkUser = (req, res) => {
  try {
    console.log("huwih")
    let { email } = req.body

    db.execute(db.partsku, `SELECT * FROM users WHERE email = ?`, email).then( response => {
      console.log(response)
      if(response.length > 0) res.json("User found!")
      else res.json({msg: "User not found"})
    }).catch( e => {
      res.status(400).json(e)
    })
  } catch (e) {
    console.log("check user error", e)
  }
}

exports.updateUserData = async (req, res) => {
  try {
    let { name, email, phone_number, address } = req.body
      , uid = req.params.id
      , check = await db.execute(db.partsku, `SELECT * FROM users WHERE uid = ?`, uid)
      , code, msg
    // console.log("BODY", req.body)
    if(check.length > 0) {
      let userData = _.reduce(check)
      , userAttr = JSON.parse(userData.attributes)

      // if user updates email
      let emailCheck = await db.execute(db.partsku, `SELECT uid, email, phone_number FROM users WHERE email = ? OR phone_number = ?`, [email, phone_number]).then(result => {
        let checkEmailDuplication = result.filter(x => (x.uid != uid && x.email === email))
        let checkPhoneDuplication = result.filter(x => (x.uid != uid && x.phonenumber === phone_number))

        if (checkEmailDuplication.length > 0) return { code: 403, msg: "Maaf, Email Sudah Digunakan." }
        else if (checkPhoneDuplication.length > 0) return { code: 403, msg: "Maaf, Nomor Telepon Sudah Digunakan." }
        else return null;
      })
      console.log(emailCheck)
      if(emailCheck) res.status(403).json(emailCheck.message)

      if(name) {
        userAttr.name = name.trim()
        delete userAttr.firstname
        delete userAttr.lastname
      }
      if(address) userAttr.address = await address

      let data = {
        email,
        phone_number,
        attributes: await JSON.stringify(userAttr),
        updated_at: new Date()
      }
      db.execute(db.partsku, `UPDATE users SET ? WHERE uid = ?`, [data, uid]).then((result) => {
        data.attributes = JSON.parse(data.attributes)
        res.json({data, msg: 'Data telah tersimpan'})
      }).catch( e => {
        res.json({err: e})
        console.log("ERROR DB FINAL",e)
      })
    } else {
      res.status(400).json(`User with userid of ${uid} is not found`)
    }
  } catch (e) {
    res.json({err: e})
    console.log("CATCH", e)
  }
}

exports.login = async (req, res) => {
  try {
    let { email, password } = req.body
      , query = `SELECT * FROM users WHERE email = ?`

    // check if email exists
    let user = await db.execute(db.partsku, query, email)
    if(user.length > 0) {
      // validate pass
      if(encryption.validatePass(password, user[0].pass)) {
        // console.log("==>", user)
        user = _.reduce(user)
        const attr = JSON.parse(user.attributes)
        const type = (user.type === 0) ? 'admin' : (user.type === 1) ? 'user' : 'seller';
        const session_id = Date.now();
        const payload = (user.sid) ? { id: user.id, type, session_id, sid: user.sid } : { id: user.id, type, session_id, sid: null }
        const token = jwt.sign(payload, secret, { expiresIn: "3h" });

        let sqlData = {
          token,
          validated: 1,
          email: email,
          type,
          expired: moment().add(3, "h").format("YYYY-MM-DD HH:mm:ss")
        }

        await db.execute(db.partsku, 'INSERT INTO sessions SET ?', sqlData)
        sqlData.msg = `login success!`
        sqlData.id = user.uid
        sqlData.name = attr.name
        sqlData.profPicture = user.picture
        sqlData.phone_number = user.phone_number
        sqlData.attributes = attr

        let sellerData = await db.execute(db.partsku, `SELECT * FROM sellers WHERE uid = ? AND status = 1`, user.uid)
        console.log(sellerData)
        if(sellerData.length > 0) {
          sqlData.sid = sellerData[0].sid;
          // sqlData.seller = { is_active: user.is_active, dealer_code: user.dealer_code }
          // sqlData.sellerPicture = user.sellerPicture
        }

        res.json(sqlData)
      } else res.status(400).json({msg: 'Email / Password is not valid!'})
    } else res.status(404).json({msg: 'Email / Password is not valid!'})
  } catch (e) {
    console.log("==>",e)
    res.status(400).json(e)
  }
}

exports.logout = async (req, res) => {
  try {
    if(req.body.token) {
      db.execute(db.partsku, `UPDATE sessions SET validated = 0 WHERE token = ?`, req.body.token).then(() => {
        res.json({msg: `Logout Success!`})
      }).catch((reason) => {
        console.log( reason)
        res.json(JSON.parse(reason.response.body))
      })
    } else res.status(500).json({error: `Token not found`})
  } catch (e) {
    console.log(e)
    res.status(500).json({error: e})
  }
}

exports.sendEmailForgotPassword = async (req, res) => {
  try {
    let { email } = req.body
      , check = await db.execute(db.partsku, `SELECT uid, email,  FROM users where email = ?`, email)

    if(check.length > 0) {
      const otp = Math.floor(100000 + Math.random() * 900000)
      let emailSubject = 'OTP for Password Reset Request Partsku.id'
        , html = `
        <div style="font-family: Arial, Helvetica, sans-serif;">
          <p style="font-size: 18;">Hi Fritz I!</p>
          <br>
          <p>You are recieving this email because it seems that you requested a password reset. Below is your OTP</p>
          <br>
          <h2><b>123456</b></h2>
          <br>
          <p>If this is not you, please ignore this email</p>
          <br>
          <p>Regards,</p>
          <p>Partsku.id</p>
        </div>
        `

      message.sendMail(email, emailSubject, null, html).then(async () => {
        const payload = { id: check[0].uid, email, type: 'user', session_id: Date.now() }
        const token = jwt.sign(payload, secret, { expiresIn: "1m" });
        await db.execute(db.partsku, `INSERT INTO sessions (token, validated, email, type, expired, created_at)
        VALUES (?, 1, ?, "reset password", DATE_ADD(NOW(), INTERVAL 1 HOUR), NOW())`, [token, email])
        res.json('Kode telah terkirim ke email anda')
      }).catch((e) => {
        console.log(typeof e, e)
        res.status(400).json(e)
      })
    } else res.status(404).json({error: 'Email tidak valid'})
  } catch (e) {
    res.status(400).json(e)
  }
}

exports.resetPassword = (req, res) => {
  const { email, new_pass, confirm_pass } = req.body
  const schema = new passwordValidator()

  // password validation
  schema
  .is().min(8)                                    // Minimum length 8
  .is().max(100)                                  // Maximum length 100
  .has().uppercase()                              // Must have uppercase letters
  .has().lowercase()                              // Must have lowercase letters
  .has().digits()                                 // Must have digits
  .has().not().spaces()                           // Should not have spaces
  .is().not().oneOf(['Passw0rd', 'Password123'])  // Blacklist these values
  .is([/[^A-Za-z0-9]/]);

  try {
    const query = `SELECT * FROM sessions
      WHERE type = "reset password" AND email = ? AND validated = 1
      ORDER BY session_id DESC
      LIMIT 1`
    let check = db.execute(db.partsku, query, email)

    // check for errors or not valid stuff
    if(new_pass != confirm_pass) res.status(403).json('Password tidak sama!')
    if(!schema.validate(new_pass)) res.status(403).json('Format password tidak valid!')

    if(check.length > 0) {
      const password = encryption.createPassword(new_password);
      const queryPass = `UPDATE users SET pass = ?  WHERE email = ?`
      db.execute(db.partsku, queryPass, [password, email]).then(async () => {
        await db.execute(db.partsku, `UPDATE sessions SET validated = 0 WHERE email = ? AND type = 'reset password'`, email)

        res.json('Reset password berhasil! Silahkan melanjutkan proses login menggunakan password baru')
      }).catch(e => {
        console.log(typeof e, e)
        res.status(400).json(e)
      })
    } else res.status(404).json('Email tidak valid!')
  } catch (e) {
    console.log(typeof e, e)
    res.status(400).json(e)
  }
}

exports.profilePicture = async (req, res) => {
  try {
    let { imgData, uid} = req.body

    let cloudinaryResponse = await cloudinary.uploader.upload(imgData, {
      upload_preset: 'user_default'
    })
    console.log(cloudinaryResponse);
    if(cloudinaryResponse.url) {
      db.execute(db.partsku, `UPDATE users SET attributes = JSON_SET(attributes, '$.imgUrl', ?) WHERE uid = ?`, [cloudinaryResponse.url, uid]).then(resposne => {
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

exports.changePassword = async (req, res) => {
  const schema = new passwordValidator();
  const { email, old_password, new_password, confirmation, uid } = req.body;

  schema
  .is().min(8)                                    // Minimum length 8
  .is().max(100)                                  // Maximum length 100
  .has().uppercase()                              // Must have uppercase letters
  .has().lowercase()                              // Must have lowercase letters
  .has().digits()                                 // Must have digits
  .has().not().spaces()                           // Should not have spaces
  .is().not().oneOf(['Passw0rd', 'Password123'])  // Blacklist these values
  .is([/[^A-Za-z0-9]/]);

  try {
    const q = email ? `SELECT * FROM users WHERE email = ?` : `SELECT * FROM users WHERE uid = ?`
    const checkUser = db.execute(db.partsku, q, email ? email : uid)

    let checkpass = encryption.validateHash(old_password, user[0].pass)

    // check pass validity
    if(!checkpass) res.status(403).json("Password lama tidak sesuai")
    if(new_password != confirmation) res.status(403).json("Password baru dan password konfirmasi tidak sesuai")
    if(!schema.validate(new_password)) res.status(403).json(`Password minimum 8 karakter, maksimum 10 karakter, harus berisi huruf besar dan kecil, berisi angka dan tidak terdapat kata yang mudah ditebak.`)

    if(checkUser.length > 0) {
      const query = (email)? 'UPDATE users SET pass = ? WHERE email = ?' : 'UPDATE users SET pass = ? WHERE uid = ?';
      const params = (email)? [ password, email ] : [ password, uid ]

      db.execute(db.partsku, query, params).then( result => {
        res.json("Success")
      }).catch( e => {
        console.log("EROR", e)
        res.json(e);
      })
    } else res.status(404).json(`User with id = ${uid} does not exist!`)
  } catch(e) {
    console.log("ORRer", e)
    res.json(e)
  }
}

exports.updateCart = async (req, res) => {
  try {
    let { uid, pid, quantity } = req.body
      , sql

    let check = await db.execute(db.partsku, `SELECT * FROM cart WHERE uid = ? AND pid = ?`, [uid, pid])
    if(check.length > 0) {
      check[0].quantity = Number(check[0].quantity) + Number(quantity)
      sql = `UPDATE cart SET quantity = ${check[0].quantity} WHERE uid = ${uid} AND pid = ${pid}`
    } else sql = `INSERT INTO cart SET uid = ${uid}, pid=${pid}, quantity=${quantity}`

    db.execute(db.partsku, sql).then(result => {
      console.log(result);
      res.json("Item added to cart")
    }).catch(e => {
      console.log(e)
      res.status(400).json(e)
    })
  } catch (e) {
    console.log("Error catch", e)
  }
}

exports.getCartData = async (req, res) => {
  try {
    let { id } = req.params
      , sql = `SELECT c.uid, c.quantity, p.sid, s.attributes ->> '$.shop_name' AS shop_name, p.pid, p.sku, p.name, p.price, p.stock, p.attributes AS attr
              FROM cart c
              INNER JOIN products p ON c.pid = p.pid
              INNER JOIN sellers s ON p.sid = s.sid
              WHERE c.uid = ${id}`
      , sellerSql = `SELECT DISTINCT p.sid, s.attributes ->> '$.shop_name' AS shop_name FROM cart c
                    INNER JOIN products p ON c.pid = p.pid
                    INNER JOIN sellers s ON p.sid = s.sid
                    WHERE c.uid = ${id}`
    let data = await db.execute(db.partsku, sql)
      , seller = await db.execute(db.partsku, sellerSql)
    
    data.forEach(x => {
      x.attr = JSON.parse(x.attr)
      x.imgUrl = x.attr.imgUrl[0]
      delete x.attr
    });
    // console.log(data)
    res.json({data, seller})
  } catch (e) {
    console.log(e)
    res.status(400).json(e)
  }
}

exports.deleteCartItem = async (req, res) => {
  try {
    let {uid, pid} = req.body
    // console.log("=========>", req.body)
    
    db.execute(db.partsku, `DELETE FROM cart WHERE uid = ${uid} AND pid = ${pid}`).then( result => {
      res.json("Deleted item successfuly")
    }).catch(e => {
      console.log("DB CATCH",e)
      res.status(400).json({err: "Whoops somehting went wrong", e})
    })
  } catch (e) {
    console.log(e)
    res.status(400).json({err: "Whoops somehting went wrong", e})
  }
}