var users = require("./users.js");
var chat = require("./chatcommands.js")

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
		var days = (hours - (hours%24)) / 24
		var readable = `${days} ${days==1?'day':'days'}, `
		readable += `${hours} ${hours==1?'hour':'hours'}, `
		readable += `${minutes} ${minutes==1?'minute':'minutes'}, `
		readable += `${sec} seconds`
		return `${pad(hours)}:${pad(minutes)}:${pad(sec)} (${readable})`
	},
	ping:{
		name: "ping",
		short_descrip: "ping",
		full_descrip: "To check if the bot is not dead. Tells you time it takes to bait you in ms",
		hidden: false,
		function: function(bot, msg){
			return "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)"
		}
	},
	celsiusToInferiorTemp:{
		name: "fahrenheit",
		short_descrip: "Convert °C to °F",
		full_descrip: "Usage: `$c->f <°C>`",
		hidden: false,
		function: function(bot, msg, args){
			if (args.length == 0) return "Not Enough Arguments: `<°C>`"
			var C = parseFloat(args[0])
			if (isNaN(C)) return "Input must be a number"
			return (C * 9 / 5 + 32).toFixed(1) + "°F"
		}
	},
	inferiorTempToCelsius:{
		name: "celsius",
		short_descrip: "Convert °F to °C",
		full_descrip: "Usage: `$f->c <°F>`",
		hidden: false,
		function: function(bot, msg, args){
			if (args.length == 0) return "Not Enough Arguments: `<°F>`"
			var F = parseFloat(args[0])
			if (isNaN(F)) return "Input must be a number"
			return ((F - 32) * 5 / 9).toFixed(1) + "°C"
		}
	},
	cmToInches:{
		name: "inches",
		short_descrip: "Convert cm to inches",
		full_descrip: "Usage: `$cm->inch <cm>`",
		hidden: false,
		function: function(bot, msg, args){
			if (args.length == 0) return "Not Enough Arguments: `<cm>`"
			var cm = parseFloat(args[0])
			if (isNaN(cm)) return "Input must be a number"
			return (cm / 2.54).toFixed(2) + '"'
		}
	},
	inchesToCm:{
		name: "centimeters",
		short_descrip: "Convert inches to cm",
		full_descrip: "Usage: `$inch->cm <inches>`",
		hidden: false,
		function: function(bot, msg, args){
			if (args.length == 0) return "Not Enough Arguments: `<inches>`"
			var I = parseFloat(args[0])
			if (isNaN(I)) return "Input must be a number"
			return (I * 2.54).toFixed(2) + "cm"
		}
	},
	// COMMAND that adds a role to a user. Defaults to sender
	addRole:{
		name: "addrole",
		short_descrip: "Gives a user a role",
		full_descrip: "Usage `$ar <role_id> [user_id]`\nuser_id defaults to the user that calls the command",
		hidden: false, // T?
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return
			if (args.length == 0) return "Not Enough Arguments: `<role_id> [user_id]`"
			var member = args[1] == undefined ? msg.member.id : args[1]
			try {
				msg.channel.guild.addMemberRole(member, args[0], `Command Call by ${msg.author.username}`)
				return `Gave user ${member} role ${args[0]}`
			} catch (e) {
				return "Failed to assign role```"+e+"```"
			}
		}
	},
	// COMMAND removes a role from a user. Defaults to sender
	removeRole:{
		name: "removerole",
		short_descrip: "Removes a role from a user",
		full_descrip: "Usage `$rr <role_id> [user_id]\nuser_id defaults to the user that calls the command",
		hidden: false, // T?
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return
			if (args.length == 0) return "Not Enough Arguments: `<role_id> [user_id]`"
			var member = args[1] == undefined ? msg.member.id : args[1]
			try {
				msg.channel.guild.removeMemberRole(member, args[0], `Command Call by ${msg.author.username}`)
				return `Removed role ${args[0]} from user ${member}`
			} catch (e) {
				return "Failed to remove role```"+e+"```"
			}
		}
	},
	// COMMAND adds a reaction to a given message
	addReaction:{
		name: "addreaction",
		short_descrip: "Reacts to a message",
		full_descrip: "Usage `$react <channel_id> <message_id> <emojis...>`\nThis will reacat with multiple space separated emojis. For a list of channel names that can be used instead of `<channel_id>` use `$ls`",
		hidden: false, // T?
		function: async function(bot, msg, args){
			if (args.length < 3) return "Not Enough Arguments: <channel_id> <message_id> <emojis...>"
			var channel = args.shift()
			var message = args.shift()
			for (var i = 0; i < args.length; i++){
					if (args[i].includes(":")) args[i] = args[i].substr(2, args[i].length-3)
			}
			args.forEach(emoji => {
				bot.addMessageReaction(chat.chooseChannel(channel), message, emoji)
					.catch((e) => {return "Failed to add reaction```"+e+"```"})
			})
		}
	},
	mentionChannel:function(channel_id){
		return `<#${channel_id}>`
	},
	getChannelID:function(arg){
		if (arg.startsWith('<#') && arg.endsWith('>')){
		    arg = arg.substr(2, arg.length-3)
		}
		return arg
	},
	mentionUser:function(user_id){
		return `<@${user_id}>`
	},
	getUserID:function(arg){
		if (arg.startsWith('<@') && arg.endsWith('>')){
		    arg = arg.substr(2, arg.length-3)
		}
		return arg
	},
	// List of command aliases
	// [Alias, Original_Command_Name]
	aliases:[
		["channeladd","addChannel"],
		["channelremove","removeChannel"],
		["listchannels","ls"], ["getchannels","ls"],
		["say","send"],
		["tr","toggleReaction"], ["togglereactions","toggleReaction"],
		["tg","toggleGames"], ["togglegame","toggleGames"],
		["get","getsubmission"],
		["setsm","setSubmissionMessage"], ["setsmsg","setSubmissionMessage"],
		["setfeed","setSubmissionFeed"],
		["startAccepting","startSubmissions"], ["startSubmission","startSubmissions"],
		["stopAccepting","stopSubmissions"], ["stopSubmission","stopSubmissions"],
		["clearAllSubmissions","clearSubmissions"],
		["setRole","setSubmittedRole"],
		["game", "games"],
		["removesubmission", "deleteSubmission"],
		["cm", "centimeters"], ["inch->cm", "centimeters"],
		["celcius", "celsius"], ["f->c", "celsius"],
		["farenheit", "fahrenheit"], ["c->f", "fahrenheit"],
		["ar", "addrole"],
		["rr", "removerole"],
		["react", "addreaction"], ["addreactions", "addreaction"],
		["addCmdAccess", "addCommandAccess"],
		["removeCmdAccess", "removeCommandAccess"],
		["dq", "disqualify"],
		["undq", "undodisqualify"],
		["ss", "secretsanta"],
		["acset", "acadd"],
		["acdelete", "acclear"], ["acremove", "acclear"]
	]
};
