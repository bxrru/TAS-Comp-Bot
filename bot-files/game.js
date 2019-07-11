const miscfuncs = require("./miscfuncs.js");
var enabled = false;

module.exports = {

  toggle:function(bot, msg, args){
    if (!miscfuncs.hasCmdAccess(msg)){return;}
    enabled = !enabled;
    return enabled ? "Games enabled" : "Games disabled";
  },

  // expected input:
  // "$giveaway
  // 1. User
  // 2....."
  giveaway:function(bot, msg, args){
    if (!miscfuncs.hasCmdAccess(msg)){return;}

    var participants = msg.content.split('\n');

    participants.splice(0, 1); // remove first line "$giveaway"

    var rand = randInt(participants.length);

    return "And the winner is... ``" + participants[rand] + "`` Congratulations!";

  },

  slots:function(bot, msg, args){
    if (!enabled){return;}

    // TODO: Add timeout (?), use default emojis
    if (!miscfuncs.hasCmdAccess(msg)){return;}

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
		if (win){
			bot.createMessage(msg.channel.id, "WINNER!");
		} else {
			bot.createMessage(msg.channel.id, "Please Play Again");
		}

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
