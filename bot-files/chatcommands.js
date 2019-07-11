const miscfuncs = require("./miscfuncs.js");
const save = require("./save.js");
var announcements = [];
var ac_1_default = ""
var CHANNELS = {"GENERAL": "397488794531528704",
		"BOT": "554820730043367445",
		"BOT_DMS": "555543392671760390",
		"SCORE": "529816535204888596",
		"RESULTS": "529816480016236554",
		"CURRENT_SUBMISSIONS": "397096356985962508",
		"OTHER": "267091686423789568",
		"MARIO_GENERAL": "267091914027696129",
		"TASBOTTESTS": "562818543494889491",
		"ANNOUNCEMENTS": "397841779535118347"}

// shortcut for channel IDs
function chooseChannel(string){
	string = string.toUpperCase()
	if (CHANNELS[string] === undefined) {
		return string;
	} else {
  	return CHANNELS[string];
	}
}


module.exports = {

	// CHANNEL COMMANDS

  addChannelAlias:function(bot, msg, args){
    if (!miscfuncs.hasCmdAccess(msg)) {return;}

    CHANNELS[args[0].toUpperCase()] = args[1];
		save.saveObject("channels.json", CHANNELS);

    return "Alias ``"+args[0].toUpperCase()+"`` added for channel ``"+args[1]+"``";

  },

  removeChannelAlias:function(bot, msg, args){
    if (!miscfuncs.hasCmdAccess(msg)) {return;}

    delete CHANNELS[args[0].toUpperCase()];
		save.saveObject("channels.json", CHANNELS);

    return "Alias ``"+args[0].toUpperCase()+"`` Removed";

  },

  getChannelAliases:function(bot, msg, args){
    if (!miscfuncs.hasCmdAccess(msg)) {return;}

    var channels = "```";
    for (var key in CHANNELS){
      channels += key + ": " + CHANNELS[key] + "\n";
    }
    return channels+"```";

  },

	loadChannels:function(){
		var json = save.readObject("channels.json");
		Object.keys(json).forEach((key) => {
			CHANNELS[key] = json[key];
		});
	},


	// CHAT COMMANDS

	send:function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){return;}

		var channel = args.shift();
		bot.createMessage(chooseChannel(channel), args.join(" ")).catch((e) => {return e.toString();});

	},

	delete:function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){return;}

		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.delete();
		}).catch((e) => {return e.toString();});

	},

	pin:function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){returm;}

		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.pin();
		}).catch((e) => {return e.toString();});

	},

	unpin:function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){returm;}

		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.unpin();
		}).catch((e) => {return e.toString();});

	},

	dm:function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)) {return;}

		var user_id = args.shift();

		if (args.length == 0){
			return "Cannot send empty message";
		}

		bot.getDMChannel(user_id).then((dm) => {
			dm.createMessage(args.join(" "))
			return "[Bot -> "+dm.recipient.username+"]: "+args.join(" ");
		}).catch((e) => {return "DM Failed";});

	},

	// following announcement commands will be moved to their own module later

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


}

// this is sample code i might implement later
/* Check if a user exists
let guild = client.guilds.get('guild ID here'),
  USER_ID = '123123123';

if (guild.member(USER_ID)) {
  // there is a GuildMember with that ID
}*/
