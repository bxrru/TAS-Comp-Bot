const Users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const chat = require("./chatcommands.js")
const Save = require("./save.js")
const fs = require("fs")
const request = require("request")
const chrono = require("chrono-node")
const Announcement = require("./announcement.js")
const Mupen = require("./m64_editor.js")
const save = require("./save.js")

var AllowSubmissions = false
var Task = 1
var FilePrefix = "TASCompetition"
var Host_IDs = []
var SubmissionsChannel = ""
var Channel_ID = ""
var Message_ID = ""
var DQs = [] // same as Submissions but with 'Reason' field as well // toDO: replace with bool dq field in Submissions
var Submissions = [] // {name, id = user_id, m64, m64_size, st, st_size, namelocked, time, info}
// filesize is stored but never used. If the bot were to store the files locally it would be important
// time is saved in VIs, info is additional info for results (rerecords, A presses, etc.)

var TimedTask = false
var Hours = 1
var Minutes = 30
var TaskMessage = "No Task Available"
var TimedTaskStatus = {started:[],completed:[],startTimes:[]} // startTimes: [ID, StartDate]
var ReleaseDate = new Date()
var TaskChannel = ""
var TimeRemainingWarnings = [15] // give warnings for how long people have left to submit to timed tasks

const ROLESTYLES = ["DISABLED", "ON-SUBMISSION", "TASK-END"]
var RoleStyle = "DISABLED"
var Guild = ""
var SubmittedRole = ""

const UPDATES = [`UPDATE`,`WARNING`,`ERROR`,`NEW SUBMISSION`,`DQ`,`TIMER`,`FILE`,`TIMING`]
var IgnoreUpdates = {} // id: []

var AllowAutoTime = false

// TODO: Implement a confirmation of request feature that makes people
// resend a task request with some number to actually start the task

function SubmissionsToMessage(showInfo){
	var message = "**__Current Submissions:__**\n\n"
	if (Submissions.length == 0) message += "No Submissions (Yet)\n"
	for (var i = 0; i < Submissions.length; i++) {
		var player = Submissions[i]
		message += `${i + 1}. ${player.name}${showInfo ? ` (${player.id})` : ``}\n`
	}

	if (showInfo) {
		for (var i = 0; i < DQs.length; i++) {
			var player = DQs[i]
			message += `DQ${i + 1}: ${player.name} (${player.id})\n`
		}
	}
	return message
}

// check if a message isn't allowed to have access to commands
function notAllowed(msg){
	return !(Users.hasCmdAccess(msg) || Host_IDs.includes(msg.author.id))
}

// send updates to everyone in the list
// They recieve messages for all comp command calls that change task info
// EXCEPT when warning for timed tasks are changed,
//        when the current submissions message was changed,
//        when hosts are added/removed
function notifyHosts(bot, message, prefix){
	if (prefix == undefined) prefix = `Update`
	var dm = async function(id) {
		if (IgnoreUpdates[id] && IgnoreUpdates[id].includes(prefix.toUpperCase())) return
		try {
			var dm = await bot.getDMChannel(id)
			dm.createMessage(`**[${prefix}]** ${message}`)
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

function getTimeString(VIs) {
	if (VIs == null) return `N/A`
	var min = Math.floor(VIs / 60 / 60)
	var sec = Math.floor(VIs / 60) - min * 60
	var ms = Math.round((VIs - min * 60 * 60 - sec * 60) * 100 / 60)
  if (sec < 10 && min > 0) sec = `0${sec}`
  if (ms < 10) ms = `0${ms}`
  return min > 0 ? `${min}'${sec}"${ms}` : `${sec}"${ms}`
}

// 3min time limit by default
function AutoTimeEntry(bot, submission_number, time_limit = 3*60*30, err_channel_id = null, err_user_id = null) {
	const LUAPATH = "C:\\MupenServerFiles\\TimingLua\\" // TODO: put in config?
	return Mupen.Process( // returns position in queue
		bot,
		Submissions[submission_number].m64,
		Submissions[submission_number].st,
		["-lua", LUAPATH + "TASCompTiming.lua"],
		() => {
			if (fs.existsSync(LUAPATH + "submission.m64")) fs.unlinkSync(LUAPATH + "submission.m64")
			fs.copyFileSync(save.getSavePath() + "/tas.m64", LUAPATH + "submission.m64")
			if (fs.existsSync(LUAPATH + "submission.st")) fs.unlinkSync(LUAPATH + "submission.st")
			fs.copyFileSync(save.getSavePath() + "/tas.st", LUAPATH + "submission.st")
		},
		async (TLE) => {
			var admin_msg = `${Submissions[submission_number].name} (${submission_number+1}): `
			if (TLE) {
				admin_msg += `time limit exceeded (their run must be timed manually)`
				try {
					var dm = await bot.getDMChannel(Submissions[submission_number].id)
					dm.createMessage(`Your submission exceeds the process time limit. It will be manually timed by a host at a later time.`)
				} catch (e) {
					admin_msg += `**Warning:** Failed to notify user of their time update. `
				}
				notifyHosts(bot, admin_msg, "Timing")
				return
			}
			var result = fs.readFileSync(LUAPATH + "result.txt").toString()
			if (result.startsWith("DQ")) {
				var reason = result.split(' ')
				reason.shift()
				reason = reason.join(' ')
				admin_msg += `DQ [${reason}]. `
				if (Submissions[submission_number].dq && Submissions[submission_number].info == reason) {
					admin_msg += `(result unchanged) `
				} else {
					Submissions[submission_number].dq = true
					Submissions[submission_number].info = reason
					module.exports.save()
					var dm = await bot.getDMChannel(Submissions[submission_number].id)
					dm.createMessage(`Your submission is currently disqualified. Reason: \`${reason}\``).catch(e => {
						admin_msg += `**Warning:** Failed to notify user of their time update. `
					})
				}
				
			} else {
				var frames = Number(result.split(' ')[1])
				admin_msg += `||${getTimeString(frames*2)} (${frames}f)||. `
				if (Submissions[submission_number].time == frames * 2) {
					admin_msg += `(time unchanged) `
				} else {
					Submissions[submission_number].time = frames * 2
					module.exports.save()
					var dm = await bot.getDMChannel(Submissions[submission_number].id)
					dm.createMessage(`Your time has been updated: ${getTimeString(frames * 2)} (${frames}f)`).catch(e => {
						admin_msg += `**Warning:** Failed to notify user of their time update. `
					})
				}
			}
			fs.unlinkSync(LUAPATH + "result.txt")
			admin_msg += `Auto-timed by lua`
			if (err_channel_id) bot.createMessage(err_channel_id, admin_msg) // assume timing was manually requested
			notifyHosts(bot, admin_msg, `Timing`)
		},
		err_channel_id,
		err_user_id,
		time_limit
	)
}

// msg is the DM that contains a submitted file
function CheckAutoTiming(bot, msg) {
	if (!AllowAutoTime) return
	var updated_m64 = false
	msg.attachments.forEach((attachment) => {
		updated_m64 |= attachment.url.endsWith(".m64")
	})
	if (!updated_m64) return // make sure they changed the inputs (though there are cases where changing st alone can update time [rng/timers])
	Submissions.forEach((submission, index) => {
		if (submission.id != msg.author.id) return
		if (submission.m64.length == 0 || submission.st.length == 0) return // make sure there is both an m64 and st
		AutoTimeEntry(bot, index)
	})
}

module.exports = {
	name: "Competition",
	short_name: "comp",
	messageAdmins:notifyHosts,

	getAllowSubmissions:function(){
		return AllowSubmissions;
	},
	getTaskNum:function(){
		return Task;
	},

	allowSubmissions:{
		name: "startTask",
		aliases: ["startAccepting", "startSubmission", "startSubmissions"],
		short_descrip: "Starts accepting submissions",
		full_descrip: "Starts accepting submissions via DMs. To start a timed task where participants have a limited amount of time to submit use `$startTask timed`",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			var message = `Now accepting submissions for Task ${Task}. `

			if (args.length > 0 && args[0].toUpperCase() == "TIMED") {
				message += `This is a timed task. Participants will have `
				message += `**${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes** to submit. `
				TimedTask = true
			}

			notifyHosts(bot, message)

			if (Submissions.length || DQs.length || TimedTaskStatus.completed.length || TimedTaskStatus.started.length)
				notifyHosts(bot, "Preexisting submissions detected. Use `$clearsubmissions` to remove previous data", "WARNING")


			if (TimedTask && ReleaseDate > new Date()) {
				module.exports.startTimedTask(bot)
			} else if (TimedTask) {
				notifyHosts(bot, `The scheduled release date has already passed - no "Task is Live!" message will appear and submissions must be closed manually with \`$stoptask\`. `, `WARNING`)
			}

			AllowSubmissions = true
			module.exports.save()

			return `Now accepting submissions for ${TimedTask ? "Timed " : ""}Task ${Task}`
		}
	},

	startTimedTask:function(bot){
		var now = new Date()
		Announcement.DelayFunction(bot, "COMP-RELEASE", ReleaseDate.getHours()-now.getHours(), ReleaseDate.getMinutes()-now.getMinutes())

		// this is all the now live message
		var msg = `**__Task ${Task}__** is now live!\n\n`
		msg += `You will have **${Hours} hour${Hours == 1 ? '' : 's'} and ${Minutes} minute${Minutes == 1 ? '' : 's'}** to complete this task.\n\n`
		msg += `To start the task, use the command \`$requesttask\`. It may be started anytime within the next `

		var total = Math.floor((ReleaseDate - now) / 1000 / 60 / 60)
		msg += `**${total} hour${total == 1 ? '' : 's'}** at which point the task will be released publicly.\n\n`

		var deadline = new Date(ReleaseDate)
		deadline.setHours(ReleaseDate.getHours()+Hours)
		deadline.setMinutes(ReleaseDate.getMinutes()+Minutes)
		msg += `The final deadline is ${deadline}\n\n`
		msg += `Good Luck, and Have Fun! @everyone`

		try {
			bot.createMessage(TaskChannel, {content:msg, disableEveryone:false})
		} catch (e) {
			notifyHosts(bot, `Failed to send \`Task is live!\` message \`\`\`${e}\`\`\``, `ERROR`)
		}
	},

	stopSubmissions:{
		name: "stopTask",
		aliases: ["stopAccepting", "stopSubmission", "stopSubmissions"],
		short_descrip: "Stops accepting submissions",
		full_descrip: "Usage: \`$stoptask [send_message?]\`\nThis will DM everyone who's timer is still counting down for timed tasks, cancel the scheduled release of timed tasks, and stop accepting any submissions via DMs. If any argument is given, this will send a message to the Task Channel saying that the task is over. This command works regarless of whether submissions are currently being accepted or not. ",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			TimedTask = false
			AllowSubmissions = false
			//Task += 1 // increment task
			module.exports.save()

			var result = `No longer accepting submissions for Task ${Task}. `

			if (Announcement.KillDelayedFunction("COMP-RELEASE", true)) {
				result += `Public release has been cancelled. `
			}
			if (Announcement.KillDelayedFunction(`COMP-WARN ${TaskChannel}`, true)) {
				result += `Public time remaining warnings have been cancelled. `
			}
			if (Announcement.KillDelayedFunction(`COMP-WARN`, true)) {
				result += `User time remaining warnings have been cancelled. `
			}
			if (Announcement.KillDelayedFunction(`COMP-END`, true)) { // TimedTaskStatus.started.length
				result += `User timers have been stopped. `
			}

			TimedTaskStatus.started.forEach(id => {
				module.exports.endTimedTask(bot, id, false)
			})

			if (args.length > 0 && TaskChannel != ``) {
				try {
					bot.createMessage(TaskChannel, `Task ${Task} is complete! Thank you for participating!`)
				} catch (e) {
					result += `Failed to send Time's Up! message to the Task Channel. `
				}
			}

			notifyHosts(bot, result + `Ready for Task ${Task+1}!`)
			return result
		}
	},

	stopTimedTask:{
		name: "stopTimedTask",
		aliases: ["stt"],
		short_descrip: "Stops a user's timer for timed tasks",
		full_descrip: "Usage: \`$stoptimedtask <user_id>\`\nThis will stop the given user's timer for timed tasks. This DMs the user that their time is up. For a list of who has timers currently running and their IDs use `$ctts`. Unknown effects if called when someone's timer is not currently running.",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) return `Missing Argument: \`$stoptimedtask <user_id>\``

			var id = args[0]
			if (!TimedTaskStatus.started.includes(id)) return `Invalid Argument: ID \`${args[0]}\` has not started the task`

			module.exports.endTimedTask(bot, args[0], true, `Timer stopped by ${msg.author.username}`)
			Announcement.KillDelayedFunction(`COMP-END ${args[0]}`, true)
			try {
				var dm = await bot.getDMChannel(args[0])
				Announcement.KillDelayedFunction(`COMP-WARN ${dm.id}`, true)
				var user = await Users.getUser(bot, args[0])
				return `Timer Successfully stopped for ${user.username} \`(${user.id})\``
			} catch (e) {
				return `Timer stopped for user \`${args[0]}\`. \`\`\`${e}\`\`\``
			}

		}
	},

	clearSubmissions:{
		name: "clearSubmissions",
		aliases: ["clearAllSubmissions"],
		short_descrip: "Deletes all submission files (WARNING: NO CONFIRMATION)",
		full_descrip: "Removes the Submitted role from every user that has submitted. Deletes the message containing all the submissions and deletes all of the saved files **without a confirmation/warning upon using the command**. This also removes everyone from the list of timed task participants. ",
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
			TimedTaskStatus.startTimes = []
			module.exports.save()

			notifyHosts(bot, result)
			return result
		}
	},

	manuallyAddSubmission:{ // initializes a submission with a name given a user id
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
				var user = module.exports.getSubmission(user_id).submission
				return `${user.name} has already submitted`
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

			notifyHosts(bot, `${name} (${Submissions.length}) [Added by ${msg.author.username}]`, `New Submission`)
			return `**New Submission:** ${name} (${Submissions.length}) [Added by ${msg.author.username}]`
		}
	},

	removeSubmission:{
		name: "deleteSubmission",
		aliases: ["removesubmission"],
		short_descrip: "Deletes a submission",
		full_descrip: "Usage: `$deletesubmission <Submission_Number>`\nRemoves/deletes a specific submission (including all files associated to it). This will DM the user who's submission is being deleted, remove their submitted role, and update the current submissions message. To see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (Submissions.length == 0 && DQs.length == 0) return "There are no submissions to edit"
			if (args.length == 0) return "Not Enough Arguments: `<submission_number>`"

			var num = getSubmissionNumber(args[0])
			if (num.message.length) return num.message

			// remove the submission
			var deleted = num.dq ? DQs.splice(num.number - 1, 1)[0] : Submissions.splice(num.number - 1, 1)[0]

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

	setSubmissionFile:{
		name: "submitFile",
		short_descrip: "Change a user's files",
		full_descrip: "Usage: `$submitfile <submission_number> <url>`\nSets the stored file (m64 or st) to the url provided. The user will be notified that their files are changed. To upload files for someone new, use `$addSubmission` first.",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (Submissions.length == 0) return "There are no submissions to edit"
			if (args.length < 2) return "Not Enough Arguments: `<submission_number> <url>`"

			var num = getSubmissionNumber(args.shift())
			if (num.message.length) return num.message

			var user = num.dq ? DQs[num.number - 1] : Submissions[num.number - 1]

			async function notifyUserAndHost(filetype){
				var modupdate = user.name + " (" + num.number + ") " + filetype + " changed [by " + msg.author.username + "] " + args[0]
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
				notifyUserAndHost("M64")
				return "Successfully updated M64"

			} else if (module.exports.isSt({filename:args[0]})){
				module.exports.update_st(user.id, args[0], 0)
				notifyUserAndHost("ST")
				return "Successfully updated ST"

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

	// COMMAND that changes the current task number
	setTask:{
		name: "setTaskNum",
		aliases: ["setTaskNumber"],
		short_descrip: "Sets the Task Number",
		full_descrip: "Usage: `$settasknum <Task_Number>`\nSets the task number that will be used when downloading competition files",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not Enough Arguments: <Task#>"
			if (isNaN(parseInt(args[0]))) return "Task must be an integer"
			Task = parseInt(args[0])
			module.exports.save()
			notifyHosts(bot, `Task number set to ${Task}`)
			return "Task number set to " + Task
		}
	},

	setFilePrefixCMD:{
		name: "setFilePrefix",
		short_descrip: "Sets the prefix for submission filenames",
		full_descrip: "Usage: `$setfileprefix <filePrefix>`\nChanges the prefix for files. IE the `TASCompetitionTask` from `TASCompetitionTask#ByName`. `<filePrefix>` cannot contain spaces and will be used as: `<filePrefix>#by<name>.st/m64`. This changes the filenames of all submissions when downloaded using `$get all`.",
		hidden: true,
		function: function(bot,msg,args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not Enough Arguments: `$setfileprefix <fileprefix>`"
			FilePrefix = args[0]
			module.exports.save()
			notifyHosts(bot, `Files will now be named \`${FilePrefix}${Task}By<Name>.st/m64\``)
			return `Files will now be named \`${FilePrefix}${Task}By<Name>.st/m64\``
		}
	},

	setServer:{
		name: "setServer",
		short_descrip: "Sets the competition server",
		full_descrip: "Usage: `$setserver [guild_id]`\nSets the server that has the roles to give out. If no ID is specified it will use the ID of the channel the command was called from. This assumes that it is given a valid server ID.",
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
			notifyHosts(bot, `Server has been set to \`${guild_id}\``)
			return "Set Guild to ``" + guild_id + "``"
		}
	},

	setRole:{
		name: "setSubmittedRole",
		aliases: ["setRole"],
		short_descrip: "Sets the submitted role",
		full_descrip: "Usage: `$setrole [role_id]`\nSets the role to be given out when people submit. If no ID is specified or the bot does not have permission to assign the role, it will disable giving roles to users that submit. Set the competition server using `$setServer` before using this command.",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) args = [""]

			var role = args[0];
			var reason = "Testing role permissions, command call by " + msg.author.username

			var result = ""

			try {
				var self = await bot.getSelf()
				await msg.channel.guild.addMemberRole(self.id, role, reason)
				await msg.channel.guild.removeMemberRole(self.id, role, reason)
				result += "Role set to `" + role + "`"
				notifyHosts(bot, `Submitted role has been set to \`${role}\``)
			} catch (e) {
				result += "Invalid Role: Role \`"+role+"\`does not exist or does not match the server. "
				result += "Use `$setServer <id>` to set the server that contains the role. "
				result += "**No role will be given out** \`\`\`"+e+"\`\`\`"
				role = ""
			}

			SubmittedRole = role;
			module.exports.save();
			return result
		}
	},

	setFeed:{
		name: "setSubmissionFeed",
		aliases: ["setfeed"],
		short_descrip: "Sets the default channel to send the submissions list to",
		full_descrip: "Usage: `$setfeed <channel>`\nSets the default channel to send the submission message to. This does not ensure that the channel is a valid text channel that the bot can send messages to",
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

			notifyHosts(bot, result)
			return result
		}
	},

	setMessage:{
		name: "setSubmissionMessage",
		aliases: ["setsm", "setsmsg"],
		short_descrip: "Sets the message that shows the submissions list",
		full_descrip: "Usage: `$setsm <channel_id> <message_id>`\nSets the message to be automatically updated. This message is stored and will be updated until the bot is set to not accept submissions. For a list of channel names that can be used instead of `<channel_id>` use `$ls`",
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

	addHost:{
		name: "addHost",
		short_descrip: "Sets a user to receive submission updates",
		full_descrip: "Usage: `$addhost <user_id>`\nAdds an ID to the list that receives submission updates. The selected user will receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To remove a user use `$removehost`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not enough arguments: `<user_id>`"

			var user_id = args[0]
			if (Host_IDs.includes(user_id)) return "ID already registered as a host"

			try {
				var dm = await bot.getDMChannel(user_id)
				var warning = "You have been set as the recipient of submission updates for the SM64 TAS Competition. "
				warning += "If you believe this to be an error please contact the bot's owner"
				await dm.createMessage(warning)
				Host_IDs.push(dm.recipient.id)
				module.exports.save()
				return dm.recipient.username + " is now set to recieve submission updates"
			} catch (e) {
				return "Invalid User ID: Unable to send Direct Message"
			}
		}
	},

	removeHost:{
		name: "removeHost",
		short_descrip: "Stops a user from receiving submission updates",
		full_descrip: "Usage: `removehost <user_id>`\nRemoves an ID from the list that receives submission updates. The selected user will NO LONGER receive DMs about new submissions, updated files, and errors such as failure to assign the submitted role. To see the curent list of hosts use `$compinfo`. To add a user use `$addhost`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not enough arguments: `<user_id>`"
			var user_id = args[0]

			for (var i = 0; i < Host_IDs.length; i++) {
				if (Host_IDs[i] == user_id){

					var id = Host_IDs.splice(i,1)[0]
					delete IgnoreUpdates[id]
					module.exports.save()

					try {
						var dm = await bot.getDMChannel(id)
						var warning = "You are no longer set as the recipient of submission updates for the SM64 TAS Competition. "
						warning += "If you believe this to be an error please contact the bot's owner"
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

	unlockName:{
		name: "unlockName",
		short_descrip: "Allow users to change their submission name",
		full_descrip: "Usage: `$unlockname <Submission_Number>`\nAllows the user to change their submission name (they can by default). To see the list of Submission Numbers use `$listsubmissions`",
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

	dqCMD:{
		name: "disqualify",
		aliases: ["dq"],
		short_descrip: "DQs a user",
		full_descrip: "Usage: `$dq <user_id> [reason]`\nDisqualifies a submission given a user id. This prevents the user from resubmitting to the current task and excludes their name from #current_submissions. This will not remove their files. It will send them a DM telling them that they've been DQ'd. If they are partifipating in a timed task their timer will be stopped. To see the list of users and IDs of those who have already submitted use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id> [reason]`"

			var id = args.shift()
			var reason = args.length ? args.join(` `) : ``

			var user = await Users.getUser(bot, id)
			if (user === null) return `User ID \`${id}\` Not Recognized`

			var submission = false
			for (var i = 0; i < Submissions.length; i++) {
				if (Submissions[i].id == user.id) {
					submission = Submissions.splice(i, 1)[0] // remove them if they've submitted
					submission.reason = reason
					break
				}
			}
			if (!submission) {
				submission = {
					name: user.username,
					id: user.id,
					m64: '', m64_size: 0,
					st: '', st_size: 0,
					namelocked: true,
					reason: reason
				}
			}

			DQs.push(submission)
			module.exports.save()
			module.exports.updateSubmissionMessage(bot)

			var result = `${user.username} \`(${id})\` has been disqualified from Task ${Task}. `

			// DM the person to tell them
			try {
				Announcement.KillDelayedFunction(`COMP-END ${id}`, true)
				var notif = `You have been disqualified from Task ${Task}. `
				if (AllowSubmissions && !TimedTaskStatus.completed.includes(id)) {
					notif += `Submissions you send in for this task will no longer be accepted. `
				}
				if (reason.length) {
					notif += `Provided Reason: ${reason}`
				} else {
					notif += `No reason has been provided`
				}
				var dm = await bot.getDMChannel(id)
				Announcement.KillDelayedFunction(`COMP-WARN ${dm.id}`, true)
				dm.createMessage(notif)

			} catch (e) {
				result += `Failed to notify user. `

			} finally {
				notifyHosts(bot, result + `[disqualified by ${msg.author.username}]`, `DQ`)
				return result
			}
		}
	},

	undqCMD:{
		name: "undoDisqualify",
		aliases: ["undq"],
		short_descrip: "Revokes a DQ",
		full_descrip: "Usage: `$undq <user_id>`\nUndoes the effects of a DQ given a user id. This DMs the user telling them they're no longer DQ'd and allows the user to resubmit to the current task. To see the list of DQs with user IDs use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id>`"

			var id = args[0]
			var user = await Users.getUser(bot, id)
			if (user === null) return `User ID \`${id}\` Not Recognized`

			var dq = false
			for (var i = 0; i < DQs.length; i++) {
				if (DQs[i].id == user.id) {
					dq = DQs.splice(i, 1)[0] // remove DQ
				}
			}
			if (!dq) return `${user.username} \`(${user.id})\` was not disqualified`

			// Move their submission out of DQs if they have one
			if (dq.m64_size || dq.st_size){
				delete dq.reason
				Submissions.push(dq)
				module.exports.updateSubmissionMessage(bot)
			}
			module.exports.save()

			var result = `${user.username} \`(${user.id})\` is no longer disqualified from Task ${Task}. `

			// DM the person to tell them
			try {
				var dm = await bot.getDMChannel(id)
				var notif = `You are no longer disqualified from Task ${Task}. `
				if (AllowSubmissions && !TimedTaskStatus.completed.includes(id)) {
					notif += `Submissions you send in will now be accepted`
				}
				dm.createMessage(notif)
			} catch (e) {
				result += `Failed to notify user. `
			} finally {
				notifyHosts(bot, result + `[undisqualified by ${msg.author.username}]`, `DQ`)
				if (Users.isBanned(id)) result += `WARNING: ${user.username} is still banned and cannot submit.`
				return result
			}
		}
	},

	// COMMAND ($get) to get all the relevant information about a submission
	// Specifying 'all' will return a script that can download every file
	checkSubmission:{
		name: "getsubmission",
		aliases: ["get"],
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
					if (!miscfuncs.isDM(msg)) bot.createMessage(msg.channel.id, "Script will be sent in DMs")
					module.exports.getAllSubmissions(bot, dm)
					return
				}

				var num = getSubmissionNumber(args[0])
				if (num.message.length) return num.message

				var s = num.dq ? DQs[num.number-1] : Submissions[num.number - 1]
				var result = (num.dq?`DQ`:``) + `${num.number}. ${s.name}\nID: ${s.id}\nTime: ${getTimeString(s.time)} (${s.time}) ${s.info}\nm64: ${s.m64}\nst: ${s.st}`
				if (miscfuncs.isDM(msg)) {
					return result
				} else {
					dm.createMessage(result)
					return 'Submission info sent via DMs'
				}

			} catch (e) {
				return "Failed to send DM```"+e+"```"
			}
		}
	},

	// gets the text for a batch script that will download every submission file `$get all`
	getDownloadScript:function(){

		var text = ''
		text += 'md "Task ' + Task + '"\n'
		text += 'cd "Task ' + Task + '"\n'

		var addSubmission = function(submission, dq) {
			// make folder // go into folder
			var name = module.exports.fileSafeName(submission.name)
			if (dq) {
				text += 'md "DQ_' + name + '"\n'
				text += 'cd "DQ_' + name + '"\n'
			} else {
				text += 'md "' + name + '"\n'
				text += 'cd "' + name + '"\n'
			}

			// download m64 + st
			var filename = module.exports.properFileName(name)
			if (submission.m64) text += `powershell -Command "Invoke-WebRequest ${submission.m64} -OutFile '${filename}.m64'\n`
			if (submission.st) text += `powershell -Command "Invoke-WebRequest ${submission.st} -OutFile '${filename}.st'\n`

			// go back to main folder
			text += 'cd ".."\n'
		}

		Submissions.forEach(s => addSubmission(s, false))
		DQs.forEach(s => addSubmission(s, true))

		return text

	},

	// send the download script to a specified channel
	getAllSubmissions:function(bot, channel){

		var text = module.exports.getDownloadScript()

		fs.writeFile("download.bat", text, (err) => {
			if (err) {
				channel.createMessage("Something went wrong```"+err+"```")
			}
			var file = {
				file: fs.readFileSync("download.bat"),
				name: `${FilePrefix}${Task}Download.bat`
			}
			channel.createMessage("** **", file)
		})

	},

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

	info:{
		name: "compinfo",
		short_descrip: "Shows module related information",
		full_descrip: "Shows current internal variables for the competition module",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			var info = `**Task ${Task} - Settings**\n\n`

			info += `**General Info**\n`
      info += `Current status: \`${AllowSubmissions ? '' : 'Not '}Accepting Submissions${TimedTask ? ' (Timed Task)' : ''}\`\n`
			info += `Filenames: \`${FilePrefix}${Task}By<Name>.m64\`\n`
			info += `Default Submissions Channel: ${SubmissionsChannel == `` ? `\`disabled\`` : `<#${SubmissionsChannel}>`}\n`
			try {
				var message = await bot.getMessage(Channel_ID, Message_ID)
				info += `Submissions Message URL: https://discordapp.com/channels/${message.channel.guild.id}/${message.channel.id}/${message.id}\n`
			} catch (e) {
				info += `Invalid Current Submissions Message: Could not retrieve URL\n`
				Channel_ID = ""
				Message_ID = ""
			}

			info += Host_IDs.length ? `\n**Update Recipients**\n` : `\nNo users are set to receive submission updates\n`
			for (var i = 0; i < Host_IDs.length; i++){
				try {
					var dm = await bot.getDMChannel(Host_IDs[i])
					info += `• ${dm.recipient.username} \`(${Host_IDs[i]})\`\n`
				} catch (e) {
					console.log("Removed invalid Host ID", Host_IDs.splice(i, 1))
					module.exports.save()
				}
			}

			info += `\n**Timed Task Info**\n`
			info += `Task Length: ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes\n`
			info += `Time Remaining Warnings: ${TimeRemainingWarnings.join(`, `)}\n`
			info += `Release Date: \`${ReleaseDate.toString()}\`\n`
			info += `Task Channel: ${TaskChannel == `` ? `\`disabled\`` : `<#${TaskChannel}>`}\n`

			info += `\n**Role Style:** \`${RoleStyle}\`\n`
			info += `Server ID: \`${Guild == `` ? ` ` : Guild}\`\n`
			info += `Submitted Role ID: \`${SubmittedRole == `` ? ` ` : SubmittedRole}\`\n`

			return info
		}
	},

	setName:{
		name: "setname",
		short_descrip: "Change your name as seen in #current_submissions",
		full_descrip: "Usage: `$setname <new name here>`\nChange your name in the submissions/filenames. Spaces and special characters are allowed. Moderators are able to remove access if this command is abused",
		hidden: true,
		function: async function(bot, msg, args){

			var user_id = msg.author.id

			// get submission
			if (!module.exports.hasSubmitted(user_id)){
				return "You must submit files before changing your name"
			}

			if (module.exports.getSubmission(user_id).submission.namelocked || DQs.filter(user => user.id == user_id).length){
				return "Missing Permissions"
			}

			// change their name
			var name = args.join(" ")
			module.exports.update_name(user_id, name)
			module.exports.updateSubmissionMessage(bot)
			return "Set name to " + name
		}
	},

	checkStatus:{
		name: "status",
		short_descrip: "Check your submitted files",
		full_descrip: "Check the status of one's submission. This tells you what you need to submit and sends you the links to your submitted files",
		hidden: true,
		function: async function(bot, msg, args){
			try {
				var dm = await bot.getDMChannel(msg.author.id)
				dm.createMessage(module.exports.getSubmisssionStatus(msg.author.id))
			} catch (e) {
				return "Something went wrong: Could not DM your submission status"
			}
		}
	},

	setTimeWindow:{
		name: "setTaskLength",
		aliases: ["setTaskTime", "setTaskWindow", "setTaskTimeWindow", "setTaskTimeFrame"],
		short_descrip: "Sets the time limit for timed tasks",
		full_descrip: "Sets how long participants will have during timed tasks. Usage: `$setTaskLength <hours> <minutes>`. User's will always be given a 15 minute warning so the time cannot be less than 15 minutes.",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length < 2) return "Missing Arguments: `$setTaskLength <hours> <minutes>`"

			if (isNaN(args[0]) || isNaN(args[1]) || Number(args[0]) < 0 || Number(args[1]) < 0)
				return "Invalid Arguments: Arguments must be positive numbers"

			if (args[0] == 0 && args[1] < 5) return "Invalid Arguments: Time must be 5 minutes minimum"

			Hours = Math.floor(args[0])
			Minutes = Math.floor(args[1])
			module.exports.save()

			notifyHosts(bot, `Timed tasks will now be ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes`)
			return `Task length set to ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes`
		}
	},

	setTaskMsg:{
		name: "setTaskMsg",
		aliases: ["setTaskMessage"],
		short_descrip: "Sets the task message for timed tasks",
		full_descrip: "Sets the task message that will be sent out to users who request the timed tasks. Everything that appears after the command call will be stored as the message. Attachments are not currently supported. To see the message use `$previewTask`",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			var result = ""

			if (args.join(' ') == '') {
				TaskMessage = "No Task Available"
				result = "Task message has been cleared"
			} else {
				TaskMessage = args.join(' ')
				result = "Task message has been updated. Use `$previewTask` to view it"
			}

			module.exports.save()
			notifyHosts(bot, result)
			return result
		}
	},

	previewTask:{
		name: "previewTask",
		aliases: ["taskPreview"],
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
		aliases: ["ctts"],
		short_descrip: "See who has started and completed the timed task",
		full_descrip: "See the IDs of people who have started and completed the timed task. This command has been left in after testing so it isn't fancy. If the object exceedes 2000 characters it will send multiple messages.",
		hidden:true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			var result = `${JSON.stringify(TimedTaskStatus)}` // + 3 \` on either side = 2000 - 6 = 1994 chars
			if (result.length + 6 < 2000) return `\`\`\`${result}\`\`\``
			var msgs = result.match(/.{1,1994}/g)
			for (var i = 0; i < msgs.length; i++) {
				msg.channel.createMessage(`\`\`\`${msgs[i]}\`\`\``)
			}
		}
	},

	requestTask:{
		name: "requestTask",
		short_descrip: "Starts a timed task",
		full_descrip: "Starts the current timed task. Once a participant calls this command they will be sent the task message (set with `$setTaskMsg`) and allowed to submit files for the allotted time (set with `$setTaskLength`). There is no confirmation, the timer will begin counting down as soon as the command is called.",
		hidden: true,
		function: function(bot, msg, args){
			if (!TimedTask && !AllowSubmissions) return `There is no active timed task to participate in right now`
			if (!TimedTask && AllowSubmissions) return `You don't need to use that command right now - just send in your files!`
			if (!miscfuncs.isDM(msg)) return `This command can only be used in DMs`

			if (TimedTaskStatus.started.includes(msg.author.id)) return `You've already started Task ${Task}!`
			if (TimedTaskStatus.completed.includes(msg.author.id)) return `You've already completed Task ${Task}! Use \`$status\` to check your files.`

			TimedTaskStatus.started.push(msg.author.id)
			TimedTaskStatus.startTimes.push([msg.author.id, (new Date()).toString()])
			module.exports.save()

			module.exports.addTimeRemainingWarnings(bot, msg.channel.id)
			Announcement.DelayFunction(bot, `COMP-END ${msg.author.id}`, Hours, Minutes)

			// send messages
			notifyHosts(bot, `${msg.author.username} \`(${msg.author.id})\` has started Task ${Task}`, `Timer`)
			bot.createMessage(msg.channel.id, TaskMessage)
			bot.createMessage(msg.channel.id, `You have started Task ${Task}. You have ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes to submit.`)
		}
	},

	// the function called when someone's time limit is reached
	// This moves them to "completed" and notifies hosts.
	// The "Time's up!" message that is sent is controlled by the Announcement
	endTimedTask:async function(bot, id, notify, additionalMessage){
		if (TimedTaskStatus.started.filter(u => u == id).length == 0) {
			console.log(`Tried to end task for user that has not *started* ${id}`)
			return
		}

		TimedTaskStatus.started = TimedTaskStatus.started.filter(u => u != id)
		TimedTaskStatus.completed.push(id)
		module.exports.save()

		try {
			var dm = await bot.getDMChannel(id)
			dm.createMessage(`Your Time is up! Thank you for participating in Task ${Task}. To see your final files use \`$status\`. `)
		} catch (e) {
			additionalMessage = `Failed to DM the user \`(${id})\` \`\`\`${e}\`\`\``
		}

		var user = await Users.getUser(bot, id)
		if (RoleStyle == "TASK-END") module.exports.giveRole(bot, id, user.username)

		if (additionalMessage == undefined) additionalMessage = ``
		if (notify) notifyHosts(bot, `Time's up for ${user.username}! ${additionalMessage}`, `Timer`)
	},

	// creates a submission object
	addSubmission:function(user_id, name, m64_url, m64_filesize, st_url, st_filesize){

		var submission = {
			name: name,
			id: user_id,
			m64: m64_url,
			m64_size: m64_filesize,
			st: st_url,
			st_size: st_filesize,
			namelocked: false,
			time: null,
			dq: false,
			info: ''
		}

		Submissions.push(submission);
		module.exports.save();
		console.log("Added submission: ", name, Submissions.length);
	},

	// short hand for initializing a submission
	addSubmissionName:function(user_id, name){
		module.exports.addSubmission(user_id, name, "", 0, "", 0)
	},

	// changes the m64 of a submission
	update_m64:function(user_id, new_m64, filesize){
		for (var i = 0; i < Submissions.length; i++) {
			if (Submissions[i].id == user_id) {
				Submissions[i].m64 = new_m64
				Submissions[i].m64_size = filesize
			}
		}
		module.exports.save()
	},

	// changes the st of a submission
	update_st:function(user_id, new_st, filesize){
		for (var i = 0; i < Submissions.length; i++) {
			if (Submissions[i].id == user_id) {
				Submissions[i].st = new_st
				Submissions[i].st_size = filesize
			}
		}
		module.exports.save()
	},

	// changes the name of a submission
	update_name:function(user_id, new_name){
		for (var i = 0; i < Submissions.length; i++) {
			if (Submissions[i].id == user_id) {
				Submissions[i].name = new_name
			}
		}
		module.exports.save()
	},

	// returns whether an m64 and/or st have been submitted by a user
	getSubmisssionStatus:function(user_id){
		if (!module.exports.hasSubmitted(user_id)) {
			var m64 = false
			var st = false
		} else {
			var submission = module.exports.getSubmission(user_id).submission
			var m64 = submission.m64.length != 0;
			var st = submission.st.length != 0;
		}

		if (m64 && st) {
			var msg = `Submission Status: \`2/2\` Submission complete\n`
			if (submission.dq) {
				msg += `**WARNING** Your run is currently disqualified!\n`
				msg += `Reason: ${submission.info}`
			} else if (submission.time != null) {
				msg += `Time: ${getTimeString(submission.time)} (${submission.time/2}f)`
				if (submission.info != ``) msg += ` ` + submission.info
			} else {
				`Your run has not been timed yet.`
			}
			msg += `\nm64: ${submission.m64}\nst: ${submission.st}`
			return msg
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

	// returns the submission object and it's ID given an id
	getSubmission:function(user_id){
		for (var i = 0; i < Submissions.length; i++) {
			if (Submissions[i].id == user_id) {
				return {submission: Submissions[i], id: i + 1}
			}
		}
		for (var i = 0; i < DQs.length; i++) {
			if (DQs[i].id == user_id) {
				return {submission: DQs[i], id: `DQ${i + 1}`}
			}
		}
		return null
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
			timedtaskstatus: TimedTaskStatus,
			taskchannel: TaskChannel,
			releasedate: ReleaseDate.toString(),
			warnings: TimeRemainingWarnings,
			roletype: RoleStyle,
			ignoredupdates: IgnoreUpdates,
			autotime: AllowAutoTime
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
		TaskChannel = data.taskchannel
		ReleaseDate = chrono.parseDate(data.releasedate)
		if (ReleaseDate == null) ReleaseDate = new Date()
		TimedTaskStatus.started = []
		while (data.timedtaskstatus.started.length > 0) TimedTaskStatus.started.push(data.timedtaskstatus.started.shift())
		TimedTaskStatus.completed = []
		while (data.timedtaskstatus.completed.length > 0) TimedTaskStatus.completed.push(data.timedtaskstatus.completed.shift())
		TimedTaskStatus.startTimes = []
		while (data.timedtaskstatus.startTimes.length > 0) {
			var info = data.timedtaskstatus.startTimes.shift()
			TimedTaskStatus.startTimes.push([info[0], chrono.parseDate(info[1])])
		}
		while (data.submissions.length > 0) Submissions.push(data.submissions.shift())
		while (data.dqs.length > 0) DQs.push(data.dqs.shift())
		TimeRemainingWarnings = []
		while (data.warnings.length > 0) TimeRemainingWarnings.push(data.warnings.shift())
		RoleStyle = data.roletype
		Object.keys(data.ignoredupdates).forEach(id => {
			IgnoreUpdates[id] = []
			while (data.ignoredupdates[id].length) IgnoreUpdates[id].push(data.ignoredupdates[id].pop())
		})
		AllowAutoTime = data.autotime == undefined ? false : data.autotime
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
		return FilePrefix + Task + "By" + module.exports.fileSafeName(username)
	},

	// removes the roles from everyone that submitted
	clearRoles:async function(bot){
		if (SubmittedRole == '' || RoleStyle == `DISABLED`) return "Roles Disabled (no roles removed). "
		var clear = async function(user){
			try {
				await bot.removeGuildMemberRole(Guild, user.id, SubmittedRole, "Clearing Submissions");
			} catch (e) {
				console.log("Could not remove role from ", user.name, user.id);
			}
		}
		Submissions.forEach(clear)
		DQs.forEach(clear)
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
			notifyHosts(bot, `${msg.author.username} (${Submissions.length}) \`(${msg.author.id})\``, `New Submission`)
		}

		var name = module.exports.getSubmission(msg.author.id).submission.name
		filename = module.exports.properFileName(name) + filename

		// begin downloading the file
		Save.downloadFromUrl(attachment.url, Save.getSavePath() + "/" + filename)

		module.exports.uploadFile(bot, filename, attachment.size, msg)
		if (RoleStyle == `ON-SUBMISSION`) module.exports.giveRole(bot, msg.author.id, msg.author.username)
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
			notifyHosts(bot, "Failed to store submission url from " + msg.author.username, `Error`)
		}

	},

	// recursive function that will keep trying to upload a file until the buffer size matches
	// this is meant to be used after a file starts to download
	uploadFile:async function(bot, filename, filesize, msg){

		try {
			var file = {
				file: fs.readFileSync(Save.getSavePath() + "/" + filename),
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
			fs.unlinkSync(Save.getSavePath() + "/" + filename)
			CheckAutoTiming(bot, msg)
		}


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
				notifyHosts(bot, `Failed to send submission update to <#${SubmissionsChannel}> \`(${SubmissionsChannel})\``)
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
			notifyHosts(bot, `Failed to assign ${name} the submitted role`, `ERROR`)
		}
	},


	// this is meant to parse every message and sort submissions
	filterSubmissions:function(bot, msg){

		if (!miscfuncs.isDM(msg)) return
		if (msg.content.startsWith("$")) return // ignore commands

		var hasM64orSt = msg.attachments.filter(module.exports.isM64).length || msg.attachments.filter(module.exports.isSt).length
		if (!hasM64orSt) return

		if (Users.isBanned(msg.author.id)) return

		if (!AllowSubmissions) return bot.createMessage(msg.channel.id, `I am not accepting submissions at this time. `)

		if (DQs.filter(user => user.id == msg.author.id).length) return

		// dont let people who have finished submit when the task is released publicly
		if (TimedTaskStatus.completed.includes(msg.author.id)) {
			bot.createMessage(msg.channel.id, "Your time is up, you can no longer submit files. Thank you for participating.")
			return
		}

		if (TimedTask && !TimedTaskStatus.started.includes(msg.author.id)) return

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

	// Sends a file update to the host(s)
	forwardSubmission:async function(bot, user_id, filename, url){

		if (!module.exports.hasSubmitted(user_id)) return console.log("SOMETHING WENT WRONG: COULD NOT FORWARD SUBMISSION")

		// need a better way to get the ID of the submission
		var submission = module.exports.getSubmission(user_id)
		var result = submission.submission.name + " (" + submission.id + ") "

		if (module.exports.isM64({filename: filename})){
			result += "uploaded m64 " + url
		} else {
			result += "uploaded st " + url
		}

		notifyHosts(bot, result, `File`)

	},

	setTaskChannel:{
		name: "setTaskChannel",
		aliases: ["stc"],
		short_descrip: "Set the channel to post Tasks in",
		full_descrip: "Usage: \`$settaskchannel [channel]\`\nSets the channel that timed tasks will automatically be released in. This will send and immediately delete a message in the specified channel to make sure the bot can use it. If no channel id is specified, it will use the channel the command is called from. If an invalid channel is specified it will disable it's use for other functions",
		hidden:true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

      var id = msg.channel.id
      if (args.length > 0) id = miscfuncs.getChannelID(args[0])
			var result = `Task channel has been changed from `
			result += TaskChannel == `` ? `\`disabled\`` : `<#${TaskChannel}> \`(${TaskChannel})\``
      try {
        await bot.createMessage(id, "Testing...").then((msg) => msg.delete())
        result += ` to <#${id}> \`(${id})\``
      } catch (e) {
				id = ``
				result += ` to \`disabled\` (Unknown Channel)`
      }
			TaskChannel = id
			module.exports.save()
			notifyHosts(bot, result)
			return result
		}
	},

	setReleaseDate:{
		name: "setReleaseDate",
		aliases: ["srd", "setReleaseTime"],
		short_descrip: "Set the time to make a task public",
		full_descrip: "Usage: \`$setreleasedate <time and date...>\`\nThis sets the time for when ",
		hidden:true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return

			var date = chrono.parseDate(msg.content)
			if (date == null) return `Invalid Argument: Date not detected \`${args.join(' ')}\``

			var now = new Date()
			if (date - now < 0) return `Invalid Argument: Date \`${date}\` has already passed. Try a more specific time`
			ReleaseDate = date
			module.exports.save()

			result = `The task will be release publicly on \`${ReleaseDate.toString()}\`. `
			if (TimedTask) { // called while a task is running, need to change the time
				Announcement.KillDelayedFunction("COMP-RELEASE")
				Announcement.DelayFunction(bot, "COMP-RELEASE", ReleaseDate.getHours()-now.getHours(), ReleaseDate.getMinutes()-now.getMinutes())
				result += `The current release time has been adjusted. `
			}

			notifyHosts(bot, result)
			return result
		}
	},

	releaseTask:async function(bot) {
		if (TaskChannel == ``) {
			notifyHosts(bot, `Failed to release task. No Task Channel is set. The task will not automatically stop, to do so use \`$stoptask\``, `ERROR`)
			return
		}
		try {
			await bot.createMessage(TaskChannel, {content:TaskMessage + `\n@everyone`, disableEveryone:false})
			TimedTask = false
			AllowSubmissions = true
			module.exports.save()
			Announcement.DelayFunction(bot, `COMP-END`, Hours, Minutes)
			module.exports.addTimeRemainingWarnings(bot, TaskChannel)
		} catch (e) {
			notifyHosts(bot, `Failed to release task \`\`\`${e}\`\`\``, `ERROR`)
		}
	},

	addTimeRemainingWarnings:function(bot, channel){
		for (var i = 0; i < TimeRemainingWarnings.length; i++) {
			Announcement.DelayFunction(bot, `COMP-WARN ${channel} ${i}`, Hours, Minutes - TimeRemainingWarnings[i])
		}
	},

	timerWarning:async function(bot, channel, warningIndex) {
		if (!AllowSubmissions) return // if the task was stopped dont give a warning
		var msg = `You have ${TimeRemainingWarnings[warningIndex]} minutes remaining to submit! `
		if (channel == TaskChannel) msg += `@everyone`
		try {
			await bot.createMessage(channel, {content:msg, disableEveryone:false})
		} catch (e) {
			notifyHosts(bot, `Failed to give ${TimeRemainingWarnings[warningIndex]} minute warning in channel ${channel}\`\`\`${e}\`\`\``, `ERROR`)
		}
	},

	AddWarning:{
		name: "SetWarnings",
		short_descrip: "Set when to send submission reminders",
		full_descrip: "Usage: \`$setWarnings [minutes...]\`\nThis sets the \`X minutes remaining!\` messages. The bot will give every user a warning for every time specified in minutes. If no times are given, it will disable all warnings. Times do not need to be given in any particular order. This does not ensure that the times are less than the task length.\n\nExample: \`$setwarnings 15 30\`",
		hidden: true,
		function:function(bot, msg, args){
			if (notAllowed(msg)) return

			TimeRemainingWarnings = []

			for (var i = 0; i < args.length; i++) {
				if (!isNaN(args[i])) {
					TimeRemainingWarnings.push(Math.floor(Number(args[i])))
				}
			}

			module.exports.save()

			if (TimeRemainingWarnings.length == 0) {
				return `No warnings will be given. `
			}
			return `Warnings will now be given every ${TimeRemainingWarnings.join(', ')} minutes. `
		}
	},

  TimeRemaining:{
    name: "TimeRemaining",
    short_descrip: "See how much time you have left to submit",
    full_descrip: "Usage: \`$timeremaining\`\nSee how much time is left for the current timed task. This only works if you started the task with \`$requesttask\`. Although it provides a seconds count, it is likely only accurate up to the minute give or take 1. If no task is currently taking place, the command call is ignored",
    hidden: true,
    function:async function(bot, msg, args){
      if (!AllowSubmissions) return `There is no task running right now (0 minutes remaining)`
			if (TimedTaskStatus.completed.includes(msg.author.id)) return `Your time is up! (0 minutes remaining)`
			if (!TimedTaskStatus.started.includes(msg.author.id)) return `You have not started yet!`

			var startdate = TimedTaskStatus.startTimes.filter(a => a[0] == msg.author.id)[0]
      var end = chrono.parseDate(startdate.toString()) // bad way to make a copy
      end.setHours(end.getHours()+Hours)
      end.setMinutes(end.getMinutes()+Minutes)
      var now = new Date()
      return `You have approximately ${miscfuncs.formatSecsToStr((end - now) / 1000)} remaining to submit!`
    }
  },

	SetRoleStyle:{
		name: "SetRoleStyle",
		aliases: ["setrolestyles"],
		short_descrip: "Set when to give out roles for submitting",
		full_descrip: "Usage: \`$setrolestyle <style>\`\nCurrent supported styles are:\n\t\`DISABLED\` - Don't give roles\n\t\`ON-SUBMISSION\` - Give role on first submission\n\t\`TASK-END\` - Give role when timer runs out\nMake sure to set the server the role will be given out in with \`$setserver\`, and to the role id with \`$setsubmittedrole\`. The \`TASK-END\` style only works with Timed Tasks.",
		hidden: true,
		function:function(bot, msg, args) {
			if (notAllowed(msg)) return

			if (args.length == 0 || !ROLESTYLES.includes(args[0].toUpperCase())) {
				RoleStyle = `DISABLED`
			} else {
				RoleStyle = args[0].toUpperCase()
			}

			module.exports.save()

			notifyHosts(bot, `Role Style updated to \`${RoleStyle}\``)
			return `Role Style updated to \`${RoleStyle}\``
		}
	},

	SetTime:{
		name: `SetTime`,
		aliases: [`SetResult`, `SetResults`],
		short_descrip: `Sets a user's time for their submission`,
		full_descrip: `Usage: \`$settime <submission_number> <VIs> [additional info]\`\nSets the time (in VIs) for a user's run. To see the results, use \`$getresults\`. This will DM the user telling them the information that is set with this command. To see a list of submission numbers use \`$listsubmissions\`. The \`additional info\` field is for rerecords, A press count, or any other relevant information to be displayed in the results. `,
		hidden: true,
		function:async function(bot, msg, args) {
			if (notAllowed(msg)) return
			if (args.length < 2) return `Missing Arguments: \`$settime <submission_number> <VIs> [additional info]\``

			var num = getSubmissionNumber(args.shift())
			var VIs = args.shift()
			var info = args.join(` `)

			if (num.message.length) return num.message
			if (isNaN(VIs)) return `Invalid Argument: VIs must be a number`

			if (num.dq) {
				DQs[num.number - 1].time = VIs
				DQs[num.number - 1].info = info
				var submission = DQs[num.number - 1]
			} else {
				Submissions[num.number - 1].time = VIs
				Submissions[num.number - 1].info = info
				var submission = Submissions[num.number - 1]
			}
			module.exports.save()

			var result = `${submission.name} (${num.dq ? `DQ` : ``}${num.number}): ||${getTimeString(VIs)} (${VIs})||`
			result += info.length ? ` ${info}. ` : `. `
			result += `Updated by ${msg.author.username}`

			try {
				var dm = await bot.getDMChannel(submission.id)
				dm.createMessage(`Your time has been updated: ${getTimeString(VIs)} ${info}`)
			} catch (e) {
				result += `. **Warning:** Failed to notify user of their time update. `
			}

			notifyHosts(bot, result, `Timing`)
			return result
		}
	},

	AutoTime:{
		name:`AutoTime`,
		short_descrip: `Time a submission via Mupen-lua`,
		full_descrip: `Usage: \`$autotime <submission_number or 'all'>\`\nAttempts to time the specified submission by playing the tas in Mupen through a timing lua script. If only 1 run is autotimed, this will disable the default time limit (runs longer than 3min can still be timed with the script through this command). This will DM participants if their time changes.`,
		hidden: true,
		function: async function(bot, msg, args) {
			if (notAllowed(msg)) return `Missing permissions`
			if (args.length < 1) return `Missing Argument: \`$autotime <submission_number or 'all'>\``
			if (args[0] == 'all') {
				for (var i = 0; i < Submissions.length; ++i) {
					AutoTimeEntry(bot, i)
				}
				return `All ${Submissions.length} submissions are in queue to be timed.`
			}
			var submission_number = getSubmissionNumber(args[0])
			submission_number = submission_number.number - 1 // assuming non DQ since I need to rework that anyways
			var pos = AutoTimeEntry(bot, submission_number, -1, msg.channel.id, msg.author.id)
			return `Position in queue: ${pos}`
		}
	},

	ToggleAutoTime:{
		name: `ToggleAutoTime`,
		short_descrip: `enable timing on submission`,
		full_descrip: `Usage: \`$toggleautotime\`\nThis toggles (turns on/off) auto timing as soon as competitors submit m64s. Use this command to stop the bot from timing runs with an outdated script (while still allowing people to submit). This does not disable \`$AutoTime\``,
		hidden: true,
		function: async function(bot, msg, args) {
			if (notAllowed(msg)) return
			AllowAutoTime = !AllowAutoTime
			return `Timing when a new file is received is now \`${AllowAutoTime ? 'enabled' : 'disabled'}\``
		}
	},

	GetResults:{
		name: `GetResults`,
		short_descrip: `Get the results for the task`,
		full_descrip: `Usage: \`$getresults [num_bold]\`\nGets the results for a task. \`num_bold\` is the number of players who will be highlighted in the results. This uses the information provided from \`$settime\`. And produces the format: 1. Name Ti"me info, DQ: name (reason). If anyone's time has not been added to the database, they will be put at the top of the list. `,
		hidden: true,
		function:async function(bot, msg, args) {
			if (notAllowed(msg)) return

			var num_bold = 0
			if (args.length > 0 && !isNaN(args[0])) num_bold = args[0]

			var result = `\`\`\`**__Task ${Task} Results:__**\n`

			var untimed = [...Submissions].filter(a => a.time == null)
			var dqs = [...Submissions].filter(a => a.dq)
			var timed = [...Submissions].filter(a => !a.dq && a.time != null).sort((a,b) => a.time - b.time)

			var ordinal_suffix = function(n) {
				if ((n % 100) in [11, 12, 13]) {
					return 'th'
				} else if (n % 10 == 1) {
					return 'st'
				} else if (n % 10 == 2) {
					return 'nd'
				} else if (n % 10 == 3) {
					return 'rd'
				}
				return 'th'
			}

			timed.forEach((s, i) => {
				var line = `${i+1}${ordinal_suffix(i+1)}. ${s.name} ${getTimeString(s.time)} ${s.info}`.trim()
				if (num_bold-- > 0) line = `**${line}**`
				result += line
			})
			result += `\n`
			dqs.forEach(dq => {
				result += `\nDQ: ${dq.name} ${dq.time ? getTimeString(dq.time) + ' ' : ''}[${dq.info}]`
			})
			result += `\n`
			untimed.forEach(s => {
				result += `\n${s.name}`
			})

			return result + `\`\`\``
		}
	},

	IgnoreUpdate:{
		name: `IgnoreUpdate`,
		aliases: [`ignoreupdates`, `toggleupdates`, `toggleupdate`],
		short_descrip: `Disable specific comp notifications`,
		full_descrip: `Usage: \`$ignoreupdate <update>\`\nThis will toggle on/off different notifications from the bot. \`update\` is not case sensitive and must be one of:\n• ${UPDATES.join(`\n• `)}`,
		hidden: true,
		function:function(bot, msg, args) {
			if (notAllowed(msg)) return

			if (!Host_IDs.includes(msg.author.id)) return `Only Hosts set to receive updates can use this command. `
			if (args.length < 1) return `Missing Argument: \`$ignoreupdate <update>\``

			var update = args.join(` `).toUpperCase()
			if (!UPDATES.includes(update)) return `Invalid Argument: Update must be one of: ${UPDATES.join(`, `)}`

			if (!IgnoreUpdates[msg.author.id]) IgnoreUpdates[msg.author.id] = []

			if (IgnoreUpdates[msg.author.id].includes(update)) {
				IgnoreUpdates[msg.author.id] = IgnoreUpdates[msg.author.id].filter(u => u != update)
				module.exports.save()
				return `You will now receive [${update}] updates. `

			} else {
				IgnoreUpdates[msg.author.id].push(update)
				module.exports.save()
				return `You will no longer receive [${update}] updates. `
			}
		}
	}
}
