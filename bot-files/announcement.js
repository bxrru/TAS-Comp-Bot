const users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")

var Announcements = []
var Commands = ["add", "remove", "list", "editmessage"]

// example announcement object:
var announcement = {
	"timer":"",
	"channel":"", // ID
	"message":"",
	"time":"", // UTC
	"interval":"" // once, biweekly
}

// delays for repeated announcements
var Delays = {
    once: 0, 0: 0, 1: 0,
    weekly: 604800000,
    biweekly: 1209600000
}

module.exports = {

	CommandInfo:function(){
		var msg = "**CompBot** - Announcement Module\n"
		msg += "\n**Announcement Commands:**\n"
		msg += "\t**$ac** - ToDo\n"
		msg += "\nType $help <command> for more info on a command."
		return msg
	},

	// COMMAND that adds an announcement to the saved list
	// Usage: $addac <channel> <interval> "message" time and date
	addAnnouncementCMD:function(bot, msg, args){
		if (!users.hasCmdAccess(msg)) return
		if (args.length < 4) return `Missing Arguments: \`$addac <channel> <interval> "message" time and date\``

		var channel = miscfuncs.getChannelID(args.shift())

		// if the announcement should repeat
		var interval = args.shift()
		if (!Object.keys(Delays).includes(interval)){
    	return `Interval \`${interval}\`not recognized: currently supported intervals are \`once\`, \`weekly\`, and \`biweekly\``
		}
		var interval = Delay[interval]

		// get the message
		var message = ""




		setTimeout(()=>{}, delay, )
	},

	addAnnouncement:function(channel, message, delay, interval){

		var timer = setTimeout(function() {
			bot.createMessage(channel, {content:msg, disableEveryone:false}) // send message (allow tags)
			Announcements.shift() // remove this from the array after it has been made
		}, delay)

		var announcement = {
			"timer":timer,
			"channel":channel, // ID
			"message":msg,
			"time":"", // UTC
			"interval":"" // once, weekly, biweekly
		}

		Announcements.push(announcement)

	},

	listAnnouncementsCMD:function(bot, msg, args){
		if (!users.hasCmdAccess(msg)) return

		if (Announcements.length == 0) return "No Active Announcements"

		var message = "```ID Channel Time Interval Message"
		var summary = ""

		for (var i = 0; i < Announcements.length; i++) {
			summary = i.toString() + ": "
			summary += miscfuncs.mentionChannel(Announcements[i].channel) + " "
			summary += Announcements[i].time + " " + Announcements[i].interval + " "
			summary += Announcements[i].message.substr(0,10) // only show a portion of the message
			summary += "...\n" if Announcements[i].message.length < 10 else "\n"

			// Send multiple messages if it passes the character limit
			if ((message + summary).length > 1996){
				bot.createMessage(msg.channel.id, message + "```")
				message = "```" + summary
			}

		}

		return message + "```"

	},

	processCommand:function(bot, msg, args){

		if (!miscfuncs.hasCmdAccess(msg)) {return;}

		if (args.length == 0){
			return "List of valid commands: ```set\nclear```";
		}

		var command = args.shift().toLowerCase();

		// create new announcement
		if (command == "set"){



		// remove an announcement
		} else if (command == "clear") {

			if (args.length == 0){
				return "Not enough arguments. Usage: ``$ac clear <all | index>";

			} else if (args[0].toLowerCase() == "all"){
				return clearAll();

			} else {
				return clearAnnouncement(args[0]);

			}

		} else if (command == "list"){


		} else { // command not recognized


		}


	},

// outdated function: this needs to be remade better
	announce_dep:function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)) {return;}

		var channel = chooseChannel(args.shift());

		//bot.createMessage(channel, "test").then((m)=>{m.delete();});
		//return;

		var everyone;
		// JANK get @everyone role
		msg.channel.guild.roles.forEach((role) => {
			if (role.id == "397082495423741953"){
				everyone = role;
			}
		});

		var now = new Date();

		var hour = args.shift();
		var min = (hour == "next") ? now.getMinutes()+1 : args.shift();

		var delay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0, 0) - now;

		if (delay < 0) {
			hour = ('0'+hour).slice(-2);
			min = ('0'+min).slice(-2);
			var h = ('0' + now.getHours()).slice(-2);
			var m = ('0' + now.getMinutes()).slice(-2);
			var msg = "Time passed. `"+h+":"+m+"` > `"+hour+":"+min+"`"
			console.log(msg);
			return msg;
		}

		msg = "1 HOUR UNTIL TASK 12 DEADLINE! SUBMIT!!!1!";

		for (var i = 0; i < args.length; i++){
			if (args[i] == "`@everyone`"){
				args[i] = "@everyone"; //everyone.mention;
			}
		}

		if (args.length > 0){msg = args.join(" ");}

		//msg = "16.5 HOURS UNTIL DEADLINE MAKE SURE TO SUBMIT!!\n\n(This message is an automated test thank you for continued support on the development of this bot)"

		console.log(msg);

		Announcements.push(
			setTimeout(function(){
				bot.createMessage(channel, {content:msg, disableEveryone:false}); // send message (allow tags)
				Announcements.shift(); // remove this from the array after it has been made
			}, delay)
		);
		return "The following announcement will take place ``"+delay+"ms`` from now in channel ``"+channel+"``:```" + msg + "```";

	},


	clearCMD:function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)) return

		while (Announcement) {
			Announcements.forEach((announcement) => {
				clearTimeout(announcement.timer)
			});
			Announcements = []
		}

		return "Deleted all planned announcements"

	},


	clearAnnouncement:function(index){
		if (index < 0 || index > Announcements.length - 1){
			return "Index out of bounds. For a list of valid indexes use ``$ac list``";
		}

		var deleted = Announcements.splice(index,1);
		var msg = "Removed announcement:";
		msg += "```" + JSON.stringify(deleted) + "```";



	}

}

/*
// The old announcement code

announce:function(bot, msg, args){
	if (!miscfuncs.hasCmdAccess(msg)) {return;}

	var channel = chooseChannel(args.shift());

	//bot.createMessage(channel, "test").then((m)=>{m.delete();});
	//return;

	var everyone;
	// JANK get @everyone role
	msg.channel.guild.roles.forEach((role) => {
		if (role.id == "397082495423741953"){
			everyone = role;
		}
	});

	var now = new Date();

	var hour = args.shift();
	var min = (hour == "next") ? now.getMinutes()+1 : args.shift();

	var delay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour, min, 0, 0) - now;

	if (delay < 0) {
		hour = ('0'+hour).slice(-2);
		min = ('0'+min).slice(-2);
		var h = ('0' + now.getHours()).slice(-2);
		var m = ('0' + now.getMinutes()).slice(-2);
		var msg = "Time passed. `"+h+":"+m+"` > `"+hour+":"+min+"`"
		console.log(msg);
		return msg;
	}

	msg = "1 HOUR UNTIL TASK 12 DEADLINE! SUBMIT!!!1!";

	for (var i = 0; i < args.length; i++){
		if (args[i] == "`@everyone`"){
			args[i] = "@everyone"; //everyone.mention;
		}
	}

	if (args.length > 0){msg = args.join(" ");}

	//msg = "16.5 HOURS UNTIL DEADLINE MAKE SURE TO SUBMIT!!\n\n(This message is an automated test thank you for continued support on the development of this bot)"

	console.log(msg);

	announcements.push(
		setTimeout(function(){
			bot.createMessage(channel, msg);
			announcements.shift();
		}, delay)
	);
	return "The following announcement will take place ``"+delay+"ms`` from now in channel ``"+channel+"``:```" + msg + "```";

},

clearAnnounce:function(bot, msg, args){
	if (!miscfuncs.hasCmdAccess(msg)) {return;}
	announcements.forEach((announcement) => {
		clearTimeout(announcement);
	});
	return "Removed all planned announcements";
}
*/
