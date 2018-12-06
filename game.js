var io;
var gameSocket;

var questions;
var points;

// TO-DO:
// 0.) Keep track of score; make game "winnable"

// Function called to initialize a new game instance.
// @param sio The Socket.IO library
// @param socket The socket object used for the connected client
exports.initGame = function(sio, socket) {
	io = sio;
	gameSocket = socket;
   questions = [];
   points = {};
	gameSocket.emit('connected', { message: "You are connected!"});	// Emtis event to client notiftying client that they successfully connected.
	
   var lineReader = require('readline').createInterface({
      input: require('fs').createReadStream('questions.txt')
   });

   lineReader.on('line', function (line) {
      questions.push(line);
   }); 
   
   
	// Host Events
	gameSocket.on('hostCreateNewGame', hostCreateNewGame)    // Fires when a client creates a nwe game.
	gameSocket.on('game-starting', gameStarting);	         // Fires when the game is beginning (host pressed Start).
	gameSocket.on('response', function(data) {					// Fires when a player sends a response to the server from the actual game.
		io.in(data.gameId).emit('response', data);
	});
	gameSocket.on('voting-begins', votingBegins);
	gameSocket.on('vote-casted', voteCasted);
	gameSocket.on('all-votes', allVotesReceived);
	
	// Player Events
	gameSocket.on('playerJoinGame', playerJoinGame);			// Fires when a player joins the game room.
	gameSocket.on('playerConfirmName', playerConfirmName);	// Fires when a player confirms their nickname so we can add the nickname to the socket.
	// gameSocket.on('playerAnswer', playerAnswer);
	// gameSocket.on('playerRestart', playerRestart);
}

// Randomly select a question from the questions array and return it. 
function selectQuestion() {
   var index = Math.floor(Math.random() * (questions.length + 1));
   return questions[index];
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
   var pointsForThisRoom = {};
	for (var index = 0; index < clients.length; index++) {
      var clientId = clients[index];
		memberSockets.push(clientId);
      pointsForThisRoom[clientId.toString()] = 0;
		memberNames.push(io.sockets.connected[clientId].nickname);
	}
   this.points[gameId.toString()] = pointsForThisRoom;   
   
   var question = selectQuestion();
   
	var personalData = {
		memberNames: memberNames,
		memberSockets: memberSockets,
		gameId: gameId,
      question: question,
      pointsKeys: Object.keys(pointsForThisRoom),
      pointsValues: Object.values(pointsForThisRoom)
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
   console.warn("[GAME " + data.gameId + "] Vote cast for " + data.vote + " [" + data.voteText + "]");
	io.in(data.gameId).emit('vote-casted', data);
}

function allVotesReceived(data) {
   // console.warn("allVotesReceived() called...")
   // console.warn("data = " + data)
	var maxNumVotes = data.valuesVotes[0];      // Maximum value.
   var maxVotesIndex = 0;
   // console.warn("maxNumVotes = " + maxNumVotes);
	var maxPlayerId = data.keysVotes[0];        // PlayerID that got the most points.
   // console.warn("maxPlayerId = " + maxPlayerId);
	var tieFound = false;			               // Indicates whether or not we found a tie.
	var winningSessionIds = [];				      // Array of winners (stored as their IDs).
   var winningResponses = [];                   // Array of winning responses.
   
   //console.warn("data.keysVotes = " + data.keysVotes);
   //console.warn("data.valuesVotes = " + data.valuesVotes);
   //console.warn("data.keysResponses = " + data.keysResponses);
   //console.warn("data.valuesResponses = " + data.valuesResponses);
   
   // Find largest or find a tie...
	for (var i = 1; i < data.keysVotes.length; i++) {
		if (data.valuesVotes[i] > data.valuesVotes[maxVotesIndex]) {
         maxVotesIndex = i;
			tieFound = false;
		}
		else if (data.valuesVotes[i] == maxNumVotes) {
			tieFound = true;
		}
	}
   
   //console.warn("Tie found? " + tieFound);
   
	// If tieFound is true at this point, then that means that a tie was found and no larger values came along after the tie. 
	// Now we must find all point-values equal to maxNumVotes.
	if (tieFound == true) {
		for (var j = 0; j < data.keysVotes.length; j++) {
			if (data.valuesVotes[j] == data.valuesVotes[maxVotesIndex]) {
            // Populate winningSessionIds with all the players who tied for first place (with regard to number of votes)
				winningSessionIds.push(data.keysVotes[j]);
            winningResponses.push(data.valuesResponses[j]);
			}
		}		
	}
	else {
      maxPlayerId = data.keysVotes[maxVotesIndex];
      // Get the index that the player's response is stoerd at.
      var responseIndex = data.keysResponses.indexOf(maxPlayerId);      
      // Push the sessionID of the winning player into the player's array. 
      // If there was a tie, then winners will have more than one entry.
		winningSessionIds.push(maxPlayerId);
      winningResponses.push(data.valuesResponses[responseIndex]);
	}
   
   // For each winner, increment their points.
   var pointsForThisRoom = points[data.gameId.toString()];
   for (var index = 0; index < winningSessionIds.length; index++) {
      var currentId = winningSessionIds[index];
      pointsForThisRoom[currentId.toString()] = pointsForThisRoom[currentId.toString()] + 1;
      console.warn("[GAME " + data.gameId + "] Points for " + currentId + ": " + pointsForThisRoom[currentId.toString()]);      
   }
   
   // Create a list of the IDs of all the players in the room and 
   // send it to the host so they know how many respones are needed and whatnot.
   var playersSocketIDs = [];
   var playerNames = [];
   var room = gameSocket.adapter.rooms[data.gameId];
   var clients = room.sockets;
   for (var index = 0; index < clients.length; index++) {
      var clientId = clients[index];
		playersSocketIDs.push(clientId);
      playerNames.push(io.sockets.connected[clientId].nickname);
	}
   
   console.warn("winningSessionIds = " + winningSessionIds);
   //console.warn("winningResponses = " + winningResponses)
   //console.warn("maxNumVotes = " + maxNumVotes)
	var finalData = {
		winners: winningSessionIds,
		responses: winningResponses,
      maxVotes: data.valuesVotes[maxVotesIndex], 
      pointsKeys: Object.keys(pointsForThisRoom),
      pointsValues: Object.values(pointsForThisRoom)
	}
   
   var question = selectQuestion();
   
   // This goes to the host only.
   var nextRoundData = {
      currentPlayersIDs: playersSocketIDs,
      currentPlayerNames: playerNames,
      question: question
   }
	
	io.in(data.gameId).emit('all-votes-final', finalData);
   
   // TODO: CHANGE THE '1500' TO '10000'
   // IT IS '1500' TO SPEED UP TESTING 
   setTimeout(function() {
      io.in(data.gameId).emit('next-round', nextRoundData);
   }, 7500);
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
	
   var pointsForThisRoom = points[data.gameId.toString()];
   console.warn("pointsForThisRoom = " + pointsForThisRoom);
   pointsForThisRoom[sock.id.toString()] = 0;
   
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
		for (var index = 0; index < clients.length; index++) {
         var clientId = clients[index];
			memberSockets.push(clientId);
			memberNames.push(io.sockets.connected[clientId].nickname);
		}
		
		// Data that isn't to go to all the other clients	
		var personalData = {
			memberNames: memberNames,
			memberSockets: memberSockets,
			gameId: data.gameId,
         pointsKeys: Object.keys(pointsForThisRoom),
         pointsValues: Object.values(pointsForThisRoom)
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