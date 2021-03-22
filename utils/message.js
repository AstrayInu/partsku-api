const nodemailer = require('nodemailer')
    , db = require('../utils/db')
    , debug = require('debug')('message')

exports.sendMail = async (to, subject, msg, html, attachments) => {
  try {
		let transporter = nodemailer.createTransport({
          host: "smtp.ethereal.email",
          port: 587,
          auth: {
            user: 'claudine.green@ethereal.email',
            pass: '57cRkJmzZdGqyZwEP1'
          }
        })
    , options = {
      from: 'noreply@partsku.id',
			to: to,
			subject: subject
    }

    if(msg) options.text = msg
    
    // if no msg (text only) then it must be using HTML, perhaps for future upgrade
    if(html) {
      delete options.text
      options.html = html
    }

	
		let info = await transporter.sendMail(options);
	
		console.log("Message sent: %s", info.messageId);
	
		console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
	} catch (e) {
		console.log(e)
	}
}