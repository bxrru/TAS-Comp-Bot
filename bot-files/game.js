const users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const Save = require("./save.js")

var DisabledServers = [];

function disabled(guild_id){
  return DisabledServers.includes(guild_id);
}

module.exports = {

  save:function(){
    console.log("Saving games...")
    Save.saveObject("games.json", DisabledServers);
  },
  load:function(){
    var data = Save.readObject("games.json");
    DisabledServers = []
    while (data.length > 0){
      DisabledServers.push(data.pop());
    }
  },
  CommandInfo:function(){
    var msg = "**CompBot** - Games Module\n"
    msg += "\n**Game Commands:**\n"
    msg += "\t**$togglegames** - Toggle game functions (tg)\n"
    msg += "\t**$slots** - Spin to win\n"
    msg += "\t**$giveaway** - Randomly select a winner\n"
    msg += "\nType $help <command> for more info on a command."
    return msg
  },

  toggle:function(bot, msg, args){
    if (!users.hasCmdAccess(msg)) return

    for (var i = 0; i<DisabledServers.length; i++){
      if (DisabledServers[i] == msg.channel.guild.id){
        DisabledServers.pop(i);
        module.exports.save();
        return "Games enabled in ``"+msg.channel.guild.id+"``";
      }
    }
    DisabledServers.push(msg.channel.guild.id);
    module.exports.save();
    return "Games disabled in ``"+msg.channel.guild.id+"``";
  },

  // expected input:
  // "$giveaway
  // 1. User
  // 2....."
  giveaway:function(bot, msg, args){
    if (disabled(msg.channel.guild.id)){return;}

    var participants = msg.content.split('\n');

    participants.splice(0, 1); // remove first line "$giveaway"

    var rand = randInt(participants.length);

    return "And the winner is... ``" + participants[rand] + "`` Congratulations!";

  },

  slots:function(bot, msg, args){

    // TODO: Add timeout (?), use default emojis
    if (disabled(msg.channel.guild.id)){return;}

		var numEmoji = args[0];
		if (isNaN(numEmoji) || numEmoji < 2){
			numEmoji = 3;
		}

		var emojis = msg.channel.guild.emojis;
		var emoji = getRandomEmoji(emojis);
		var lastID = emoji.id;
		var win = true;
		var result = printEmoji(emoji)+" ";

		for (var i = 0; i < numEmoji-1; i++){
			emoji = getRandomEmoji(emojis);

			if (lastID != emoji.id){win = false;}
			lastId = emoji.id;

			if (result.length + printEmoji(emoji).length > 2000){
				break;
			}

			result += printEmoji(emoji)+" ";
		}

		bot.createMessage(msg.channel.id, result);
	  bot.createMessage(msg.channel.id, win ? "WINNER!" : "Please Play Again");

  },

  blackjack:function(bot, msg, args){
    // TODO ;)
  }
}


// Various helping commands

function getRandomEmoji(emojis){
	var i = randInt(emojis.length);
	while (!canUseEmoji(emojis[i])){
		i = randInt(emojis.length);
	}
	return emojis[i];
}

function randInt(exclusiveUpperBound){
	return Math.floor(Math.random() * exclusiveUpperBound);
}

function canUseEmoji(emoji){
	return !emoji.roles.length && !emoji.animated;
}

function printEmoji(emoji){
	return "<:"+emoji.name+":"+emoji.id+">";
}
