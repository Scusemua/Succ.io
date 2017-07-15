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
	// When a player disconnects, we need to tell the clients
	// so that, if that player was in their room, they can be
	// removed from lists and whatnot.
	socket.on('disconnect', function() {
		console.log("A Client has disconnected.");
		io.emit('player-disconnected', socket.id);
	});
	socket.on('chat message', function(msg) {
		io.emit('chat message', msg);
	});	
	// Emit countdown events to the users which will
	// display the countdown in the chat.
	socket.on('countdown', function(data) {
		io.emit('chat message', data.count);
	});
});

server.listen(4200);

