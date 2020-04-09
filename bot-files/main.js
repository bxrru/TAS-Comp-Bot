process.title = "PokéQuizBOT";
console.log("Starting main.js...");
var NAME = "BOT"

// other js files
var fs = require("fs");
const Eris = require("eris-additions")(require("eris"));

const miscfuncs = require("./miscfuncs.js");
const users = require("./users.js");
const save = require("./save.js");
const game = require("./game.js");
const chat = require("./chatcommands.js");
const announcements = require('./announcement.js')
const bf = require("./brainfuck.js")
const pkmn = require("./whosthatpokemon.js")

const Info = require("../SETUP-INFO.js")
var BOT_ACCOUNT = ""

var bot = new Eris.CommandClient(Info.Bot_Token, {}, {
	description: "List of commands",
	owner: "ERGC | Xander",
	prefix: "$"
});

bot.on("ready", async() => {
	var self = await bot.getSelf()
	BOT_ACCOUNT = self.id
	NAME = self.username
	loadAllModules()
	console.log(self.username + " Ready! (" + miscfuncs.getDateTime() + ")");
	bot.createMessage(chat.chooseChannel('bot_dms'), `Connected (${miscfuncs.getDateTime()})`)
});

function addCommand(name, func, descrip, fullDescrip, hide, aliases){
	bot.registerCommand(name, (msg, args) => {
		if (users.isBanned(msg.author.id)) return // disallow banned users from using any commands
		return func(bot, msg, args); // pass arguments to the function
	},
	{
		description: descrip,
		fullDescription: fullDescrip,
		hidden: hide,
		caseInsensitive: true
	});
	if (aliases != undefined) aliases.forEach(a => bot.registerCommandAlias(a, name))
}

function addCmdObj(cmd){
	addCommand(cmd.name, cmd.function, cmd.short_descrip, cmd.full_descrip, cmd.hidden, cmd.aliases)
}

function loadModule(mod){
	createHelpCommand(mod)
	Object.keys(mod).forEach(key => {
		var command = mod[key]
		if (Object.prototype.toString.call(command) == "[object Object]" && command.custom === undefined){
			addCmdObj(command)
		}
	})
	if (mod.load != undefined) mod.load(bot) // load saves
}

function createHelpCommand(mod){
	var msg = `**${NAME}** - ${mod.name} Module\n\n`
	var i = 0;
	Object.keys(mod).forEach(key => {
		var cmd = mod[key]
		if (Object.prototype.toString.call(cmd) == "[object Object]"){
			msg += `\t**${cmd.name}** - ${cmd.short_descrip}\n`
			if (++i % 5 == 0) msg += `\n` // break them up in groups of 5
		}
	})
	msg += "\nType \`$help <command>\` for more info on a command."
	addCommand(mod.short_name, function(){return msg}, `Lists ${mod.name} commands`, msg, false)
}


// message handle
bot.on("messageCreate", async(msg) => {

	if (msg.author.id == BOT_ACCOUNT) return // ignore it's own messages

 	// Redirect Direct Messages that are sent to the bot
	if (miscfuncs.isDM(msg)) {
		var message = `[${msg.author.username} (${msg.author.id})]: ${msg.content}`
		bot.createMessage(chat.chooseChannel('bot_dms'), message)
		//if (!Info.Owner_IDs.includes(msg.author.id)) bot.getDMChannel(Info.Owner_IDs[0]).then((dm) => {dm.createMessage(message);}); // Redirect to a specific user
	}

});

// add any reaction added to any message
var echoReactions = true;
bot.on("messageReactionAdd", (msg, emoji) => {

	if (!echoReactions){return;}

	reaction = emoji.name;
	if (emoji.id != null){
		reaction += ":" + emoji.id;
	}
	bot.addMessageReaction(msg.channel.id, msg.id, reaction)

});

function loadAllModules(){
	loadModule(miscfuncs)
	loadModule(users)
	loadModule(chat)
	loadModule(game)
	loadModule(announcements)
	loadModule(pkmn)
}

// Special Commands //
addCommand("restart", (bot, msg) => {if (users.hasCmdAccess(msg)) process.exit(42)},"","Shuts down the bot, downloads files off of github, then starts the bot back up. This will only download files from 'bot-files'", true)

bot.registerCommand("tr", (msg, args) => {if (users.hasCmdAccess(msg)) return (echoReactions = !echoReactions) ? "Reactions enabled" : "Reactions disabled"},{description: "Toggle auto reactions",fullDescription: "Switches echoing reactions on/off"})
bot.registerCommandAlias("toggleReaction", "tr")
bot.registerCommandAlias("toggleReactions", "tr")

bot.registerCommand("log", (msg, args) => {if (users.hasCmdAccess(msg)) console.log(args.join(" "))},{hidden: true})

addCommand("uptime", function() {return miscfuncs.formatSecsToStr(process.uptime())}, "Prints uptime", "Prints how long the bot has been connected", false)

addCmdObj(bf.run)

bot.connect();
