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



// message handle
bot.on("messageCreate", (msg) => {

	if (msg.content.indexOf("😃") != -1) bot.addMessageReaction(msg.channel.id, msg.id, "✈") // it's a meme

	if (msg.author.id == BOT_ACCOUNT) return // ignore it's own messages

	score.autoUpdateScore(bot, msg);
	comp.filterSubmissions(bot, msg);

 	// Redirect Direct Messages that are sent to the bot
	if (miscfuncs.isDM(msg)) {
		var message = "[" + msg.author.username + "]: " + msg.content;
		bot.createMessage(CHANNELS.BOT_DMS, message); // Redirect to a specific channel
		//bot.getDMChannel(XANDER).then((dm) => {dm.createMessage(message);}); // Redirect to a specific user
	}

});

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

// Specials //
bot.registerCommand("toggleReaction", (msg, args) => {if (miscfuncs.hasCmdAccess(msg)) return (echoReactions = !echoReactions) ? "Reactions enabled" : "Reactions disabled"},{description: "Toggle auto reactions (tr)",fullDescription: "Switches echoing reactions on/off"})
bot.registerCommand("score", (msg, args) => {return score.processCommand(bot, msg, args)},{description: "Edits #score", fullDescription: score.help()});
bot.registerCommand("log", (msg, args) => {if (miscfuncs.hasCmdAccess(msg)) console.log(args.join(" "))},{hidden: true});

// MISC //
addCommand("ping", miscfuncs.ping, "ping", "To check if the bot is not dead. Tells you time it takes to bait you in ms", false);
addCommand("uptime", function() {return miscfuncs.formatSecsToStr(process.uptime())}, "Prints uptime", "Prints how long the bot has been connected", false);
addCommand("addrole", miscfuncs.addRole, "Gives a user a role", "Usage `$ar <role_id> [user_id]`\nuser_id defaults to the user that calls the command", true)
addCommand("removerole", miscfuncs.removeRole, "Removes a role from a user", "Usage `$rr <role_id> [user_id]\nuser_id defaults to the user that calls the command", true)
addCommand("addreaction", miscfuncs.addReaction, "Reacts to a message", "Usage `$react <channel_id> <message_id> <emojis...>`\nThis will reacat with multiple space separated emojis. For a list of channel names that can be used instead of `<channel_id>` use `$ls`", false)


// CHAT MODULE //
addCommand("chat", chat.CommandInfo, "Lists chat commands", chat.CommandInfo(), false)

// Channel Commands
addCommand("ls", chat.getChannelAliases, "Lists recognized channel names", "Retrieves the list of channel aliases that may replace `<channel_id>` in other commands", true);
addCommand("addChannel", chat.addChannelAlias, "Adds a channel name to the list", "Usage: `$addChannel <alias> <channel_id>`\nAllows `<alais>` to be specified in place of `<channel_id>` for other commands.", true);
addCommand("removeChannel", chat.removeChannelAlias, "Removes a channel name from the list", "Usage: `$removeChannel <alias>`", true);

// Chat Commands
addCommand("send", chat.send, "Sends a message to a specified channel", "Usage: `$send <channel_id> <message>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`", true);
addCommand("delete", chat.delete, "Deletes a message", "Usage: `$delete <channel_id> <message_id>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`", true);
addCommand("pin", chat.pin, "Pins a message", "Usage: `$pin <channel_id> <message_id>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`", true);
addCommand("unpin", chat.unpin, "Unpins a message", "Usage: `$unpin <channel_id> <message_id>`\nFor a list of channel names that can be used instead of `<channel_id>` use `$ls`", true);
addCommand("dm", chat.dm, "Sends a message to a user", "Usage: `$dm <user_id> <message...>`\nThe message may contain spaces", true);


// GAME MODULE //
addCommand("games", game.CommandInfo, "Lists game commands", game.CommandInfo(), false)

addCommand("toggleGames", game.toggle, "Toggle game functions (tg)", "Switches the game functions on/off", true);
addCommand("giveaway", game.giveaway, "Randomly selects from a list", "Randomly selects a winner from line separated entries for a giveaway. Make sure that a space follows `$giveaway ` before the new lines otherwise the command will not be recognized", true);
addCommand("slots", game.slots, "Spin to win", "Chooses a number of random emojis. This number is specified by the user and defaults to 3. The limit is as many characters as can fit in one message", true);


// COMP MODULE //
addCommand("comp", comp.CommandInfo, "List competition commands", comp.CommandInfo(), false)

// edit submissions
addCommand("startSubmissions", comp.allowSubmissions, "Starts accepting submissions", "Starts accepting submissions via DMs", true)
addCommand("stopSubmissions", comp.stopSubmissions, "Stops accepting submissions", "Stops accepting submissions via DMs", true)
addCommand("clearSubmissions", comp.clearSubmissions, "Deletes all submission files (WARNING: NO CONFIRMATION)", "Removes the Submitted role from every user that has submitted. Deletes the message containing all the submissions and deletes all of the saved files **without a confirmation/warning upon using the command**", true)
addCommand("addSubmission", comp.manuallyAddSubmission, "Adds a submission", "Usage: `$addsubmission <user_id>`\nAdds a submission with a name but no files. To add files use `$submitfile`. To remove a submission use `$deletesubmission`", true)
addCommand("deleteSubmission", comp.removeSubmission, "Deletes a submission", "Usage: `$deletesubmission <Submission_Number>`\nTo see the list of Submission Numbers use `$listsubmissions", true)
addCommand("submitFile", comp.setSubmissionFile, "Change a user's files", "Usage: `$submitfile <submission_number> <url>`\nSets the stored file to the url provided. The user will be notified that their files are changed.", true)

// changing competition information
addCommand("setTask", comp.setTask, "Sets the Task Number", "Usage: `$settask <Task_Number>`\nSets the task number that will be used when downloading competition files", true)
addCommand("setServer", comp.setServer, "Sets the competition server", "Usage: `$setserver [guild_id]`\nIf no ID is specified it will use the ID of the channel the command was called from. This assumes that it is given a valid server ID.", true)
addCommand("setSubmittedRole", comp.setRole, "Sets the submitted role", "Usage: `$setrole [role_id]`\nIf no ID is specified or the bot does not have permission to assign the role, it will disable giving roles to users that submit. Set the competition server using `$setServer` before using this command.", true);
addCommand("setSubmissionFeed", comp.setFeed, "Sets the default channel to send the submissions list to", "Usage: `$setfeed <channel>`\nThis does not ensure that the channel is a valid text channel that the bot can send messages to", true)
addCommand("setSubmissionMessage", comp.setMessage, "Sets the message that shows the submissions list", "Usage: `$setsm <channel_id> <message_id>`\nThis message is stored and will be updated until the bot is set to not accept submissions. For a list of channel names that can be used instead of `<channel_id>` use `$ls`", true)
addCommand("addHost", comp.addHost, "Sets a user to receive submission updates", "Usage: `$addhost <user_id>`\nThe selected user will receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To remove a user use `$removehost`", true)
addCommand("removeHost", comp.removeHost, "Stops a user from receiving submission updates", "Usage: `removehost <user_id>`\nThe selected user will NO LONGER receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To add a user use `$addhost`", true)

// edit users
addCommand("setname", comp.setName, "Change your name as seen in #current_submissions", "Usage: `$setname <new name here>`\nSpaces and special characters are allowed. Moderators are able to remove access if this command is abused", false);
addCommand("lockName", comp.lockName, "Disable a user from changing their submission name", "Usage: `$lockname <Submission_Number> [Name]`\nPrevents the user from changing their name and sets it to `[Name]`. If no name is specified it will remain the same. To see the list of Submission Numbers use `$listsubmissions`", true)
addCommand("unlockName", comp.unlockName, "Allow users to change their submission name", "Usage: `$unlockname <Submission_Number>`\nAllows the user to change their submission name. To see the list of Submission Numbers use `$listsubmissions`", true)
addCommand("disqualify", comp.dq, "DQ a user", "Usage: `$dq <submission_number> [reason]`\nThis prevents the user from resubmitting to the current task and excludes their name from #current_submissions. This will not remove their files. To see the list of Submission Numbers use `$listsubmissions`")
addCommand("undoDisqualify", comp.undq, "", "Usage: `$undq <submission_number>`\nAllows the user to resubmit to the current task. To see the list of Submission Numbers use `$listsubmissions`")

// competition information
addCommand("compinfo", comp.info, "Shows module related information", "Shows current internal variables for the competition module", true)
addCommand("getsubmission", comp.checkSubmission, "Get submitted files (get)", "Usage: `$get <Submission_Number or 'all'>`\nReturns the name, id, and links to the files of the submission. If you use `$get all` the bot will upload a script that can automatically download every file. To see the list of Submission Numbers use `$listsubmissions`", true)
addCommand("listSubmissions", comp.listSubmissions, "Shows the list of current submissions", "Shows the list of users that have submitted. Anyone can use this command in DMs", false)
addCommand("status", comp.checkStatus, "Check your submitted files", "Tells you what you need to submit and sends you the links to your submitted files", false)

// ANNOUNCEMENT MODULE // (ToDo)

// Announcements
//const announce = require("./announcement.js");
//addCommand("ac", announce.announce, "Announces a message", "Usage: ``$ac <channel> <hour> <minute> [message]``\nHours must be in 24 hour.\nUses current date.\nHas a default message", false);
//addCommand("acclear", announce.clearAnnounce, "Removes all planned announcements", "Removes all planned announcements", true);

addCommand("fahrenheit", miscfuncs.celciusToInferiorTemp, "Convert °C to °F", "Usage: `$fahrenheit <°C>`", true)
addCommand("celsius", miscfuncs.inferiorTempToCelcius, "Convert °F to °C", "Usage: `$celsius <°F>`", true)
addCommand("inches", miscfuncs.cmToInches, "Convert cm to inches", "Usage: `$inches <cm>`", true)
addCommand("centimeters", miscfuncs.inchesToCm, "Convert inches to cm", "Usage: `$cm <inches>`", true)

bot.registerCommand("restart", (msg, args) => {
	if (!miscfuncs.hasCmdAccess(msg)) return
	bot.createMessage(msg.channel, "Restarting :wave:")
	process.exit(42) // this can be any unique code in the exclusive range (12, 128)
},
{
	description: "",
	fullDescription: "Usage: ``$``",
	hidden: true,
	caseInsensitive: true
});

addCommand("NewCMD", function(){return "Update Test"}, "", "", false)

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
	["setRole","setSubmittedRole"],
	["game", "games"],
	["removesubmission", "deleteSubmission"],
	["cm", "centimeters"],
	["celcius", "celsius"],
	["farenheit", "fahrenheit"],
	["ar", "addrole"],
	["rr", "removerole"],
	["react", "addreaction"],
	["addreactions", "addreaction"]
]

aliases.forEach((alias)=>{bot.registerCommandAlias(alias[0], alias[1])});


bot.connect();

/* Command Template
bot.registerCommand("", (msg, args) => {
	if (!miscfuncs.hasCmdAccess(msg)) return

	// Code here:

},
{
	description: "",
	fullDescription: "Usage: ``$``",
	hidden: true,
	caseInsensitive: true
});
*/
