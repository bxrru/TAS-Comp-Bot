var Announcements = [];
var Commands = ["set", "clear", "list"];

// example announcement object:
var announcement = {
	"timer":"",
	"guild":"", // ID
	"channel":"", // ID
	"message":"",
	"time":"", // UTC
	"interval":"" // once, weekly, biweekly
}

module.exports = {

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

	addAnnouncement:function(guild, channel, message, time, interval){
		if (!miscfuncs.hasCmdAccess(msg)) {return;}

		// TODO implement chroma to detect time

		var delay = time - new Date();

		// parse message for everyone
		var msg = message

		var timer = setTimeout(function() {
			bot.createMessage(channel, {content:msg, disableEveryone:false}); // send message (allow tags)
			Announcements.shift(); // remove this from the array after it has been made
		}, delay)

		var announcement = {
			"timer":timer,
			"guild":guild, // ID
			"channel":channel, // ID
			"message":msg,
			"time":"", // UTC
			"interval":"" // once, weekly, biweekly
		}

		Announcements.push(announcement);


	},

// outdated function: this needs to be remade better
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

		Announcements.push(
			setTimeout(function(){
				bot.createMessage(channel, {content:msg, disableEveryone:false}); // send message (allow tags)
				Announcements.shift(); // remove this from the array after it has been made
			}, delay)
		);
		return "The following announcement will take place ``"+delay+"ms`` from now in channel ``"+channel+"``:```" + msg + "```";

	},


	clearAll:function(){

		while (Announcement) {
			Announcements.forEach((announcement) => {
				clearTimeout(announcement.timer);
			});
		}

		return "Deleted all planned announcements";

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
