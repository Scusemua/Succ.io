var io;
var gameSocket;

// Function called to initialize a new game instance.
// @param sio The Socket.IO library
// @param socket The socket object used for the connected client
exports.initGame = function(sio, socket) {
	io = sio;
	gameSocket = socket;
	gameSocket.emit('connected', { message: "You are connected!" });
	
	// Host Events
	gameSocket.on('hostCreateNewGame', hostCreateNewGame);
	// gameSocket.on('hostRoomFull', hostPrepareGame);
	gameSocket.on('hostCountdownFinished', hostStartGame);
	// gameSocket.on('hostNextRound', hostNextRound);
	
	// Player Events
	gameSocket.on('playerJoinGame', playerJoinGame);
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
function hostCreateNewGame() {
	// Create a unique Socket.IO Room
	var thisGameId = ( Math.random() * 100000) | 0;
	
	// Return the Room ID (gameId) and the socket ID (mySocketId) to the browser client.
	this.emit('newGameCreated', {gameId: thisGameId, mySocketId: this.id});
	
	// Join the Room and wait for the players.
	this.join(thisGameId.toString());
};

function hostStartGame(gameId) {
	console.log('Game Started.');
}

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
	
	// Look up the room ID in the Socket.IO manager object;
	var room = gameSocket.adapter.rooms[data.gameId];
	
	// If the room exists, attempt to join. Otherwise, present error message.
	if (room != undefined) {
		// Attach the socket id to the data object.
		data.mySocketId = sock.id;
		
		// Join the room.
		sock.join(data.gameId);
		
		console.log('Player ' + data.playerName + ' successfully joining game: ' + data.gameId );
		
		// Emit an event notifying other clients that the player has joined the room.
		sock.broadcast.to(data.gameId).emit('playerJoinedRoom', data);
	} else {
		this.emit('error', {message: "This room does not exist."} );
	}
}