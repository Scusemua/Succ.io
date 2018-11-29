;
jQuery(function($) {
	'use strict';
	
    /**
     * All the code relevant to Socket.IO is collected in the IO namespace.
     *
     * @type {{init: Function, bindEvents: Function, onConnected: Function, onNewGameCreated: Function, playerJoinedRoom: Function, beginNewGame: Function, onNewWordData: Function, hostCheckAnswer: Function, gameOver: Function, error: Function}}
     */	
	var IO = {
		
        /**
         * This is called when the page is displayed. It connects the Socket.IO client
         * to the Socket.IO server
         */		
		init: function() {
			IO.socket = io.connect();
			IO.bindEvents();
		},
		
		/**
		 * While connected, Socket.IO will listen to the following events
		 * emitted by the Socket.IO server, then execute the appropriate function.
		 */
		bindEvents : function() {
			IO.socket.on('connected', IO.onConnected);						// Fires when first connected to server.
			IO.socket.on('player-disconnected', IO.playerDisconnected);		// Fires when a player disconnects from the server.
			IO.socket.on('newGameCreated', IO.onNewGameCreated);			// Fires when a new game is created, rendering the client which fired the event a 'Host'.
			IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);			// Fires when a player joins the game room.
			IO.socket.on('youJoinedRoom', App.Player.youJoinedRoom);		// Fires from the player's socket to the player's client when they join a room.
			IO.socket.on('beginNewGame', IO.beginNewGame);					// Fires when the host starts the game from the pre-game lobby.
			IO.socket.on('gameOver', IO.gameOver);							// Fires when a game ends.
			IO.socket.on('error-occurred', IO.error);						// Fires when an error records.
			IO.socket.on('game-started', IO.showGameScreen);				// Fires when the game has been started by the host and the game actually started.
			IO.socket.on('response', IO.onResponse);						// Fires when a player sends a response to a question to the server (from in-game).
			IO.socket.on('voting-begins', IO.votingBegins);		// Fires when all responses have been submitted and the voting phase begins.
			IO.socket.on('chat message', function(msg) {					// Fires when a player sends a chat message (from the pre-game lobby).
				$('#messages').append($('<li>').text(msg));
			});
			IO.socket.on('vote-casted', IO.voteCasted);
			IO.socket.on('all-votes-final', IO.allVotesFinal);
			/* When the player hits 'enter' while typing in the chat box */
			$(document).on('submit', '#message-box-form', function() {
				// Grab the text and verify that it isn't empty or just spaces.
				var msg = $('#message-box').val();
				var valid = App.verifyText(msg);
				if (!valid) return null;
				// Append the player's name to the message.
				msg = App.Player.myName + ': ' +  msg;
				IO.socket.emit('chat message', msg);
				$('#message-box').val('');
				return false;
			});		
			/* When the player hits 'enter' while typing in the response box */
			$(document).on('submit', '#response-form', function() {
				// If they've already responded, do nothing.
				if (App.responded) return false;
				// Grab the text and verify that it isn't empty or just spaces.
				var response = $('#response').val();
				var valid = App.verifyText(response);
				if (!valid) return null;
				// Append the player's name to the message.
				response = response;
				var data = {
					response: response,
					playerId: App.mySocketId,
					gameId: App.gameId
				}
				IO.socket.emit('response', data);
				$('#response').val('');
				App.responded = true;
				$('#response').prop('disabled', true);
				$('#response').prop('placeholder', "Your response has been submitted.");
				return false;
			});		
		},
	
		/**
		 * The client is successfully connected.
  		 */
		onConnected : function() {
			// Cache a copy of the client's socket.IO session ID on the App.
			App.mySocketId = IO.socket.io.engine.id;
			console.log('SessionID: ' + App.mySocketId);
		},
	
		/** 
		 * A new game has been created, and a random game ID has been generated.
		 * @param data {{ gameId: int, mySocketId: *}}
		 */
		onNewGameCreated : function(data) {
			App.Host.gameInit(data);
		},
		
		// Update the game screen such that the UI for the actual game is shown.
		showGameScreen: function(data) {
			App.gameStarted = true;
			App.showGameScreen(data);
		},
		
		/**
		* An error has occurred.
		* @param data
		*/
		error : function(data) {
			alert(data.message);
		},

		// Executes when a player joins a game room.
		playerJoinedRoom: function(data) {
			App[App.myRole].playerJoinedRoom(data);
		},
		
		// Executes when a player has disconnected from the room in which this client resides.
		// The data passed to the function is the socket id of the disconnected client. This
		// is used to remove that list element from the players waiting list.
		playerDisconnected: function(data) {
			App.playerDisconnected(data);
		},		
		
		// Executes when a player responds to a question in-game.
		onResponse: function(data) {
			App[App.myRole].onResponse(data);
		},
		
		// Executes when the voting phase of the game/round begins.
		votingBegins: function(data) {
			App.votingBegins(data);
		},
		
		// Executes when the server notifies the clients of a vote-casted.
		// This will only trigger a method on the host client.
		voteCasted: function(data) {
			App[App.myRole].voteCasted(data);
		},
		
		allVotesFinal: function(data) {
			App[App.myRole].allVotesFinal(data);
		}
	};
	
	var App = {
		
		/** 
		 * Keep track of the gameId, which is identical to the ID
		 * of the Socket.IO Room used for the players and host to communicate.
		 */
		gameId: 0,
		
		/**
		 * THis is used to differentiate between the 'Host' and 'Player' browsers.
		 */
		myRole: '', // 'Player' or 'Host'
		
		/**
		 * Identifies the current round. Rounds start at Round 0.
		 */
		currentRound: 0,
		
		/**
		 * Used when displaying the count-down in the chat box when the host clicks start.
		 */
		counter: 5,	
		
		/* Flag which indicates whether a player has already responded to the current question. 
		 * When this is true, they cannot type more answers into the prompt, and any new answers
		 * will not actually be submitted should they circumvent the disabled input text box.
		 */
		responded: false,
		
		/* Flag which indicates whether or not the game has started */
		gameStarted: false,
		
		// This represents the selected response within the voting list.
		// It is stored as the clientID associated with that response. 
		// It is updated by selecting different options from the list.
		selectedId: '',
		
		//
		//
		//
		// SETUP
		//
		//
		//
		/**
		 * This function executes when the page initially loads.
		 */ 
		init: function () {
			App.cacheElements();
			App.showInitScreen();
			App.bindEvents();
			
			// Initialize the fastclick library.
			FastClick.attach(document.body);
		},
		 
		/**
		* Create references to on-screen elements used during game.
		*/
		cacheElements: function() {
			App.$doc = $(document);

			//
			// Templates
			//
			// This is the main container where all game UI will be displayed.
			App.$gameArea = $('#gameArea');						
			// This is the container which will house the 'Start' button for just the host client.
			App.$hostStartBtnArea = $('#hostStartBtnArea');
			// This is the template which contains the question and response interface.
			App.$templateQuestionGame = $('#game-question-template').html();
			// Contains the interface for voting for respones.
			App.$templateVoteGame = $('#game-voting-template').html();
			// Contains the interface for choosing to join an existing game or create a new game.
			App.$templateJoinCreate = $('#join-create-template').html();
			// Contains the interface for entering one's nickname.
			App.$templateNickname = $('#nickname-template').html();
			// This is the start button which is to be displayed within the hostStartBtnArea for JUST the host client.
			App.$templateHostStartBtn = $('#host-start-button-template').html();
			// This is the template for the pre-game lobby; this is displayed within the gameArea.
			App.$templateLobby = $('#lobby-template').html();
			// This is the template which contains the interface for supplying a game number and attempting to connect to the corresponding game.
			App.$templateJoinGame = $('#join-game-template').html();
			// This is the overall template for the game. It contains the panelContent element.
			App.$templateGame = $('#game-template').html();
			// This is the template for displaying the most-voted response at the end of the voting stage.
			App.$templateFinalResults = $('#game-display-results').html();
		},
		 
		/**
		* Create some click handlers for the various buttons that
		* appear on the screen.
		*/
		bindEvents: function() {
			//
			// Player
			//
			// 'Join' button - used to join an existing game using the game's ID number.
			App.$doc.on('click', '#btnJoin', App.Player.onJoinClick);	
			// 'Create' button - used to create a new game to which clients may connect using the game's ID number.
			App.$doc.on('click', '#btnCreate', App.Host.onCreateClick);
			// The button which locks in the client's nickname.
			App.$doc.on('click', '#btnConfirmNickname', App.Player.onPlayerConfirmNicknameClick);
			// Button which triggers an attempt to connect to the game with the game id specified by the client.
			App.$doc.on('click', '#btnConfirmGameId', App.Player.onJoinGameConfirmClick);
			// Button which will begin the game from the pre-game lobby; clicked by the host (only the host client may see the button).
			App.$doc.on('click', '#btnHostStartGame', function() {
				 $(this).prop("disabled",true);
				 App.Host.onStartClick();
			});
			// Button which sends to the server this client's vote for the best answer. Disables the vote button once vote is submitted.
			App.$doc.on('click', '#btnConfirmVote', function(e) {
				// Ensure the user has something selected.
				if (App.selectedId === '') {
					return;
				}
				$(this).prop("disabled",true);
				console.log(App.selectedId);
				var data = {
					gameId: App.gameId,
					vote: App.selectedId
				};
				console.log('Confirm Vote: ' + App.selectedId);
				IO.socket.emit('vote-casted', data);
			});		
		}, 
		
		// Displays the Join Game / Create Game template.
		displayJoinCreateMenu: function() {
			// Animate transition.
			App.$gameArea.html(App.$templateJoinCreate).hide();
			App.$gameArea.fadeIn();
		},
		
        /**
         * Show the initial screen
         * (with Start and Join buttons)
         */
        showInitScreen: function() {
			// Animate the transition.
            App.$gameArea.html(App.$templateNickname).hide();
			App.$gameArea.fadeIn();
        },		
		
		 
		// Make the text inside the given element as big as possible.
		// Uses the textFit library.
		// @param el The parent element of some text.
		doTextFit : function(el) {
			textFit(
				$(el)[0],
				{
					alignHoriz:true,
					alignVert:false,
					widthOnly:true,
					reProcess:true,
					maxFontSize:128
				}
			);
		},
		
		// Display the actual game UI (not waiting room or otherwise).
		showGameScreen: function(data) {
			// Animate the transition.
			App.$gameArea.html(App.$templateGame).hide();
			App.$gameArea.fadeIn();
			
			$('#panel-content').html(App.$templateQuestionGame);
			
			// Populate the list of players.
			for (var i = 0; i < data.memberNames.length; i++) {
				var elementId = "listElement_" + data.memberSockets[i];
				$('<li id=' + elementId + '>' + data.memberNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
			}				
		},
		
		// Returns a flag indicating whether or not a string is valid (true indicates validity).
      // A string is valid if it is less than 1000 characters long and does not solely consist of spaces.
		verifyText: function(str) {
			if (str == "") return false;
         if (str.length > 1000) return false;
			var flag = false;
			for (var x = 0; x < str.length; x++) 
			{
				var c = str.charAt(x);
				if (c != " ") flag = true;
			}
			return flag;
		},		
		
		// Executes when a player disconnects from the game. Removes them from the player list.
		playerDisconnected: function(data) {
			$('#listElement_' + data).hide('slow', function(){ $('#listElement_' + data).remove(); });
		},
		
		// Executes when the voting phase of the game/round begins.
		votingBegins: function(data) {
			// This is a container within the game template. This houses the question and voting interfaces. We swap between
			// the two interfaces (which are kept within their own templates) depending on if we are in a question/respone or voting phase of the game.				
			$('#panel-content').html(App.$templateVoteGame);
			var list = $('#response-list');
			
			// Using Fisher-Yates algorithm, shuffle the array so it isn't obvious whose answers are whose.
			var currentIndex = data.keys.length, temporaryValue, randomIndex;
			
		    // While there remain elements to shuffle...
		    while (0 !== currentIndex) {

			  // Pick a remaining element...
			  randomIndex = Math.floor(Math.random() * currentIndex);
			  currentIndex -= 1;

			  // And swap it with the current element.
			  temporaryValue = data.keys[currentIndex];
			  data.keys[currentIndex] = data.keys[randomIndex];
			  data.keys[randomIndex] = temporaryValue;
			  
			  temporaryValue = data.values[currentIndex];
			  data.values[currentIndex] = data.values[randomIndex];
			  data.values[randomIndex] = temporaryValue;			  
		    }
			
			// Load all of the respones into the list.
			for (var i = 0; i < data.keys.length; i++) {
				$('<button type="button" id="e_' + data.keys[i] + '" + class="list-group-item">' + data.values[i] + '</button>').appendTo(list).hide().slideDown();
				$('#e_' + data.keys[i]).on('click', function() {
					App.selectedId = $(this).attr('id').substring(2);
				});	
			}			
		},		
		 
		///
		///
		///
		/// HOST
		///
		///
		///
		 
		Host : {
			 
			// References to the player data.
			players: [],

			roundResponses: {},
			
			points: {},
			
			numVotes: 0,
			
			gameStarting: false,
			
			// Flag to indicate if a new game is starting.
			// Used when game ends and players start new game
			// without refreshing the browser windows.
			isNewGame: false,

			// Keeps track of the number of players who have jonined the game
			numPlayersInRoom: 0,
			 
			// Handler for the 'Start' button on the title screen.
			onCreateClick: function () {
				IO.socket.emit('hostCreateNewGame', App.Player.myName);
			},

			// Host screen is displayed for the first time.
			// @param data {{gameId: int, mySocketId: *}}
			gameInit: function (data) {
				App.gameId = data.gameId;
				App.mySocketId = data.mySocketId;
				App.myRole = 'Host';
				App.Host.numPlayersInRoom = 1;

				App.Host.displayNewGameScreen();
			},
			 
			// Show the Host screen containing the game URL and
			// the unique game ID.
			displayNewGameScreen: function() {
				// Fill the game area with the appropriate HTML.
				// We call .hide() and then .fadeIn() to animate the transition.
				App.$gameArea.html(App.$templateLobby);
				App.$hostStartBtnArea.html(App.$templateHostStartBtn);

				// Show the gameID / room ID on the screen.
				$('#gameCode').text('Room #: ' + App.gameId);
				App.doTextFit('#gameCode', {minFontSize:10, maxFontSize: 20});
				
				var elementId = "listElement_" + App.mySocketId;
				$('<li id=' + elementId + '>' + App.Player.myName + '</li>').appendTo('#players-waiting-list').hide().slideDown();
			},	
			
			onStartClick: function() {
				if (App.gameStarting) {
					return false;
				}
				App.gameStarting = true;
				// Tell the server that the host clicked start.
				// App.$gameArea.html(App.$templateActualGame);
				var intervalId;
				IO.socket.emit('chat message', "HOST STARTED THE GAME - COUNTING DOWN");
				interval: intervalId = setInterval(function() {
					var data = {
						count: App.counter
					}
					// Emit a countdown to the server which will then start displaying the count-down in the chat to the users.
					IO.socket.emit('countdown', data);
					App.counter = App.counter - 100;
					// Display 'counter' wherever you want to display it.
					if (App.counter < 0) {
						// Tell the server that the game is starting.
						IO.socket.emit('game-starting', App.gameId);
						App.$hostStartBtnArea.hide();
						$('#gameCode').hide();
						clearInterval(intervalId);
					}
				}, 1000)
			},
			
			/* When a player enters and submits a response to a question, an event is fired and this method is executed by the host (server-side). */
			onResponse: function(data) {
				// console.log('Client ' + data.playerId + ' responded with: ' + data.response);
				// App.Host.roundResponses.set(data.playerId, data.response);
				App.Host.roundResponses[data.playerId] = data.response;
				
				// Everybody has submitted a response. 
				if (Object.keys(App.Host.roundResponses).length == App.Host.numPlayersInRoom) {
					var d = {
						keys: Object.keys(App.Host.roundResponses),
						values: Object.values(App.Host.roundResponses),
						gameId: App.gameId
					}
					
					// Tell the server to emit the event to all CLIENTS in the game room INCLUDING THE SENDER. 
					IO.socket.emit('voting-begins', d);
				}
			},

			/**
			 * A player has successfully joined the game.
			 * @param data {{playerName: string, gameId: int, mySocketId: int}}
			 */
			playerJoinedRoom : function(data) {
				var elementId = "listElement_" + data.playerId;
				$('<li id=' + elementId + '>' + data.playerName + '</li>').appendTo('#players-waiting-list').hide().slideDown();
				App.Host.numPlayersInRoom++;
			},

			voteCasted: function(data) {
				if (App.Host.points[data.vote] != null) 
				{
					App.Host.points[data.vote]++;
				} 
				else 
				{
					App.Host.points[data.vote] = 1;
				}
				App.Host.numVotes++;
				
				if (App.Host.numVotes == Object.keys(App.Host.roundResponses).length) {
               console.log("Object.keys(App.Host.points) = " + Object.keys(App.Host.points));
               console.log("Object.values(App.Host.points) = " + Object.values(App.Host.points));
               console.log("Object.keys(App.Host.roundResponses) = " + Object.keys(App.Host.roundResponses));
               console.log("Object.values(App.Host.roundResponses) = " + Object.values(App.Host.roundResponses));
					var dataToServer = {
						keysPoints: Object.keys(App.Host.points),
						valuesPoints: Object.values(App.Host.points),
						keysResponses: Object.keys(App.Host.roundResponses),
						valuesResponses: Object.values(App.Host.roundResponses),
						gameId: App.gameId
					}
					
					IO.socket.emit('all-votes', dataToServer);
				}
			},
			
			allVotesFinal: function(data) {
            console.log("allVotes() called for host")
				$('#panel-content').html(App.$templateFinalResults);	
				
				for (var winner in data.winners) {
					console.log(winner, '=', JSON.stringify(data.winners[winner]));
				}
				
				for (var i = 0; i < data.winners.length; i++) {
					var elementId = "listElement_" + data.winners[i];
					var str = JSON.stringify(data.responses[i]);
               // If the winning entry was longer than 100, then only display the first 100 characters.
               if (str.length > 100) {
                  str = str.substring(0, 100) + "..."
               }
               str = str + " [votes received: " + data.maxVotes + "]"
					console.log('str: ' + str);
					$('<li id=' + elementId + '>' + str + '</li>').appendTo('#winning-response-list');
				}				
			},			
		},
		 
		 ///
		 ///
		 ///
		 /// PLAYER
		 ///
		 ///
		 ///
		 
		Player : {
			// Reference to the socket ID of the Host.
			hostSocketID: '',
			 
			// The player's name entered on the 'Join' screen.
			myName: '',
			
			// Click handler for the 'JOIN GAME' button.
			onJoinClick: function() {
				// We call .hide() and then .fadeIn() to animate the transition to the new UI.
				App.myRole = 'Player';
				App.$gameArea.html(App.$templateJoinGame).hide();
				App.$gameArea.fadeIn();
			},
			 
			// Handler for when the Player entered their name and gameID
			// and then proceeded to click 'Start'.
			onPlayerConfirmNicknameClick: function() {
				var playerName = $('#inputPlayerName').val();
				
				if (playerName.length > 25) 
				{
					alert("ERROR: Your nickname cannot exceed twenty-five (25) characters.");
					return false;
				}
				
				// Verify that the player didn't just enter spaces.
				var valid = App.verifyText(playerName);
				if (!valid) {
					alert("Error: Name must have a non-space character!");
					return false;
				}
				
				// Set the appropriate properties for the current player.
				App.Player.myName = playerName;	
				// IO.socket.nickname = playerName;
				IO.socket.emit('playerConfirmName', playerName);
					
				// Send the gameId and playerName to the server.
				App.displayJoinCreateMenu();
			},
			
			// Attempts to join the game with the game id entered by the user.
			onJoinGameConfirmClick: function(data) {
				var gameId = $('#inputGameId').val();
				
				var isnum = /^\d+$/.test(gameId);
				
				if (!isnum) {
					window.alert("Please only enter numbers [0-9] in the Game ID input box.");
					return;
				}

                // Collect data to send to the server.
                var data = {
                    gameId : +($('#inputGameId').val()),
					playerId: App.mySocketId,
                    playerName : App.Player.myName
                };				
				
                // Send the gameId and playerName to the server
                IO.socket.emit('playerJoinGame', data);
			},
			
			// Display the new game screen. This screen won't have a "start" button since this is the player and not the host.
			displayNewGameScreen: function(data) {
				// Fill the game area with the appropriate HTMl
				App.$gameArea.html(App.$templateLobby).hide();
				App.$gameArea.fadeIn();

				// Show the gameID / room ID on the screen.
				$('#gameCode').text('Room #: ' + App.gameId);
				App.doTextFit('#gameCode', {minFontSize:10, maxFontSize: 20});
				
				// Add each player already in the lobby (including THIS client) to the players waiting list.
				// We animate the additions so it looks nice.
				for (var i = 0; i < data.memberNames.length; i++) {
					var elementId = "listElement_" + data.memberSockets[i];
					$('<li id=' + elementId + '>' + data.memberNames[i] + '</li>').appendTo('#players-waiting-list').hide().slideDown();
				}				
			},
			
			// Fired when this client successfully joins a room.
			youJoinedRoom: function(data) {
				App.gameId = data.gameId;
				
				App.Player.displayNewGameScreen(data);			
			},
			
			/**
			 * A player has successfully joined the game.
			 * @param data {{playerName: string, gameId: int, mySocketId: int}}
			 */
			playerJoinedRoom : function(data) {
				var elementId = "listElement_" + data.playerId;
				$('<li id=' + elementId + '>' + data.playerName + '</li>').appendTo('#players-waiting-list').hide().slideDown();
			},			

			onResponse: function(data) {
				// do nothing...
			},		
			
			voteCasted: function(data) {
				// do nothing...
			},
			
			allVotesFinal: function(data) {
            console.log("allVotes() called for client/player")
				$('#panel-content').html(App.$templateFinalResults);	
				for (var i = 0; i < data.winners.length; i++) {
					var elementId = "listElement_" + data.winners[i];
					var str = JSON.stringify(data.responses[data.winners[i]]);
					console.log('str: ' + str);
					$('<li id=' + elementId + '>' + str + '</li>').appendTo('#winning-response-list');
				}		
			}						
		},
	};
	IO.init();
   App.init();
}($));