var express = require("express");
var ms = require("ms");
var app = express();
var argv = require("optimist").argv;
var Board = require("./board-server.js");
var fs = require("fs");
var Entities = require('html-entities').AllHtmlEntities;
var entities = new Entities();
var server = app.listen(argv.port || 9000);

var io = require('socket.io').listen(server);

app.get("/", function(req, res) {
	res.sendFile(__dirname + '/index.html');
})

app.get("/reload", function(req, res) {
	Board = require("./board-server.js");
	res.sendFile(__dirname + '/index.html');
})

app.get("/board", function(req, res) {
	res.sendFile(__dirname + '/board.html');
})

function clean(data) {
	return entities.encode(data)
}

app.get('/scripts/fb.js', function(req, res) {
	var data = fs.readFileSync(__dirname + '/scripts/fb.js', 'utf8');
	res.write(data.replace("%appId%", argv.appId));
	res.end();
})

app.use('/fonts', express.static( __dirname + '/fonts', { dotfiles: 'allow', maxAge: ms('30 days') }));
app.use('/common', express.static( __dirname + '/common', { maxAge: ms('30 days') }));
app.use('/scripts', express.static( __dirname + '/scripts', { maxAge: ms('30 days') }));
app.use('/css', express.static( __dirname + '/css', { dotfiles: 'allow', maxAge: ms('30 days') }));
app.use('/images', express.static( __dirname + '/images', { maxAge: ms('30 days') }));

app.get(/\/images\/*/, function(req, res) {
	if(req.query.board) {
		var board = manager.getBoardById(req.query.board);
		if (board) {
			var image = board.getImage(req.query.img);
			if (image) {
				res.writeHead(200, { 'Content-Type' :  image.contentType });
				res.end(image.data, 'binary');
			} else {
				res.writeHead(500);
				res.end();
			}
		} else {
			socket.emit('error', { message: "Board does not exist!" });
		}
	} else {
		serveStatic(req, res);
	}
})


app.get('*', function(req, res){
  res.status(404).sendFile(__dirname + '/notfound.html');
});

function BoardManager() {
	var boards = {};

	function createBoard(name) {
		var board = new Board(name)
		boards[board.id] = board;
		return board;
	}

	return {
		createBoard: createBoard,
		getBoardById: function(id) {
			return boards[id];
		}
	}
}

var manager = new BoardManager();


function registerJoin(socket) {
	socket.on('join', function (data) {
		var board = manager.getBoardById(data.id);
		if (board) {
			board.join(socket, data);
		} else {
			socket.emit('error', { message: "Board does not exist!" });
		}
	});
}

function registerRejoin(socket) {
	socket.on('rejoin', function (data) {
		var board = manager.getBoardById(data.id);
		if (board) {
			board.rejoin(socket, data.sessionId);
		} else {
			socket.emit('error', { message: "Board does not exist!" });
		}
	});
}

function registerGetBoardInfo(socket) {
	socket.on('getBoardInfo', function (data) {
		var board = manager.getBoardById(data.id);
		if (board) {
			socket.emit('boardInfo', { name: board.name });
		} else {
			socket.emit('errorhandler', { message: "Board does not exist!" });
		}
	});
}


function registerCreate(socket) {
	socket.on('create', function (data) {
		var board = manager.createBoard(data.name);
		console.log("Created a new board: " + board.name + " (" + board.id + ")");
		socket.emit('created', { id: board.id, name: board.name });
	});
}

// wait for a connection from a client
io.on('connection', function (socket) {
	console.log(socket.id);
	// add this socket to the clients list
	registerJoin(socket);
	registerRejoin(socket);
	registerCreate(socket);
	registerGetBoardInfo(socket);
});

