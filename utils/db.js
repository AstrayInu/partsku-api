const mysql = require('mysql')

exports.partsku = mysql.createPool({
	connectionLimit: 100,
	host: process.env.DB_HOST,
	user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
})

exports.execute = (db, sql, args) => {
    return new Promise((resolve, reject) => {
        db.query(sql, args, (error, results, fields) => {
					if(error) reject(error)
					else resolve(results)
				})
    })
}
