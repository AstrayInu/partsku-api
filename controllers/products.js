const e = require("express");
const _ = require("lodash")
  , db = require('../utils/db')
  , { cloudinary } = require("../utils/cloudinary")

const mv = require('mv')

exports.getProducts = async (req, res) => {
  try {
    let q = req.query
    , limit = q.limit ? q.limit : 16
    , offset = q.offset ? q.offset : 0
    , sort = q.sort == 'undefined' ? null :  q.sort
    , brand = q.brand == 'undefined' ? null : q.brand
    , sqlQuery = `SELECT * FROM products WHERE 1`
    , sqlCount = `SELECT COUNT(*) AS num FROM products WHERE 1`
    , where = ``
    , arg = []

    // console.log("DATA", q)
    if(q.sid) {
      where += ` AND sid = ?`
      arg.push(q.sid)
    }

    if(q.q) {
      let edit = q.q.toUpperCase().replace(' ', '%')
      where +=  ` AND (brand LIKE "%${edit}%" OR name LIKE "%${edit}%" OR sku LIKE "%${edit}%" OR description LIKE "%${edit}%" OR attributes ->> '$.carType' LIKE "%${edit}%")`
      // for(let i=0 ; i<4 ; i++) arg.push(q.q)
    }

    if(brand) {
      let brands = q.brand.split(',').map(x => x.toLowerCase())

      where += ` AND brand = ? OR attributes->>'$.carType' = ?`
      if (brands.length > 1)  {
        for(let item of brands) {
          where += ` OR brand = ? OR attributes->>'$.carType' = ?`
          arg.push(item)
          arg.push(item)
        }
      } else {
        arg.push(brand)
        arg.push(brand)
      }
    }
    
    if(q.category) {
      where += ` AND category LIKE "%${q.category}%"`
    }

    sqlQuery += q.sid ? '' : ` AND is_active = 1`

    if(sort) {
      switch (q.sort) {
        case "new":
          where += ` ORDER BY created_at DESC`
          break;
        case "best_sell":
          where += ` ORDER BY sold DESC`
          break;
        case "min_price":
          where += ` ORDER BY price ASC`
          break;
        case "max_price":
          where += ` ORDER BY price DESC`
          break;
        default:
          break;
      }
    }

    sqlQuery += where
    sqlQuery += ` LIMIT ${offset},${limit}`
    sqlCount += where
    // console.log(sqlQuery)
    let data = await db.execute(db.partsku, sqlQuery, arg.concat([Number(offset), Number(limit)]))
      , num = await db.execute(db.partsku, sqlCount, arg)

    // console.log("NUM", num[0].num)
    data.forEach(x => {
      x.attributes = JSON.parse(x.attributes)
    })

    let resData = {
      data: data,
      count: num[0].num
    }
    // console.log("===>",resData)
    res.json(resData)
  } catch(e) {
    console.log("ERROR CATCH",e)
  }
}

exports.getSingleProduct = async (req, res) => {
  if (_.isUndefined(req.params.pid)) {
    res.status(400).json('Product ID is missing');
  }

  let id = req.params.pid
    , sql = `SELECT * FROM products WHERE pid = ?`
    , data = await db.execute(db.partsku, sql, id)

  if(data.length > 0) {
    let product = _.reduce(data)
    product.attributes = JSON.parse(product.attributes)
    let seller = await db.execute(db.partsku, `SELECT * FROM sellers WHERE sid = ?`, product.sid)
      , productCount = await db.execute(db.partsku, `SELECT COUNT(*) as num FROM products WHERE sid = ${product.sid}`)
    seller = _.reduce(seller)
    seller.attributes = JSON.parse(seller.attributes)
    seller.productCount = _.reduce(productCount).num
    response = {
      product,
      seller,
      id,
      msg: `Success`
    }
    res.json(response)
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
  try {
    let data = req.body
    // console.log("====>", Array.isArray(data.category))
    let sql = `INSERT INTO products SET ?`
      , urlName = data.name.toLowerCase().replace(/\/|\ |\./g,'-')
      , usedData = {
        sid: data.sid,
        category: Array.isArray(data.category) ? data.category.join() : data.category,
        is_active: 1, // default to active
        // preorder: data.preorder ? data.preorder : 0,
        // status: data.stock > 0 ? 1 : 0, // 0 = not ready ; 1 = ready ; 2 = pre-order
        condition: data.condition, // used or new
        sku: data.sku.trim(),
        name: data.name.trim(),
        description: data.description,
        price: data.price.trim(),
        stock: data.stock.trim(),
        sold: 0,
      }
      , imgUrl = []
      , attributes = {
        urlName,
        carType: data.brand.map(x => {
          return x.split('.')[1]
        })
      }
      , arr, newArr = []

      if(Array.isArray(data.brand)) {
        // console.log('data.brand', data.brand)
        arr = data.brand.map(x => {
          return x.split('.')[0]
        })
        for(let i=0 ; i<arr.length-1 ; i++) {
          if(i != 0) {
            if(arr[i] != arr[i-1]) newArr.push(arr[i])
          } else newArr.push(arr[i])
        }
        usedData.brand = newArr.join()
      }

      // NOTE
      // - add stuff for imgs, perhaps in another API.. or here maybe?
      for(let i=0 ; i<data.imgData.length ; i++) {
        let cloudinaryResponse = await cloudinary.uploader.upload(data.imgData[i], {
          upload_preset: 'product_default'
        })
        if(cloudinaryResponse.url) {
          imgUrl.push(cloudinaryResponse.url)
        } else res.json({err: 'Something went wrong while uploading your product :('})
      }
      attributes.imgUrl = imgUrl
      usedData.attributes = JSON.stringify(attributes)

      // insert into db
      db.execute(db.partsku, sql, usedData).then( async result => {
        // put code for admin notif here

        res.json({
          msg: "Product added!",
          id: result.insertId
        })
      }).catch(e => {
        console.log(e)
        // res.json(e)
      })
  } catch (e) {
    res.status(400).json(e)
    console.log(e)
    // res.json(e) // for dev usage
  }
}

exports.updateProduct = async (req, res) => {
  try {
    let data = req.body
      , { id } = req.params
      , urlName = data.name.toLowerCase().replace(/\/|\ |\./g,'-')
      , usedData = {
          sid: data.sid,
          category: data.category,
          status: data.stock > 0 ? 1 : 0, // 0 = not ready ; 1 = ready ; 2 = pre-order
          condition: data.condition, // used or new
          brand: data.brand.split(".")[0],
          sku: data.sku.trim(),
          name: data.name.trim(),
          description: data.description,
          price: Number(data.price),
          stock: Number(data.stock),
        }
      , attributes = {
          urlName,
          carType: data.brand.split(".")[1]
        }
      , imgs = await db.execute(db.partsku, `SELECT attributes->>'$.imgUrl' AS img FROM products WHERE pid = ${id}`)
      , parsedImg = JSON.parse(imgs[0].img)

    if(data.imgData) {
      for(let i=0 ; i<data.imgData.length ; i++) {
        if(data.imgData[i]) {
          let cloudinaryResponse = await cloudinary.uploader.upload(data.imgData[i], {
            upload_preset: 'product_default'
          })
          if(cloudinaryResponse.url) {
            parsedImg[i] = cloudinaryResponse.url
            // parsedImg.push(cloudinaryResponse.url)
          } else res.json({err: 'Something went wrong while uploading your product :('})
        }
      }
      attributes.imgUrl = parsedImg
    } else {
      attributes.imgUrl = parsedImg
    }

    usedData.attributes = JSON.stringify(attributes)
    delete data.imgData
    db.execute(db.partsku, `UPDATE products SET ? WHERE pid = ${id}`, usedData).then(result => {
      console.log('result', result)
      res.json("Update Success")
    }).catch(e => {
      console.log('DB ERROR', e)
      res.status(500).json(e)
    })
  } catch (e) {
    console.log('ERROR', e)
    res.status(500).json(e)
  }
}

exports.activateProduct = (req, res) => {
  try {
    let { active } = req.query
      , { id } = req.params
    db.execute(db.partsku, `UPDATE products SET is_active = ${active} WHERE pid = ${id}`).then(result => {
      res.json("Update Success")
    }).catch(e => {
      console.log("DB ERROR", e)
      res.status(500).json(e)
    })
  } catch (e) {
    console.log("DB ERROR", e)
    res.status(500).json(e)
  }
}

exports.deleteProduct = async (req, res) => {
  try {
    console.log(req)
    db.execute(db.partsku, `DELETE FROM products WHERE pid = ${req.params.id}`).then(result => {
      res.json("Item deleted!")
    }).catch(e => {
      console.log('DB CATCH', e)
      res.status(500).json({err: e, msg: "Whoops something went wrong :(. Please contact our devs"})
    })
  } catch (error) {
    console.log('error', error)
    res.status(500).json({err: e, msg: "Whoops something went wrong :(. Please contact our devs"})
  }
}

exports.getProductRating = async (req, res) => {
  try {
    let { pid, uid, sid, rid } = req.body
      , select = `SELECT *`
      , count = `SELECT COUNT(*) AS num`
      , sql = ` FROM ratings WHERE `

    if(pid) sql += `pid = ${pid}`
    if(uid) sql += `uid = ${uid}`
    if(sid) sql += `sid = ${sid}`
    if(rid) sql += `id = ${rid}`

    let num = await db.execute(db.partsku, `${count}${sql}`)
    let data = await db.execute(db.partsku, `${select}${sql}`)

    res.json({data, count: num[0].num})
  } catch (e) {
    console.log(e)
    res.status(500).json(e)
  }
}

exports.submitReview = (req, res) => {
  try {
    let data = req.body

    db.execute(db.partsku, `INSERT INTO ratings SET ?`, data).then(async response => {
      db.execute(db.partsku, `UPDATE transaction_log SET rated = ${response.insertId} WHERE id = ${data.tlog_id}`)
      let ratings = await db.execute(db.partsku, `SELECT pid, rate FROM ratings WHERE pid = ${data.pid}`)
        , avg = 0

      for(let x of ratings) avg = avg + x.rate
      avg = avg / ratings.length
      db.execute(db.partsku, `UPDATE products SET rating = ${avg}, times_rated = times_rated + 1 WHERE pid = ${data.pid}`)

      res.json(response)
    }).catch(e => {
      console.log('DB ERROR', e)
      res.status(500).json(e)
    })
  } catch (e) {
    console.log('e', e)
  }
}