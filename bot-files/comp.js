const users = require("./users.js");
const miscfuncs = require("./miscfuncs.js");
const chat = require("./chatcommands.js");
const SAVE = require("./save.js")

var allowSubmission = false;
var task = 1;

var Guild = "397082495423741953";
var SubmittedRole = "575732673402896404";
var Channel_ID = ""//"555543392671760390";
var Message_ID = ""//"599382510580793344";
var Num_Submissions = 0;
var Submissions = []; // {number, name, id, m64, st}

function SubmissionsToMessage(){
	var message = "**__Current Submissions:__**\n\n";
	Submissions.forEach((player) => {
		message += player.number + ". " + player.name + "\n";
	});
	return message
}

module.exports = {
	allowSubmission:function(rawrxd){
		allowSubmission = true;
		task = rawrxd;
	},
	getAllowSubmission:function(){
		return allowSubmission;
	},
	getTaskNum:function(){
		return task;
	},
	stopSubmissions:function(){
		allowSubmission = false;
	},
	clearSubmissions:function(){
		// clear google drive files // for when files are taken in as info too

		// remove submitted roles from everyone

		// clear #current_submissions
	},
	setRole:async function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)) return
		if (args.length == 0) return "Missing argument: ``<role_id>``"

		var role = args[0];
		var reason = "Testing role permissions, command call by " + msg.author.username;
		let self = await bot.getSelf()

		try {
			let test = await bot.addGuildMemberRole(Guild, self.id, role, reason);
		} catch (e) {
			return "Invalid Role ID ```"+e.id+"```"
		}

	  bot.removeGuildMemberRole(Guild, self.id, role, reason);
		SubmittedRole = role;
		module.exports.save();
		return "Role set to ``" + role + "``"
	},
	setServer:async function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)) return
		if (args.length == 0) args = [msg.channel.guild.id];
		var guild_id = args[0];

		// test to see if it's a real server by getting bans
		// this can return "Missing Permissions" whether the bot is in the server or not
		// the REST API would need to be implemented to check for valid guilds
		// (IE this function does not work)
		try {
			let test = await bot.getGuildBans(guild_id);
		} catch (e) {
			return "Invalid Server ID ```"+e+"```"
		}

		Guild = guild_id;
		module.exports.save();
		return "Set Guild to ``" + guild_id + "``"

	},
	addSubmission:async function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)) return
		if (args.length == 0) return "Missing argument: ``<user_id>``"

		var user_id = args[0];

		// Check if the user has already submitted
		if (module.exports.hasSubmitted(user_id)){
			var user = module.exports.getSubmission(user_id);
			return user.name + " has already submitted (No. "+user.number+")"
		}

		// get the user
		var name;
		try {
			let dm = await bot.getDMChannel(user_id);
			name = dm.recipient.username;
		} catch (e) {
			return "Invalid User ID: ```"+e+"```"
		}

		// add the submission
		Num_Submissions++;
		var submission = {number: Num_Submissions, name:name, id:user_id}
		Submissions.push(submission);
		module.exports.save();
		var result = "Added the following:```" + submission.number + ". " + submission.name + "```";

		// add the role
		try {
			let addRole = await bot.addGuildMemberRole(Guild, user_id, SubmittedRole, "Command call by "+msg.author.username);
		} catch (e) {
			result += "Could not assign role: ```"+e+"```";
		}

		// update the message
		try {
			let message = await bot.getMessage(Channel_ID, Message_ID);
			message.edit(SubmissionsToMessage());
		} catch (e) {
			result += "Could not edit message: ```"+e+"```";
		}

		return result

	},
	hasSubmitted:function(user_id){
		let check = function(submission) {return submission.id == user_id}
		return Submissions.filter((i) => check(i)).length > 0;
	},
	getSubmission:function(user_id){
		if (!module.exports.hasSubmitted(user_id)) return null // ensure the submission exists
		let check = function(submission) {return submission.id == user_id}
		return Submissions.filter((i) => check(i))[0];
	},
	startSubmissionMessage:async function(bot, msg, args){

		if (args.length == 0) args = ["bot_dms"]; // default channel
		var channel = args[0];

		Num_Submissions = 0;
		Submissions = [];
		var result = "Submissions cleared. "

		// Set the message
		try {
			let message = await bot.createMessage(chat.chooseChannel(channel), SubmissionsToMessage());
			Channel_ID = message.channel.id;
			Message_ID = message.id;
		} catch (e) {
			result += "Unable to send message: ```"+e+"```";
		}

		module.exports.save();
		return result

	},
	save:async function(){
		var data = {
			guild_id: Guild,
			role_id: SubmittedRole,
			channel_id: Channel_ID,
			message_id: Message_ID,
			num: Num_Submissions,
			submissions: Submissions
		};
		SAVE.saveObject("submissions.json", data);
	},
	load:function(){
		var data = SAVE.readObject("submissions.json");
		Guild = data.guild_id
		SubmittedRole = data.role_id;
		Channel_ID = data.channel_id;
		Message_ID = data.message_id;
		Num_Submissions = data.num;
		while (data.submissions.length > 0) Submissions.push(data.submissions.shift())
	},

 	// UNTESTED // NOT WORKING // YET TO IMPLEMENT
	deleteSubmissionMessage:async function(bot){
		try {
			let message = bot.getMessage(Channel_ID, Message_ID);
			message.delete();
		} catch (e) {
			return "Could not find message to delete: ```"+e+"```"
		}

		Channel_ID = "";
		Message_ID = "";
		module.exports.save();
		return "Deleted message. "

	},
	clearRoles:async function(bot){
		Submissions.forEach((user) => {
			try {
				let clearRole = await bot.removeGuildMemberRole(Guild, user.id, SubmittedRole, reason);
			} catch (e) {
				console.log("Could not remove role from ", user.name, user.id);
			}
		});
		return "Cleared roles. "
	}
};
