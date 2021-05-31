const db = require('../utils/db')
	, moment = require('moment')
	, passwordValidator = require('password-validator')
	, encryption = require('../utils/encryption')
	, bodyParser = require('body-parser')
	, nodemailer = require('nodemailer')

exports.addAdmin = async (req, res) => {
	try {
		let {firstName, lastName, email, username, password} = req.body

		const pass = encryption.createPassword(password)
		const data = {
			first_name: firstName,
			last_name: lastName,
			email,
			username,
			pass,
			created_at: new Date(),
			is_active: 1
		}

		let sql = await db.execute(db.partsku, `INSERT INTO admins SET ?`, data)

		res.json("SUCCESS ADD ADMIN!")
	} catch (e) {
		res.status(400).message(e)
	}
}

exports.sendEmail = async (req, res) => {
	const { email } = req.body
	try {
		let transporter = nodemailer.createTransport({
			host: "smtp.ethereal.email",
			port: 587,
			auth: {
				user: 'claudine.green@ethereal.email',
				pass: '57cRkJmzZdGqyZwEP1'
			}
		})
	
		let info = await transporter.sendMail({
			from: 'noreply@partsku.id',
			to: email,
			subject: "Hello ✔", // Subject line
			text: "Hello world?", // plain text body
			html: "<b>Hello world?</b>", // html body
		});
	
		console.log("Message sent: %s", info.messageId);
	
		console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
		
		await transporter.sendMail(info).then((result) => {
			console.log("===>", result)
			res.json("Email sent!")
		}).catch( (e) => {
			console.log(e)
		})
	} catch (e) {
		console.log(e)
	}
}