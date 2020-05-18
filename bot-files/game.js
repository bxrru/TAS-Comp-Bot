const users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const Save = require("./save.js")

// 35 default emoji
var DefaultEmoji = ["smiley","smile","grin","sweat_smile","joy","innocent","slight_smile","upside_down","wink","heart_eyes","kissing_heart","stuck_out_tongue","smirk","sunglasses","pensive","weary","cry","rage","flushed","scream","thinking","grimacing","frowning","open_mouth","cowboy","smiling_imp","clown","robot","thumbsup","thumbsdown","clap","ok_hand","wave","pray","eyes"]
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

  bound:{
    name: "bound",
		aliases: ["unbound"],
    short_descrip: "Bound/Unbound slots",
    full_descrip: "A global switch to bound/unbound slots. Bounded means that it limits $slots to 1 message. If it's unbounded it will send as many messages as it takes to send all the requested emoji (**WARNING** Walls of emoji may cause discord to lag)",
    hidden: true,
    function: function(bot, msg, args){
      if (!users.hasCmdAccess(msg)) return
      BoundSlots = !BoundSlots
      return `Bounded = ${BoundSlots ? `True` : `False`}`
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

  slots:{ // TODO: Add timeout (?)
    name: "slots",
    short_descrip: "Spin to Win",
    full_descrip: "Chooses a number of random emojis. This number is specified by the user and defaults to 3. The limit is as many characters as can fit in one message. This will use the server's custom emoji. If it has none, or this is used in DMs this will use a selection of 35 default emoji",
    hidden: true,
    function: function(bot, msg, args){

      if (!miscfuncs.isDM(msg) && disabled(msg.channel.guild.id)) return

  		var numEmoji = args[0];
  		if (isNaN(numEmoji) || numEmoji < 2){
  			numEmoji = 3
  		}

      var emojis = []
      if (miscfuncs.isDM(msg) || msg.channel.guild.emojis.length == 0) {
        emojis = DefaultEmoji
      } else {
        emojis = msg.channel.guild.emojis
      }

  		var emoji = getRandomEmoji(emojis)
  		var last = miscfuncs.isDM(msg) ? emoji : emoji.id
  		var win = true
  		var result = printEmoji(emoji)

  		for (var i = 0; i < numEmoji - 1; i++) {
  			emoji = getRandomEmoji(emojis)

  			if (miscfuncs.isDM(msg) && last != emoji || last != emoji.id) win = false
  			last = miscfuncs.isDM(msg) ? emoji : emoji.id

  			if (result.length + printEmoji(emoji).length > 2000){
          if (BoundSlots){
            break
          } else {
            bot.createMessage(msg.channel.id, result)
            result = ""
          }
  			}

  			result += printEmoji(emoji)
  		}

  		bot.createMessage(msg.channel.id, result)
  	  bot.createMessage(msg.channel.id, win ? `WINNER! ` + msg.author.mention : "Please Play Again")
    }
  },

  spin:{
    name: "spin",
    short_descrip: "Spin to Win 2: Electric Boogaloo",
    full_descrip: "Spin the classic slot machine to choose 9 random emoji. Win by getting 3 in a row in any row, column, or diagonal! This will use the server's custom emoji. If it has none, or this is used in DMs this will use a selection of 35 default emoji",
    hidden: true,
    function: function(bot, msg, args){

      if (!miscfuncs.isDM(msg) && disabled(msg.channel.guild.id)) return

      var emojis = []
      if (miscfuncs.isDM(msg) || msg.channel.guild.emojis.length == 0) {
        emojis = DefaultEmoji
      } else {
        emojis = msg.channel.guild.emojis
      }

      var roll = []
      for (var i = 0; i < 9; i++) roll.push(getRandomEmoji(emojis))

      var combinations = [[0,1,2], [3,4,5], [6,7,8], [0,3,6], [1,4,7], [2,5,8], [0,4,8], [2,4,6]]

      var win = false
      var result = ``
      for (var i = 0; i < combinations.length; i++) {
        var c = combinations[i]
        if (roll[c[0]] == roll[c[1]] && roll[c[1]] == roll[c[2]]) {
          win = true
          break
        }
      }

      var result = ``
      for (var i = 0; i < 9; i++) {
        result += printEmoji(roll[i])
        if (i % 3 == 2) result += `\n`
      }

      bot.createMessage(msg.channel.id, result)
      bot.createMessage(msg.channel.id, win ? `WINNER! ` + msg.author.mention : "Please Play Again")
    }
  },

  // COMMAND: for every user @mentioned in the command, the bot will
  // DM each one a different name on the list (meant for secret santa deligation)
  assign_random:{
    name: "secretsanta",
		aliases: ["ss"],
    short_descrip: "Chooses your Secret Santa",
    full_descrip: "Sends a DM to everyone @ mentioned in the command, with a name of another person on the list. No 2 users will get each other, and nobody will get themself.",
    hidden: true,
    function: async function(bot, msg, args){

      var users = []
      msg.mentions.forEach((person)=>{
        users.push({username:person.username, id:person.id, bans:[person.id]})
      })

      if (users.length == 2)
        return "Minimum of 3 people required"

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
	return !emoji.id || !emoji.roles.length // !emoji.id is used to detect default emoji
}

function printEmoji(emoji){
  if (emoji.animated) {
    return `<a:${emoji.name}:${emoji.id}> `
  } else if (emoji.name) {
    return `<:${emoji.name}:${emoji.id}> `
  } else {
    return `:${emoji}: `
  }
}

// easier to make this separate than edit the previous code
function DMSlots(channel, num) {
  var win = true
  var last = DefaultEmoji[randInt(DefaultEmoji.length)]
  var result = `:${last}: `
  for (var i = 1; i < num; i++) {
    var emoji = DefaultEmoji[randInt(DefaultEmoji.length)]
    if (emoji != last) win = false
    if (result.length + emoji.length > 2000 - 3) {
      if (BoundSlots) break
      channel.createMessage(result)
      result = ""
    }
    result += `:${last = emoji}: `
  }
  channel.createMessage(result)
  channel.createMessage(win ? `WINNER!` : "Please Play Again")
}
