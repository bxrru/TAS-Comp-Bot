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

var spam = "196442189604192256"
const GUILDS = {"COMP":"397082495423741953","ABC":"267091686423789568"}

const COMP_ACCOUNT = "397096658476728331";
const SCORE_POINTER = "569918196971208734";
var BOT_ACCOUNT = "532974459267710987" //"555489679475081227"; // better way to identify self?
const XANDER = "129045481387982848";
const BARRY = "146958598801457152";

// token
const ERGC = "NTMyOTc0NDU5MjY3NzEwOTg3.Dxlp2Q.QDe4dbD8_Pym_qonc9y47fybmx0";
const CompBot = "NTU1NDg5Njc5NDc1MDgxMjI3.D2smAQ.wJYGkGHK5mdC15kEX3_0wThBA7w";
var bot = new Eris.CommandClient(CompBot, {}, {
	description: "List of commands",
	owner: "Eddio0141, Barry & Xander",
	prefix: "$"
});

bot.on("ready", () => {
	//miscfuncs.makeFolderIfHNotExist("./taskuploads/");
	comp.load();
	game.load();
	score.retrieveScore(bot);
	bot.getSelf().then((self) => {
		BOT_ACCOUNT = self.id;
		console.log(self.username + " Ready! (" + miscfuncs.getDateTime() + ")");
	})
});

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

function ping(bot, msg, args){
	if (args.length < 1)
		return "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)";
}

// public commands
addCommand("ping", ping, "ping", "To check if the bot is not dead. Tells you time it takes to bait you in ms", false);

// specials
// this command doesnt do anything...
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
	if (miscfuncs.hasCmdAccess(msg)){
		var name = "lua.st"
		var file = {
			file: fs.readFileSync("./saves/"+name),
			name: name
		}
		console.log("./saves/"+file.name, "Size: " + file.file.byteLength, file.file)
		bot.createMessage(msg.channel.id, "** **", file);
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


function uptime(bot, msg, args){
	bot.createMessage(msg.channel.id, miscfuncs.formatSecsToStr(process.uptime()));
	console.log("uptime : " + miscfuncs.formatSecsToStr(process.uptime()));
}
addCommand("uptime", uptime, "Prints uptime", "Prints how long the bot has been connected", false);



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




// message handle
bot.on("messageCreate", (msg) => {

	// auto add planes to smileys
	if (msg.content.indexOf("😃") != -1){
		bot.addMessageReaction(msg.channel.id, msg.id, "✈");
	}

	if (msg.author.id == BOT_ACCOUNT) {return;} // ignore it's own messages

	// handle task submissions
	if (msg.attachments.length > 0 && !users.isBanned(msg.author) && miscfuncs.isDM(msg) && comp.getAllowSubmissions()) {
		//bot.createMessage(msg.channel.id, "ye");
	}

	// Handle Results
	score.autoUpdateScore(bot, msg);

	// Handle Submissions
	comp.filterSubmissions(bot, msg);

 	// Redirect Direct Messages that are sent to the bot
	if (miscfuncs.isDM(msg)) {

		var message = "[" + msg.author.username + "]: " + msg.content;

		// Redirect to a specific channel
		bot.createMessage(CHANNELS.BOT_DMS, message);

		// Redirect to a specific user
		//bot.getDMChannel(XANDER).then((dm) => {dm.createMessage(message);});
	}

});


//addCommand("score", score.processCommand, "Edits #score", "Usage: ``$score <action> <parameters>``\nAnyone may use ``$score calculate`` and ``$score find <me or name>``", false)
bot.registerCommand("score", (msg, args) => {return score.processCommand(bot, msg, args);},
{description: "Edits #score", fullDescription: score.help()});


// Channel Commands (Allowed from #bot and #tasbottests)
const chat = require("./chatcommands.js");
addCommand("ls", chat.getChannelAliases, "Retrieves the list of recognized channels", "Retrieves the list of channel aliases with their ids", false);
addCommand("addChannel", chat.addChannelAlias, "Adds a shortcut for a ID", "Usage: ``$addChannel <alias> <channel_id>``\nAllows ``<alais>`` to be specified in place of ``<channel_id>`` for other commands.", false);
addCommand("removeChannel", chat.removeChannelAlias, "Removes a channel alias from the database", "Usage: ``$removeChannel <alias>``", false);

// Chat Commands (Allowed from #bot and #tasbottests)
addCommand("send", chat.send, "Sends a message to a specified channel", "Usage: ``$send <channel_id or alias> <message>``\nFor a list of aliases use ``$ls``", true);
addCommand("delete", chat.delete, "Deletes a message", "Usage: ``$delete <channel_id or alias> <message_id>``\nFor a list of aliases use ``$ls``", true);
addCommand("pin", chat.pin, "Pins a message", "Usage: ``$pin <channel_id or alias> <message_id>``\nFor a list of aliases use ``$ls``", true);
addCommand("unpin", chat.unpin, "Unpins a message", "Usage: ``$unpin <channel_id or alias> <message_id>``\nFor a list of aliases use ``$ls``", true);
addCommand("dm", chat.dm, "Sends a message to a user", "Usage: ``$dm <user_id> <message...>``\nThe message may contain spaces", true);


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
var echoReactions = false;
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
	if (!miscfuncs.hasCmdAccess(msg)) {return;}

	echoReactions = !echoReactions;
	return echoReactions ? "Reactions enabled" : "Reactions disabled";

},
{
	description: "Toggle auto reactions (tr)",
	fullDescription: "Switches echoing reactions on/off",
	hidden: false
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
bot.registerCommand("addrole", (msg, args) => {
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
		return "List Complete"*/
	}
},
{
	description: "This message should not appear",
	fullDescription: "Adds a role. Usage ``$add <role_id> [member_id]``",
	hidden: true
});

bot.registerCommand("removerole", (msg, args) => {
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
	fullDescription: "Removes a role. Usage ``$rm <role_id> [member_id]``",
	hidden: true
});

// log a message
bot.registerCommand("log", (msg, args) => {if (miscfuncs.hasCmdAccess(msg)) console.log(args.join(" "))},{hidden: true});

// Games
addCommand("toggleGames", game.toggle, "Toggle game functions (tg)", "Switches the game functions on/off", false);
addCommand("giveaway", game.giveaway, "Randomly selects from a list", "Randomly selects a winner from line separated entries for a giveaway", false);
addCommand("slots", game.slots, "Spin to win", "Chooses a number of random emojis. This number is specified by the user and defaults to 3. The limit is as many characters as can fit in one message", true);

/*
// Announcements
const announce = require("./announcement.js");
addCommand("ac", announce.announce, "Announces a message", "Usage: ``$ac <channel> <hour> <minute> [message]``\nHours must be in 24 hour.\nUses current date.\nHas a default message", false);
addCommand("acclear", announce.clearAnnounce, "Removes all planned announcements", "Removes all planned announcements", true);
*/

// start / stop / clear submissions
addCommand("startSubmissions", comp.allowSubmissions, "Starts accepting submissions", "Starts accepting submissions via DMs", true)
addCommand("stopSubmissions", comp.stopSubmissions, "Stops accepting submissions", "Stops accepting submissions via DMs", true)
addCommand("clearSubmissions", comp.clearSubmissions, "Deletes all submission files (WARNING)", "Removes the Submitted role from every user that has submitted. Deletes the message containing all the submissions and deletes all of the saved files **without a confirmation/warning**", true)

// changing competition information
addCommand("setServer", comp.setServer, "Sets the competition server", "Usage: `$setserver [guild_id]`\nIf no ID is specified it will use the ID of the channel the command was called from. This assumes that it is given a valid server ID.", true)
addCommand("setSubmittedRole", comp.setRole, "Sets the submitted role", "Usage: `$setrole [role_id]`\nIf no ID is specified or the bot does not have permission to assign the role, it will disable giving roles to users that submit. Set the competition server using `$setServer` before using this command.", true);
addCommand("setSubmissionMessage", comp.setMessage, "Sets the message to show all submissions", "Usage: `$setsm <channel> <message_id>`\nThis message is stored and will be updated until the bot is set to not accept submissions", true)
addCommand("setSubmissionFeed", comp.setFeed, "Sets the default channel to send the submissions list to", "Usage: `$setfeed <channel>`\nThis does not ensure that the channel is a valid text channel that the bot can send messages to", true)
addCommand("setTask", comp.setTask, "Sets the Task Number", "Usage: `$settask <Task_Number>`\nSets the task number that will be used when downloading competition files", true)
addCommand("addHost", comp.addHost, "Sets a user to receive submission updates", "Usage: `$addhost <user_id>`\nThe selected user will receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To remove a user use `$removehost`", true)
addCommand("removeHost", comp.removeHost, "Stops a user from receiving submission updates", "Usage: `removehost <user_id>`\nThe selected user will NO LONGER receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To add a user use `$addhost`", true)

// naming submissions
addCommand("setname", comp.setName, "Change your name as seen in #current_submissions", "Usage: `$setname <new name here>`\nSpaces and special characters are allowed. Moderators are able to remove access if this command is abused", false);
addCommand("lockName", comp.lockName, "Disable a user from changing their submission name", "Usage: `$lockname <Submission_Number> [Name]`\nPrevents the user from changing their name and sets it to `[Name]`. If no name is specified it will remain the same. To see the list of Submission Numbers use `$listsubmissions`", true)
addCommand("unlockName", comp.unlockName, "Allow users to change their submission name", "Usage: `$unlockname <Submission_Number>`\nAllows the user to change their submission name. To see the list of Submission Numbers use `$listsubmissions`", true)

// competition information
addCommand("compinfo", comp.info, "Shows competition related information", "Shows current internal variables for the competition module", true)
addCommand("getsubmission", comp.checkSubmission, "Get submitted files (get)", "Usage: `$get <Submission_Number or 'all'>`\nReturns the name, id, and links to the files of the submission. If you use `$get all` the bot will upload a script that can automatically download every file. To see the list of Submission Numbers use `$listsubmissions`", true)
addCommand("listSubmissions", comp.listSubmissions, "Shows the list of current submissions", "Shows the list of users that have submitted. Anyone can use this command in DMs", false)
addCommand("status", comp.checkStatus, "Check your submitted files", "Tells you what you need to submit and sends you the links to your submitted files", false)

// Various Command Aliases (<Alias>, <Original_Command_Name>)
aliases = [
	["channeladd","addChannel"],
	["channelremove","removeChannel"],
	["listchannels","ls"],
	["getchannels","ls"],
	["say","send"],
	["tr","toggleReaction"],
	["togglereactions","toggleReaction"],
	["tg","toggleGames"],
	["togglegame","toggleGames"],
	["get","getsubmission"],
	["setsm","setSubmissionMessage"],
	["setsmsg","setSubmissionMessage"],
	["setfeed","setSubmissionFeed"],
	["startAccepting","startSubmissions"],
	["startSubmission","startSubmissions"],
	["stopAccepting","stopSubmissions"],
	["stopSubmission","stopSubmissions"],
	["clearAllSubmissions","clearSubmissions"],
	["setRole","setSubmittedRole"]
];

aliases.forEach((alias)=>(bot.registerCommandAlias(alias[0], alias[1])));


bot.connect();

/* Command Template
bot.registerCommand("", (msg, args) => {
	if (!miscfuncs.hasCmdAccess(msg)) {return;}

	// Code here:

},
{
	description: "",
	fullDescription: "Usage: ``$``",
	hidden: true,
	caseInsensitive: true
});
*/
