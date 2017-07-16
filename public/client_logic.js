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
			IO.socket.on('connected', IO.onConnected);
			IO.socket.on('player-disconnected', App.playerDisconnected);
			IO.socket.on('newGameCreated', IO.onNewGameCreated);
			IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);
			IO.socket.on('youJoinedRoom', App.Player.youJoinedRoom);
			IO.socket.on('beginNewGame', IO.beginNewGame);
			IO.socket.on('gameOver', IO.gameOver);
			IO.socket.on('error-occurred', IO.error);
			IO.socket.on('game-started', IO.showGameScreen);
			IO.socket.on('chat message', function(msg) {
				$('#messages').append($('<li>').text(msg));
			});
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
					playerId: App.mySocketId
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
			console.log("SessionID: " + App.mySocketId);
		},
	
		/** 
		 * A new game has been created, and a random game ID has been generated.
		 * @param data {{ gameId: int, mySocketId: *}}
		 */
		onNewGameCreated : function(data) {
			App.Host.gameInit(data);
		},
	 
		/**
		 * A player has successfully joined the game.
		 * @param data {{playerName: string, gameId: int, mySocketId: int}}
		 */
		playerJoinedRoom : function(data) {
			// When a player joins the lobby, do the updateWaitingScreen function.
			App.Host.updateWaitingScreen(data);
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

			// Templates
			App.$gameArea = $('#gameArea');
			App.$hostStartBtnArea = $('#hostStartBtnArea');
			
			App.$templateJoinCreate = $('#join-create-template').html();
			App.$templateNickname = $('#nickname-template').html();
			App.$templateHostStartBtn = $('#host-start-button-template').html();
			App.$templateLobby = $('#lobby-template').html();
			App.$templateJoinGame = $('#join-game-template').html();
			App.$templateGame = $('#game-template').html();
		},
		 
		/**
		* Create some click handlers for the various buttons that
		* appear on the screen.
		*/
		bindEvents: function() {
			// Player
			App.$doc.on('click', '#btnJoin', App.Player.onJoinClick);
			App.$doc.on('click', '#btnCreate', App.Host.onCreateClick);
			App.$doc.on('click', '#btnConfirmNickname', App.Player.onPlayerConfirmNicknameClick);
			App.$doc.on('click', '#btnConfirmGameId', App.Player.onJoinGameConfirmClick);
			App.$doc.on('click', '#btnHostStartGame', App.Host.onStartClick);
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
			
			// Populate the list of players.
			for (var i = 0; i < data.memberNames.length; i++) {
				var elementId = "listElement_" + data.memberSockets[i];
				$('<li id=' + elementId + '>' + data.memberNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
			}				
		},
		
		// Returns true if the given string consists of at least one character that isn't a space.
		verifyText: function(str) {
			if (str == "") return false;
			var flag = false;
			for (var x = 0; x < str.length; x++) 
			{
				var c = str.charAt(x);
				if (c != " ") flag = true;
			}
			return flag;
		},		

		// Executes when a player has disconnected from the room in which this client resides.
		// The data passed to the function is the socket id of the disconnected client. This
		// is used to remove that list element from the players waiting list.
		playerDisconnected: function(data) {
			$('#listElement_' + data).hide('slow', function(){ $('#listElement_' + data).remove(); });
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
				App.Host.numPlayersInRoom = 0;

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
			
			// Add a player's name to the list of waiting players.
			updateWaitingScreen: function(data) {
				var elementId = "listElement_" + data.playerId;
				$('<li id=' + elementId + '>' + data.playerName + '</li>').appendTo('#players-waiting-list').hide().slideDown();
			},			
			
			onStartClick: function() {
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
					App.counter--;
					// Display 'counter' wherever you want to display it.
					if (App.counter < 0) {
						// Tell the server that the game is starting.
						IO.socket.emit('game-starting', App.gameId);
						App.$hostStartBtnArea.hide();
						$('#gameCode').hide();
						clearInterval(intervalId);
					}
				}, 1000)
			}
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
				// App.myRole = 'Player';
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
				// Set the appropriate properties for the current player.
				App.myRole = 'Player';		

				App.gameId = data.gameId;
				
				App.Player.displayNewGameScreen(data);			
			}			
		},
	};
	IO.init();
    App.init();
}($));