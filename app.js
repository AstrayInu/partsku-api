require('dotenv').config();
const express = require('express')
, app = express()
, helmet = require('helmet')
, public = require('./routes/public')
, users = require('./routes/users')
, bodyParser = require('body-parser');

// use helmet for security ?
app.use(helmet());

// set up BodyParser Middleware
app.use(bodyParser.json({limit: '50mb'})); // limit post data
app.use(bodyParser.urlencoded({ extended: true }));

// routes
app.use('/public', public)
app.use('/users', users)


const port = process.env.PORT || 3000;
app.listen(port, () => {
	console.log(`[Node] Server Listening on port http://localhost:${port}`)
})