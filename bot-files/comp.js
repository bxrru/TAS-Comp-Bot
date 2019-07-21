const users = require("./users.js");
const miscfuncs = require("./miscfuncs.js");
const chat = require("./chatcommands.js");
const SAVE = require("./save.js");
const fs = require("fs");
const request = require("request");

var allowSubmission = false;
var Task = 1;

var Guild = "397082495423741953";
var SubmittedRole = "575732673402896404";
var Channel_ID = ""//"555543392671760390";
var Message_ID = ""//"599382510580793344";
var Num_Submissions = 0;
var Submissions = []; // {number, name, id, m64, m64_size, st, st_size}

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
		Task = rawrxd;
	},
	getAllowSubmission:function(){
		return allowSubmission;
	},
	getTaskNum:function(){
		return Task;
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
	addSubmission:function(user_id, name, m64_url, m64_filesize, st_url, st_filesize){
		Num_Submissions++;

		var submission = {
			number: Num_Submissions,
			name: name,
			id: user_id,
			m64: m64_url,
			m64_size: m64_filesize,
			st: st_url,
			st_size: st_filesize
		}

		Submissions.push(submission);
		module.exports.save();
		console.log("Added submission:", submission);
	},
	addSubmissionName:function(user_id, name){
		module.exports.addSubmission(user_id, name, "", 0, "", 0)
	},
	update_m64:function(user_id, new_m64, filesize){
		var index = module.exports.getSubmission(user_id).number - 1;
		Submissions[index].m64 = new_m64;
		Submissions[index].m64_size = filesize;
		module.exports.save();
	},
	update_st:function(user_id, new_st, filesize){
		var index = module.exports.getSubmission(user_id).number - 1;
		Submissions[index].st = new_st;
		Submissions[index].st_size = filesize;
		module.exports.save();
	},
	update_name:function(user_id, new_name){
		var index = module.exports.getSubmission(user_id).number - 1;
		Submissions[index].name = new_name;
		module.exports.save();
	},
	getSubmisssionStatus:function(user_id){
		if (!module.exports.hasSubmitted(user_id)) {
			var m64 = false
			var st = false
		} else {
			var submission = module.exports.getSubmission(user_id);
			var m64 = submission.m64.length != 0;
			var st = submission.st.length != 0;
		}

		if (m64 && st){
			return "Submission Status: ``2/2`` Submission complete.\nm64: "+submission.m64+"\nst: "+submission.st
		} else if (m64 && !st){
			return "Submission Status: ``1/2`` No st received.\nm64: "+submission.m64
		} else if (!m64 && st){
			return "Submission Status: ``1/2`` No m64 received.\nst: "+submission.st
		} else { // (!m64 && !st)
			return "Submission Status: ``0/2`` No m64 or st received."
		}
		//
	},
	addSubmissionCommand:async function(bot, msg, args){
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
		module.exports.addSubmissionName(user_id, name);

		var result = "Added the following:```" + Num_Submissions + ". " + name + "```";

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
	save:function(){
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
	isM64:function(attachment){
		return attachment.filename.substr(-4).toLowerCase() == ".m64"
	},
	isSt:function(attachment){
		return attachment.filename.substr(-3).toLowerCase() == ".st"
	},
	fileSafeName:function(name){
		var string = "";
		name.split('').forEach(char => {
			// dont allow special characters
			if (!["\\","/",":",'?','"','<','>','|',' ','*'].includes(char)) {
				string += char;
			}
		});
		return string;
	},
	properFileName:function(username){
		return "TASCompetitionTask"+Task+"By" + module.exports.fileSafeName(username);
	},
	clearRoles:async function(bot){
		var clear = async function(user){
			try {
				let clearRole = await bot.removeGuildMemberRole(Guild, user.id, SubmittedRole, "Clearing Submissions");
			} catch (e) {
				console.log("Could not remove role from ", user.name, user.id);
			}
		}
		Submissions.forEach(clear);
		return "Cleared roles."
	},

	// attachment = {filename, url, size}
	filerFiles:function(bot, msg, attachment){

		// if they have not submitted, add a new submission
		if (!module.exports.hasSubmitted(msg.author.id)){
			module.exports.addSubmissionName(msg.author.id, msg.author.username)
		}

		var name = module.exports.getSubmission(msg.author.id).name
		var filename = module.exports.properFileName(name)

		// make sure the file is an m64 or st
		if (module.exports.isM64(attachment)) {
			filename += ".m64";
		} else if (module.exports.isSt(attachment)) {
			filename += ".st";
		} else {
			bot.createMessage(msg.channel.id, "Attachment ``"+attachment.filename+"`` is not an ``m64`` or ``st``");
			return
		}

		bot.createMessage(msg.channel.id, "Processing "+filename+"...");

		// begin downloading the file
		miscfuncs.downloadFromUrl(attachment.url, "./saves/" + filename)

		module.exports.uploadFile(bot, filename, attachment.size, msg)

		module.exports.giveRole(bot, msg.author.id, msg.author.username)
		module.exports.updateSubmissionMessage(bot)

	},


	storeFile:async function(bot, file, msg){

		try {
			var message = await bot.createMessage(msg.channel.id, "File submitted. Use `$status` to check the status of your submission", file)
			var attachment = message.attachments[0]

			// save the url and filesize in the submission
			if (module.exports.isM64(attachment)){
				module.exports.update_m64(msg.author.id, attachment.url, attachment.size)

			} else if (module.exports.isSt(attachment)){
				module.exports.update_st(msg.author.id, attachment.url, attachment.size)

			} else { // this should never happen since it must be an m64 or st at this point
				throw "Attempted to upload incorrect file: " + file.name
			}

			//bot.createMessage(msg.channel.id, module.exports.getSubmisssionStatus(msg.author.id));

		} catch (e) {
			bot.createMessage(chat.chooseChannel("BOT_DMS"), "Filed to store submission url from "+msg.author.username+"```"+e+"```")
		}

	},

	// recursive function that will keep trying to upload a file until the buffer size matches
	// this is meant to be used after a file starts to download
	uploadFile:async function(bot, filename, filesize, msg){

		try {
			var file = {
				file: fs.readFileSync("./saves/" + filename),
				name: filename
			}
		} catch (e) {
			var file = {file: {byteLength: -1}} // this causes a recursive call
		}

		// if the file hasnt completely downloaded try again
		if (file.file.byteLength != filesize){
			setTimeout(function(){module.exports.uploadFile(bot, filename, filesize, msg)}, 1000)

		} else {
			// upload the file then delete it locally
			await module.exports.storeFile(bot, file, msg)
			fs.unlinkSync("./saves/" + filename)
		}


	},

	changeName:async function(bot, msg, args){

		var user_id = msg.author.id
		var name = args.join(" ")

		// get submission
		if (!module.exports.hasSubmitted(user_id)){
			return "You must submit files before changing your name"
		}

		// change their name
		module.exports.update_name(user_id, name)

		// redownload files with new name
		var submission = module.exports.getSubmission(user_id)

		if (!miscfuncs.isDM(msg)){
			try {
				msg.channel = await bot.getDMChannel(user_id)
			} catch (e) {
				return "Something went wrong. Try calling command from DMs"
			}
		}

		// reupload m64
		var attachment = {filename: ".m64", url: submission.m64, size: submission.m64_size}
		module.exports.filerFiles(bot, msg, attachment)

		// reupload st
		var attachment = {filename: ".st", url: submission.st, size: submission.st_size}
		module.exports.filerFiles(bot, msg, attachment)

		return "Set name to " + name

	},

	checkStatus:function(bot, msg, args){
		return module.exports.getSubmisssionStatus(msg.author.id)
	},

	checkSubmission:function(bot, msg, args){

		if (!miscfuncs.hasCmdAccess(msg)) return

		if (args[0].toLowerCase() == "all"){
			if (!miscfuncs.isDM(msg)) return "This command can only be called in DMs"
			bot.createMessage(msg.channel.id, "Creating script...")
			module.exports.getAllSubmissions(bot, msg.channel.id)
			return
		}

		var num = parseInt(args[0])
		if (isNaN(num) || num < 1 || num > Num_Submissions){
			return "A number between 1 and " + Num_Submissions + " inclusive must be specified"
		}

		var submission = Submissions[num - 1]

		return num+". "+submission.name+"\nID: "+submission.id+"\n"+"m64: "+submission.m64+"\nst: "+submission.st

	},

	getDownloadScript:function(){

		var text = ''
		text += 'md "Task ' + Task + '"\n'
		text += 'cd "Task ' + Task + '"\n'

		Submissions.forEach((submission) => {

			// make folder // go into folder
			var name = module.exports.fileSafeName(submission.name)
			text += 'md "' + name + '"\n'
			text += 'cd "' + name + '"\n'

			// download m64 + st
			var filename = module.exports.properFileName(name)
			text += 'powershell -Command "Invoke-WebRequest ' + submission.m64 + ' -OutFile ' + filename + '.m64"\n'
			text += 'powershell -Command "Invoke-WebRequest ' + submission.st + ' -OutFile ' + filename + '.st"\n'

			// go back to main folder
			text += 'cd ".."\n'

		});

		return text


	},

	getAllSubmissions:function(bot, channel){

		var text = module.exports.getDownloadScript()

		fs.writeFile("download.bat", text, (err) => {
			if (err) {
				bot.createMessage(channel, "Something went wrong```"+err+"```")
			}
			var file = {
				file: fs.readFileSync("download.bat"),
				name: "download.bat"
			}
			bot.createMessage(channel, "** **", file)
		})

	},

	updateSubmissionMessage:async function(bot){
		try {
			let message = await bot.getMessage(Channel_ID, Message_ID);
			message.edit(SubmissionsToMessage());
		} catch (e) {
			console.log("Failed to edit Current Submissions")
			bot.createMessage(chat.chooseChannel("BOT_DMS"), "Could not edit #current_submissions```"+e+"```")
		}
	},

	giveRole:async function(bot, user_id, name){
		try {
			let addRole = await bot.addGuildMemberRole(Guild, user_id, SubmittedRole, "Submission received");
		} catch (e) {
			console.log("Failed to assign role to "+name)
			bot.createMessage(chat.chooseChannel("BOT_DMS"), "Failed to assign submitted role to "+name+"```"+e+"```")
		}
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
	handleSubmission:function(bot, msg, args){

	}
};

/*
OUTDATED
echoFileFilter:async function(bot, msg, attachment){

	bot.createMessage(msg.channel.id, "Processing...");

	var filename = module.exports.properFileName(msg.author.username);

	if (module.exports.isM64(attachment)) {
		filename += ".m64";
	} else if (module.exports.isSt(attachment)) {
		filename += ".st";
	} else {
		bot.createMessage(msg.channel.id, "Attachment ``"+attachment.filename+"`` is not an ``m64`` or ``st``");
		return
	}

	miscfuncs.downloadFromUrl(attachment.url, "./saves/" + filename)


	// sends the file to the user it received it from, then store the url in that message
	var storeFileUrl = async function(file){
		try {
			var message = await bot.createMessage(msg.channel.id, "Submitted File:", file)
			var attachment = message.attachments[0]

			if (module.exports.isM64(attachment)){
				module.exports.update_m64(msg.author.id, attachment.url)

			} else if (module.exports.isSt(attachment)){
				module.exports.update_st(msg.author.id, attachment.url)

			} else { // this should never happen since it must be an m64 or st at this point
				throw "Attempted to upload incorrect file: " + file.name
			}

			bot.createMessage(msg.channel.id, module.exports.getSubmisssionStatus(msg.author.id));

		} catch (e) {
			bot.createMessage(chat.chooseChannel("BOT_DMS"), "Filed to store submission url ```"+e+"```")
		}
	}


	// recursive setTimeout function to wait until the file has downloaded it
	var uploadFile = async function(){

		var file = {
			file: fs.readFileSync("./saves/" + filename),
			name: filename
		}

		// if the file hasnt completely downloaded try again
		if (file.file.byteLength != attachment.size){
			setTimeout(uploadFile, 1000)

		} else {
			await storeFileUrl(file)
			fs.unlinkSync("./saves/" + filename)
		}
	}

	setTimeout(uploadFile, 1000)

},*/
