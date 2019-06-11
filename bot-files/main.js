process.title = "CompBOT";
console.log("Starting main.js...");

// other js files
var fs = require("fs");
const Eris = require("eris");

var miscfuncs = require("./miscfuncs.js");
var users = require("./users.js");
var comp = require("./comp.js");
var score = require("./score.js");
var save = require("./save.js");

// make new cfg file if it doesn't exist
if (!fs.existsSync("save.cfg"))
	save.makeNewSaveFile();

// channels of interest
var CHANNELS = {"GENERAL": "397488794531528704",
		"BOT": "554820730043367445",
		"BOT_DMS": "555543392671760390",
		"SCORE": "529816535204888596",
		"RESULTS": "529816480016236554",
		"CURRENT_SUBMISSIONS": "397096356985962508",
		"OTHER": "267091686423789568",
		"MARIO_GENERAL": "267091914027696129",
		"TASBOTTESTS": "562818543494889491"}

const GUILDS = {"COMP":"397082495423741953","ABC":"267091686423789568"}

const COMP_ACCOUNT = "397096658476728331";
const SCORE_POINTER = "569918196971208734";
const BOT_ACCOUNT = "555489679475081227"; // better way to identify self?

// token
var bot = new Eris.CommandClient("NTU1NDg5Njc5NDc1MDgxMjI3.D2smAQ.wJYGkGHK5mdC15kEX3_0wThBA7w", {}, {
	description: "List of commands",
	owner: "Eddio0141, Barry & Xander",
	prefix: "$"
});

bot.on("ready", () => {
	score.retrieveScore(bot);
	console.log("Ready! (" + miscfuncs.getDateTime() + ")");
});

function addCommand(name, func, descrip, fullDescrip, hide){
	bot.registerCommand(name, (msg, args) => {
		return func(bot, msg, args); // pass arguments to the function
	},
	{
		description: descrip,
		fullDescription: fullDescrip,
		hidden: hide,
		caseInsensitive: false
	});
}

function ping(bot, msg, args){
	if (args.length < 1)
		return "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)";
}

// public commands
addCommand("ping", ping, "ping", "To check if the bot is not dead. Tells you time it takes to bait you in ms", false);

// specials
bot.registerCommand("restart", (msg, args) => {
	if (users.hasCmdAccess(msg.member)) {
		restart();
	}
},
{
	description: "restarts bot",
	fullDescription: "This restarts bot.",
	hidden: true
});

bot.registerCommand("test", (msg, args) => {
	if (users.hasCmdAccess(msg.member)){
		console.log("test command called");
		//miscfuncs.makeFolderIfHNotExist("./taskuploads/");
		//miscfuncs.downloadFromUrl(msg.attachments[0].url, "./taskuploads/" + msg.attachments[0].filename);
		//return "done saving " + msg.attachments[0].filename;

		//save.makeNewSaveFile();
	}
},
{
	description: "test (don't use)",
	fullDescription: "its a test command (don't use)",
	hidden: true
});

bot.registerCommand("uptime", (msg, args) => {
	if (users.hasCmdAccess(msg.member) && args.length < 1) {
		bot.createMessage(msg.channel.id, miscfuncs.formatSecsToStr(process.uptime()));
		console.log("uptime : " + miscfuncs.formatSecsToStr(process.uptime()));
	}
},
{
	description: "Prints uptime",
	fullDescription: "Prints uptime",
	hidden: true
});

bot.registerCommand("starttask", (msg, args) => {
	if (users.hasCmdAccess(msg.member) && args.length == 1) {
		var tasknum = Number(args[0]);
		if (Number.isNaN(tasknum))
			return "Invalid argument, needs task number instead";

		// empty out folder
		miscfuncs.deleteFilesInFolder("./taskuploads/");
		miscfuncs.makeFolderIfNotExist("./taskuploads/");

		comp.allowSubmission(tasknum);

		//save.saveAllowsubmissionAndTaskNum(comp.getAllowSubmission, getTaskNum);

		return "starting task " + args[0];
	}
	return "Enter task number after the $starttask";
},
{
	description: "Now accepts file uploads in dms for tas comp entry",
	fullDescription: "Arguments : task number",
	hidden: true
});



bot.registerCommand("score", (msg, args) => {
	return score.processCommand(bot, msg, args);
},
{
	description: "Edits #score",
	fullDescription: "Usage: $score <action> <parameters>",
	hidden: true
});



// message handle
bot.on("messageCreate", (msg) => {

	// auto add planes to smileys
	if (msg.content.indexOf("😃") != -1){
		bot.addMessageReaction(msg.channel.id, msg.id, "✈");
	}

	if (msg.author.id == BOT_ACCOUNT){return;} // ignore messages from self

	// handle task submissions
	if (msg.attachments.length > 0 && !users.isBanned(msg.author) && miscfuncs.isDM(msg) && comp.getAllowSubmission()) {
		bot.createMessage(msg.channel.id, "ye");
	}

	// message in #results (non-DQ) => calculate score
	if (msg.channel.id == CHANNELS.RESULTS && msg.content.split("\n")[0].toUpperCase().indexOf("DQ") == -1){

		var message = score.updateScore(msg.content);

		bot.createMessage(CHANNELS.SCORE, message).then((msg)=>{
			// store the message so it may be edited
    	score.setScoreMsg(msg.channel.id, msg.id);
			bot.getDMChannel(COMP_ACCOUNT).then((channel) => {
				channel.editMessage(SCORE_POINTER, msg.channel.id + " " + msg.id);
			});
		});
	}
});


// shortcut for channel IDs
function chooseChannel(string){
	string = string.toUpperCase()
	if (CHANNELS[string] === undefined) {
		return string;
	} else {
		return CHANNELS[string];
	}
}

bot.registerCommand("addChannel", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)) {
		CHANNELS[args[0].toUpperCase()] = args[1];
		return "``"+args[0].toUpperCase()+": "+args[1]+"`` Added.";
	}
},
{
	description: "Adds a shortcut for a ID.",
	fullDescription: "Usage: $addChannel <alias> <channel_id>\nAllows <alais> to be specified in place of <channel_id> for other commands.",
	hidden: true
});

bot.registerCommand("removeChannel", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)) {
		delete CHANNELS[args[0].toUpperCase()];
		return "``"+args[0]+"`` Removed."
	}
},
{
	description: "Removes a channel alias from the database",
	fullDescription: "Usage: $removeChannel <alias>",
	hidden: true
});

bot.registerCommand("getChannels", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)) {
		var channels = "```";
		for (var key in CHANNELS){
			channels += key + ": " + CHANNELS[key] + "\n";
		}
		return channels+"```";
	}
},
{
	description: "Gets a list of channel aliases and thier IDs",
	fullDescription: "Gets a list of channel aliases and thier IDs",
	hidden: true
});


// Various mod commands:
// people with command access
// or anyone in #bot can use them

bot.registerCommand("send", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)){
		var message = msg.content.substr(5, msg.content.length-1);
		message = message.substr(args[0].length+2, message.length-1)
		bot.createMessage(chooseChannel(args[0]), message).catch((err) => {return;});
	}
},
{
	description: "Sends a message to a specified channel",
	fullDescription: "Usage: $send <channel_id or alias> <message>",
	hidden: true
});

bot.registerCommand("delete", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)){
		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.delete();
		});
	}
},
{
	description: "Deletes a message",
	fullDescription: "Usage: $delete <channel_id or alias> <message_id>",
	hidden: true
});

bot.registerCommand("pin", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)){
		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.pin();
		});
	}
},
{
	description: "Pins a message",
	fullDescription: "Usage: $pin <channel_id or alias> <message_id>",
	hidden: true
});

bot.registerCommand("unpin", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)){
		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.unpin();
		});
	}
},
{
	description: "Unpins a message",
	fullDescription: "Usage: $unpin <channel_id or alias> <message_id>",
	hidden: true
});

/*
		case "$addCmdAccess":
			if (users.hasCmdAccess(msg.member) && msg.content.split(" ").length == 2) {
				var user = msg.content.split(" ", 2)[1].replace("@", "");
				users.addCmdAccess(user);
				bot.createMessage(msg.channel.id, "successfully added user " + user + " to CmdAccess");
				console.log("successfully added user " + user + " to CmdAccess");
			}
			break;
		case "$addBan":
			if (users.hasCmdAccess(msg.member) && msg.content.split(" ").length == 2) {
				var user = msg.content.split(" ", 2)[1].replace("@", "");
				users.addBan(user);
				bot.createMessage(msg.channel.id, "successfully banned user " + user);
				console.log("successfully banned user " + user);
			}
			break;
*/

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

bot.registerCommand("toggleReaction", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)) {
		echoReactions = !echoReactions;
		if (echoReactions){
			return "Reactions enabled";
		} else {
			return "Reactions disabled";
		}
	}
},
{
	description: "Toggle whether the bot echos reactions",
	hidden: true
});

bot.registerCommand("react", (msg, args) => {
	if (args[2].includes(":")){
		args[2] = args[2].substr(2, args[2].length-3);
	}
	bot.addMessageReaction(chooseChannel(args[0]), args[1], args[2]).catch((err) => {return;});
},
{
	description: "React to a message (This is broken ?)",
	hidden: true
});


const Submitted = "575732673402896404";
const RevealStreamer = "405161681769988096";
bot.registerCommand("add", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)){
		var member = msg.member.id;
		if (args[1] != undefined){
			member = args[1];
		}
		msg.channel.guild.addMemberRole(member, args[0], "He asked nicely")
		return "Gave user " + member + " Role " + args[0];
		/* cycle through all the roles and print them
		var roles = msg.channel.guild.roles;
		roles.forEach((role) => {
			bot.createMessage(msg.channel.id, role.name + " " + role.id)
		})
		//msg.channel.guild.addMemberRole(msg.member, "", "He asked nicely")
		return "List Complete"*/
	}
},
{
	description: "This message should not appear",
	fullDescription: "This message should not appear",
	hidden: false
});

bot.registerCommand("rm", (msg, args) => {
	if (miscfuncs.hasCmdAccess(msg)){
		var member = msg.member.id;
		if (args[1] != undefined){
			member = args[1];
		}
		msg.channel.guild.removeMemberRole(member, args[0], "He asked for it")
		return "Removed Role "+args[0]+" from user " + member;
	}
},
{
	description: "This message should not appear",
	fullDescription: "This message should not appear",
	hidden: true
});

bot.registerCommand("log", (msg, args) => {
	if (users.hasCmdAccess(msg.member)) {
		bot.createMessage(CHANNELS.BOT_DMS, msg.channel.guild.id)
		console.log(msg.content);
	}
},
{
	description: "",
	fullDescription: "Logs the message in the console",
	hidden: true
});

bot.connect();

/* Command Template
bot.registerCommand("", (msg, args) => {
	if (users.hasCmdAccess(msg.member)) {

	}
},
{
	description: "",
	fullDescription: "Usage: $",
	hidden: true
});
*/
