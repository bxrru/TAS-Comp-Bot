const users = require("./users.js");
const miscfuncs = require("./miscfuncs.js");
const chat = require("./chatcommands.js");
const SubmittedRole = "575732673402896404";
var allowSubmission = false;
var task = 1;
var SubmissionMessage = ["", ""]; // [channel_id, message_id]
var Submissions = []; // {ID, Name, m64, st}
var Num_Submissions = 0;
var Guild = "397082495423741953";

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
		// clear google drive files

		// remove submitted roles from everyone

		// clear #current_submissions
	},
	addSubmission:async function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){return "You do not have access";}

		var user_id = args[0];
		let dm = await bot.getDMChannel(user_id);
		bot.addGuildMemberRole(Guild, user_id, SubmittedRole, "Command call by "+msg.author.username)

		let message = await bot.getMessage(SubmissionMessage[0], SubmissionMessage[1])

		Num_Submissions++;

		if (Num_Submissions == 1){
			message.edit(message.content + "\n\n"+Num_Submissions+". "+dm.recipient.username);
		} else {
			message.edit(message.content + "\n"+Num_Submissions+". "+dm.recipient.username);
		}

		return "Added "+dm.recipient.username;

	},
	startSubmissionMessage:async function(bot, msg, args){
		Num_Submissions = 0;

		if (args.length == 0) {args = ["bot_dms"];}
		var channel = args[0];
		var msg = "**__Current Submissions:__**\n\n"

		// Set the message
		let message = await bot.createMessage(chat.chooseChannel(channel), msg);
		SubmissionMessage = [message.channel.id, message.id]

	}
};
/* UNTESTED // NOT WORKING // YET TO IMPLEMENT
	setServer:async function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){return;}

		if (args.length == 0) {
			args = [msg.channel.guild.id];
		}
		var guild_id = args[0];
		let test = await bot.getGuildBans(guild_id).catch((error) => {
			return "Invalid server ID ``" + error + "``";
		});

		Guild = guild_id;
		saveVars();
		return "Server set to ``" + guild_id + "``";
	},
	setRole:async function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){return;}

		if (args.length == 0){
			return "Missing argument ``<role_id>``";
		}

		var role = args[0];

		let self = await bot.getSelf();

		let test = await bot.addGuildMemberRole(Guild, self.id, role, "Testing Role Permissions").catch((error) => {
			return "Invalid role ID ``" + error + "``";
		});

		let test = await bot.removeGuildMemberRole(Guild, self.id, role, "Testing Role Permissions");

		SubmittedRole = role;
		saveVars();
		return "Role set to ``" + role + "``";

	},
	addSubmission:async function(bot, msg, args){
		if (!miscfuncs.hasCmdAccess(msg)){return;}

		if (args.length == 0){
			args = ["0"];
		}

		var user_id = args[0];

		if (hasSubmitted(user_id)){
			return getSubmission(user_id).name + " has already submitted";
		}

		let dm = await bot.getDMChannel(user_id);
		bot.addGuildMemberRole(Guild, user_id, SubmittedRole, "Command call by "+msg.author.username)

		let message = await bot.getMessage(ChannelID, MessageID)

		Num_Submissions++;

		if (Num_Submissions == 1){ // need extra line for first submission
			message.edit(message.content + "\n\n"+Num_Submissions+". "+dm.recipient.username);
		} else {
			message.edit(message.content + "\n"+Num_Submissions+". "+dm.recipient.username);
		}

		Submissions.push({id:user_id, name:dm.recipient.username});

		saveVars();
		return "Added "+dm.recipient.username;

	},
	hasSubmitted:function(user_id){
		console.log("checking...")
		return !Submissions.filter((entrant) => {entrant.id == user_id;}).length;
	},
	getSubmission:function(user_id){
		if (!hasSubmitted(user_id)){
			return null;
		}
		return Submissions.filter((entrant) => {entrant.id == user_id;})[0];
	},
	startSubmissionMessage:async function(bot, msg, args){
		Num_Submissions = 0;

		if (args.length == 0) {args = ["bot_dms"];}
		var channel = args[0];
		var msg = "**__Current Submissions:__**\n\n"

		// Set the message
		let message = await bot.createMessage(chat.chooseChannel(channel), msg);
		ChannelID = message.channel.id;
		MessageID = message.id;
	},
	deleteSubmissionMessage:function(bot){
		bot.getMessage(ChannelID, MessageID).then((msg) => {
			msg.delete();
		});
	},
	clearRoles:function(bot){
		Submissions.forEach((user) => {
			bot.removeGuildMemberRole(Guild, user.id, SubmittedRole, reason)
		});
	},
	saveVars:async function(){
		console.log("Saving comp data...")
		var data = {
			server: Guild,
			role: SubmittedRole,
			channel_id: ChannelID,
			message_id: MessageID,
			num: Num_Submissions,
			submissions: Submissions
		};
		save.saveObject("submissions.json", data);
	},
	loadVars:function(){
		var data = save.readObject("submissions.json");
		Guild = data.server;
		SubmittedRole = data.role;
		ChannelID = data.channel_id;
		MessageID = data.message_id;
		Num_Submissions = data.num;
		while (data.submissions.length > 0) Submissions.push(data.submissions.shift())
	}
};*/
