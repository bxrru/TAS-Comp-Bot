const users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const Save = require("./save.js")

var DisabledServers = [];
var BoundSlots = true;

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
    msg += "\t**$ss** - Chooses your Secret Santa\n"
    msg += "\nType $help <command> for more info on a command."
    return msg
  },

  toggle:{
    name: "toggleGames",
    short_descrip: "Toggle game functions (tg)",
    full_descrip: "Switches the game functions on/off for a specific server",
    hidden: false,
    function: function(bot, msg, args){
      if (!users.hasCmdAccess(msg)) return

      for (var i = 0; i<DisabledServers.length; i++){
        if (DisabledServers[i] == msg.channel.guild.id){
          DisabledServers.pop(i)
          module.exports.save()
          return "Games enabled in ``"+msg.channel.guild.id+"``"
        }
      }
      DisabledServers.push(msg.channel.guild.id);
      module.exports.save()
      return "Games disabled in ``"+msg.channel.guild.id+"``"
    }
  },

  // expected input:
  // "$giveaway
  // 1. User
  // 2....."
  giveaway:{
    name: "giveaway",
    short_descrip: "Randomly selects from a list",
    full_descrip: "Randomly selects a winner from line separated entries for a giveaway. Make sure that a space follows `$giveaway ` before the new lines otherwise the command will not be recognized",
    hidden: true,
    function: function(bot, msg, args){
      if (disabled(msg.channel.guild.id)){return;}

      var participants = msg.content.split('\n');

      participants.splice(0, 1); // remove first line "$giveaway"

      var rand = randInt(participants.length);

      return "And the winner is... ``" + participants[rand] + "`` Congratulations!"
    }
  },

  slots:{
    name: "slots",
    short_descrip: "Spin to Win",
    full_descrip: "Chooses a number of random emojis. This number is specified by the user and defaults to 3. The limit is as many characters as can fit in one message",
    hidden: false,
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

  // COMMAND: for every user @mentioned in the command, the bot will
  // DM each one a different name on the list (meant for secret santa deligation)
  assign_random:{
    name: "secretsanta",
    short_descrip: "Chooses your Secret Santa",
    full_descrip: "Sends a DM to everyone @ mentioned in the command, with a name of another person on the list. No 2 users will get each other, and nobody will get themself.",
    hidden: true,
    function: async function(bot, msg, args){

      var users = []
      msg.mentions.forEach((person)=>{
        users.push({username:person.username, id:person.id, bans:[person.id]})
      })

      users.forEach(async(recipient)=>{

        //console.log(`Recipient: ${recipient.username}`)

        var rando = users[randInt(users.length)] // choose a random person

        // bans include self and users already picked
        while (recipient.bans.includes(rando.id)){
          var rando = users[randInt(users.length)]
        }


        for (var i = 0; i < users.length; i++){
          // Make sure nobody else can get this user again
          users[i].bans.push(rando.id)

          // Make sure no two people get each other
          if (users[i].id == rando.id){
            users[i].bans.push(recipient.id)
          }

        }

        //console.log(`Name getting sent: ${rando.username}`)

        // send the DM
        let dm = await bot.getDMChannel(recipient.id).catch((e) => {return "DM Failed ``"+e+"``";})
  		  dm.createMessage(rando.username)
      })
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
