var io;
var gameSocket;

// Function called to initialize a new game instance.
// @param sio The Socket.IO library
// @param socket The socket object used for the connected client
exports.initGame = function(sio, socket) {
	io = sio;
	gameSocket = socket;
	gameSocket.emit('connected', { message: "You are connected!"});	// Emtis event to client notiftying client that they successfully connected.
	
	// Host Events
	gameSocket.on('hostCreateNewGame', hostCreateNewGame);		// Fires when a client creates a nwe game.
	gameSocket.on('game-starting', gameStarting);				// Fires when the game is beginning (host pressed Start).
	gameSocket.on('response', function(data) {					// Fires when a player sends a response to the server from the actual game.
		io.in(data.gameId).emit('response', data);
	});
	gameSocket.on('voting-begins', votingBegins);
	gameSocket.on('vote-casted', voteCasted);
	gameSocket.on('all-votes', allVotesReceived);
	
	// Player Events
	gameSocket.on('playerJoinGame', playerJoinGame);			// Fires when a player joins the game room.
	gameSocket.on('playerConfirmedName', playerConfirmName);	// Fires when a player confirms their nickname so we can add the nickname to the socket.
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

// Executes when the game begins. Alerts clients that game is starting and sends data to clients with information about the room.
function gameStarting(gameId) {
	console.log('Game ' + gameId + ' Started!!!');
	var sock = this;
	var room = gameSocket.adapter.rooms[gameId];
	
	var memberNames = [];
	var memberSockets = [];
	var clients = room.sockets;
	console.log(clients);
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

// This event is triggered when the voting phase of the game begins. The host client will emit an event to the server which
// will execute this method. This method will emit events to all the clients in thr host client's room to notify the
// clients that it is time to vote. This method will also send the clients the responses to the clients may display them and report the votes
// back to the server and then host client properly.
function votingBegins(data) {
	io.in(data.gameId).emit('voting-begins', data);
}

// This event is triggered when a client votes for a response during the voting stage of the game. This method will emit an event
// to the clients, telling the host to increase the point tally for the appropriate response based on the vote field of the data parameter.
function voteCasted(data) {
	io.in(data.gameId).emit('vote-casted', data);
}

function allVotesReceived(data) {
   // console.warn("allVotesReceived() called...")
   // console.warn("data = " + data)
	var i;							      // Loop.
	var max = data.valuesPoints[0];  // Maximum value.
   console.warn("max = " + max);
	var maxId = data.keysPoints[0];  // PlayerID that got the most points.
   console.warn("maxId = " + maxId);
	var tieFound = false;			   // Indicates whether or not we found a tie.
	var winners = [];				      // Array of winners (stored as their IDs).
   // Find largest or find a tie...
	for (i = 1; i < data.keysPoints.length; i++) {
		if (data.valuesPoints[i] > max) {
			max = data.valuesPoints[i];
			maxId = data.keysPoints[i];
			tieFound = false;
		}
		else if (data.valuesPoints[i] == max) {
			tieFound = true;
		}
	}
	// If tieFound is true at this point, then that means that a tie was found and no larger values came along after the tie. 
	// Now we must find all point-values equal to max.
	if (tieFound == true) {
		var j;
		for (j = 0; j < data.keysPoints.length; j++) {
			if (data.valuesPoints[j] == max) {
            // console.warn("Pushing " + data.keysPoints[j] + " onto/into winners (there was a tie)")
            // Populate winners with all the players who tied for first place (with regard to number of votes)
				winners.push(data.keysPoints[j]);
			}
		}		
	}
	else {
      // Push the sessionID of the winning player into the player's array. 
      // If there was a tie, then winners will have more than one entry.
		winners.push(maxId);
	}
   // console.warn("winners = " + winners);
   // console.warn("data.valuesResponses = " + data.valuesResponses)
	var finalData = {
		winners: winners,
		responses: data.valuesResponses,
      maxVotes: max 
	}
	
	io.in(data.gameId).emit('all-votes-final', finalData);
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