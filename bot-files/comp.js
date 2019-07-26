const users = require("./users.js");
const miscfuncs = require("./miscfuncs.js");
const chat = require("./chatcommands.js");
const Save = require("./save.js");
const fs = require("fs");
const request = require("request");

var AllowSubmissions = true;
var Task = 1;
var Guild = "" // 397082495423741953
var SubmittedRole = "" //597167186070732801
var Host_IDs = [] //397096658476728331
var SubmissionsChannel = "" //397096356985962508
var Channel_ID = ""
var Message_ID = ""
var Num_Submissions = 0
var Submissions = [] // {number, name, id, m64, m64_size, st, st_size, locked}
// filesize is stored but never used. If the bot were to store the files locally it would be important

function SubmissionsToMessage(){
	var message = "**__Current Submissions:__**\n\n";
	if (Submissions.length == 0) message += "No Submissions (Yet)"
	Submissions.forEach((player) => {
		message += player.number + ". " + player.name + "\n";
	});
	return message
}

// check if a message isn't allowed to have access to commands
function notAllowed(msg){
	return !miscfuncs.hasCmdAccess(msg) && !Host_IDs.includes(msg.author.id)
}

// send updates to everyone in the list
function notifyHosts(bot, message){
	var dm = async function(id) {
		try {
			var dm = await bot.getDMChannel(id)
			dm.createMessage("[Update]: " + message)
		} catch (e) {
			console.log("Failed to DM Host", id, message)
		}
	}
	Host_IDs.forEach(dm)
}

module.exports = {

	CommandInfo:function(){
		var msg = "**CompBot** - Competition Module\n"

		msg += "\n**Competition Commands:**\n"
		msg += "\t**startsubmissions** - Starts accepting submissions\n"
		msg += "\t**stopsubmissions** - Stops accepting submissions\n"
		msg += "\t**clearsubmissions** - Deletes all submission files (WARNING: NO CONFIRMATION)\n"
		msg += "\t**addsubmission** - Adds a submission\n"
		msg += "\t**deletesubmission** - Deletes a submission\n"
		msg += "\t**submitfile** - Change a user's files\n"
		msg += "\n"

		msg += "\t**settask** - Sets the Task Number\n"
		msg += "\t**setserver** - Sets the competition server\n"
		msg += "\t**setsubmittedrole** - Sets the submitted role\n"
		msg += "\t**setsubmissionfeed** - Sets the default channel to send the submissions list to\n"
		msg += "\t**setsubmissionmessage** - Sets the message that shows the submissions list\n"
		msg += "\t**addhost** - Sets a user to receive submission updates\n"
		msg += "\t**removehost** - Stops a user from receiving submission updates\n"
		msg += "\n"

		msg += "\t**setname** - Change your name as seen in #current_submissions\n"
		msg += "\t**lockname** - Disable a user from changing their submission name\n"
		msg += "\t**unlockname** - Allow users to change their submission name\n"
		msg += "\n"

		msg += "\t**compinfo** - Shows module related information\n"
		msg += "\t**getsubmission** - Get submitted files (get)\n"
		msg += "\t**listsubmissions** - Shows the list of current submissions\n"
		msg += "\t**status** - Check your submitted files\n"

		msg += "\nType $help <command> for more info on a command."
		return msg
	},

	getAllowSubmissions:function(){
		return AllowSubmissions;
	},
	getTaskNum:function(){
		return Task;
	},

	// COMMAND that changes the current task number
	setTask:function(bot, msg, args){
		if (notAllowed(msg)) return
		if (args.length == 0) return "Not Enough Arguments: <Task#>"
		if (isNaN(parseInt(args[0]))) return "Task must be an integer"
		Task = parseInt(args[0])
		module.exports.save()
		return "Task number set to " + Task
	},

	// COMMAND that starts accepting submissions
	allowSubmissions:function(bot, msg, args){
		if (notAllowed(msg)) return
		AllowSubmissions = true
		module.exports.save()
		notifyHosts(bot, "Now accepting submissions for Task " + Task)
		return "Now accepting submissions for Task " + Task
	},

	// COMMAND that stops accepting submissions
	stopSubmissions:function(bot, msg, args){
		if (notAllowed(msg)) return
		AllowSubmissions = false
		module.exports.save()
		notifyHosts(bot, "No longer accepting submissions for Task " + Task)
		return "No longer accepting submissions for Task " + Task
	},

	// COMMAND
	clearSubmissions:async function(bot, msg, args){
		if (notAllowed(msg)) return

		var result = "SUBMISSIONS CLEARED by " + msg.author.username + ". "
		result += await module.exports.clearRoles(bot)
		result += await module.exports.deleteSubmissionMessage(bot)

		Submissions = []
		Num_Submissions = 0
		module.exports.save()

		notifyHosts(bot, result)
		return result

	},

	// COMMAND sets the role to be given out when people submit
	setRole:async function(bot, msg, args){
		if (notAllowed(msg)) return
		if (args.length == 0) args = [""]

		var role = args[0];
		var reason = "Testing role permissions, command call by " + msg.author.username;

		var result = ""

		try {
			var self = await bot.getSelf()
			await bot.addGuildMemberRole(Guild, self.id, role, reason);
			await bot.removeGuildMemberRole(Guild, self.id, role, reason);
			result += "Role set to `" + role + "`"

		} catch (e) {
			role = ""
			result += "Invalid Role: Role does not exist or does not match the server. "
			result += "Use `$setServer <id>` to set the server that contains the role. "
			result += "**No role will be given out**"
		}

		SubmittedRole = role;
		module.exports.save();
		return result
	},

	// COMMAND that sets the server that has the roles to give out
	setServer:async function(bot, msg, args){
		if (notAllowed(msg)) return

		if (args.length == 0) args = [msg.channel.guild.id];
		var guild_id = args[0];

		// getGuildBans can return "Missing Permissions" whether the bot is in the server or not
		// the REST API would need to be implemented to check for valid guilds
		try {
			//var test = await bot.getGuildBans(guild_id);
		} catch (e) {
			return "Invalid Server ID ```"+e+"```"
		}

		Guild = guild_id;
		module.exports.save();
		return "Set Guild to ``" + guild_id + "``"

	},

	// creates a submission object
	addSubmission:function(user_id, name, m64_url, m64_filesize, st_url, st_filesize){
		Num_Submissions++;

		var submission = {
			number: Num_Submissions,
			name: name,
			id: user_id,
			m64: m64_url,
			m64_size: m64_filesize,
			st: st_url,
			st_size: st_filesize,
			locked: false
		}

		Submissions.push(submission);
		module.exports.save();
		console.log("Added submission: ", name, Num_Submissions);
	},

	// short hand for initializing a submission
	addSubmissionName:function(user_id, name){
		module.exports.addSubmission(user_id, name, "", 0, "", 0)
	},

	// changes the m64 of a submission
	update_m64:function(user_id, new_m64, filesize){
		var index = module.exports.getSubmission(user_id).number - 1;
		Submissions[index].m64 = new_m64;
		Submissions[index].m64_size = filesize;
		module.exports.save();
	},

	// changes the st of a submission
	update_st:function(user_id, new_st, filesize){
		var index = module.exports.getSubmission(user_id).number - 1;
		Submissions[index].st = new_st;
		Submissions[index].st_size = filesize;
		module.exports.save();
	},

	// changes the name of a submission
	update_name:function(user_id, new_name){
		var index = module.exports.getSubmission(user_id).number - 1;
		Submissions[index].name = new_name;
		module.exports.save();
	},

	// returns whether an m64 and/or st have been submitted by a user
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
			return "Submission Status: `2/2` Submission complete.\nm64: "+submission.m64+"\nst: "+submission.st
		} else if (m64 && !st){
			return "Submission Status: `1/2` No st received.\nm64: "+submission.m64
		} else if (!m64 && st){
			return "Submission Status: `1/2` No m64 received.\nst: "+submission.st
		} else { // (!m64 && !st)
			return "Submission Status: `0/2` No m64 or st received."
		}
	},

	// checks whether a user id is linked to a submission or not
	hasSubmitted:function(user_id){
		let check = function(submission) {return submission.id == user_id}
		return Submissions.filter((i) => check(i)).length > 0;
	},

	// returns the submission object given an id
	getSubmission:function(user_id){
		if (!module.exports.hasSubmitted(user_id)) return null // ensure the submission exists
		let check = function(submission) {return submission.id == user_id}
		return Submissions.filter((i) => check(i))[0];
	},

	// creates submissions.json to store relevant information
	save:function(){
		var data = {
			acceptingSubmissions: AllowSubmissions,
			task: Task,
			guild_id: Guild,
			role_id: SubmittedRole,
			hosts: Host_IDs,
			feed: SubmissionsChannel,
			channel_id: Channel_ID,
			message_id: Message_ID,
			num: Num_Submissions,
			submissions: Submissions
		}
		Save.saveObject("submissions.json", data)
	},

	// reads relevant information from submissions.json and stores it in memory
	load:function(){
		var data = Save.readObject("submissions.json")
		AllowSubmissions = data.acceptingSubmissions
		Task = data.task
		Guild = data.guild_id
		SubmittedRole = data.role_id
		Host_IDs = data.hosts
		SubmissionsChannel = data.feed
		Channel_ID = data.channel_id
		Message_ID = data.message_id
		Num_Submissions = data.num
		while (data.submissions.length > 0) Submissions.push(data.submissions.shift())
	},

	// return whether an attachment is an m64 or not
	isM64:function(attachment){
		return attachment.filename.substr(-4).toLowerCase() == ".m64"
	},

	// return whether an attachment is a savestate or not
	isSt:function(attachment){
		return attachment.filename.substr(-3).toLowerCase() == ".st"
	},

	// returns a string with no special characters
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

	// returns a a string that conforms to the competition standards
	properFileName:function(username){
		return "SpeedTASCompetitionTask"+Task+"By" + module.exports.fileSafeName(username);
	},

	// removes the roles from everyone that submitted
	clearRoles:async function(bot){
		var clear = async function(user){
			try {
				await bot.removeGuildMemberRole(Guild, user.id, SubmittedRole, "Clearing Submissions");
			} catch (e) {
				console.log("Could not remove role from ", user.name, user.id);
			}
		}
		Submissions.forEach(clear);
		return "Cleared roles. "
	},

	/* Downloads m64 and st files
	Uploads them back to the person who sent it, this time with the proper file name
	Deletes the local files, and stores the discord urls

	attachment = {filename, url, size} */
	filterFiles:async function(bot, msg, attachment){

		// if they have not submitted, add a new submission
		if (!module.exports.hasSubmitted(msg.author.id)){
			module.exports.addSubmissionName(msg.author.id, msg.author.username)
			notifyHosts(bot, "**New Submission:** " + msg.author.username + " (" + Num_Submissions + ")")
		}

		var name = module.exports.getSubmission(msg.author.id).name
		var filename = module.exports.properFileName(name)

		// make sure the file is an m64 or st
		if (module.exports.isM64(attachment)) {
			filename += ".m64"
		} else if (module.exports.isSt(attachment)) {
			filename += ".st"
		} else {
			bot.createMessage(msg.channel.id, "Attachment ``"+attachment.filename+"`` is not an ``m64`` or ``st``")
			return
		}

		//bot.createMessage(msg.channel.id, "Processing "+filename+"...") // notify the user that the files are processing

		// begin downloading the file
		Save.downloadFromUrl(attachment.url, "./saves/" + filename)

		module.exports.uploadFile(bot, filename, attachment.size, msg)
		module.exports.giveRole(bot, msg.author.id, msg.author.username)
		module.exports.updateSubmissionMessage(bot)

	},

	// Sends file back to message, stores the attachment url in the submission
	storeFile:async function(bot, file, msg){

		try {
			var filetype = "ST"
			if (module.exports.isM64({filename:file.name})) filetype = "M64"

			var message = await bot.createMessage(msg.channel.id, filetype + " submitted. Use `$status` to check your submitted files", file)
			var attachment = message.attachments[0]

			// save the url and filesize in the submission
			if (module.exports.isM64(attachment)){
				module.exports.update_m64(msg.author.id, attachment.url, attachment.size)

			} else if (module.exports.isSt(attachment)){
				module.exports.update_st(msg.author.id, attachment.url, attachment.size)

			} else { // this should never happen since it must be an m64 or st at this point
				throw "Attempted to upload incorrect file: " + file.name
			}

			// notify host of updated file
			module.exports.forwardSubmission(bot, msg.author.id, file.name, attachment.url)

		} catch (e) {
			notifyHosts(bot, "Failed to store submission url from " + msg.author.username)
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

	// COMMAND to change the name in the submissions
	setName:async function(bot, msg, args){

		var user_id = msg.author.id

		// get submission
		if (!module.exports.hasSubmitted(user_id)){
			return "You must submit files before changing your name"
		}

		if (module.exports.getSubmission(user_id).locked){
			return "Missing Permissions"
		}

		// change their name
		var name = args.join(" ")
		module.exports.update_name(user_id, name)
		module.exports.updateSubmissionMessage(bot)
		return "Set name to " + name

	},

	// COMMAND to check the status of one's submission
	checkStatus:async function(bot, msg, args){
		try {
			var dm = await bot.getDMChannel(msg.author.id)
			dm.createMessage(module.exports.getSubmisssionStatus(msg.author.id))
		} catch (e) {
			return "Something went wrong: Could not DM you submission status"
		}
	},

	// COMMAND to get all the relevant information about a submission
	// Specifying 'all' will return a script that can download every file
	checkSubmission:function(bot, msg, args){

		if (notAllowed(msg)) return

		if (args[0].toLowerCase() == "all"){
			if (!miscfuncs.isDM(msg)) return "This command can only be called in DMs"
			bot.createMessage(msg.channel.id, "Creating script...")
			module.exports.getAllSubmissions(bot, msg.channel.id)
			return
		}

		var num = parseInt(args[0])
		if (isNaN(num) || num < 1 || num > Num_Submissions){
			return "Submission number must be between 1 and " + Num_Submissions + " inclusive"
		}

		var submission = Submissions[num - 1]

		return num+". "+submission.name+"\nID: "+submission.id+"\n"+"m64: "+submission.m64+"\nst: "+submission.st

	},

	// gets the text for a batch script that will download every submission file
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

	// send the download script to a specified channel
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

	// edits the stored message with the current submissions list
	updateSubmissionMessage:async function(bot){

		// create one if none exists
		if ((Channel_ID == "" || Message_ID == "") && SubmissionsChannel != ""){
			try {
				var message = await bot.createMessage(SubmissionsChannel, SubmissionsToMessage())
				Channel_ID = message.channel.id
				Message_ID = message.id
			} catch (e) {
				console.log("Failed to send submission message")
				notifyHosts(bot, "Failed to send submission update to <#" + SubmissionsChannel + ">")
				return
			}
		}

		if (Channel_ID != "" && Message_ID != ""){
			try {
				var message = await bot.getMessage(Channel_ID, Message_ID);
				message.edit(SubmissionsToMessage());
			} catch (e) {
				console.log("Failed to edit submission message")
				notifyHosts(bot, "Failed to edit submission message")
			}
		}
	},

	// gives the submitted role to a user
	giveRole:async function(bot, user_id, name){
		if (SubmittedRole == "") return
		try {
			await bot.addGuildMemberRole(Guild, user_id, SubmittedRole, "Submission received");
		} catch (e) {
			console.log("Could not assign role", name, e)
			notifyHosts(bot, "Failed to assign " + name + " the submitted role")
		}
	},

	// COMMAND that sets the message to be automatically updated
	setMessage:async function(bot, msg, args){
		if (notAllowed(msg)) return
		if (args.length < 2) return "Not enough arguments: `<channel_ID> <message_ID>`"

		var channel_id = chat.chooseChannel(args[0])
		var message_id = args[1]

		try {
			var self = await bot.getSelf()
			var message = await bot.getMessage(channel_id, message_id)

			if (message.author.id != self.id) return "Invalid user. Message must be sent by me"

			message.edit(SubmissionsToMessage())
			Channel_ID = channel_id
			Message_ID = message_id
			module.exports.save()
			return "Message Set <#" + Channel_ID + "> " + Message_ID

		} catch (e) {
			return "Invalid channel or message id. Could not find message ```"+e+"```"
		}

	},


	// this is meant to parse every message and sort submissions
	filterSubmissions:function(bot, msg){

		if (AllowSubmissions && miscfuncs.isDM(msg)){
			msg.attachments.forEach(attachment => {
				module.exports.filterFiles(bot, msg, attachment)
			})
		}

	},

	// Deletes the submissions message. Returns status
	deleteSubmissionMessage:async function(bot){
		try {
			var message = await bot.getMessage(Channel_ID, Message_ID);
			message.delete();
			Channel_ID = "";
			Message_ID = "";
			module.exports.save();
			return "Deleted Message. "
		} catch (e) {
			return "Failed to find message to delete. "
		}
	},

	// COMMAND that returns some of the internal variables
	info:async function(bot, msg, args){
		if (notAllowed(msg)) return

		var result = "Not accepting submissions\n"
		if (AllowSubmissions) result = "Accepting submissions for **Task " + Task + "**\n"

		result += "**Server ID** - " + Guild + "\n"

		result += "**Submitted Role ID** - "
		if (SubmittedRole == "") {
			result += "`disabled`\n"
		} else {
			result += SubmittedRole + "\n"
		}

		if (Host_IDs.length == 0) {
			result += "No users are set to receive submission updates" + "\n"

		} else if (Host_IDs.length == 0){
			result += "**Update Recipient** "

		} else { // Host_IDs.length > 1
			result += "**Update Recipients**\n"
		}
		for (var i = 0; i < Host_IDs.length; i++){
			try {
				var dm = await bot.getDMChannel(Host_IDs[i])
				result += "- " + dm.recipient.username + " (ID: `" + Host_IDs[i] + "`)\n"
			} catch (e) {
				console.log("Removed invalid Host ID", Host_IDs.pop(i))
				module.exports.save()
			}
		}

		result += "**Default Submissions Channel** - "
		if (SubmissionsChannel == "") {
			result += "`disabled`\n"
		} else {
			result += "<#" + SubmissionsChannel + ">\n"
		}

		try {
			var message = await bot.getMessage(Channel_ID, Message_ID)
			result += "**Submissions Message URL** - https://discordapp.com/channels/"
			result += message.channel.guild.id + "/" + message.channel.id + "/" + message.id
		} catch (e) {
			result += "Invalid Current Submissions Message: Could not retrieve URL"
			Channel_ID = ""
			Message_ID = ""
		}

		return result
	},

	// COMMAND to add an ID to the list that receives submission updates
	addHost:async function(bot, msg, args){
		if (notAllowed(msg)) return
		if (args.length == 0) return "Not enough arguments: `<user_id>`"

		var user_id = args[0]
		if (Host_IDs.includes(user_id)) return "ID already registered as a host"

		try {
			var dm = await bot.getDMChannel(user_id)
			var warning = "You have been set as the recipient of submission updates for the SM64 TAS Competition. "
			warning += "If you believe this to be an error please contact `ERGC | Xander`"
			await dm.createMessage(warning)
			Host_IDs.push(dm.recipient.id)
			module.exports.save()
			return dm.recipient.username + " is now set to recieve submission updates"
		} catch (e) {
			return "Invalid User ID: Unable to send Direct Message"
		}
	},

	// COMMAND to remove an ID from the list that receives submission updates
	removeHost:async function(bot, msg, args){
		if (notAllowed(msg)) return
		if (args.length == 0) return "Not enough arguments: `<user_id>`"
		var user_id = args[0]

		for (var i = 0; i < Host_IDs.length; i++) {
			if (Host_IDs[i] == user_id){

				var id = Host_IDs.splice(i,1)[0]
				module.exports.save()

				try {
					var dm = await bot.getDMChannel(id)
					var warning = "You are no longer set as the recipient of submission updates for the SM64 TAS Competition. "
					warning += "If you believe this to be an error please contact `ERGC | Xander`"
					await dm.createMessage(warning)
					return dm.recipient.username + " (ID `" + id + "`) will no longer recieve submission updates"
				} catch (e) {
					return "ID: `" + id + "` will no longer recieve submission updates. Failed to send DM"
				}
			}
		}

		return "ID `" + user_id + "` Not found in list. Use `$compinfo` to check the list"

	},

	// Sends a file update to the host(s)
	forwardSubmission:async function(bot, user_id, filename, url){

		if (!module.exports.hasSubmitted(user_id)) return console.log("SOMETHING WENT WRONG: COULD NOT FORWARD SUBMISSION")

		var submission = module.exports.getSubmission(user_id)
		var result = submission.name + " (" + submission.number + ") "

		if (module.exports.isM64({filename: filename})){
			result += "uploaded m64 " + url
		} else {
			result += "uploaded st " + url
		}

		notifyHosts(bot, result)

	},

	// COMMAND returns the current list of submissions
	listSubmissions:function(bot, msg, args){
		if (notAllowed(msg)) return // && !miscfuncs.isDM(msg)) return // allow anyone to check in DMs
		return "```" + SubmissionsToMessage() + "```"
	},

	// COMMAND that sets the default channel to send the submission message to
	setFeed:async function(bot, msg, args){
		if (notAllowed(msg)) return

		if (args.length == 0) args = [""]
		var channel = chat.chooseChannel(args[0])

		var result = "Default submissions channel changed from <#"+SubmissionsChannel+"> to <#"+channel+">"
		if (SubmissionsChannel == "") result = "Default submissions channel changed from `disabled` to <#"+channel+">"
		if (channel == "") result = "Default submissions channel changed from <#"+SubmissionsChannel+"> to `disabled`"

		SubmissionsChannel = channel
		module.exports.save()

		return result
	},

	// COMMAND that disables users from changing their name
	lockName:function(bot, msg, args){
		if (notAllowed(msg)) return
		if (Num_Submissions == 0) return "There are no submissions to edit"
		if (args.length == 0) return "Not Enough Arguments: `<Submission Number> [Name]`"

		var num = parseInt(args.shift())
		if (isNaN(num) || num < 1 || num > Num_Submissions){
			return "Submission number must be between 1 and " + Num_Submissions + " inclusive"
		}

		if (args.length != 0) Submissions[num-1].name = args.join(" ")

		Submissions[num-1].locked = true
		module.exports.save()

		module.exports.updateSubmissionMessage(bot)

		return "`$setname` privleges disabled for " + Submissions[num-1].name

	},

	// COMMAND that reallows users to change their own name
	unlockName:function(bot, msg, args){
		if (notAllowed(msg)) return
		if (Num_Submissions == 0) return "There are no submissions to edit"
		if (args.length == 0) return "Not Enough Arguments: `<Submission Number>`"

		var num = parseInt(args[0])
		if (isNaN(num) || num < 1 || num > Num_Submissions){
			return "Submission number must be between 1 and " + Num_Submissions + " inclusive"
		}

		Submissions[num-1].locked = false
		module.exports.save()

		return "`$setname` privleges enabled for " + Submissions[num-1].name

	},

	// COMMAND that removes a specific submission
	removeSubmission:async function(bot, msg, args){
		if (notAllowed(msg)) return
		if (Num_Submissions == 0) return "There are no submissions to edit"
		if (args.length == 0) return "Not Enough Arguments: `<submission_number>`"

		var num = parseInt(args[0])
		if (isNaN(num) || num < 1 || num > Num_Submissions){
			return "Submission number must be between 1 and " + Num_Submissions + " inclusive"
		}

		var deleted = Submissions.splice(num - 1, 1)[0]
		Num_Submissions--
		for (var i = 0; i < Submissions.length; i++){
			Submissions[i].number = i+1
		}
		module.exports.save()
		module.exports.updateSubmissionMessage(bot)

		var message = msg.author.username + " deleted submission from " + deleted.name + " (ID: `" + deleted.id + "`) "
		message += "m64: " + deleted.m64 + "\nst: " + deleted.st
		notifyHosts(bot, message)

		// notify the user that their submission was deleted
		var result = "Deleted Submission"
		try {
			var dm = await bot.getDMChannel(deleted.id)
			dm.createMessage("Your submission has been removed by Moderators")
			result += " from " + deleted.name + " (ID: `" + deleted.id + "`). "
		} catch (e) {
			result += ". Could not notify user"
		}

		// remove the role
		if (SubmittedRole != ""){
			try {
				await bot.removeGuildMemberRole(Guild, deleted.id, SubmittedRole, "Submission Deleted by " + msg.author.username);
				result += "Removed role"
			} catch (e) {
				result += "Could not remove role"
			}
		}

		return result

	},

	// COMMAND that initializes a submission with a name given a user id
	manuallyAddSubmission:async function(bot, msg, args){
		if (notAllowed(msg)) return
		if (args.length == 0) return "Not Enough Arguments: `<user_id>`"

		var user_id = args[0]

		// check if they've already submitted
		if (module.exports.hasSubmitted(user_id)){
			var user = module.exports.getSubmission(user_id);
			return user.name + " ("+user.number+") has already submitted"
		}

		// get the user
		try {
			var dm = await bot.getDMChannel(user_id)
			var name = dm.recipient.username
			dm.createMessage("A submission in your name has been added by Moderators")
		} catch (e) {
			return "Invalid User ID: ```"+e+"```"
		}

		module.exports.addSubmissionName(user_id, name)
		module.exports.giveRole(bot, user_id, name)
		module.exports.updateSubmissionMessage(bot)

		notifyHosts(bot, "**New Submission:** "+ name + " ("+Num_Submissions+") [Added by " + msg.author.username + "]")
		return "**New Submission:** "+ name + " ("+Num_Submissions+") [Added by " + msg.author.username + "]"

	},

	// COMMAND that changes the m64 or st of a submission via url
	setSubmissionFile:async function(bot, msg, args){
		if (notAllowed(msg)) return
		if (Num_Submissions == 0) return "There are no submissions to edit"
		if (args.length < 2) return "Not Enough Arguments: `<submission_number> <url>`"

		var num = parseInt(args.shift())
		if (isNaN(num) || num < 1 || num > Num_Submissions){
			return "Submission number must be between 1 and " + Num_Submissions + " inclusive"
		}

		var user = Submissions[num - 1]

		async function notifyUserAndHost(filetype){
			var modupdate = user.name + " (" + user.number + ") " + filetype + " changed [by " + msg.author.username + "] " + args[0]
			try {
				var dm = await bot.getDMChannel(user.id)
				dm.createMessage(filetype + " submitted on your behalf by Moderators " + args[0])
			} catch (e) {
				modupdate += " Could not notify user"
			}
			notifyHosts(bot, modupdate)
		}

		// check if it was given a url
		if (module.exports.isM64({filename:args[0]})){
			module.exports.update_m64(user.id, args[0], 0)
			return notifyUserAndHost("M64")

		} else if (module.exports.isM64({filename:args[0]})){
			module.exports.update_m64(user.id, args[0], 0)
			return notifyUserAndHost("ST")

		} else {
			return "Invalid Filetype: Must be `.m64` or `.st`"
		}


		// UPDATE WITH ATTACHMENT: Not Working, probably dont need it to work
		/*
		if (msg.attachments.length == 0) return "No Attachments or URLs Received"

		var updated = false

		msg.attachment.forEach((attachment) => async function(attachment){

			if (module.exports.isM64(attachment) || module.exports.isSt(attachment)){
				updated = true
				try {
					var dm = await bot.getDMChannel(user.id)
					dm.createMessage("A moderator is updating your files")
					msg.channel = dm
					msg.author = dm.recipient
					module.exports.filterFiles(bot, msg, attachment)
				} catch (e) {
					return "Failed to update files via attachment. Try using a URL```"+e+"```"
				}
			}

		})

		if (!updated) return "No Valid Attaachments or URLs Received"
		*/
	}
};
