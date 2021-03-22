const crypto = require('crypto')

exports.validatePass = (password, hash) => {
  let hashArr = hash.split(':')
    , data

  switch(hashArr.length)  {
    case 1:
      data = crypto.createHash('sha256').update(password).digest('hex')
      return data === hash
    case 2:
      data = crypto.createHash('sha256').update(`${hashArr[1]}${password}`).digest('hex')
      return data === hashArr[0]
  }
}

exports.createPassword = (password) => {
  let key = crypto.randomBytes(16).toString('hex')
    , data = crypto.createHash('sha256').update(`${key}${password}`).digest('hex')

  return `${data}:${key}`
}