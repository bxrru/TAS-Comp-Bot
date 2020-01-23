process.title = "CompBOT";
console.log("Starting main.js...");

// other js files
var fs = require("fs");
const Eris = require("eris");

const miscfuncs = require("./miscfuncs.js");
const users = require("./users.js");
const comp = require("./comp.js");
const score = require("./score.js");
const save = require("./save.js");
const game = require("./game.js");
const chat = require("./chatcommands.js");

const GUILDS = {"COMP":"397082495423741953","ABC":"267091686423789568"}

var BOT_ACCOUNT = "532974459267710987" //"555489679475081227"; // better way to identify self?
const XANDER = "129045481387982848";
const BARRY = "146958598801457152";

var bot = new Eris.CommandClient(process.argv[2], {}, {
	description: "List of commands",
	owner: "Eddio0141, Barry & Xander",
	prefix: "$"
});

bot.on("ready", () => {
	loadSaves()
	bot.getSelf().then((self) => {
		BOT_ACCOUNT = self.id;
		console.log(self.username + " Ready! (" + miscfuncs.getDateTime() + ")");
	})
	bot.createMessage(chat.chooseChannel('bot_dms'), `Connected (${miscfuncs.getDateTime()})`)
});

function loadSaves(){
	score.retrieveScore(bot)
	chat.loadChannels()
	users.load()
	comp.load()
	game.load()
	announcements.load(bot)
}

function addCommand(name, func, descrip, fullDescrip, hide){
	bot.registerCommand(name, (msg, args) => {
		return func(bot, msg, args); // pass arguments to the function
	},
	{
		description: descrip,
		fullDescription: fullDescrip,
		hidden: hide,
		caseInsensitive: true
	});
}

function loadModule(mod){
	Object.keys(mod).forEach(key => {
		var command = mod[key]
		if (Object.prototype.toString.call(command) == "[object Object]" && command.custom === undefined){
			addCommand(command.name, command.function, command.short_descrip, command.full_descrip, command.hidden)
		}
	})
}


// message handle
bot.on("messageCreate", async(msg) => {

	if (msg.content.indexOf("😃") != -1) bot.addMessageReaction(msg.channel.id, msg.id, "✈") // it's a meme

	if (msg.author.id == BOT_ACCOUNT) return // ignore it's own messages

	// another meme
	if (msg.content.split(' ').includes('<@!532974459267710987>') || msg.content.split(' ').includes('<@532974459267710987>')) {
		bot.createMessage(msg.channel.id, "What the fuck. Did you really ping me at this time for that? You did. Arrangements have been made so that I will no longer be directly pinged from you. If you need me, contact somebody else.")
	}

	score.autoUpdateScore(bot, msg);
	comp.filterSubmissions(bot, msg);

 	// Redirect Direct Messages that are sent to the bot
	if (miscfuncs.isDM(msg)) {
		var message = `[${msg.author.username} (${msg.author.id})]: ${msg.content}`
		//bot.createMessage(CHANNELS.BOT_DMS, message); // Redirect to a specific channel
		if (msg.author.id != XANDER) bot.getDMChannel(XANDER).then((dm) => {dm.createMessage(message);}); // Redirect to a specific user
	}

	/*// automatically compile brainfuck code - currently very buggy
	if (msg.content.substr(0, 3) != "$bf"){ // dont double compile commands
		var code = await bf.run.function(bot, msg, [], false, true)
		if (code.length) msg.channel.createMessage(code)
	}*/

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

	if (emoji.name == "😃"){ // auto add planes to smileys
		bot.addMessageReaction(msg.channel.id, msg.id, "✈");
	}

});

// Specials //
addCommand("restart", (bot, msg) => {if (users.hasCmdAccess(msg)) process.exit(42)},"","Shuts down the bot, downloads files off of github, then starts the bot back up. This will only download files from 'bot-files'", true)
bot.registerCommand("toggleReaction", (msg, args) => {if (users.hasCmdAccess(msg)) return (echoReactions = !echoReactions) ? "Reactions enabled" : "Reactions disabled"},{description: "Toggle auto reactions (tr)",fullDescription: "Switches echoing reactions on/off"})
bot.registerCommand("score", (msg, args) => {return score.processCommand(bot, msg, args)},{description: "Lists #score commands", fullDescription: score.help()});
bot.registerCommand("log", (msg, args) => {if (users.hasCmdAccess(msg)) console.log(args.join(" "))},{hidden: true});

loadModule(miscfuncs)
addCommand("uptime", function() {return miscfuncs.formatSecsToStr(process.uptime())}, "Prints uptime", "Prints how long the bot has been connected", false);

loadModule(users)
addCommand("mod", users.commandInfo, "Lists miscellaneous mod commands", users.commandInfo(), false)
addCommand("ban", async(bot,msg,args)=>comp.messageAdmins(bot,await users.BanCMD(bot,msg,args)), users.BanCMD.short_descrip, users.BanCMD.full_descrip, true)
addCommand("unban", async(bot,msg,args)=>comp.messageAdmins(bot,await users.unbanCMD(bot,msg,args)), users.unbanCMD.short_descrip, users.unbanCMD.full_descrip, true)

loadModule(chat)
addCommand("chat", chat.CommandInfo, "Lists chat commands", chat.CommandInfo(), false)

loadModule(game)
addCommand("games", game.CommandInfo, "Lists game commands", game.CommandInfo(), false)

loadModule(comp)
addCommand("comp", comp.CommandInfo, "List competition commands", comp.CommandInfo(), false)

var bf = require("./brainfuck.js")
loadModule(bf)

var announcements = require('./announcement.js')
loadModule(announcements)
addCommand("ac", announcements.CommandInfo, "Lists announcement commands", announcements.CommandInfo(), false)

bot.registerCommand("unused", (msg, args) => {
	return //'||baited||'//"\uD83D \u1F54B :kaaba:"

}, {hidden: true, caseInsensitive: true});

miscfuncs.aliases.forEach((alias)=>{bot.registerCommandAlias(alias[0], alias[1])})

bot.connect();

/* Command Template
bot.registerCommand("", (msg, args) => {
	if (!users.hasCmdAccess(msg)) return

	// Code here:

}, {hidden: true, caseInsensitive: true});
*/
