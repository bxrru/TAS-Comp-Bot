const users = require("./users.js");
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

function chooseChannel(string){
	string = string.toUpperCase()
	if (CHANNELS[string] === undefined) {
		return string;
	} else {
		return CHANNELS[string];
	}
}

module.exports = {

	CommandInfo:function(){
		var msg = "**CompBot** - Chat Module\n"
    msg += "\n**Chat Commands:**\n"
    msg += "\t**$listchannels** - lists recognized channel names (ls)\n"
    msg += "\t**$addchannel** - Adds a channel name to the list\n"
    msg += "\t**$removechannel** - Removes a channel name from the list\n"
    msg += "\t**$send** - Sends a message to a specified channel\n"
    msg += "\t**$delete** - Deletes a message\n"
    msg += "\t**$pin** - Pins a message\n"
    msg += "\t**$unpin** - Unpins a message\n"
    msg += "\t**$dm** - Sends a message to a user\n"
    msg += "\nType $help <command> for more info on a command."
		return msg
	},

	// CHANNEL COMMANDS

	// allow other modules to use this command
	chooseChannel:function(string){
		return chooseChannel(string)
	},

  addChannelAlias:function(bot, msg, args){
    if (!users.hasCmdAccess(msg)) {return;}

    CHANNELS[args[0].toUpperCase()] = args[1];
		save.saveObject("channels.json", CHANNELS);

    return "Alias ``"+args[0].toUpperCase()+"`` added for channel ``"+args[1]+"``";

  },

  removeChannelAlias:function(bot, msg, args){
    if (!users.hasCmdAccess(msg)) {return;}

    delete CHANNELS[args[0].toUpperCase()];
		save.saveObject("channels.json", CHANNELS);

    return "Alias ``"+args[0].toUpperCase()+"`` Removed";

  },

  getChannelAliases:function(bot, msg, args){
    if (!users.hasCmdAccess(msg)) {return;}

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
		if (!users.hasCmdAccess(msg)){return;}

		var channel = args.shift();
		bot.createMessage(chooseChannel(channel), args.join(" ")).catch((e) => {return e.toString();});

	},

	delete:function(bot, msg, args){
		if (!users.hasCmdAccess(msg)){return;}

		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.delete();
		}).catch((e) => {return e.toString();});

	},

	pin:function(bot, msg, args){
		if (!users.hasCmdAccess(msg)){returm;}

		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.pin();
		}).catch((e) => {return e.toString();});

	},

	unpin:function(bot, msg, args){
		if (!users.hasCmdAccess(msg)){returm;}

		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.unpin();
		}).catch((e) => {return e.toString();});

	},

	dm:async function(bot, msg, args){
		if (!users.hasCmdAccess(msg)) {return;}

		var user_id = args.shift();

		if (args.length == 0){
			return "Cannot send empty message";
		}

		let dm = await bot.getDMChannel(user_id).catch((e) => {return "DM Failed ``"+e+"``";});
		dm.createMessage(args.join(" "));

		return "[Bot -> "+dm.recipient.username+"]: "+args.join(" ");
	},

}
