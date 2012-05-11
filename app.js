var express = require('express'),
    Bot     = require('ttapi');

Array.prototype.has = function(v) {
	for (var i = 0; i < this.length; i++) {
		if (this[i] == v) {
			return i;
		}
	}
	return false;
}

var PlayTable = function(user_auth, user_id, room_id) {
	var self = this;
	this.app = express.createServer();
	this.bot = false;
	this.on_stage = false;

	// create our bot
	var bot = new Bot(user_auth, user_id, room_id);

	// clear the bot's queue
	bot.on('ready', function() {
		console.log('PlayTable:: bot ' + bot.userId + ' ready!');
		// clear the queue
		self.clearQueue(bot);
	});

	// say hello to users when they join
	bot.on('registered', function(data) {
		var user_id   = data.user[0].userid;
		var user_name = data.user[0].name;
		if (bot.userId != user_id) {
			bot.speak('OH HAI ' + user_name + '!');
		}
	});

	this.bot = bot;

	// this really should be the "debug" config..
	this.app.configure(function() {
		self.app.use(express.logger());
		self.app.use(express.errorHandler({
			dumpExceptions: true,
			showStack: true
		}));
	});

	this.app.get('/stream_url', function(req, res) {
		res.json({success: true, url: "http://turntable.fm/" + room_id});
		res.end();
	});

	this.app.get('/now_playing', function(req, res) {
		if (self.bot) {
			self.getCurrentSong(function(data){
				res.json(data);
				res.end();
			});
		} else {
			res.json({success: false, error: "No DJ bot."});
			res.end();
		}
	});

	this.app.get('/upcoming', function(req, res) {
		if (self.bot) {
			self.bot.playlistAll(function(data){
				res.json(data.list);
				res.end();
			});
		} else {
			res.json({success: false, error: "No DJ bot."});
			res.end();
		}
	});

	this.app.get('/clear_queue', function(req, res) {
		if (self.bot) {
			self.clearQueue(self.bot);
			res.json({success: true});
			res.end();
		} else {
			res.json({success: false, error: "No DJ bot."});
			res.end();
		}
	});

	this.app.get('/add_artist/:artist', function(req, res) {
		var song_limit = 10; // should change to whatever the max TT will play of 1 artist in a row..
		var to_top = ('undefined' !== typeof(req.query['top']));
		var song_limit = req.query['limit'] || 10;

		self.searchSong(req.params.artist, function(data){
			var titles = [];
			var songs = [];
			var search_results = data.docs;

			// force serial addition of songs using recursion
			function addSongsFromResult(songs_to_add, cb) {
				if ((0 == songs_to_add.length) || (song_limit == songs.length)) {
					cb(songs);
					return;
				}
				var song_to_add = songs_to_add.shift();
				var title = song_to_add.metadata.song;
				if (false === titles.has(title)) { // check for artist name also?
					songs.push(song_to_add);
					titles.push(title);
					self.addSong(song_to_add._id, to_top, function(){
						addSongsFromResult(songs_to_add, cb);
					});
				} else {
					addSongsFromResult(songs_to_add, cb);
				}
			}

			addSongsFromResult(search_results, function(data){
				res.json(data);
				res.end();
			});
		});
	});

	this.app.get('/add_song/:id', function(req, res) {
		var to_top = ('undefined' !== typeof(req.query['top']));
		self.addSong(req.params.id, to_top);
		res.json({success: true});
		res.end();
	});

	this.app.get('/next', function(req, res) {
		if (self.bot) {
			self.skipSong(function(){
				self.getCurrentSong(function(data){
					res.json(data);
					res.end();
				});
			});
		} else {
			res.json({success: false, error: "No DJ bot."});
			res.end();
		}
	});

	this.app.get('/current_dj', function(req, res) {
		if (self.bot) {
			// get room info, return dj name
			self.getCurrentDJ(function(data){
				res.json(data);
				res.end();
			});
		} else {
			res.json({success: false, error: "No DJ bot."});
			res.end();
		}
	});

	this.app.get('/search/:query', function(req, res) {
		self.searchSong(req.params.query, function(data){
			res.json(data.docs);
			res.end();
		});
	});
};

PlayTable.prototype.listen = function(port) {
	if ('undefined' == typeof(port)) {
		port = 8888;
	}
	this.app.listen(port);
	console.log('PlayTable listening on port ' + port);
}

PlayTable.prototype.clearQueue = function(bot) {
	bot.playlistAll(function(data){
		var i = data.list.length;
		// force serial removal of songs using recursion
		function removeSong(count) {
			if (count >= i) {
				return;
			}
			bot.playlistRemove(0, function(){
				removeSong(count + 1);
			});
		}
		bot.playlistRemove(0, function(){
			removeSong(1);
		});
	});
};

PlayTable.prototype.addSong = function(song_id, top, callback) {
	var idx = 9999;
	if (top) {
		idx = 0;
	}
	var self = this;
	self.bot.playlistAdd(song_id, idx, function(data){
		if (!self.on_stage) {
			self.bot.addDj(function(){
				self.on_stage = true;
				self.bot.speak("Time to get ill.");
			});
		}
		if (callback) {
			callback(data);
		}
	});
};

PlayTable.prototype.addSongToTop = function(song_id, cb) {
	this.addSong(song_id, true, cb);
};

PlayTable.prototype.getCurrentDJ = function(cb) {
	this.bot.roomInfo(function(data){
		cb({success: true, dj: data.room.metadata.current_song.djname})
	});
};

PlayTable.prototype.getCurrentSong = function(cb) {
	this.bot.roomInfo(function(data){
		cb({success: true, song: data.room.metadata.current_song})
	});
};

PlayTable.prototype.setCurrentSong = function(data) {
	this.current_song = data.room.metadata.current_song;
};

PlayTable.prototype.skipSong = function(cb) {
	this.bot.skip(cb);
};

PlayTable.prototype.searchSong = function(q, cb) {
	this.bot.searchSong(q, cb);
}

exports.PlayTable = PlayTable;

