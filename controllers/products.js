const _ = require("lodash")
  , db = require('../utils/db')


exports.getSingleProducts = (req, res) => {
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

exports.createProduct = (req, res) => {
  let data = req.body.data

  try {
    let sql = `INSERT INTO products ?`
      , sid = req.body.sid
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
      db.execute(db.partsku, sql, usedData).then( result => {
        res.json("Produk berhasil dibuat!", result)
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