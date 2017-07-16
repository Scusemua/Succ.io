var io;
var gameSocket;
// Maps a player's socketId to their response for this round.
var roundResponses = new Map();
// Map which maps socket id's to points.
var points = new Map(); 

// Function called to initialize a new game instance.
// @param sio The Socket.IO library
// @param socket The socket object used for the connected client
exports.initGame = function(sio, socket) {
	io = sio;
	gameSocket = socket;
	gameSocket.emit('connected', { message: "You are connected!"});
	
	// Host Events
	gameSocket.on('hostCreateNewGame', hostCreateNewGame);
	gameSocket.on('game-starting', gameStarting);
	gameSocket.on('response', onResponse);
	
	// Player Events
	gameSocket.on('playerJoinGame', playerJoinGame);
	gameSocket.on('playerConfirmedName', playerConfirmName);
	// gameSocket.on('playerAnswer', playerAnswer);
	// gameSocket.on('playerRestart', playerRestart);
}

///
///
///
/// HOST FUNCTIONS
///
///
///

// The 'START' button was clicked and 'hostCreateNewGame' event occurred.
function hostCreateNewGame(name) {
	// Create a unique Socket.IO Room
	var thisGameId = ( Math.random() * 100000) | 0;
	
	this.nickname = name;
	
	// Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client.
	this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});
	
	// Join the Room and wait for the players.
	this.join(thisGameId.toString());
};

function gameStarting(gameId) {
	console.log('Game ' + gameId + ' Started.');
	var sock = this;
	var room = gameSocket.adapter.rooms[gameId];
	
	var memberNames = [];
	var memberSockets = [];
	var clients = room.sockets;
	for (var clientId in clients) {
		memberSockets.push(clientId);
		memberNames.push(io.sockets.connected[clientId].nickname);
	}
	
	// Data that isn't to go to all the other clients	
	var personalData = {
		memberNames: memberNames,
		memberSockets: memberSockets,
		gameId: gameId
	}
	
	// Tell all of the players that the game has started.
	io.in(gameId).emit('game-started', personalData);
};

/* When a player enters and submits a response to a question, an event is fired and this method is executed by the host (server-side). */
function onResponse(data) {
	// console.log('Client ' + data.playerId + ' responded with: ' + data.response);
	roundResponses.set(data.playerId, data.response);
};

///
///
///
/// PLAYER FUNCTIONS
///
///
///

// A player clicked the 'START GAME' button.
// Attempt to connect them to a room that matches the gameId entered by the player.
function playerJoinGame(data) {
	console.log('Player ' + data.playerName + ' attempting to join game: ' + data.gameId );
	
	// Reference to the player's Socket.IO 
	var sock = this;
	
	// Look up the room ID.
	var room = gameSocket.adapter.rooms[data.gameId];
	
	// If the room exists, attempt to join. Otherwise, present error message.
	if (room != undefined) {
		// Attach the socket id to the data object.
		data.mySocketId = sock.id;
		
		// Join the room.
		sock.join(data.gameId);
		sock.nickname = data.playerName;
		
		var memberNames = [];
		var memberSockets = [];
		var clients = room.sockets;
		for (var clientId in clients) {
			memberSockets.push(clientId);
			memberNames.push(io.sockets.connected[clientId].nickname);
		}
		
		// Data that isn't to go to all the other clients	
		var personalData = {
			memberNames: memberNames,
			memberSockets: memberSockets,
			gameId: data.gameId
		}
		
		// Note that thsis only emits to the client of the sender.
		sock.emit('youJoinedRoom', personalData);
		
		console.log('Player ' + data.playerName + ' successfully joining game: ' + data.gameId );
		
		// Emit an event notifying other clients that the player has joined the room.
		sock.broadcast.to(data.gameId).emit('playerJoinedRoom', data);
	} else {
		sock.emit('error-occurred', {message: "This room does not exist."} );
	}
}

// Set this socket's nickname. 
function playerConfirmName(name) {
	var sock = this;
	sock.nickname = name;
};