const users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const Save = require("./save.js")

var DisabledServers = [];
var BoundSlots = true;

function disabled(guild_id){
  return DisabledServers.includes(guild_id);
}

module.exports = {
  name: "Games",
  short_name: "games",
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

  toggle:{
    name: "tg",
		aliases: ["toggleGames", "toggleGame"],
    short_descrip: "Toggle game functions",
    full_descrip: "Switches the game functions on/off for a specific server",
    hidden: true,
    function: function(bot, msg, args){
      if (!users.hasCmdAccess(msg)) return

      for (var i = 0; i<DisabledServers.length; i++){
        if (DisabledServers[i] == msg.channel.guild.id){
          DisabledServers.splice(i, 1)
          module.exports.save()
          return "Games enabled in ``"+msg.channel.guild.id+"``"
        }
      }
      DisabledServers.push(msg.channel.guild.id);
      module.exports.save()
      return "Games disabled in ``"+msg.channel.guild.id+"``"
    }
  },

  slots:{
    name: "slots",
    short_descrip: "Spin to Win",
    full_descrip: "Chooses a number of random emojis. This number is specified by the user and defaults to 3. The limit is as many characters as can fit in one message",
    hidden: true,
    function: function(bot, msg, args){

      // TODO: Add timeout (?), use default emojis
      if (disabled(msg.channel.guild.id)) return

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
          if (BoundSlots){
            break;
          } else {
            bot.createMessage(msg.channel.id, result); result = ""
          }
  			}

  			result += printEmoji(emoji)+" ";
  		}

  		bot.createMessage(msg.channel.id, result);
  	  bot.createMessage(msg.channel.id, win ? "WINNER!" : "Please Play Again");
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
