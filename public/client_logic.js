$.fn.extend({
  animateCss: function(animationName, callback) {
    var animationEnd = (function(el) {
      var animations = {
        animation: 'animationend',
        OAnimation: 'oAnimationEnd',
        MozAnimation: 'mozAnimationEnd',
        WebkitAnimation: 'webkitAnimationEnd',
      };

      for (var t in animations) {
        if (el.style[t] !== undefined) {
          return animations[t];
        }
      }
    })(document.createElement('div'));

    this.addClass('animated ' + animationName).one(animationEnd, function() {
      $(this).removeClass('animated ' + animationName);

      if (typeof callback === 'function') callback();
    });

    return this;
  },
});
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
			IO.socket.on('player-disconnected', IO.playerDisconnected);	// Fires when a player disconnects from the server.
			IO.socket.on('newGameCreated', IO.onNewGameCreated);			// Fires when a new game is created, rendering the client which fired the event a 'Host'.
			IO.socket.on('playerJoinedRoom', IO.playerJoinedRoom);		// Fires when a player joins the game room.
			IO.socket.on('youJoinedRoom', App.Player.youJoinedRoom);		// Fires from the player's socket to the player's client when they join a room.
			IO.socket.on('beginNewGame', IO.beginNewGame);					// Fires when the host starts the game from the pre-game lobby.
			IO.socket.on('gameOver', IO.gameOver);							   // Fires when a game ends.
			IO.socket.on('error-occurred', IO.error);					   	// Fires when an error records.
			IO.socket.on('game-started', IO.showGameScreen);				// Fires when the game has been started by the host and the game actually started.
			IO.socket.on('response', IO.onResponse);						   // Fires when a player sends a response to a question to the server (from in-game).
			IO.socket.on('voting-begins', IO.votingBegins);		         // Fires when all responses have been submitted and the voting phase begins.
         IO.socket.on('game-over', IO.gameOver);                     // Fires once somebody wins the game.   
			IO.socket.on('chat message', function(msg) {					   // Fires when a player sends a chat message (from the pre-game lobby).
				// Determines whether or not we should scroll down to see new messages. 
            //var shouldScroll = $('#messages').prop('scrollTop') + $('#messages').prop('clientHeight') === $('#messages').prop('scrollHeight');
            $('#messages').append($('<li>').text(msg));
            
            // For now, just scroll down if a new message was sent. This will be absurdly annoying if 
            // a player is trying to scroll up to view old messages, but we can extend this later.
            var scrollHeight = $('#messages').prop('scrollHeight');
            $('#messages').prop('scrollTop', scrollHeight);         
			});
         IO.socket.on('next-round', IO.nextRound);
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
				if (!valid) {
               alert("Answer cannot consist solely of spaces and must be under 1000 characters in length.");
               return;
            }
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
      
      gameStates: {"LOBBY":0, "QUESTION":1, "VOTING":2, "WINNERS":3},
	
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
			App.showGameScreen(data);
		},
		
		/**
		* An error has occurred.
		* @param data
		*/
		error : function(data) {
			alert(data.message);
         
         // Re-enable the join button in case the error was bc join failed 
         $('btnConfirmGameId').prop("disabled", false);
		},

		// Executes when a player joins a game room.
		playerJoinedRoom: function(data) {
			App[App.myRole].playerJoinedRoom(data);
		},
		
		// Executes when a player has disconnected from the room in which this client resides.
		// The data passed to the function is the socket id of the disconnected client. This
		// is used to remove that list element from the players waiting list.
		playerDisconnected: function(data) {
         if (App[App.myRole] != null) {
            App[App.myRole].playerDisconnected(data);            
         }
         else {
            console.warn("App[App.myRole] is null");
         }
		},		
      
      // A player won the game. Display winners then return to lobby.
      gameOver: function(data) {
         App[App.myRole].gameOver(data);
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
		},
      
      nextRound: function(data) {
         App[App.myRole].nextRound(data);
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
      
		// This represents the selected response within the voting list.
		// It is stored as the clientID associated with that response. 
		// It is updated by selecting different options from the list.
		selectedId: '',
      
      // Current question.
      question: '',
      
      // Client-side copy of the points for this room. The server maintains this data 
      // and broadcasts it at the end of rounds and to new players when they join the room.
      points: {},      
		
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
         // Displayed when a player joins mid-game. 
         App.$templateAwaitingNextRound = $('#game-awaiting-next-round').html();
			// This is the overall template for the game. It contains the panelContent element.
			App.$templateGame = $('#game-template').html();
         // Displayed when somebody wins the game.
         App.$templateWinner = $('#winner-template').html();
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
				
            $('#btnConfirmVote').prop("disabled", true);
            $('#e_' + App.selectedId).css("color", '#51bc21');
            
				console.log(App.selectedId);
				var data = {
					gameId: App.gameId,
					vote: App.selectedId,
               voteText: $('#e_' + App.selectedId).text()
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
         App.$gameArea.html(App.$templateNickname);
                      
         /*for (var i = 0; i < 200; i++) {
            App.create(i);
         }*/
     },		
      
      /*create(i) {
  var width = Math.random() * 8;
  var height = width * 0.4;
  var colourIdx = Math.ceil(Math.random() * 3);
  var colour = "red";
  switch(colourIdx) {
    case 1:
      colour = "yellow";
      break;
    case 2:
      colour = "blue";
      break;
    default:
      colour = "red";
  }
  $('<div class="confetti-'+i+' '+colour+'"></div>').css({
    "width" : width+"px",
    "height" : height+"px",
    "top" : -Math.random()*20+"%",
    "left" : Math.random()*100+"%",
    "opacity" : Math.random()+0.5,
    "transform" : "rotate("+Math.random()*360+"deg)"
  }).appendTo('.wrapper');  
  
  App.drop(i);
       },
      
      drop(x) {
        $('.confetti-'+x).animate({
          top: "100%",
          left: "+="+Math.random()*15+"%"
        }, Math.random()*3000 + 3000, function() {
          App.reset(x);
        });
      },

      reset(x) {
        $('.confetti-'+x).animate({
          "top" : 0+"%",
          "left" : "-="+Math.random()*15+"%"
        }, 0, function() {
          App.drop(x);             
        });
      },    */ 
		
		 
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

         // Copy in all the socketIDs for the current players to the Host.
         for (var j = 0; j < data.memberSockets.length; j++) {
            App.Host.playersParticipating[j] = data.memberSockets[j];
         }
         
         for (var index = 0; index < data.pointsKeys.length; index++) {
            var currentKey = data.pointsKeys[index];
            var currentValue = data.pointsValues[index];
            App.points[currentKey] = currentValue;
         }
         
         console.warn("App.Host.playersParticipating = " + App.Host.playersParticipating);  
         
         $('#panel-content').html(App.$templateQuestionGame);
			
			// Populate the list of players in either of the aforementioned cases.
			for (var i = 0; i < data.memberNames.length; i++) {
				var elementId = "listElement_" + data.memberSockets[i];
				$('<li id=' + elementId + '>' + data.memberNames[i] + ' [0]</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
			}			
         
         App.question = data.question;
         $('#question-text').text(App.question);             
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
		
		// Executes when the voting phase of the game/round begins.
		votingBegins: function(data) {
         // Update the game state 
         App.Host.currentGameState = IO.gameStates.VOTING;         
         
         // If client is a player and they joined mid-round, don't do anything. They shouldn't vote.
         if (new String(App.myRole).valueOf() == new String('Player').valueOf()) {
            if (App.Player.waitingForNextRound) {
               return;
            }
         }
         
			// This is a container within the game template. This houses the question and voting interfaces. We swap between
			// the two interfaces (which are kept within their own templates) depending on if we are in a question/respone or voting phase of the game.				
			$('#panel-content').html(App.$templateVoteGame).hide();
         $('#panel-content').fadeIn();
			
         // Make sure the vote button is enabled. If this is not the first 
         // round, then it will be disabled from the last round (I think?)
         $('#btnConfirmVote').prop("disabled", false);
         
         $('#question-voting').text(App.question); 
         
         var list = $('#response-list');
			
			// Using Fisher-Yates algorithm, shuffle the array so it isn't obvious whose answers are whose.
			var currentIndex = data.keys.length;
         var temporaryValue;
         var randomIndex;
			
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
         
         votes: {},
			
			numVotes: 0,

			// Keeps track of the number of players who have jonined the game
			numPlayersInRoom: 0,
         
         // The socket ID's of players who were present at the beginning of the round
         // and who haven't left, meaning they're still participating in the game.
         playersParticipating: [],
         
         currentGameState: IO.gameStates.LOBBY, 
			 
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
            App.Host.numPlayersAtStartOfRound = 1;

				App.Host.displayNewGameScreen();
			},
         
         // Executes when a player disconnects from the game. Removes them from the player list.
         // Since this is the Host, this also updates the numPlayersInRoom. We need to check if
         // all the other players have voted now since somebody left and perhaps they were the
         // only person not to vote.
         playerDisconnected: function(data) {
            $('#listElement_' + data).hide('slow', function(){ $('#listElement_' + data).remove(); });
            
            // Decrement the number of players in the room.
            App.Host.numPlayersInRoom = App.Host.numPlayersInRoom - 1;
            
            App.Host.playersParticipating = 
               App.Host.playersParticipating.filter(function(e) {
                  return e != data
               });
            
				// Everybody has submitted a response. 
				if (Object.keys(App.Host.roundResponses).length >= App.Host.playersParticipating.length) {
					var d = {
						keys: Object.keys(App.Host.roundResponses),
						values: Object.values(App.Host.roundResponses),
						gameId: App.gameId
					}
					
					// Tell the server to emit the event to all CLIENTS in the game room INCLUDING THE SENDER. 
					IO.socket.emit('voting-begins', d);
				}            
         },         
			 
			// Show the Host screen containing the game URL and
			// the unique game ID.
			displayNewGameScreen: function() {
				// Fill the game area with the appropriate HTML.
				// We call .hide() and then .fadeIn() to animate the transition.
            
            App.$gameArea.html(App.$templateLobby);
				App.$hostStartBtnArea.html(App.$templateHostStartBtn);
				// Show the gameID / room ID on the screen.
				$('#gameCode').html('<p style="font-size:64px; text-align: center">RoomID: ' + App.gameId + '</p>');
				//App.doTextFit('#gameCode', {minFontSize:10, maxFontSize: 20});
				
				var elementId = "listElement_" + App.mySocketId;
				$('<li id=' + elementId + ' style="font-weight:bold">' + App.Player.myName + ' [0]</li>').appendTo('#players-waiting-list').hide().slideDown();
            
            $('#messages').append($('<li style="color: #676767">').text("You are the HOST. Press \"Start\" to start the game."));
			},	
			
			onStartClick: function() {
            console.warn("[HOST]: Start button clicked.");
            
            // Disable the start button so that it cannot be clicked anymore...
				$('#btnHostStartGame').prop('disabled', true);
            
            // Update the game state.
				App.Host.currentGameState = IO.gameStates.QUESTION;
            
				// Tell the server that the host clicked start.
				// App.$gameArea.html(App.$templateActualGame);
				var intervalId;
            
            App.$hostStartBtnArea.hide();
            
				// IO.socket.emit('chat message', "HOST STARTED THE GAME - COUNTING DOWN");
            IO.socket.emit('game-starting', App.gameId);
			},
			
			/* When a player enters and submits a response to a question, an event is fired and this method is executed by the host (server-side). */
			onResponse: function(data) {
				App.Host.roundResponses[data.playerId] = data.response;
				
				// Everybody has submitted a response. 
				if (Object.keys(App.Host.roundResponses).length == App.Host.playersParticipating.length) {
					var data = {
						keys: Object.keys(App.Host.roundResponses),
						values: Object.values(App.Host.roundResponses),
						gameId: App.gameId
					}
					
					// Tell the server to emit the event to all CLIENTS in the game room INCLUDING THE SENDER. 
					IO.socket.emit('voting-begins', data);
				}
			},

			/**
			 * A player has successfully joined the game.
			 * @param data {{playerName: string, gameId: int, mySocketId: int}}
			 */
			playerJoinedRoom : function(data) {
            console.warn("[HOST] Player joined.");
				var elementId = "listElement_" + data.playerId;
				$('<li id=' + elementId + ' class="fadeInUp animated fast">' + data.playerName + ' [0]</li>').appendTo('#players-waiting-list'); //.hide().slideDown();
            $('<li id=' + elementId + ' class="fadeInUp animated fast">' + data.playerName + ' [0]</li>').appendTo('#players-waiting-list-ingame'); //.hide().slideDown();
				App.Host.numPlayersInRoom++;
            
            $('#messages').append($('<li style="color: #7c89bd">').text(data.playerName + " connected to the game."));
			},

			voteCasted: function(data) {
            console.warn("Vote Casted: " + data.vote);
				if (App.Host.votes[data.vote] != null) 
				{
					App.Host.votes[data.vote]++;
				} 
				else 
				{
					App.Host.votes[data.vote] = 1;
				}
				App.Host.numVotes++;
				
				if (App.Host.numVotes >= App.Host.playersParticipating.length) {
					var dataToServer = {
						keysVotes: Object.keys(App.Host.votes),
						valuesVotes: Object.values(App.Host.votes),
						keysResponses: Object.keys(App.Host.roundResponses),
						valuesResponses: Object.values(App.Host.roundResponses),
						gameId: App.gameId
					}
					
					IO.socket.emit('all-votes', dataToServer);
				}
			},
			
         // This function is triggered by an event emitted by the server once the server is finished
         // tallying all of the votes and whatnot. Ten seconds after the server emits that event, the
         // server will emit an event starting the next round.
			allVotesFinal: function(data) {
            console.warn("allVotesFinal() [HOST]");
            // Update game state 
            App.Host.currentGameState = IO.gameStates.WINNERS;
            
            // console.warn("Object.keys(App.points): " + Object.keys(App.points));
            // console.warn("Object.values(App.points): " + Object.values(App.points));
            
            // Grab all of the updated points.
            App.points = {};
            for (var i = 0; i < data.pointsKeys.length; i++) {
               App.points[data.pointsKeys[i]] = data.pointsValues[i];
            }
            
            // console.warn("data.pointsKeys = " + data.pointsKeys);
            // console.warn("data.pointsValues = " + data.pointsValues);
            
            // Host Method 
				$('#panel-content').html(App.$templateFinalResults).hide();
            $('#panel-content').fadeIn();
            
            $('#question-results').text(App.question); 
            
            // Update the players list to visually show point changes from the round.
				for (var index = 0; index < data.roundWinners.length; index++) {
               var winner = data.roundWinners[index];
               var currentText = $('#listElement_' + winner).text();
               console.warn("currentText = " + currentText);
               
               // We want to capture just the user's name from the currentText variable. We need to subtract a certain
               // number of characters from the end. We definitely subtract at least three since we need to subtract the
               // space and the two brackets '[' ']', but we also need to subtract the digits. This, of course, depends 
               // upon the number of digits in the player's point value, so we calculate that here.
               var lengthOfPointsText = -1;
               if (App.points[winner] == 10) {
                     // If the winner now has ten points, then that means the current amount they have displayed is 9.
                     // That is, " [9]". The length of this is 4 total, as the length of '9' is one and the length of all
                     // the other characters is 3. However, if we compute the length of App.points[winner], then that will 
                     // be two since the length of '10' is 2. Since ten is not actually displayed right now (nine is), we do
                     // not want to count both digits of ten. Thus, we add 2 instead of 3 to the length. 
                     lengthOfPointsText = App.points[winner].toString().length + 2;
               }
               else {
                     lengthOfPointsText = App.points[winner].toString().length + 3;
               }
               console.warn("length of points text: " + lengthOfPointsText);
               console.warn("length of current text: " + currentText.length);
               currentText = currentText.substring(0, currentText.length - lengthOfPointsText);
               $('#listElement_' + winner).text(currentText + ' [' + App.points[winner] + ']');
				}
				
				for (var i = 0; i < data.roundWinners.length; i++) {
					var elementId = "listElement_" + data.roundWinners[i];
					var str = JSON.stringify(data.responses[i]);
               // If the winning entry was longer than 100, then only display the first 100 characters.
               if (str.length > 100) {
                  str = str.substring(0, 100) + "..."
               }
               str = str + " <strong>[votes received: " + data.maxVotes + "]</strong>"
					console.log('str: ' + str);
					$('<li id=' + elementId + ' class="fadeIn animated faster">' + str + '</li>').appendTo('#winning-response-list');
				}			
			},	
         
         // [Host]
         gameOver: function(data) {
            App.$gameArea.html(App.$templateWinner);
            for (var i = 0; i < data.winnerNames.length; i++) {
               $('<p style="font-size:64px; text-align: center">' + data.winnerNames[i] + '</p>').appendTo('#winners-list');
            }
            
            // Reset the flag indicating that the user has responded. 
            // If this is not reset, then the user won't be able to submit a new answer.
            App.responded = false;
            
            // Reset the vote counter.
            App.Host.numVotes = 0;
            
            // Increment the round counter. 
            App.currentRound = 0;     

            // Clear the participating players list and repopulate it with data received from the server.
            App.Host.playersParticipating = [];
            for (var i = 0; i < data.currentPlayersIDs.length; i++) {
               App.Host.playersParticipating[i] = data.currentPlayersIDs[i]; 
            }
            
            console.warn("App.Host.playersParticipating = " + App.Host.playersParticipating);
            
            // Make sure to clear the roundResponses dictionary/map as well.
            App.Host.roundResponses = {}   

            // Clear the points dictionary/map. 
            App.Host.votes = {}
            
            // Update the game state. 
            App.Host.currentGameState = IO.gameStates.LOBBY;
               
            setTimeout(function () {
               App.Host.returnToLobby(data);
            }, 8000);
         },
         
         // [Host]
         // Show the lobby screen again, populate the players list, reset start button, etc.
         returnToLobby: function(data) {
            console.log("[HOST] Returning to lobby...");
            App.$gameArea.html(App.$templateLobby);
            App.$hostStartBtnArea.html(App.$templateHostStartBtn);
            $('#hostStartBtnArea').show();
            $('#btnHostStartGame').show();
            $('#btnHostStartGame').prop('disabled', false); 
            $('#messages').append($('<li style="color: #676767">').text("You are the HOST. Press \"Start\" to start the game."));
            // Add each player already in the lobby (including THIS client) to the players waiting list.
            // We animate the additions so it looks nice.
            for (var i = 0; i < data.currentPlayerNames.length; i++) {
               var elementId = "listElement_" + data.currentPlayersIDs[i];
               // If we are adding THIS player's name to the list, bold it.
               if (new String(data.currentPlayersIDs[i]).valueOf() == new String(App.mySocketId).valueOf()) {
                  $('<li id=' + elementId + ' style="font-weight:bold">' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list').hide().slideDown();
                  $('<li id=' + elementId + ' style="font-weight:bold">' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
                  
               }
               else {
                  $('<li id=' + elementId + '>' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list').hide().slideDown();
                  $('<li id=' + elementId + '>' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
               }
            }	
         },

         nextRound: function(data) {
            console.log("[HOST] Starting next round...");
            
            console.warn("data.currentPlayersIDs = " + data.currentPlayersIDs);
            
            $('#panel-content').html(App.$templateQuestionGame).hide();
            $('#panel-content').fadeIn();
            
            // Re-enable the ability to submit an answer.
            $('#response').prop('disabled', false);
            
            // Reset the flag indicating that the user has responded. 
            // If this is not reset, then the user won't be able to submit a new answer.
            App.responded = false;
            
            // Reset the vote counter.
            App.Host.numVotes = 0;
            
            // Increment the round counter. 
            App.currentRound = App.currentRound + 1;
            
            // Clear the participating players list and repopulate it with data received from the server.
            App.Host.playersParticipating = [];
            for (var i = 0; i < data.currentPlayersIDs.length; i++) {
               App.Host.playersParticipating[i] = data.currentPlayersIDs[i]; 
            }
            
            console.warn("App.Host.playersParticipating = " + App.Host.playersParticipating);
            
            // Make sure to clear the roundResponses dictionary/map as well.
            App.Host.roundResponses = {}   

            // Clear the points dictionary/map. 
            App.Host.votes = {}
            
            // Update the game state. 
            App.Host.currentGameState = IO.gameStates.QUESTION;
            
            App.question = data.question;
            $('#question-text').text(App.question);            
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
         
         waitingForNextRound:  false,
			 
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
            // Disable the join button so they cannot spam it, causing multiple clients to be created and connect...
             $('btnConfirmGameId').prop("disabled", true);
             
				var gameId = $('#inputGameId').val();
				
				var isnum = /^\d+$/.test(gameId);
				
				if (!isnum) {
					window.alert("Please only enter numbers [0-9] in the Game ID input box.");
               
               // Re-enable the "join" button
               $('btnConfirmGameId').prop("disabled", false);
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
			
			// Display the game screen. If the game hasn't started yet, then the lobby
         // will be displayed. This screen won't have a "start" button since this is 
         // the player and not the host.
			displayGameScreen: function(data) {
            // Fill the game area with the appropriate HTMl
            App.$gameArea.html(App.$templateLobby).hide();
            App.$gameArea.fadeIn();

            // Show the gameID / room ID on the screen.
            $('#gameCode').html('<p style="font-size:64px; text-align: center">RoomID: ' + App.gameId + '</p>');
            
				// Add each player already in the lobby (including THIS client) to the players waiting list.
				// We animate the additions so it looks nice.
				for (var i = 0; i < data.memberNames.length; i++) {
					var elementId = "listElement_" + data.memberSockets[i];
               // If we are adding THIS player's name to the list, bold it.
               if (new String(data.memberSockets[i]).valueOf() == new String(App.mySocketId).valueOf()) {
                  $('<li id=' + elementId + ' style="font-weight:bold">' + data.memberNames[i] + '</li>').appendTo('#players-waiting-list').hide().slideDown();
                  $('<li id=' + elementId + ' style="font-weight:bold">' + data.memberNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
                  
               }
               else {
                  $('<li id=' + elementId + '>' + data.memberNames[i] + '</li>').appendTo('#players-waiting-list').hide().slideDown();
                  $('<li id=' + elementId + '>' + data.memberNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
               }
				}			

            $('#messages').append($('<li style="color: #676767">').text("Waiting for host to start game or current round to end..."));
			},
			
			// Fired when this client successfully joins a room.
			youJoinedRoom: function(data) {
				App.gameId = data.gameId;
				
				App.Player.displayGameScreen(data);			
			},
			
			/**
			 * A player has successfully joined the game.
			 * @param data {{playerName: string, gameId: int, mySocketId: int}}
			 */
			playerJoinedRoom : function(data) {
				var elementId = "listElement_" + data.playerId;
				$('<li id=' + elementId + '>' + data.playerName + '</li>').appendTo('#players-waiting-list').hide().slideDown();
            $('<li id=' + elementId + '>' + data.playerName + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
            
            $('#messages').append($('<li style="color: #7c89bd">').text(data.playerName + " connected to the game."));
			},			
         
         // Executes when a player disconnects from the game. Removes them from the player list.
         playerDisconnected: function(data) {
            $('#listElement_' + data).hide('slow', function(){ $('#listElement_' + data).remove(); });          
         },          

			onResponse: function(data) {
				// do nothing...
			},		
			
			voteCasted: function(data) {
				// do nothing...
			},
			
         // This function is triggered by an event emitted by the server once the server is finished
         // tallying all of the votes and whatnot. Ten seconds after the server emits that event, the
         // server will emit an event starting the next round.  
         //
         // A player who is waiting for the next round will still see this UI since they cannot interact with it.
			allVotesFinal: function(data) {
            console.warn("allVotesFinal() [PLAYER]");
            
            // Player method 
				$('#panel-content').html(App.$templateFinalResults).hide();
            $('#panel-content').fadeIn();
				
            $('#question-results').text(App.question);             
            
            // Grab all of the updated points.
            App.points = {};
            for (var i = 0; i < data.pointsKeys.length; i++) {
               App.points[data.pointsKeys[i]] = data.pointsValues[i];
            }                   

            // Update the players list to visually show point changes from the round.
				for (var index = 0; index < data.roundWinners.length; index++) {
               var winner = data.roundWinners[index];
               var currentText = $('#listElement_' + winner).text();
               console.warn("currentText = " + currentText);
               
               // We want to capture just the user's name from the currentText variable. We need to subtract a certain
               // number of characters from the end. We definitely subtract at least three since we need to subtract the
               // space and the two brackets '[' ']', but we also need to subtract the digits. This, of course, depends 
               // upon the number of digits in the player's point value, so we calculate that here.
               var lengthOfPointsText = -1;
               if (App.points[winner] == 10) {
                     // If the winner now has ten points, then that means the current amount they have displayed is 9.
                     // That is, " [9]". The length of this is 4 total, as the length of '9' is one and the length of all
                     // the other characters is 3. However, if we compute the length of App.points[winner], then that will 
                     // be two since the length of '10' is 2. Since ten is not actually displayed right now (nine is), we do
                     // not want to count both digits of ten. Thus, we add 2 instead of 3 to the length. 
                     lengthOfPointsText = App.points[winner].toString().length + 2;
               }
               else {
                     lengthOfPointsText = App.points[winner].toString().length + 3;
               }
               console.warn("length of points text: " + lengthOfPointsText);
               console.warn("length of current text: " + currentText.length);
               currentText = currentText.substring(0, currentText.length - lengthOfPointsText);
               $('#listElement_' + winner).text(currentText + ' [' + App.points[winner] + ']');
				}
            
				for (var i = 0; i < data.roundWinners.length; i++) {
					var elementId = "listElement_" + data.roundWinners[i];
					var str = JSON.stringify(data.responses[i]);
               // If the winning entry was longer than 100, then only display the first 100 characters.
               if (str.length > 100) {
                  str = str.substring(0, 100) + "..."
               }
               str = str + " <strong>[votes received: " + data.maxVotes + "]</strong>"
					// console.log('str: ' + str);
					$('<li id=' + elementId + ' class="fadeIn animated faster">' + str + '</li>').appendTo('#winning-response-list');
				}              
			},
         
         // [Player]
         gameOver: function(data) {
            App.$gameArea.html(App.$templateWinner);
            for (var i = 0; i < data.winnerNames.length; i++) {
               $('<p style="font-size:64px; text-align: center">' + data.winnerNames[i] + '</p>').appendTo('#winners-list');
            }
            
            // Reset the flag indicating that the user has responded. 
            // If this is not reset, then the user won't be able to submit a new answer.
            App.responded = false;
            
            // Increment the round counter. 
            App.currentRound = 0;
               
            setTimeout(function () {
               App.Player.returnToLobby(data);
            }, 8000);
         },        

         // [Player]
         // Show the lobby screen again, populate the players list, reset start button, etc.
         returnToLobby: function(data) {
            console.log("[Player] Returning to lobby...");
            $('#messages').append($('<li style="color: #676767">').text("Waiting for host to start game or current round to end..."));
            App.$gameArea.html(App.$templateLobby);              
            // Add each player already in the lobby (including THIS client) to the players waiting list.
            // We animate the additions so it looks nice.
            for (var i = 0; i < data.currentPlayerNames.length; i++) {
               var elementId = "listElement_" + data.currentPlayersIDs[i];
               // If we are adding THIS player's name to the list, bold it.
               if (new String(data.currentPlayersIDs[i]).valueOf() == new String(App.mySocketId).valueOf()) {
                  $('<li id=' + elementId + ' style="font-weight:bold">' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list').hide().slideDown();
                  $('<li id=' + elementId + ' style="font-weight:bold">' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
                  
               }
               else {
                  $('<li id=' + elementId + '>' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list').hide().slideDown();
                  $('<li id=' + elementId + '>' + data.currentPlayerNames[i] + '</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
               }
            }	
         },
         
         nextRound: function(data) {
            console.log("[PLAYER] Starting next round...");
            
            // Animate the transition.
            App.$gameArea.html(App.$templateGame).hide();
            App.$gameArea.fadeIn();
            
            $('#panel-content').html(App.$templateQuestionGame).hide();
            $('#panel-content').fadeIn();

            for (var i = 0; i < data.currentPlayerNames.length; i++) {
					var elementId = "listElement_" + data.currentPlayersIDs[i];
               var playerPoints = App.points[data.currentPlayersIDs[i]];
					$('<li id=' + elementId + '>' + data.currentPlayerNames[i] + ' [' + playerPoints + ']</li>').appendTo('#players-waiting-list').hide().slideDown();
               $('<li id=' + elementId + '>' + data.currentPlayerNames[i] + ' [' + playerPoints + ']</li>').appendTo('#players-waiting-list-ingame').hide().slideDown();
				} 
            
            // Re-enable the ability to submit an answer.
            $('#response').prop('disabled', false);            
            
            // Reset the flag indicating that the user has responded. 
            // If this is not reset, then the user won't be able to submit a new answer.
            App.responded = false; 	

            // Set this to false (it may or may not have been set to true).
            App.Player.waitingForNextRound = false;
            
            App.question = data.question;
            $('#question-text').text(App.question); 
         }        
		},
	};
	IO.init();
   App.init();
}($));