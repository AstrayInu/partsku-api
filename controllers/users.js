const passwordValidator = require('password-validator')
const _ = require("lodash")
const jwt = require('jsonwebtoken')
const moment = require('moment')
const mv = require('mv')

const db = require('../utils/db')
const encryption = require("../utils/encryption")
const message = require("../utils/message")
const { response } = require('express')
const secret = process.env.secret


exports.createUser = async (req, res) => {
  try {
    const schema = new passwordValidator();
    const { email, pass } = req.body

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
          firstname: '',
          lastname: '',
          phone_number: 0,
          address: null
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
  let { email } = req.body

  db.execute(db.partsku, `SELECT * FROM users WHERE email = ?`, email).then( response => {
    console.log(response)
    if(response.length > 0) res.json("User found!")
    else res.status(404).json("User not found")
  }).catch( e => {
    res.status(400).json(e)
  })
}

exports.updateUserData = async (req, res) => {
  try {
    let data =  req.body.data
      , attr = data.attributes
      , uid = req.params.id
      , check = db.execute(db.partsku, `SELECT * FROM users WHERE uid = ?`, uid)

    if(check.length > 0) {
      let userData = _.reduce(check)
        , userAttr = JSON.parse(userData.attributes)

      // if user updates email
      let emailCheck = db.execute(db.partsku, `SELECT * FROM users WHERE email = ?`, data.email)
      if(emailCheck.length > 0) {
        res.status(400).json(`Email yang anda input sudah digunakan!`)
      }
      data.attributes = JSON.stringify(attr)
      data.updated_at = new Date()
      db.execute(db.partsku, `UPDATE users SET ? WHERE uid = ?`, [data, uid]).then((result) => {
        res.json('Data telah tersimpan')
      })
    } else {
      res.status(404).json(`User with userid of ${uid} is not found`)
    }
  } catch (e) {

  }
}

exports.login = async (req, res) => {
  let { email, password } = req.body
    , query = `SELECT * FROM users WHERE email = ?`
  console.log(req)
  try {
    // check if email exists
    let user = await db.execute(db.partsku, query, email)
    if(user.length > 0) {
      // validate pass
      if(encryption.validatePass(data.password, user[0].pass)) {
        user = _.reduce(user)
        const attr = JSON.parse(user.attributes)
        const type = (user.sid) ? 'seller' : 'user';
        const session_id = Date.now();
        const payload = (user.sid) ? { id: user.id, type, session_id, sid: user.sid } : { id: user.id, type, session_id, sid: null }
        const token = jwt.sign(payload, secret, { expiresIn: "3h" });

        const sqlData = {
          token,
          validated: 1,
          email: data.email,
          type,
          expired: moment().add(3, "h").format("YYYY-MM-DD HH:mm:ss")
        }

        await db.execute(db.partsku, 'INSERT INTO sessions SET ?', sqlData)
        sqlData.msg = `login success!`
        sqlData.id = user.id
        sqlData.name = `${attr.firstname} ${attr.lastname}`
        sqlData.profPicture = user.picture

        let sellerData = await db.execute(db.partsku, `SELECT * FROM sellers WHERE email = ?`, email)
        if(sellerData.length > 0) {
          sqlData.sid = sellerData.sid;
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
  if(req.body.token) {
    db.execute(db.partsku, `UPDATE sessions SET validated = 0 WHERE token = ?`, req.body.token).then(() => {
      res.json(`Logout Success!`)
    }).catch((reason) => {
      console.log({res, reason})
      res.json(JSON.parse(reason.response.body))
    })
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

exports.profilePicture = (req, res) => {
  if(!req.files.imgData) {
    res.status(404).json('Image is missing')
  }

  let { originalname, path} = req.files.imgData[0]
  , fileFormat = originalname.split('.').pop() // remove format
  , uid = originalname.split('.')[0].split('-')[1]
  , fileName = `${Date.now()}-${uid}.${fileFormat}`
  , imgPath = `/user-${fileName}`
  , source = path
  , dest = `${path.dirname(__dirname)}/data/media${imgPath}`

  mv(source, dest, { mkdirp: true }, async (err) => {
    if(err) res.json(err)
    else{
      try {
        let check = await db.execute(db.partsku, `SELECT * FROM users WHERE uid = ?`, uid)

        if(check.length > 0) {
          await db.execute(db.partsku, `UPDATE users SET attributes = JSON_SET(attributes, '$.picture', ?) WHERE uid = ?`, [imgPath, uid])

          res.json({
            id: uid,
            msg: 'Gambar berhasil disimpan',
            path: imgPath
          })
        }
      } catch (e) {
        res.json(e)
      }
    }
  })
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