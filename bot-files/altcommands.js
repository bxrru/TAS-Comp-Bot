var users = require("./users.js");

var CHANNELS = {"GENERAL": "397488794531528704",
		"BOT": "554820730043367445",
		"BOT_DMS": "555543392671760390",
		"SCORE": "529816535204888596",
		"RESULTS": "529816480016236554",
		"CURRENT_SUBMISSIONS": "397096356985962508",
		"OTHER": "267091686423789568",
		"MARIO_GENERAL": "267091914027696129",
		"TASBOTTESTS": "562818543494889491"}

// shortcut for channel IDs
function chooseChannel(string){
	string = string.toUpperCase()
	if (CHANNELS[string] === undefined) {
		return string;
	} else {
  	return CHANNELS[string];
	}
}

// shorthand to see who has access to commands
function fromValidChannel(msg){
  return users.hasCmdAccess(msg.member) || msg.channel.id == CHANNELS.BOT || msg.channel.id == CHANNELS.TASBOTTESTS;
}

modle.exports = {
  addChannel:function(bot, msg, args){
    if (users.hasCmdAccess(msg.member)) {
      CHANNELS[args[0].toUpperCase()] = args[1];
      return "``"+args[0].toUpperCase()+": "+args[1]+"`` Added.";
    }
  },

  removeChannel:function(bot, msg, args){
    if (users.hasCmdAccess(msg.member)) {
      delete CHANNELS[args[0].toUpperCase()];
      return "``"+args[0]+"`` Removed."
    }
  },

  getChannels:function(bot, msg, args){
    if (users.hasCmdAccess(msg.member)) {
      var channels = "```";
      for (var key in CHANNELS){
        channels += key + ": " + CHANNELS[key] + "\n";
      }
      return channels+"```";
    }
  },




}
