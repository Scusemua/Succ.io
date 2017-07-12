// Import the Express module
var express = require('express');
// Import the 'path' module (packaged with Node.js)
var path = require('path');
// Create a new instance of Express
var app = express();

// Create a Node.js based http server on port 6969
var server = require('http').createServer(app).listen(process.env.PORT || 6969);

// Create a Socket.IO server and attach it to the http server
var io = require('socket.io').listen(server)

// Import the game file.
var game = require('./game.js');

// Serve static html, js, css, and image files from the 'public' directory
app.use(express.static(path.join(__dirname + '/public')));

io.sockets.on('connection', function(socket){
	var address = socket.request.connection.remoteAddress;
	console.log('A Client has connected from ' + address);
	game.initGame(io, socket);
	socket.on('disconnect', function() {
		console.log("A Client has disconnected.");
	});
	socket.on('chat message', function(msg) {
		io.emit('chat message', msg);
	});	
});

server.listen(4200);
