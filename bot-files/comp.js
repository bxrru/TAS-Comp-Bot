const Users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const chat = require("./chatcommands.js")
const Save = require("./save.js")
const fs = require("fs")
const request = require("request")
const chrono = require("chrono-node")
const Announcement = require("./announcement.js")

var AllowSubmissions = false
var Task = 1
var FilePrefix = "TASCompetition"
var Guild = "" // 397082495423741953
var SubmittedRole = "" //597167186070732801
var Host_IDs = [] //397096658476728331
var SubmissionsChannel = "" //397096356985962508
var Channel_ID = ""
var Message_ID = ""
var DQs = []
var Submissions = [] // {number, name, id, m64, m64_size, st, st_size, namelocked, dq}
// filesize is stored but never used. If the bot were to store the files locally it would be important

var TimedTask = false
var Hours = 1
var Minutes = 30
var TaskMessage = "No Task Available"
var TimedTaskStatus = {started:[],completed:[]} // stores the IDs of people who are participating
// TODO: Implement a confirmation of request feature that makes people
// resend a task request with some number to actually start the task

function SubmissionsToMessage(showInfo){
	var message = "**__Current Submissions:__**\n\n"
	if (Submissions.length == 0) message += "No Submissions (Yet)\n"
	Submissions.forEach((player) => {
		message += `${player.number}. ${player.name}`
		message += showInfo ? ` (${player.id})\n` : `\n`
	})

	if (showInfo) {
		DQs.forEach((player) => {
			message += `DQ${player.number}: ${player.name} (${player.id})\n`
		})
	}
	return message
}

// check if a message isn't allowed to have access to commands
function notAllowed(msg){
	return !(Users.hasCmdAccess(msg) || Host_IDs.includes(msg.author.id))
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
	return message
}

// helper function to get the submission number from a parameter
// if it returns a message the function should be escaped as the arg is not valid
function getSubmissionNumber(arg){
	var dq = arg.substr(0,2).toUpperCase() == "DQ"
	var num = dq ? parseInt(arg.substr(2, arg.length - 2)) : parseInt(arg)
	var msg = ""

	// an invalid number
	if (isNaN(num) || num < 1 || (!dq && num > Submissions.length) || (dq && num > DQs.length)) {
		msg = `Submission number must be an integer between `

		if (!DQs.length){ // no DQs
			msg += `\`1\` and \`${Submissions.length}\` inclusive. `
			msg += `There are no disqualified submissions to retrieve`

		} else if (!Submissions.length) { // only DQs
			msg += `\`DQ1\` and \`DQ${DQs.length}\` inclusive. `
			msg += `There are no non-disqualified submissions to retrieve`

		} else { // there are some of both
			msg += `\`1\` and \`${Submissions.length}\` inclusive, or `
			msg += `\`DQ1\` and \`DQ${DQs.length}\` inclusive. `

		}
	}
	return {number:num, dq:dq, message:msg}
}

module.exports = {
	messageAdmins:notifyHosts,

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

		msg += "\t**settasknum** - Sets the Task Number\n"
		msg += "\t**setfileprefix** - Sets the prefix for submission filenames\n"
		msg += "\t**setserver** - Sets the competition server\n"
		msg += "\t**setsubmittedrole** - Sets the submitted role\n"
		msg += "\t**setsubmissionfeed** - Sets the default channel to send the submissions list to\n"
		msg += "\t**setsubmissionmessage** - Sets the message that shows the submissions list\n"
		msg += "\t**addhost** - Sets a user to receive submission updates\n"
		msg += "\t**removehost** - Stops a user from receiving submission updates\n"
		msg += "\n"

		msg += "\t**lockname** - Disable a user from changing their submission name\n"
		msg += "\t**unlockname** - Allow users to change their submission name\n"
		msg += "\t**disqualify** - DQs a user\n"
		msg += "\t**undodisqualify** - Revokes a DQ\n"
		msg += "\n"

		msg += "\t**getsubmission** - Get submitted files (get)\n"
		msg += "\t**listsubmissions** - Shows the list of current submissions\n"
		msg += "\t**compinfo** - Shows module related information\n"
		msg += "\t**setname** - Change your name as seen in #current_submissions\n"
		msg += "\t**status** - Check your submitted files\n"
		msg += "\n"

		// TimedTask Commands
		msg += "\t**setTaskMsg** - Sets the task message for timed tasks\n"
		msg += "\t**previewTask** - Previews the timed task message\n"
		msg += "\t**setTaskLength** - Sets the time limit for timed tasks\n"
		msg += "\t**checkTimedTaskStatus** - See who has started and completed the timed task\n"
		msg += "\t**requestTask** - Starts a timed task\n"

		msg += "\nAnyone may use `$status` and `$setname`"
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
	setTask:{
		name: "setTaskNum",
		short_descrip: "Sets the Task Number",
		full_descrip: "Usage: `$settasknum <Task_Number>`\nSets the task number that will be used when downloading competition files",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not Enough Arguments: <Task#>"
			if (isNaN(parseInt(args[0]))) return "Task must be an integer"
			Task = parseInt(args[0])
			module.exports.save()
			return "Task number set to " + Task
		}
	},

	setTimeWindow:{
		name: "setTaskLength",
		short_descrip: "Sets the time limit for timed tasks",
		full_descrip: "Sets how long participants will have during timed tasks. Usage: `$setTaskLength <hours> <minutes>`. User's will always be given a 15 minute warning so the time cannot be less than 15 minutes.",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length < 2) return "Missing Arguments: `$setTaskLength <hours> <minutes>`"

			if (isNaN(args[0]) || isNaN(args[1]) || Number(args[0]) < 0 || Number(args[1]) < 0)
				return "Invalid Arguments: Arguments must be positive numbers"

			if (args[0] == 0 && args[1] < 15) return "Invalid Arguments: Time must be 15 minutes minimum"

			Hours = Math.floor(args[0])
			Minutes = Math.floor(args[1])
			module.exports.save()

			return `Task length set to ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes`
		}
	},

	setTaskMsg:{
		name: "setTaskMsg",
		short_descrip: "Sets the task message for timed tasks",
		full_descrip: "Sets the task message that will be sent out to users who request the timed tasks. Everything that appears after the command call will be stored as the message. Attachments are not currently supported. To see the message use `$previewTask`",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.join(' ') == '') {
				TaskMessage = "No Task Available"
				module.exports.save()
				return "No task message found. Task message has been cleared."
			} else {
				TaskMessage = args.join(' ')
				module.exports.save()
				return "Task message has been set. Use `$previewTask` to see what it looks like"
			}
		}
	},

	previewTask:{
		name: "previewTask",
		short_descrip: "Previews the timed task message",
		full_descrip: "Sends you a DM with the task message to see what participants will see (admin only). To set the message use `$setTaskMsg`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			try {
				var dm = await bot.getDMChannel(msg.author.id)
				dm.createMessage(TaskMessage)
			} catch (e) {
				return `Could not DM preview\`\`\`${e}\`\`\``
			}
		}
	},

	checkTimedTaskStatus:{
		name: "checkTimedTaskStatus",
		short_descrip: "See who has started and completed the timed task",
		full_descrip: "See the IDs of people who have started and completed the timed task. This command has been left in after testing so it isn't fancy.",
		hidden:true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			return `\`\`\`${JSON.stringify(TimedTaskStatus)}\`\`\``
		}
	},

	requestTask:{
		name: "requestTask",
		short_descrip: "Starts a timed task",
		full_descrip: "Starts the current timed task. Once a participant calls this command they will be sent the task message (set with `$setTaskMsg`) and allowed to submit files for the allotted time (set with `$setTaskLength`). There is no confirmation, the timer will begin counting down as soon as the command is called.",
		hidden: true,
		function: function(bot, msg, args){
			if (!TimedTask) return `There is no active timed task to participate in right now`
			if (!miscfuncs.isDM(msg)) return `This command can only be used in DMs`

			if (TimedTaskStatus.started.includes(msg.author.id)) return `You've already started Task ${Task}!`
			if (TimedTaskStatus.completed.includes(msg.author.id)) return `You've already completed Task ${Task}! Use \`$status\` to check your files.`

			TimedTaskStatus.started.push(msg.author.id)
			module.exports.save()

			Announcement.AddExternalAnnouncement(bot, msg.author.id, "You have 15 minutes remaining", "_", Hours, Minutes - 15, true)
			Announcement.AddExternalAnnouncement(bot, msg.author.id, `Your Time is up! Thank you for participating in Task ${Task}. To see your final files use \`$status\``, `Comp ${msg.author.id}`, Hours, Minutes, true)

			// send messages
			notifyHosts(bot, `${msg.author.username} (${msg.author.id}) has started Task ${Task}`)
			bot.createMessage(msg.channel.id, TaskMessage)
			bot.createMessage(msg.channel.id, `You have started Task ${Task}. You have ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes to submit.`)
		}
	},

	// the function called when someone's time limit is reached
	// This moves them to "completed" and notifies hosts.
	// The "Time's up!" message that is sent is controlled by the Announcement
	endTimedTask:async function(bot, id, notify){
		if (TimedTaskStatus.started.filter(u => u == id).length == 0) {
			console.log(`Tried to end task for user that has not *started* ${id}`)
			return
		}

		TimedTaskStatus.started = TimedTaskStatus.started.filter(u => u != id)
		TimedTaskStatus.completed.push(id)
		module.exports.save()

		var user = await Users.getUser(bot, id)
		if (notify) notifyHosts(bot, `Time's up for ${user.username} (${id})!`)
	},

	// COMMAND that starts accepting submissions
	allowSubmissions:{
		name: "startTask",
		short_descrip: "Starts accepting submissions",
		full_descrip: "Starts accepting submissions via DMs. To start a timed task where participants have a limited amount of time to submit use `$startTask timed`",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			var message = `Now accepting submissions for Task ${Task}. `

			if (args.length > 0 && args[0].toUpperCase() == "TIMED") {
				message += `This is a timed task. Participants will have `
				message += `**${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes** to submit.`
				TimedTask = true
			}

			if (Submissions.length || DQs.length)
				message += "\nWARNING: Preexisting submissions detected. Use `$clearsubmissions` to remove previous data"

			notifyHosts(bot, message)

			AllowSubmissions = true
			module.exports.save()

			return `Now accepting submissions for ${TimedTask ? "Timed " : ""}Task ${Task}`
		}
	},

	// COMMAND that stops accepting submissions
	stopSubmissions:{
		name: "stopTask",
		short_descrip: "Stops accepting submissions",
		full_descrip: "Stops accepting submissions via DMs",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			TimedTask = false
			AllowSubmissions = false
			module.exports.save()

			TimedTaskStatus.started.forEach(id => {
				module.exports.endTimedTask(bot, id, false)
			})

			notifyHosts(bot, "No longer accepting submissions for Task " + Task)
			return "No longer accepting submissions for Task " + Task
		}
	},

	// COMMAND
	clearSubmissions:{
		name: "clearSubmissions",
		short_descrip: "Deletes all submission files (WARNING: NO CONFIRMATION)",
		full_descrip: "Removes the Submitted role from every user that has submitted. Deletes the message containing all the submissions and deletes all of the saved files **without a confirmation/warning upon using the command**",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			var result = "SUBMISSIONS CLEARED by " + msg.author.username + ". "
			result += await module.exports.clearRoles(bot)
			result += await module.exports.deleteSubmissionMessage(bot)

			Submissions = []
			DQs = []
			TimedTaskStatus.started = []
			TimedTaskStatus.completed = []
			module.exports.save()

			notifyHosts(bot, result)
			return result
		}
	},

	// COMMAND sets the role to be given out when people submit
	setRole:{
		name: "setSubmittedRole",
		short_descrip: "Sets the submitted role",
		full_descrip: "Usage: `$setrole [role_id]`\nIf no ID is specified or the bot does not have permission to assign the role, it will disable giving roles to users that submit. Set the competition server using `$setServer` before using this command.",
		hidden: true,
		function: async function(bot, msg, args){
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
		}
	},

	// COMMAND that sets the server that has the roles to give out
	setServer:{
		name: "setServer",
		short_descrip: "Sets the competition server",
		full_descrip: "Usage: `$setserver [guild_id]`\nIf no ID is specified it will use the ID of the channel the command was called from. This assumes that it is given a valid server ID.",
		hidden: true,
		function: async function(bot, msg, args){
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
		}
	},

	// creates a submission object
	addSubmission:function(user_id, name, m64_url, m64_filesize, st_url, st_filesize){

		var submission = {
			number: Submissions.length + 1,
			name: name,
			id: user_id,
			m64: m64_url,
			m64_size: m64_filesize,
			st: st_url,
			st_size: st_filesize,
			namelocked: false
		}

		Submissions.push(submission);
		module.exports.save();
		console.log("Added submission: ", name, submission.number);
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
		return Submissions.filter(user => user.id == user_id).length || DQs.filter(user => user.id == user_id).length
	},

	// returns the submission object given an id
	getSubmission:function(user_id){
		if (!module.exports.hasSubmitted(user_id)) return null // ensure the submission exists
		var check = Submissions.filter(user => user.id == user_id)
		return check.length ? check[0] : DQs.filter(user => user.id == user_id)[0]
	},

	// creates submissions.json to store relevant information
	save:function(){
		var data = {
			acceptingSubmissions: AllowSubmissions,
			task: Task,
			fileprefix: FilePrefix,
			guild_id: Guild,
			role_id: SubmittedRole,
			hosts: Host_IDs,
			feed: SubmissionsChannel,
			channel_id: Channel_ID,
			message_id: Message_ID,
			submissions: Submissions,
			dqs: DQs,
			timedtask: TimedTask,
			hr: Hours,
			min: Minutes,
			taskmsg: TaskMessage,
			timedtaskstatus: TimedTaskStatus
		}
		Save.saveObject("submissions.json", data)
	},

	// reads relevant information from submissions.json and stores it in memory
	load:function(){
		var data = Save.readObject("submissions.json")
		AllowSubmissions = data.acceptingSubmissions
		Task = data.task
		FilePrefix = data.fileprefix
		Guild = data.guild_id
		SubmittedRole = data.role_id
		Host_IDs = data.hosts
		SubmissionsChannel = data.feed
		Channel_ID = data.channel_id
		Message_ID = data.message_id
		TimedTask = data.timedtask
		Hours = data.hr
		Minutes = data.min
		TaskMessage = data.taskmsg
		while (data.timedtaskstatus.started.length > 0) TimedTaskStatus.started.push(data.timedtaskstatus.started.shift())
		while (data.timedtaskstatus.completed.length > 0) TimedTaskStatus.completed.push(data.timedtaskstatus.completed.shift())
		while (data.submissions.length > 0) Submissions.push(data.submissions.shift())
		while (data.dqs.length > 0) DQs.push(data.dqs.shift())
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
		return FilePrefix + "Task" + Task + "By" + module.exports.fileSafeName(username)
	},

	// COMMAND that changes the prefix for files. IE the 'TASCompetition' from 'TASCompetitionTask#ByName'
	setFilePrefixCMD:{
		name: "setFilePrefix",
		short_descrip: "Sets the prefix for submission filenames",
		full_descrip: "Usage: `$setfileprefix <filePrefix>`\n`<filePrefix>` cannot contain spaces and will be used as: `<filePrefix>Task#by<name>.st/m64`. This changes the filenames of all submissions when downloaded using `$get all`.",
		hidden: true,
		function: function(bot,msg,args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not Enough Arguments: `$setfileprefix <fileprefix>`"
			FilePrefix = args[0]
			module.exports.save()
			return `Files will now be named \`${FilePrefix}Task${Task}By<Name>.st/m64\``
		}
	},

	// removes the roles from everyone that submitted
	clearRoles:async function(bot){
		if (SubmittedRole == '') return "Roles Disabled (no roles removed). "
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

		// make sure the file is an m64 or st
		if (module.exports.isM64(attachment)) {
			var filename = ".m64"
		} else if (module.exports.isSt(attachment)) {
			var filename = ".st"
		} else {
			bot.createMessage(msg.channel.id, "Attachment ``"+attachment.filename+"`` is not an ``m64`` or ``st``")
			return
		}

		// if they have not submitted, add a new submission
		if (!module.exports.hasSubmitted(msg.author.id)){
			module.exports.addSubmissionName(msg.author.id, msg.author.username)
			notifyHosts(bot, `**New Submission:** ${msg.author.username} (${Submissions.length})`)
		}

		var name = module.exports.getSubmission(msg.author.id).name
		filename = module.exports.properFileName(name) + filename

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
	setName:{
		name: "setname",
		short_descrip: "Change your name as seen in #current_submissions",
		full_descrip: "Usage: `$setname <new name here>`\nSpaces and special characters are allowed. Moderators are able to remove access if this command is abused",
		hidden: false,
		function: async function(bot, msg, args){

			var user_id = msg.author.id

			// get submission
			if (!module.exports.hasSubmitted(user_id)){
				return "You must submit files before changing your name"
			}

			if (module.exports.getSubmission(user_id).namelocked || DQs.filter(user => user.id == user_id).length){
				return "Missing Permissions"
			}

			// change their name
			var name = args.join(" ")
			module.exports.update_name(user_id, name)
			module.exports.updateSubmissionMessage(bot)
			return "Set name to " + name
		}
	},

	// COMMAND to check the status of one's submission
	checkStatus:{
		name: "status",
		short_descrip: "Check your submitted files",
		full_descrip: "Tells you what you need to submit and sends you the links to your submitted files",
		hidden: false,
		function: async function(bot, msg, args){
			try {
				var dm = await bot.getDMChannel(msg.author.id)
				dm.createMessage(module.exports.getSubmisssionStatus(msg.author.id))
			} catch (e) {
				return "Something went wrong: Could not DM your submission status"
			}
		}
	},

	// COMMAND ($get) to get all the relevant information about a submission
	// Specifying 'all' will return a script that can download every file
	checkSubmission:{
		name: "getsubmission",
		short_descrip: "Get submitted files (get)",
		full_descrip: "Usage: `$get <Submission_Number or 'all'>`\nReturns the name, id, and links to the files of the submission. If you use `$get all` the bot will upload a script that can automatically download every file. To see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){

			if (notAllowed(msg)) return

			try {
				if (!Submissions.length && !DQs.length) return "No submissions found"
				if (args.length == 0) return "Not Enough Arguments: `$get <Submission_Number>`"

				var dm = await bot.getDMChannel(msg.author.id)
				if (args[0].toLowerCase() == "all"){
					bot.createMessage(dm.id, "Creating script...")
					module.exports.getAllSubmissions(bot, msg.channel.id)
					return
				}

				var num = getSubmissionNumber(args[0])
				if (num.message.length) return num.message

				var submission = num.dq ? DQs[num.number-1] : Submissions[num.number - 1]
				dm.createMessage((num.dq?`DQ`:``) + `${submission.number}. ${submission.name}\nID: ${submission.id}\nm64: ${submission.m64}\nst: ${submission.st}`)
				return 'Submission info sent via DMs'

			} catch (e) {
				return "Failed to send DM```"+e+"```"
			}
		}
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
	setMessage:{
		name: "setSubmissionMessage",
		short_descrip: "Sets the message that shows the submissions list",
		full_descrip: "Usage: `$setsm <channel_id> <message_id>`\nThis message is stored and will be updated until the bot is set to not accept submissions. For a list of channel names that can be used instead of `<channel_id>` use `$ls`",
		hidden: true,
		function: async function(bot, msg, args){
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
		}
	},


	// this is meant to parse every message and sort submissions
	filterSubmissions:function(bot, msg){

		if (!miscfuncs.isDM(msg)) return
		if (!AllowSubmissions) return
		if (Users.isBanned(msg.author.id)) return
		if (DQs.filter(user => user.id == msg.author.id).length) return
		if (TimedTask && !TimedTaskStatus.started.includes(msg.author.id)) return
		if (TimedTask && TimedTaskStatus.completed.includes(msg.author.id)) {
			bot.createMessage(msg.channel.id, "Your time is up, you can no longer submit files. Thank you for participating.")
		}

		msg.attachments.forEach(attachment => {
			module.exports.filterFiles(bot, msg, attachment)
		})

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
	info:{
		name: "compinfo",
		short_descrip: "Shows module related information",
		full_descrip: "Shows current internal variables for the competition module",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			var result = AllowSubmissions ? "Accepting submissions\n" : "Not accepting submissions\n"
			result += `**Task** - ${Task}\n`

			result += `**Filenames** - ${FilePrefix}Task${Task}By<Name>.st/m64\n`

			result += `**Server ID** - ${Guild}\n`

			result += "**Submitted Role ID** - "
			if (SubmittedRole == "") {
				result += "`disabled`\n"
			} else {
				result += SubmittedRole + "\n"
			}

			if (Host_IDs.length == 0) {
				result += "No users are set to receive submission updates" + "\n"

			} else if (Host_IDs.length == 1){
				result += "**Update Recipient** "

			} else { // Host_IDs.length > 1
				result += "**Update Recipients**\n"
			}
			for (var i = 0; i < Host_IDs.length; i++){
				try {
					var dm = await bot.getDMChannel(Host_IDs[i])
					result += "- " + dm.recipient.username + " (ID: `" + Host_IDs[i] + "`)\n"
				} catch (e) {
					console.log("Removed invalid Host ID", Host_IDs.splice(i, 1))
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
				result += `${message.channel.guild.id}/${message.channel.id}/${message.id}\n`
			} catch (e) {
				result += "**Invalid Current Submissions Message** - Could not retrieve URL\n"
				Channel_ID = ""
				Message_ID = ""
			}

			result += `**Timed Task Length** - ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes\n`

			return result
		}
	},

	// COMMAND to add an ID to the list that receives submission updates
	addHost:{
		name: "addHost",
		short_descrip: "Sets a user to receive submission updates",
		full_descrip: "Usage: `$addhost <user_id>`\nThe selected user will receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To remove a user use `$removehost`",
		hidden: true,
		function: async function(bot, msg, args){
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
		}
	},

	// COMMAND to remove an ID from the list that receives submission updates
	removeHost:{
		name: "removeHost",
		short_descrip: "Stops a user from receiving submission updates",
		full_descrip: "Usage: `removehost <user_id>`\nThe selected user will NO LONGER receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To add a user use `$addhost`",
		hidden: true,
		function: async function(bot, msg, args){
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
		}
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
	listSubmissions:{
		name: "listSubmissions",
		short_descrip: "Shows the list of current submissions",
		full_descrip: "Shows the list of users that have submitted. This will include DQ'd submissions as well as user IDs",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			return "```" + SubmissionsToMessage(true) + "```"
		}
	},

	// COMMAND that sets the default channel to send the submission message to
	setFeed:{
		name: "setSubmissionFeed",
		short_descrip: "Sets the default channel to send the submissions list to",
		full_descrip: "Usage: `$setfeed <channel>`\nThis does not ensure that the channel is a valid text channel that the bot can send messages to",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length == 0) args = [""]
			var channel = chat.chooseChannel(args[0])

			var result = "Default submissions channel changed from <#"+SubmissionsChannel+"> to <#"+channel+">"
			if (SubmissionsChannel == "") result = "Default submissions channel changed from `disabled` to <#"+channel+">"
			if (channel == "") result = "Default submissions channel changed from <#"+SubmissionsChannel+"> to `disabled`"

			SubmissionsChannel = channel
			module.exports.save()

			return result
		}
	},

	// COMMAND that disables users from changing their name
	lockName:{
		name: "lockName",
		short_descrip: "Disable a user from changing their submission name",
		full_descrip: "Usage: `$lockname <Submission_Number> [Name]`\nPrevents the user from changing their name and sets it to `[Name]`. If no name is specified it will remain the same. To see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			if (Submissions.length == 0) return "There are no submissions to edit"
			if (args.length == 0) return "Not Enough Arguments: `<Submission Number> [Name]`"

			var num = getSubmissionNumber(args.shift())
			if (num.message.length) return num.message

			if (num.dq) {
				DQs[num.number-1].namelocked = true
				if (args.length != 0) DQs[num.number-1].name = args.join(" ")
			} else {
				Submissions[num.number-1].namelocked = true
				if (args.length != 0) Submissions[num.number-1].name = args.join(" ")
			}
			module.exports.save()

			module.exports.updateSubmissionMessage(bot)

			return `\`$setname\` privleges disabled for ${args.join(" ")}`
		}
	},

	// COMMAND that reallows users to change their own name
	unlockName:{
		name: "unlockName",
		short_descrip: "Allow users to change their submission name",
		full_descrip: "Usage: `$unlockname <Submission_Number>`\nAllows the user to change their submission name. To see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			if (Submissions.length == 0) return "There are no submissions to edit"
			if (args.length == 0) return "Not Enough Arguments: `<Submission Number>`"

			var num = getSubmissionNumber(args[0])
			if (num.message.length) return num.message

			if (num.dq){
				DQs[num.number-1].namelocked = false
			} else {
				Submissions[num.number-1].namelocked = false
			}
			module.exports.save()

			var result = "`$setname` privleges enabled for "
			result += num.dq ? DQs[num.number-1].name : Submissions[num.number-1].name
			result += num.dq ? ". They will be able to use the command once they are no longer disqualified" : ""
			return result
		}
	},

	// COMMAND that removes/deletes a specific submission ($deletesubmission)
	removeSubmission:{
		name: "deleteSubmission",
		short_descrip: "Deletes a submission",
		full_descrip: "Usage: `$deletesubmission <Submission_Number>`\nTo see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (Submissions.length == 0) return "There are no submissions to edit"
			if (args.length == 0) return "Not Enough Arguments: `<submission_number>`"

			var num = getSubmissionNumber(args[0])
			if (num.message.length) return num.message

			// reset the numbers
			if (num.dq){
				var deleted = DQs.splice(num.number - 1, 1)[0]
				for (var i = 0; i < DQs.length; i++){
					DQs[i].number = i+1
				}
			} else {
				var deleted = Submissions.splice(num.number - 1, 1)[0]
				for (var i = 0; i < Submissions.length; i++){
					Submissions[i].number = i+1
				}
			}
			module.exports.save()
			module.exports.updateSubmissionMessage(bot)

			var message = `${msg.author.username} deleted submission from ${deleted.name} \`(${deleted.id})\`\nm64: ${deleted.m64}\nst: ${deleted.st}`
			notifyHosts(bot, message)

			// notify the user that their submission was deleted
			var result = "Deleted Submission"
			try {
				var dm = await bot.getDMChannel(deleted.id)
				dm.createMessage("Your submission has been removed by a Moderator")
				result += " from " + deleted.name + " `(" + deleted.id + ")`. "
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
		}
	},

	// COMMAND that initializes a submission with a name given a user id
	manuallyAddSubmission:{
		name: "addSubmission",
		short_descrip: "Adds a submission",
		full_descrip: "Usage: `$addsubmission <user_id>`\nAdds a submission with a name but no files. To add files use `$submitfile`. To remove a submission use `$deletesubmission`",
		hidden: true,
		function: async function(bot, msg, args){
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

			notifyHosts(bot, `**New Submission:** ${name} (${Submissions.length}) [Added by ${msg.author.username}]`)
			return `**New Submission:** ${name} (${Submissions.length}) [Added by ${msg.author.username}]`
		}
	},

	// COMMAND that changes the m64 or st of a submission via url
	setSubmissionFile:{
		name: "submitFile",
		short_descrip: "Change a user's files",
		full_descrip: "Usage: `$submitfile <submission_number> <url>`\nSets the stored file to the url provided. The user will be notified that their files are changed.",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (Submissions.length == 0) return "There are no submissions to edit"
			if (args.length < 2) return "Not Enough Arguments: `<submission_number> <url>`"

			var num = getSubmissionNumber(args.shift())
			if (num.message.length) return num.message

			var user = Submissions[num.number - 1]

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

			} else if (module.exports.isSt({filename:args[0]})){
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
	},


	// COMMAND disqualifies a submission given a number
	dqCMD:{
		name: "disqualify",
		short_descrip: "DQs a user",
		full_descrip: "Usage: `$dq <submission_number> [reason]`\nThis prevents the user from resubmitting to the current task and excludes their name from #current_submissions. This will not remove their files. To see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id or @user> [reason]`>"

			// use mention if the message contains one
			var id = msg.mentions.length ? msg.mentions[0].id : args[0]

			// if the mention isnt the first argument, assume the first argument is the id
			// this is in case an @mention is used in the reason
			if (msg.mentions.length && `<@${id}}>` == args[0]) id = args[0]

			var user = await Users.getUser(bot, id)
			if (user == null) return `User ID \`${id}\` Not Recognized`

			// exit if they're already DQ'd
			if (DQs.filter(dq => dq.id == id).length) return `${user.username} is already disqualified`

			// Move their submission to the DQ list if they've submitted
			if (module.exports.hasSubmitted(id)){
				var submission = module.exports.getSubmission(id)
				var dq = Submissions.splice(submission.number-1,1)[0]
				dq.number = DQs.length + 1
				module.exports.updateSubmissionMessage(bot)

			} else { // "Create" A DQ submission for them
				var submission = {
					number: DQs.length + 1,
					name: user.username,
					id: id,
					m64: '', m64_size: 0,
					st: '', st_size: 0,
					namelocked: false
				}
			}
			DQs.push(submission)
			module.exports.save()

			var result = `${user.username} \`(${id})\` has been disqualified from Task ${Task}. `

			// DM the person to tell them
			try {
				args.shift()
				var reason = args.length ? "Provided Reason: " + args.join(" ") : "No reason has been provided"
				var dm = await bot.getDMChannel(id)
				dm.createMessage(`You have been disqualified from Task ${Task}. Submissions you send in for this task will no longer be accepted. ${reason}`)
			} catch (e) {
				result += `Failed to notify user. `

			} finally {
				notifyHosts(bot, result + `[disqualified by ${msg.author.username}]`)
				return result
			}
		}
	},

	// COMMAND disqualifies a submission given a number
	undqCMD:{
		name: "undoDisqualify",
		short_descrip: "Revokes a DQ",
		full_descrip: "Usage: `$undq <submission_number>`\nAllows the user to resubmit to the current task. To see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id or @user>`>"

			var id = msg.mentions.length ? msg.mentions[0].id : args[0]

			var user = await Users.getUser(bot, id)
			if (user == null) return `User ID \`${id}\` Not Recognized`

			var result = `${user.username} \`(${id})\` is no longer disqualified from Task ${Task}. `

			if (!DQs.filter(user => user.id == id).length) return `${user.username} \`(${id})\` was not disqualified`
			var dq = DQs.filter(user => user.id == id)[0]
			dq = DQs.splice(dq.number-1, 1)[0]

			// Move their submission out of DQs if they have one
			if (dq.m64_size || dq.st_size){
				dq.number = Submissions.length + 1
				Submissions.push(dq)
				module.exports.updateSubmissionMessage(bot)
			}
			module.exports.save()

			// DM the person to tell them
			try {
				var dm = await bot.getDMChannel(id)
				var notif = `You are no longer disqualified from Task ${Task}. `
				notif += Users.isBanned(id) ? `However, you are still banned and may not submit` : `Submissions you send in will now be accepted`
				dm.createMessage(notif)
			} catch (e) {
				result += `Failed to notify user. `
			} finally {
				notifyHosts(bot, result + `[undisqualified by ${msg.author.username}]`)
				if (Users.isBanned(id)) result += `WARNING: ${user.username} is still banned and cannot submit.`
				return result
			}
		}
	}
};
