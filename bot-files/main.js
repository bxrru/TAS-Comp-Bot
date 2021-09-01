process.title = "CompBOT";
console.log("Starting main.js...");
var NAME = "BOT"

// other js files
var fs = require("fs");
const Eris = require("eris-additions")(require("eris"));

const miscfuncs = require("./miscfuncs.js");
const users = require("./users.js");
const comp = require("./comp.js");
const score = require("./score.js");
const save = require("./save.js");
const game = require("./game.js");
const chat = require("./chatcommands.js");
const announcements = require('./announcement.js')
const bf = require("./brainfuck.js")

const Info = require("." + process.argv[2]) // use the info passed to it
users.setOwners(Info.Owner_IDs)
save.setSavePath(Info.Saves_Path)

var BOT_ACCOUNT = ""

var bot = new Eris.CommandClient(Info.Bot_Token, {}, {
	description: "List of commands",
	owner: "ERGC | Xander, Eddio0141, & Barry",
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
		if (users.isBanned(msg.author.id) && !users.hasCmdAccess(msg)) return // disallow banned users from using any commands
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
	var header = `**${NAME}** - ${mod.name} Module\n\n`
	var footer = `\nType \`$help <command>\` for more info on a command. `
	var footer2 = ``
	var msg = ``
	var i = 0
	var cmd_number = 1
	Object.keys(mod).forEach(key => {
		var cmd = mod[key]
		if (Object.prototype.toString.call(cmd) == "[object Object]"){
			msg += `\t**${cmd.name}** - ${cmd.short_descrip}\n`
			if (++i % 5 == 0) msg += `\n` // break them up in groups of 5
		}

		// split up to prevent passing the discord limit and having walls of text
		if (msg.length > 1000) {
			footer2 = `Use \`$${mod.short_name}${cmd_number + 1}\` for more commands. `
			var message = header + msg + footer + footer2
			if (cmd_number == 1) {
				addCommand(mod.short_name, () => message, `Lists ${mod.name} commands`, message, false)
			} else {
				addCommand(`${mod.short_name}${cmd_number}`, () => message, `Lists ${mod.name} commands`, message, true)
			}
			cmd_number++
			msg = ``
		}
	})
	var message = header + msg + footer
	if (cmd_number == 1) {
		addCommand(mod.short_name, () => message, `Lists ${mod.name} commands`, message, false)
	} else {
		addCommand(`${mod.short_name}${cmd_number}`, () => message, `Lists ${mod.name} commands`, message, true)
	}
}

function loadAllModules(){
	loadModule(miscfuncs)
	loadModule(users)
	loadModule(chat)
	loadModule(game)
	loadModule(comp)
	loadModule(announcements)
	loadModule(require(`./voice.js`))
}


// message handle
bot.on("messageCreate", async(msg) => {

	if (msg.content.indexOf("😃") != -1) bot.addMessageReaction(msg.channel.id, msg.id, "✈") // it's a meme

	if (msg.author.id == BOT_ACCOUNT) return // ignore it's own messages


	score.autoUpdateScore(bot, msg);
	comp.filterSubmissions(bot, msg);

 	// Redirect Direct Messages that are sent to the bot
	if (miscfuncs.isDM(msg)) {
		var message = `[${msg.author.username} (${msg.author.id})]: ${msg.content}`
		bot.createMessage(chat.chooseChannel('bot_dms'), message)
		//if (!Info.Owner_IDs.includes(msg.author.id)) bot.getDMChannel(Info.Owner_IDs[0]).then((dm) => {dm.createMessage(message);}); // Redirect to a specific user
	}

});

// add any reaction added to any message
var ReactionDisabledServers = save.readObject(`reactions.json`)
var flagcodes = ["🇦", "🇧", "🇨", "🇩", "🇪", "🇫", "🇬", "🇭", "🇮", "🇯", "🇰", "🇱", "🇲", "🇳", "🇴", "🇵", "🇶", "🇷", "🇸", "🇹", "🇺", "🇻", "🇼", "🇽", "🇾", "🇿"]
bot.on("messageReactionAdd", async(msg, emoji, userID) => {
	if (emoji.name.length == 4 && flagcodes.includes(emoji.name.substr(0, 2)) && flagcodes.includes(emoji.name.substr(2, 4))) {
		var user = await users.getUser(bot, userID)
		var url = `https://discordapp.com/channels/${msg.channel.guild.id}/${msg.channel.id}/${msg.id}`
		if (chat.chooseChannel(`flaglog`) != `flaglog`) bot.createMessage(chat.chooseChannel(`flaglog`), `${user ? `${user.username}#${user.discriminator} (\`${userID}\`)` : `Unknown User`} reacted with ${emoji.name} in ${msg.channel.mention}\n> ${msg.content}\n${url}`)
	}

	if (ReactionDisabledServers.includes(msg.channel.guild.id)) return

	reaction = emoji.name;
	if (emoji.id != null){
		reaction += ":" + emoji.id;
	}
	bot.addMessageReaction(msg.channel.id, msg.id, reaction)

	if (emoji.name == "😃"){ // auto add planes to smileys
		bot.addMessageReaction(msg.channel.id, msg.id, "✈");
	}

});


// Special Commands //
var toggleReactions = function(bot, msg, args) {
	if (!users.hasCmdAccess(msg)) return
	if (miscfuncs.isDM(msg)) return `Command must be called from a server`
	var result = ``
	if (ReactionDisabledServers.includes(msg.channel.guild.id)) {
		ReactionDisabledServers = ReactionDisabledServers.filter(id => id != msg.channel.guild.id)
		result = `Reactions enabled`
	} else {
		ReactionDisabledServers.push(msg.channel.guild.id)
		result = `Reactions disabled`
	}
	save.saveObject(`reactions.json`, ReactionDisabledServers)
	return result
}

async function restart(bot, msg, args) {
	if (!users.hasCmdAccess(msg)) return
	try {
		await bot.createMessage(msg.channel.id, args.length ? `Restarting... Downloading updated files` : `Restarting`)
	} catch (e) {
		console.log(`Error: Failed to send message`)
	} finally {
		process.exit(args.length ? 42 : 0)
	}
}

addCommand("restart", restart,"Restart the bot", "Shuts down the bot, and starts it up again. If this is called with any arguments (ex \`$restart 1\`) it will download the latest files off of github, and then start the bot back up. This will only download files from 'bot-files'", true)
addCommand("tr", toggleReactions, `Toggle auto reactions`, `Switches echoing reactions on/off for the current server`, false, [`toggleReaction`, `toggleReactions`])

bot.registerCommand("score", (msg, args) => {return score.processCommand(bot, msg, args)},{description: "Lists #score commands", fullDescription: score.help()})
bot.registerCommand("log", (msg, args) => {if (users.hasCmdAccess(msg)) console.log(args.join(" "))},{hidden: true})

addCommand("uptime", function() {return miscfuncs.formatSecsToStr(process.uptime())}, "Prints uptime", "Prints how long the bot has been connected", false)

addCmdObj(bf.run)

bot.connect();
