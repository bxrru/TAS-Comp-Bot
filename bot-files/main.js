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
let loaded = false
let resuming = -1

var bot = new Eris.CommandClient(Info.Bot_Token, {}, {
	description: "List of commands",
	owner: "Barry, Eddio0141, Skazzy & Xander",
	prefix: "$"
});

bot.on("shardResume", (id) => {
	resuming = id
})

bot.on("ready", async() => {
	var self = await bot.getSelf()
	BOT_ACCOUNT = self.id
	NAME = self.username
	if (!loaded) { // this event can fire multiple times. Don't re-register commands
		loadAllModules()
		loaded = true
	}
	let connected_msg = `onnected (${miscfuncs.getDateTime()})`
	connected_msg = (resuming == -1 ? 'C' : "Rec") + connected_msg
	if (fs.existsSync(`./crash.log`)) {
		try {
			var err = fs.readFileSync(`./crash.log`)
			bot.createMessage(chat.chooseChannel('bot_dms'), connected_msg, {file:err, name:"crash.log"})
				.catch((err) => {
					console.log("[Error] Failed to send 'Connected' message. " + err)
				})
				.then(
					fs.unlinkSync(`./crash.log`)
				)
			console.log(self.username + " Ready! (" + miscfuncs.getDateTime() + ")")
			return
		} catch (e) {
			connected_msg += "\n```Unknown Error: Failed to open crash log```"
		}
	}
	bot.createMessage(chat.chooseChannel('bot_dms'), connected_msg)
		.catch((err) => {
			console.log("[Error] Failed to send 'Connected' message. " + err)
		})
	if (resuming == -1) {
		console.log(self.username + " Ready! (" + miscfuncs.getDateTime() + ")");
	}
	resuming = -1
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
	if (msg.length == 0) return; // a command was just registered for this already
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
	loadModule(require(`./m64_editor.js`))
	loadModule(require(`./dtm_editor.js`))
}


// message handle
bot.on("messageCreate", async(msg) => {

	if (msg.content.indexOf("😃") != -1) bot.addMessageReaction(msg.channel.id, msg.id, "✈") // it's a meme

	if (msg.author.id == BOT_ACCOUNT) return // ignore it's own messages

	// another meme
	if (msg.content.split(' ').includes('<@!532974459267710987>') || msg.content.split(' ').includes('<@532974459267710987>')) {
		bot.createMessage(msg.channel.id, "What the f*ck. Did you really ping me at this time for that? You did. Arrangements have been made so that I will no longer be directly pinged from you. If you need me, contact somebody else.")
	}

	score.autoUpdateScore(bot, msg);
	comp.filterSubmissions(bot, msg);

 	// Redirect Direct Messages that are sent to the bot
	if (miscfuncs.isDM(msg)) {
		var message = `[${msg.author.username} (${msg.author.id})]: ${msg.content}`
		bot.createMessage(chat.chooseChannel('bot_dms'), message).catch(() => {}) // error = cannot access this channel (ignore)
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

addCommand(
	"history",
	async (bot, msg, args) => {
		if (!users.hasCmdAccess(msg) && msg.author.id != "397688653276774403") return "You do not have permission to use this command"
		const LIMIT = 1000
		const FILEPATH = "./_history" + msg.id
		let attachments = 0;
		let info = ""
		let dl_script = ""
		let rcvd = LIMIT

		let channel = msg.channel
		if (args.length) {
			channel = bot.getChannel(args[0])			
		}
		bot.createMessage(msg.channel.id, `Scraping file history of ${channel.mention}`)
		let before = channel.lastMessageID

		let iter = 0
		while (rcvd == LIMIT){ // uncertain about behaviour when total % LIMIT = 0
			//msg.channel.getMessages(1031, undefined, "820409264219750441") // tasfiles
			//console.log("fetching msgs...")
			let msgs = await channel.getMessages(LIMIT, before)
			rcvd = msgs.length
			console.log(`Received ${rcvd} #${iter++}. Attachments ${attachments}`)
			let i = 0
			for (const m of msgs) {
				i++ // if this is not here, the loops dont run????? javascript pls.....
				for (const a of m.attachments) {
					i--
					let ext = a.filename.substr(a.filename.lastIndexOf('.')).toLowerCase()
					if ([".m64", ".st", ".savestate", ".zip", ".7z"].includes(ext)) {
						++attachments
						info += `${m.timestamp} ${m.author.username} ${m.content}\n`
						let url = a.url.substring(0, a.url.lastIndexOf("?"))
						let fname = `${m.timestamp}_${i}_${a.filename}`
						if (m.attachments.length == 1) {
							fname = `${m.timestamp}_${a.filename}`
						}
						dl_script += `powershell -Command "Invoke-WebRequest ${url} -OutFile '${fname}'\n`
					}
				}
			}
			//console.log(attachments)
			before = msgs[msgs.length-1].id
		}
		fs.writeFileSync(FILEPATH + ".bat", dl_script)
		fs.writeFileSync(FILEPATH + ".txt", info)
		await bot.createMessage(
			msg.channel.id,
			`${attachments} attachments found`,
			[
				{file: fs.readFileSync(FILEPATH + ".bat"), name: "_TAS_Download.bat"},
				{file: fs.readFileSync(FILEPATH + ".txt"), name: "_TAS_Info.txt"},
			]
		)
		fs.unlinkSync(FILEPATH + ".bat")
		fs.unlinkSync(FILEPATH + ".txt")
		
	},
	"Get channel file history",
	"Get channel history of files with st/savestate/m64/zip/7z attachments. Usage: `$history [channel id]` (uses current channel if none specified)",
	true,
	[]
)

bot.connect();
