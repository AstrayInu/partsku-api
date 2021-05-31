const { rearg } = require("lodash");
const _ = require("lodash")
  , db = require('../utils/db')

const mv = require('mv')

exports.getSingleProduct = (req, res) => {
  if (_.isUndefined(req.params.id)) {
    res.status(400).json('Product ID is missing');
  }

  let id = req.params.id
    , sql = `SELECT * FROM products WHERE pid = ?`
    , data = db.execute(db.partsku, sql, id)

  if(data.length > 0) {
    let product = _.reduce(data)

    product.attributes = JSON.parse(product.attributes)
    response = {
      data,
      id,
      msg: `Success`
    }
    res.json(data)
  } else {
    res.status(404).json(`Product with pid ${id} is not found`)
  }
}

exports.getSellerProduct = (req, res) => {
  let sid = req.params.id
  if (_.isUndefined(sid)) {
    res.status(400).json('Product ID is missing');
  }

  try {
    let check = db.execute(db.partsku, `SELECT * FROM sellers WHERE sid = ?`, sid)
    if(check.length > 0) {
      let data =  db.execute(db.partsku, `SELECT * FROM products WHERE sid = ?`, sid)

      if(data.length > 0) {
        data = _.reduce(data)

      } else {
        res.json("This seller has no products!")
      }
    } else {
      res.status(404).json("Seller not found!")
    }

  } catch (e) {
    res.json(e)
  }
}

exports.createTMPImage = async (req, res) => {
  if(!req.files.imgData) {
    res.status(403).json('Image is missing')
  }

  let { pid/*, pos*/ } = req.body
    , { originalname, path } = req.files.imgData[0]
    , fileOrig = originalname.replace(/ /g,'_')
    , folder = fileOrig.slice(0,2).split('').join('/')
    , imgPath = `/${folder}/${fileOrig}`
    , dest = `${path.dirname(__dirname)}/data/media${imgPath}`

  mv(path, dest, { mkdirp: true }, async (err) => {
    if(err) res.json(err)
    else{
      try {
        let check = await db.execute(db.partsku, ` SELECT fid FROM images WHERE pid = ?`, pid)
        let query, params
          , data = {
            id: uid,
            msg: 'Gambar berhasil disimpan',
            path: imgPath
          }

        if(check.length > 0) {
          query = `UPDATE images_tmp SET path = ? WHERE pid = ? AND position = ?`
          params = [imgPath, pid, pos]
          data.fid = check[0].fid
        } else {
          query = `INSERT INTO images_tmp SET ?`
          params = { pid: pid, position: pos, path: pathImg }
        }

        db.execute(db.partsku, `INSERT INTO images_tmp SET ?`, data).then( response => {
          if(check.length>0) data.id = response.insertId
          res.json(data)
        }).catch( e => {
          console.log(e)
          res.json(e)
        })
      } catch (e) {
        res.json(e)
      }
    }
  })
}

exports.createProduct = async (req, res) => {
  let data = req.body.data

  try {
    let sql = `INSERT INTO products ?`
      , { sid, tmpPid } = req.body
      , urlName = data.name.toLowerCase().replace(/\/|\ |\./g,'-')
      , usedData = {
        sid,
        category: data.category,
        is_active: 1, // default to active
        preorder: data.preorder,
        status: data.stock > 0 ? 1 : 0, // 0 = not ready ; 1 = ready ; 2 = pre-order
        condition: data.condition, // used or new
        brand: data.brand,
        sku: data.sku,
        name: data.name,
        description: data.description,
        price: data.price,
        stock: data.stock,
      }

      // NOTE
      // - add stuff for imgs, perhaps in another API.. or here maybe?
      // - add stuff for admin notif


      // insert into db
      db.execute(db.partsku, sql, usedData).then( async result => {

        // put img to db
        // 1. get img from tmp db
        let tmpImg = await db.execute(db.partsku, `SELECT * FROM images_tmp WHERE pid = ?`, tmpPid)
        // 2. if exists then put img to final db and get path
        if(tmpImg.length>0) {
          // save user data to db
          let result = await db.execute(db.partsku, sql, usedData)
          console.log("==>", result)
          // copy tmp img to img db
          // await db.execute(db.partsku, `INSERT INTO images SELECT 0, ${result.insertId}, NULL, position, path FROM images_tmp WHERE PID = ?`, tmpPid)
          // await db.execute(db.partsku, `UPDATE images_tmp SET status = 1 WHERE pid = ?`, tmpPid)

          // put code for admin notif here

          res.json({
            msg: "Produk berhasil dibuat!",
            id: result.insertId
          })

          
        } else res.status(404).json("Produk harus memiliki gambar")

      }).catch(e => {
        res.json(e)
      })
  } catch (e) {
    // res.status(400).json(e)
    res.json(e) // for dev usage
  }
}

exports.updateProduct = async (req, res) => {

}