var request = require("request");
var fs = require("fs");
var users = require("./users.js");
const path = require("path");

module.exports = {
	getDateTime:function() {
		var now     = new Date();
		var year    = now.getFullYear();
		var month   = now.getMonth()+1;
		var day     = now.getDate();
		var hour    = now.getHours();
		var minute  = now.getMinutes();
		var second  = now.getSeconds();
		if(month.toString().length == 1) {
			var month = '0'+month;
		}
		if(day.toString().length == 1) {
			var day = '0'+day;
		}
		if(hour.toString().length == 1) {
			var hour = '0'+hour;
		}
		if(minute.toString().length == 1) {
			var minute = '0'+minute;
		}
		if(second.toString().length == 1) {
			var second = '0'+second;
		}
		var dateTime = day+'/'+month+'/'+year+' '+hour+':'+minute+':'+second;
		return dateTime;
	},
	isDM:function (msg) {
		if (msg.channel.type == 1) {
			return true;
		} else {
			return false;
		}
	},
	formatSecsToStr:function(seconds) {
		function pad(s) {
			return (s < 10 ? '0' : '') + s;
		}
		var hours = Math.floor(seconds / (60*60));
		var minutes = Math.floor(seconds % (60*60) / 60);

		return pad(hours) + ':' + pad(minutes) + ':' + pad(seconds);
	},
	downloadFromUrl:function(url, path) {
		request.get(url)
        .on('error', console.error)
        .pipe(fs.createWriteStream(path));
	},
	makeFolderIfNotExist:function(path) {
		if (!fs.existsSync(path)){
			fs.mkdirSync(path);
		}
	},
	deleteFilesInFolder:function(directory) {
		fs.readdir(directory, (err, files) => {
			if (err) throw err;

			for (const file of files) {
				fs.unlink(path.join(directory, file), err => {
					if (err) throw err;
				});
			}
		});
	},
	editFileLine:function(directory, line, newshit, callback){
		var data = fs.readFileSync(directory, 'utf8');
		var lines = data.split("\n");

		if(+line > lines.length)
			throw new Error("line number larger than file lines count");

		lines[line] = newshit;

		var newlines = "";

		for (var i = 0; i < lines.length; i++)
			newlines = lines[i] + "\n";

		fs.writeFile(directory, newlines, function(err, data) {
			if (err) throw new err;
		});
	},
	hasCmdAccess:function(message){ // allow anyone to use commands in #bot and #tasbottests
		return users.hasCmdAccess(message.author) || message.channel.id == "554820730043367445" ||  message.channel.id == "562818543494889491";
	}
};
