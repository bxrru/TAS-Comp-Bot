var users = require("./users.js");

module.exports = {
	getDateTime:function() {
		var now = new Date()
		var year = now.getFullYear()
		var month = now.getMonth()+1
		var day = now.getDate()
		var hour = now.getHours()
		var minute = now.getMinutes()
		var second = now.getSeconds()
		if(month.toString().length == 1) month = '0'+month
		if(day.toString().length == 1) day = '0'+day
		if(hour.toString().length == 1) hour = '0'+hour
		if(minute.toString().length == 1) minute = '0'+minute
		if(second.toString().length == 1) second = '0'+second
		return day+'/'+month+'/'+year+' '+hour+':'+minute+':'+second
	},
	isDM:function (msg) {
		return msg.channel.type == 1
	},
	formatSecsToStr:function(seconds) {
		function pad(s) {return (s < 10 ? '0' : '') + s}
		var hours = Math.floor(seconds / (60*60))
		var minutes = Math.floor(seconds / 60) - hours * 60
		var sec = (seconds - minutes*60 - hours*60*60).toFixed(3)
		return pad(hours) + ':' + pad(minutes) + ':' + pad(sec)
	},
	hasCmdAccess:function(message){ // allow anyone to use commands in #bot and #tasbottests and #stream_stuff (for speed comp)
		return users.hasCmdAccess(message.author) || ["554820730043367445","562818543494889491","488155410910543872"].includes(message.channel.id)
	},
	ping:function(bot, msg){
		return "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)"
	},
	celciusToInferiorTemp:function(bot, msg, args){
		if (args.length == 0) return "Not Enough Arguments: `<°C>`"
		var C = parseFloat(args[0])
		if (isNaN(C)) return "Input must be a number"
		return (C * 9 / 5 + 32).toFixed(1) + "°F"
	},
	inferiorTempToCelcius:function(bot, msg, args){
		if (args.length == 0) return "Not Enough Arguments: `<°F>`"
		var F = parseFloat(args[0])
		if (isNaN(F)) return "Input must be a number"
		return ((F - 32) * 5 / 9).toFixed(1) + "°C"
	},
	cmToInches:function(bot, msg, args){
		if (args.length == 0) return "Not Enough Arguments: `<cm>`"
		var cm = parseFloat(args[0])
		if (isNaN(cm)) return "Input must be a number"
		return (cm / 2.54).toFixed(2) + '"'
	},
	inchesToCm:function(bot, msg, args){
		if (args.length == 0) return "Not Enough Arguments: `<inches>`"
		var I = parseFloat(args[0])
		if (isNaN(I)) return "Input must be a number"
		return (I * 2.54).toFixed(2) + "cm"
	},
	// COMMAND that adds a role to a user. Defaults to sender
	addRole:async function(bot, msg, args){
		if (!module.exports.hasCmdAccess(msg)) return
		if (args.length == 0) return "Not Enough Arguments: `<role_id> [user_id]`"
		//if (args.length > 1)
	},
	// COMMAND
	removeRole:function(bot, msg, args){

	}
};
