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

  addChannelAlias:{
		name:"addChannel",
		short_descrip: "Adds a channel name to the list",
		full_descrip: "Usage: `$addChannel <alias> <channel_id>`\nAllows `<alais>` to be specified in place of `<channel_id>` for other commands.",
		hidden: true,
		function: function(bot, msg, args){
	    if (!users.hasCmdAccess(msg)) return

	    CHANNELS[args[0].toUpperCase()] = args[1]
			save.saveObject("channels.json", CHANNELS)

	    return "Alias ``"+args[0].toUpperCase()+"`` added for channel ``"+args[1]+"``"
		}
  },

  removeChannelAlias:{
		name: "removeChannel",
		short_descrip: "Removes a channel name from the list",
		full_descrip: "Usage: `$removeChannel <alias>`",
		hidden: true,
		function: function(bot, msg, args){
	    if (!users.hasCmdAccess(msg)) return

	    delete CHANNELS[args[0].toUpperCase()]
			save.saveObject("channels.json", CHANNELS)

	    return "Alias ``"+args[0].toUpperCase()+"`` Removed"
		}
  },

  getChannelAliases:{
		name:"ls",
		short_descrip:"Lists recognized channel names",
		full_descrip:"Retrieves the list of channel aliases that may replace `<channel_id>` in other commands",
		hidden:true,
		function: function(bot, msg, args){
	    if (!users.hasCmdAccess(msg)) return

	    var channels = "```"
	    for (var key in CHANNELS){
	      channels += `${key}: ${CHANNELS[key]}\n`
	    }
	    return channels+"```"
		}
  },

	loadChannels:function(){
		var json = save.readObject("channels.json");
		Object.keys(json).forEach((key) => {
			CHANNELS[key] = json[key];
		});
	},


	// CHAT COMMANDS

	send:{
		name: "send",
		short_descrip: "Sends a message to a specified channel",
		full_descrip: "Usage: `$send <channel_id> <message>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`",
		hidden: true,
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			var channel = args.shift()
			bot.createMessage(chooseChannel(channel), args.join(" ")).catch((e) => {return e.toString()})
		}
	},

	delete:{
		name: "delete",
		short_descrip: "Deletes a message",
		full_descrip: "Usage: `$delete <channel_id> <message_id>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`",
		hidden: true,
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
				msg.delete()
			}).catch((e) => {return e.toString()})
		}
	},

	pin:{
		name: "pin",
		short_descrip: "Pins a message",
		full_descrip: "Usage: `$pin <channel_id> <message_id>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`",
		hidden: true,
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
				msg.pin()
			}).catch((e) => {return e.toString();})
		}
	},

	unpin:{
		name: "unpin",
		short_descrip: "Unpins a message",
		full_descrip: "Usage: `$unpin <channel_id> <message_id>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`",
		hidden: true,
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
				msg.unpin()
			}).catch((e) => {return e.toString();})
		}
	},

	dm:{
		name: "dm",
		short_descrip: "Sends a message to a user",
		full_descrip: "Usage: `$dm <user_id> <message...>`\nThe message may contain spaces",
		hidden: true,
		function: async function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			var user_id = args.shift()

			if (args.length == 0){
				return "Cannot send empty message"
			}

			let dm = await bot.getDMChannel(user_id).catch((e) => {return "DM Failed ``"+e+"``";})
			dm.createMessage(args.join(" "))

			return "[Bot -> "+dm.recipient.username+"]: "+args.join(" ")
		}
	},

}
