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
const SCORE = "529816535204888596";
const RESULTS = "529816480016236554";
const BOT_DMS = "555543392671760390";
const BOT = "554820730043367445";
const CURRENT_SUBMISSIONS = "397096356985962508";
const GENERAL = "397488794531528704";

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
	retrieveScore();
	console.log("Ready! (" + miscfuncs.getDateTime() + ")");
});

// public commands
bot.registerCommand("ping", (msg, args) => {
	if (args.length < 1)
		return "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)";
},
{
	description: "ping",
	fullDescription: "To check if the bot is not dead. Tells you time it takes to bait you in ms"
});

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
	if (msg.content.split(" ").length == 1){return}

	var action = msg.content.split("\n")[0].split(" ")[1].toUpperCase();

	// allow people to calculate scores and find themselves
	if (["FIND","CALCULATE"].includes(action) || users.hasCmdAccess(msg.author) || msg.channel.id == BOT){

		var params = [];

		if (action == "SET" || action == "CALCULATE"){
			params = msg.content.split("\n");
			params = params.splice(1, params.length - 1)
		} else {
			params = msg.content.split(" ");
			params = params.splice(2, params.length - 1)
		}

		// check that the message is a valid message from the bot
		if (action == "SETMESSAGE"){
			if (params.length >= 2){

				bot.getMessage(params[0], params[1]).then((msg) => {

					if (msg.author.id != BOT_ACCOUNT){
						return "Invalid user. Message must be sent by me."
					}

				}).catch((error) => {
					return "Invalid channel or message. Could not find message."
				});

				bot.getDMChannel(COMP_ACCOUNT).then((channel) => {
					channel.editMessage(SCORE_POINTER, params[0] + " " + params[1])
				})
			}
		}

		var message = score.processRequest(msg.member, action, params);

		// directly edit the message in #SCORE
		if (["CHANGENAME","CHANGEPOINTS","COMBINE","ADD","REMOVE","CLEAR","SET","CHANGETASK"].includes(action)){
			if (score.getScoreMsg()[0] == ""){
				message += " No message found to edit."
			} else {

				bot.getMessage(score.getScoreMsg()[0], score.getScoreMsg()[1]).then((msg) => {

					var task = parseInt(msg.content.split("\n")[0].split(" ").pop());

					if (action == "CHANGETASK"){task = parseInt(args[1]);}
					if (isNaN(task)){task = 1}

					bot.editMessage(score.getScoreMsg()[0],
						score.getScoreMsg()[1],
						score.scoreToMessage(score.getScore(), task));
				});
			}
		}
	}

		console.log(message);
		return message;
},
{
	description: "Edits #score",
	fullDescription: "Usage: $score <action> <parameters>",
	hidden: true
});

function retrieveScore(){

	// retrieve pointer to message containing score
	bot.getDMChannel(COMP_ACCOUNT).then((dm) => {
		dm.getMessage(SCORE_POINTER).then((msg) => {

			// store the channel and id
			var channel = msg.content.split(" ")[0];
			var id = msg.content.split(" ")[1];
			score.setScoreMsg(channel, id);

			// store the current score (string manipulation garbage)
			bot.getMessage(channel, id).then((score_msg) => {
				var results = score_msg.content.replace("**","").replace("**","").split('\n');
				if (results[results.length-1]==''){results.splice(results.length-1,results.length-1)}
				results = score.scoreMessageToScore(results.slice(2));
				results = score.sortScore(results);
				score.setScore(results);
			});
		});
	});
}

// shortcut for channel IDs
function chooseChannel(string){
	string = string.toUpperCase()
	if (string == "BOT"){
		return BOT;
	} else if (string == "GENERAL") {
		return GENERAL;
	} else {
		return string
	}
}

// Various mod commands:
// people with command access
// or anyone in #bot can use them

bot.registerCommand("send", (msg, args) => {
	if (users.hasCmdAccess(msg.member) || msg.channel.id == BOT){
		var message = msg.content.substr(5, msg.content.length-1);
		message = message.substr(args[0].length+2, message.length-1)
		bot.createMessage(chooseChannel(args[0]), message);
	}
});

bot.registerCommand("react", (msg, args) => {
	if (args[2].includes(":")){
		args[2] = args[2].substr(2, args[2].length-3);
	}
	bot.addMessageReaction(chooseChannel(args[0]), args[1], args[2]);
});

bot.registerCommand("delete", (msg, args) => {
	if (users.hasCmdAccess(msg.member) || msg.channel.id == BOT){
		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.delete();
		});
	}
});

bot.registerCommand("pin", (msg, args) => {
	if (users.hasCmdAccess(msg.member) || msg.channel.id == BOT){
		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.pin();
		});
	}
});

bot.registerCommand("unpin", (msg, args) => {
	if (users.hasCmdAccess(msg.member) || msg.channel.id == BOT){
		bot.getMessage(chooseChannel(args[0]), args[1]).then((msg) => {
			msg.unpin();
		});
	}
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

// message handle
bot.on("messageCreate", (msg) => {
	// handle task submissions
	if (msg.attachments.length > 0 && !users.isBanned(msg.author) && miscfuncs.isDM(msg) && comp.getAllowSubmission()) {
		bot.createMessage(msg.channel.id, "ye");
	}
	
	// message in #results (non-DQ) => calculate score
	if (msg.channel.id == RESULTS && msg.content.split("\n")[0].toUpperCase().indexOf("DQ") == -1){

		var message = score.updateScore(msg.content);

		bot.createMessage(SCORE, message).then((msg)=>{
			// store the message so it may be edited
    			score.setScoreMsg(msg.channel.id, msg.id);
			bot.getDMChannel(COMP_ACCOUNT).then((channel) => {
				channel.editMessage(SCORE_POINTER, msg.channel.id + " " + msg.id);
			});
		});
	}
});

// add any reaction added to any message
bot.on("messageReactionAdd", (msg, emoji) => {
	reaction = emoji.name;
	if (emoji.id != null){
		reaction += ":" + emoji.id;
	}
	bot.addMessageReaction(msg.channel.id, msg.id, reaction)
});

bot.connect();
