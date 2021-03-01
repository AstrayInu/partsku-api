const express = require('express')
	, app = express()
	// , helmet = require('helmet')
	, public = require('./routes/public')

// // use helmet for security
// app.use(helmet());

// routes
app.use('public', public)

app.listen('3000', () => {
	console.log()
})