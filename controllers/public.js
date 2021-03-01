const db = require('../utils/db')
	// , moment = require('moment')
	// , passwordValidator = require('password-validator');

exports.add = async (req, res) => {
	try {
		let query = `INSERT INTO admins VALUES(?, ?, ?, ?, ?, ?, NOW())`
			, {firstName, lastName, email, pass} = req.body
			, data = await db.execute(db.partsku, query, [firstName, lastName, email, pass])

		res.json(data)
	} catch (e) {
		//error handling
		res.json(e)
	}
}