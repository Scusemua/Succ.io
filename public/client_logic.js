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
			IO.socket.on('newGameCreated', IO.onNewGameCreated);
			IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);
			IO.socket.on('beginNewGame', IO.beginNewGame);
			IO.socket.on('gameOver', IO.gameOver);
			IO.socket.on('error', IO.error);
			IO.socket.on('chat message', function(msg) {
				$('#messages').append($('<li>').text(msg));
			});			
			$(document).on('click', '#btn-send-message', function() {
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
		 * @param data {{playerName: string, gameId: iint, mySocketId: int}}
		 */
		playerJoinedRoom : function(data) {
			// When a player joins the lobby, do the updateWaitingScreen function.
			// There is a version of this function for the host and for the player.
			App.updateWaitingScreen(data);
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
			App.$templateNewGame = $('#new-game-template').html();
			App.$templateJoinGame = $('#join-game-template').html();
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
		}, 
		
		// Displays the Join Game / Create Game template.
		displayJoinCreateMenu: function() {
			App.$gameArea.html(App.$templateJoinCreate);
		},
		
        /**
         * Show the initial screen
         * (with Start and Join buttons)
         */
        showInitScreen: function() {
            App.$gameArea.html(App.$templateNickname);
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
				IO.socket.emit('hostCreateNewGame');
				console.log('Create game clicked.');
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
				// Fill the game area with the appropriate HTMl
				App.$gameArea.html(App.$templateNewGame);
				App.$hostStartBtnArea.html(App.$templateHostStartBtn);

				// Show the gameID / room ID on the screen.
				$('#gameCode').text('Room #: ' + App.gameId);
				App.doTextFit('#gameCode', {minFontSize:10, maxFontSize: 20});
				
				$('#players-waiting-list').append($('<li>').text(App.Player.myName));	
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
				App.$gameArea.html(App.$templateJoinGame);
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
				 
				// Send the gameId and playerName to the server.
				App.displayJoinCreateMenu();
			},
			
			// Attempts to join the game with the game id entered by the user.
			onJoinGameConfirmClick: function(data) {
				console.log("Join game confirm clicked.");
				
				var gameId = $('#inputGameId').val();
				
				var isnum = /^\d+$/.test(gameId);
				
				if (!isnum) {
					window.alert("Please only enter numbers [0-9] in the Game ID input box.");
					return;
				}

                // Collect data to send to the server.
                var data = {
                    gameId : +($('#inputGameId').val()),
                    playerName : App.Player.myName
                };				
				
                // Send the gameId and playerName to the server
                IO.socket.emit('playerJoinGame', data);

                // Set the appropriate properties for the current player.
                App.myRole = 'Player';		

				App.Player.displayNewGameScreen();
			},
			
			// Display the new game screen. This screen won't have a "start" button since this is the player and not the host.
			displayNewGameScreen: function() {
				// Fill the game area with the appropriate HTMl
				App.$gameArea.html(App.$templateNewGame);

				// Show the gameID / room ID on the screen.
				$('#gameCode').text('Room #: ' + App.gameId);
				App.doTextFit('#gameCode', {minFontSize:10, maxFontSize: 20});
				
				$('#players-waiting-list').append($('<li>').text(App.Player.myName));	
			}
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
		
		// Add a player's name to the list of waiting players.
		updateWaitingScreen: function(data) {
			$('#players-waiting-list').append($('<li>').text(data.playerName));
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
		}			
	};
	IO.init();
    App.init();
}($));