/*
Overview of the submission process
1. User DM's the bot => call filterSubmissions
2. Check for attachment => call filterFiles to look for REQUIRED_FILES
2a. Create a new entry if they havent submitted yet
3. Download the file by calling storeFile
3a. Update submission info, notify hosts, etc
4. Try to time the submission with CheckAutoTiming
*/

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
const archiver = require('archiver');

const LUAPATH = process.cwd() + "\\TimingLua\\" // assumed bot is started from main folder

var AllowSubmissions = false
var Task = 1
var FilePrefix = "TASCompetition"
var Host_IDs = []
var SubmissionsChannel = ""
var Channel_ID = ""
var Message_IDs = [] // in case too many people submit, possibly we need multiple messages
var DQs = [] // same as Submissions but with 'Reason' field as well // toDO: replace with bool dq field in Submissions
var Submissions = [] // {name, id = user_id, m64, m64_size, st, st_size, namelocked, time, info, dq: bool}
// filesize is stored but never used. If the bot were to store the files locally it would be important
// time is saved in VIs, info is additional info for results (rerecords, A presses, etc.)
// Submissions will store the user_id of the most recent partner to submit (in co-op tasks)
var Nicknames = {} // {id: name} remember custom names set with $setname between tasks
var LockedNames = [] // ids that are not allowed to change their nickname (per user instead of per submission now)
var Teams = {} // {id1: id2, id2: id1, "id1,id2": team_name} // hard coded teams of 2
var TeamTask = false

// order matters: it will prioritize downloading the first element over the 2nd etc.
// recursive: one of [st, savestate] is required, but either are acceptable
// both of [st, savetate] will be saved to submission.st
const REQUIRED_FILES = ["m64", ["st", "savestate"]] // possibly variable for other competitions?

var TimedTask = false
var Hours = 1
var Minutes = 30
var TaskMessage = "No Task Available"
var TimedTaskStatus = {started:[],completed:[],startTimes:[]} // startTimes: [ID, StartDate]
var ReleaseDate = new Date()
var TaskChannel = ""
var TimeRemainingWarnings = [15] // give warnings for how long people have left to submit to timed tasks
var LateEntrants = []


const ROLESTYLES = ["DISABLED", "ON-SUBMISSION", "TASK-END"]
var RoleStyle = "DISABLED"
var Guild = ""
var SubmittedRole = ""
var TimedTaskRole = "" // to disable this it needs to be set to ""

const UPDATES = [`UPDATE`,`WARNING`,`ERROR`,`NEW SUBMISSION`,`DQ`,`TIMER`,`FILE`,`TIMING`]
var IgnoreUpdates = {} // id: []

var AllowAutoTime = false

// [AF] For April Fool's Day, randomly assign names to display on a leaderboard
let NamesPool = ["kanef","Why","AStrongGuy","Bretaigne","manama","Lysinthia,","CeeSZee","Bagel","Brokami","emoyosh","YO_WUZ_UP","PurpleJuiceBox","Aurora112190","Jonarn","JalvinGaming","Zerolin","Gryzak","swajee","Superdavo0001","Ethan D.","FanOfNintendo","Bluely","gainai","Nis","VisionElf","Peter Griffin","Noci27","Mister Shots","Zombie","SilentSlayers","Rush57","Zyon","Core2EE","fifdspence","Blobfish Times","TheAmazingAladdin","icecream17","Experge","MineMan","Fritzafella","Soweli","Nicsi","CraftingDNA","Sunk","alex167","sm64noob","Sk3p3x","Chosis","DeRockProject","drybloxman","Coolerdude1203","Deldee/Rouge","SpeckyYT","Fraims","Brittany","Ystem","Laxenarde","FilipeTales","jolan","roblox8192","ligma","Rayon","RadixSmash","SuperSM64","Cynimal","BigBongB","Meowximum","LeonGamer_real","DanPark","Taechuk","DyllonStej","Experge25A","SuperM789","Noobtasstar","wRadion","Iwer Sonsch","SR","FeijoadaMolhada","Cabi","paper","MKDasher","Bobbybob","makayu","sear","lemon","L3dry","TelephoneMan","B4DTAS3R","NoobTASer","1Ted59","Now_wow","scuttlebug_raiser","Finn The Human","ds273","Padacuw","FireBreather","Marbler","LeddaZ","brqm","Windows X","Neicu","famicomdisksystem","2003041","Kociewie2012","enderience","Tabascoth","Adeal","Alex__","Tomatobird8","Krithalith","Niknoc","kierio04","Dazer","ShadoXFM","Dono","aquamarina","Skazzy3","mekb the turtle","Sk3p3X","Eribetra","Non5en5e","TimeTravelPenguin","SolarPrism","gameplayer","Major","Madghostek","MoonlightMirage","Somebro","Krystal","PastaGuy27","Not Plush","Jongyon","fnfnfnfnf123","Crackhex","Lim","yNotLaseyzin","superminerJG","neicu","LRFLEW","Luigihaxd","THC98","Bismuth","galoomba","Faz","Kierio04","MrPyt1001","bread","zach","Hapax","Komali","slither","LukeSaward1","Vbhnkl","Jatotz","SunkSimp","karl1043","M1NTY","speedycube64","bagel","Anastazja","Discordine","MrGatlampa","Galoomba","69420lol","LaseyApow","Cankicker8","gomitamaster1938984"]
let NamesFree = ["TASCompBot","Frame","ERGC | Xander","RSw","Alexpalix1","tjk"] // arbitrary starting selection
let NamesUsed = []
const NAMES_PER_ENTRANT = 3
function RandomName() {
	let name = "" + Math.floor(Math.random() * 1000000000) // use random numbers if we run out of names somehow
	if (NamesFree.length) {
		name = NamesFree.splice(Math.floor(Math.random() * NamesFree.length), 1)[0] 
	}
	for (let i = 0; i < Submissions.length; ++i) {
		if (Submissions[i].name == name) { // this name is being reused, so remove the submission
			Submissions.splice(i, 1)
			break
		}
	}
	NamesUsed.push(name)
	//console.log("Random Name: " + name)
    return name
}

var COMPLOG = [] // list of [timestamp, "userid", "action"]
function LOG(uid, action) {
	let d = new Date()
	COMPLOG.push([d.getTime(), uid, action])
	module.exports.save()
}

// TODO: Implement a confirmation of request feature that makes people
// resend a task request with some number to actually start the task

async function SubmissionsToMessage(bot, showInfo){
	var msgs = ["**__Current Submissions:__**\n\n"]
	if (Submissions.length == 0) {
		msgs[0] += AllowSubmissions ? "No Submissions (Yet)\n" : "Not accepting submissions at this time."
	}
	const MAXMSGLEN = 1900//2000 - 6 - 1 // 6 allows for ```x``` and 1 extra char of leeway bc i dont trust it xd
	for (var i = 0; i < Submissions.length; i++) {
		var player = Submissions[i]
		// only lists ID of most recent player to submit (when in a team)
		let line = `${i + 1}. ${await submissionName(bot, player.id)}${showInfo ? ` (${player.id})` : ``}\n`
		//let line = `${i + 1}. ${[player.name]}${showInfo ? ` (${player.id})` : ``}\n` // [AF] use name on submission
		if ((msgs[msgs.length - 1] + line).length < MAXMSGLEN) {
			msgs[msgs.length - 1] += line
		} else {
			msgs.push(line)
		}
	}

	/*if (showInfo) { // this DQ system is old/unused
		for (var i = 0; i < DQs.length; i++) {
			var player = DQs[i]
			message += `DQ${i + 1}: ${player.name} (${player.id})\n`
		}
	}*/
	return msgs
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
function AutoTimeEntry(bot, submission_number, submission_id, time_limit = 3*60*30, err_channel_id = null, err_user_id = null) {
	//console.log(submission_id)
	//console.log(submission_number)
	var getSubNum = function() { // [AF]
		if (submission_id != null) {
			for (let i = 0; i < Submissions.length; ++i) {
				if (Submissions[i].id == submission_id) {
					return i
				}
			}
		} else {
			return submission_number
		}
	}
	//console.log(Submissions)
	//console.log(getSubNum())
	//console.log(Submissions[getSubNum()])
	
	let filepath = Save.getSavePath() + "/Submissions/" + submission_id
	let st_ext = fs.existsSync(filepath + ".st") ? ".st" : ".savestate"

	if (!fs.existsSync(filepath + ".m64") || !fs.existsSync(filepath + st_ext)) {
		let err_msg = `[ERROR] Tried to autotime submission (id: ${submission_id}) with missing files.`
		console.log(err_msg)
		if (err_channel_id) bot.createMessage(err_channel_id, err_msg)
		return -1
	}

	let lua_args = ["lua", ...Mupen.lua_scripts(), LUAPATH + "TASCompTiming.lua"]
	const args = ["-m64", LUAPATH + "submission.m64", lua_args]
	
	return Mupen.Process( // returns position in queue
		bot,
		filepath + ".m64",
		filepath + st_ext,
		args,
		() => { // move Save/Submissions/id.m64 to LUA/submission.m64
			if (fs.existsSync(LUAPATH + "submission.m64")) fs.unlinkSync(LUAPATH + "submission.m64")
			fs.copyFileSync(filepath + ".m64", LUAPATH + "submission.m64")
			if (fs.existsSync(LUAPATH + "submission.st")) fs.unlinkSync(LUAPATH + "submission.st")
			fs.copyFileSync(filepath + st_ext, LUAPATH + "submission.st")
		},
		async (TLE, MISMATCH_SETTINGS) => {
			var admin_msg = `${await submissionName(bot, Submissions[submission_number].id)} (${submission_number+1}): `
			//var admin_msg = `${Submissions[getSubNum()].name} (${getSubNum()+1}): ` // [AF] use name on submission
			if (TLE) {
				admin_msg += `time limit exceeded (their run must be timed manually)`
				try {
					var dm = await bot.getDMChannel(Submissions[getSubNum()].id)
					dm.createMessage(`Your submission exceeds the process time limit. It will be manually timed by a host at a later time.`)
				} catch (e) {
					admin_msg += `**Warning:** Failed to notify user of their time update. `
				}
				notifyHosts(bot, admin_msg, "Timing")
				return
			}
			let result = ""
			if (MISMATCH_SETTINGS) {
				result = "DQ Can't playback m64. Make sure you use 1 controller with rumblepak & mempak disabled!"
			} else {
				if (fs.existsSync(LUAPATH + "result.txt")) {
					result = fs.readFileSync(LUAPATH + "result.txt").toString()
				} else {
					result = "DQ the timing script could not load, likely your m64 or st caused Mupen to crash."
				}
			}
			var user_msg = ``
			var unchanged = false
			if (result.startsWith("DQ")) {
				var reason = result.split(' ').slice(1).join(' ')
				admin_msg += `DQ [${reason}]. `
				unchanged = Submissions[getSubNum()].dq && Submissions[getSubNum()].info == reason
				Submissions[getSubNum()].dq = true
				Submissions[getSubNum()].info = reason
				Submissions[getSubNum()].time = 0 // [AF]
				user_msg = `Your submission is currently disqualified. Reason: \`${reason}\` `
				if (unchanged) {
					admin_msg += `(result unchanged) `
					user_msg += `(result unchanged) `
				}
				LOG(Submissions[getSubNum()].id, `Time: DQ [${reason}]`)
			} else {
				var frames = Number(result.split(' ')[1])
				var info = result.split(' ').slice(2).join(' ') // normally an empty string
				admin_msg += `||${getTimeString(frames*2)} (${frames}f) ${info}||. `
				unchanged = (
					Submissions[getSubNum()].time == frames * 2 &&
					Submissions[getSubNum()].info == info && // usecase: extra info is important (track A presses)
					!Submissions[getSubNum()].dq // unchanged if it wasn't a DQ previously
				)
				Submissions[getSubNum()].time = frames * 2
				Submissions[getSubNum()].info = info
				Submissions[getSubNum()].dq = false
				user_msg = `Your time has been updated: ${getTimeString(frames * 2)} (${frames}f) ${info} `
				if (unchanged) {
					admin_msg += `(time unchanged) `
					user_msg += `(time unchanged) `
				}
				LOG(Submissions[getSubNum()].id, `Time: ${frames}${info.length ? `[${info}]` : ''}`)
			}
			module.exports.save()
			if (fs.existsSync(LUAPATH + "results.txt")) fs.unlinkSync(LUAPATH + "result.txt")
			admin_msg += `Auto-timed by lua. `
			// either the time has changed, or it hasnt changed but it was a submission (not an admin timing the run)
			if (!unchanged || (unchanged && !err_channel_id)) {
				try {
					var dm = await bot.getDMChannel(Submissions[getSubNum()].id)
					dm.createMessage(user_msg.trim()).catch(e => {
						admin_msg += `**Warning:** Failed to notify user of their time update. ` // since this isn't awaited, I don't think this error actually shows up...
					})
				} catch (e) { // [AF] issue timing old runs since the uid has '-' at the end
					admin_msg += `**Warning:** Failed to notify user (\`${Submissions[getSubNum()].id}\`) of their time update. `
				}
				
				if (completedTeam(Submissions[getSubNum()].id)) { // message teammate
					dm = await bot.getDMChannel(Teams[Submissions[getSubNum()].id])
					dm.createMessage(user_msg.trim()).catch(e => {
						admin_msg += `**Warning:** Failed to notify user's partner of their time update. `
					})
				}
			}
			if (err_channel_id) bot.createMessage(err_channel_id, admin_msg) // assume timing was manually requested
			notifyHosts(bot, admin_msg, `Timing`)

			// [AF] sort runs by time and update msg
			/*var untimed = [...Submissions].filter(a => a.time == null)
			var dqs = [...Submissions].filter(a => a.dq)
			var timed = [...Submissions].filter(a => !a.dq && a.time != null).sort((a,b) => b.time - a.time) // reverse so pop is in right order
			Submissions = []
			while (timed.length) Submissions.push(timed.pop())
			while (dqs.length) Submissions.push(dqs.pop())
			while (untimed.length) Submissions.push(untimed.pop())*/
			//console.log(Submissions)
			module.exports.save()
			updateSubmissionMessage(bot)
		},
		err_channel_id,
		err_user_id,
		time_limit,
		true
	)
}

// msg is the DM that contains a submitted file
// this will time whether it's given an m64 or st
function CheckAutoTiming(bot, msg) {
	if (!AllowAutoTime) return
	Submissions.forEach((submission, index) => {
		if (submission.id != msg.author.id && !(msg.author.id in Teams && submission.id == Teams[msg.author.id])) return
		if (submission.m64.length == 0 || submission.st.length == 0) return // make sure there is both an m64 and st
		AutoTimeEntry(bot, index, submission.id) // [AF]
	})
}

// =============
// File Handling (this should be moved to save.js)
// =============

// check if a file has been fully downloaded
function hasDownloaded(filename, filesize) {
	try {
	  var file = fs.readFileSync(save.getSavePath() + "/" + filename)
	  return file.byteLength == filesize
	} catch (e) {
	  return false
	}
}
  
// TODO: give the call back a variable amount of args
// run a callback function when a file downloads
function onDownload(filename, filesize, callback) {
	if (!hasDownloaded(filename, filesize)) {
	  setTimeout(() => {onDownload(filename, filesize, callback)}, 1000) // recursive call after 1s
	} else {
	  setTimeout(() => callback(filename), 1000) // wait 1s to hope file actually loads??
	}
}
  
// repeated code. allows for url/filename/size to be entered manually,
// it will use the attachment's properties if they arent passed
function downloadAndRun(attachment, callback, url, filename, filesize) {
	if (!url) url = attachment.url
	if (!filename) filename = attachment.filename
	if (!filesize) {
	  if (attachment) {
		filesize = attachment.size
	  } else {
		request({url:url, method: `HEAD`}, (err, response) => { // find the filesize
		  save.downloadFromUrl(url, save.getSavePath() + `/` + filename)
		  onDownload(filename, response.headers[`content-length`], callback)
		})
		return
	  }
	}
  
	save.downloadFromUrl(url, save.getSavePath() + `/` + filename)
	onDownload(filename, filesize, callback)
}

function parseDate(str) {
	var date = new Date(Number(str)) // try epoch time first
	if (date < new Date(1e12)) date = new Date(Number(str+"000")) // time was in s not ms (for these purposes we only need times in the future)
	if (date == "Invalid Date") data = new Date(str) // expected date string format
	if (date == "Invalid Date") data = chrono.parseDate(str) // human date format
	return date // will be null if all fail
}

function completedTeam(user_id) {
	return Teams[user_id] && Teams[Teams[user_id]] == user_id
}

async function submissionName(bot, user_id, only_team_name = false) {
	const MAXNAMELEN = 100
	let name = ""
	if (!completedTeam(user_id)) {
		if (user_id in Nicknames /* [AF] dont use nicknames */) {
			name = Nicknames[user_id]
		} else {
			//let user = await Users.getUser(bot, user_id)
			//name = user.username
			let submitted = Submissions.filter(s => s.id == user_id)
			if (submitted.length) { // instead of loading the user with the bot
				name = submitted[0].name
			}
		}
	}
	if (name.length > 0) {
		return name.substring(0, MAXNAMELEN)
	}
	try {
		var user = await Users.getUser(bot, user_id)
		var partner = await Users.getUser(bot, Teams[user_id])
		if (user && partner) {
			var name1 = user_id in Nicknames ? Nicknames[user_id] : user.username // player nicknames
			var name2 = Teams[user_id] in Nicknames ? Nicknames[Teams[user_id]] : partner.username
			if ([user_id,Teams[user_id]] in Teams) {
				if (only_team_name) return Teams[[user_id,Teams[user_id]]]
				return `${Teams[[user_id,Teams[user_id]]]} (${name1} & ${name2})`.substring(0, MAXNAMELEN)
			}
			return `${name1} & ${name2}`.substring(0, MAXNAMELEN)
		}
	} catch (error) {
		console.log(`Error retrieving team name: ${error}`)
	}
	return ``
}

function timestamp(date) {
	return Math.floor(+date/1000)
}

// will return the extension including .
// "a.m64" -> ".m64"
function fileExt(attachment) {
	let fname = attachment
	if (typeof attachment != "string") {
		fname = ("filename" in attachment) ? attachment.filename : attachment.name
	}
	fname = fname.substring(0, fname.lastIndexOf('?')) || fname
	return fname.substring(fname.lastIndexOf('.') + 1).toLowerCase()
}

// recursively determine if ext is in REQUIRED_FILES
// returns the first extension corresponding to this file
function is_required_ext(ext) {
	// only on the first level [x, x, x] do you not want to return the first element
	let includes_recur = function(arr, first = true) {
		let found = false
		arr.forEach(x => {
			if (x == ext) { // base case: found the string
				found = ext
			} else if (!found && typeof x != "string") {
				found = includes_recur(x)
			}
		})
		if (first && found) { // recursively find first element
			found = arr[0]
			while (typeof found != "string") found = found[0] 
		}
		return found
	}
	return includes_recur(REQUIRED_FILES, false)
}

// TODO: track submission stats? or maybe from autotiming...
function update_submission_file(user_id, new_file_url, filesize){
	let file_type = is_required_ext(fileExt(new_file_url))
	let partner_id = completedTeam(user_id) ? Teams[user_id] : ""
	for (let i = 0; i < Submissions.length; i++) {
		if (Submissions[i].id == user_id || Submissions[i].id == partner_id) {
			Submissions[i][file_type] = new_file_url
			Submissions[i][file_type + "_size"] = filesize
		}
	}
	module.exports.save()
}

// Sends a file update to the host(s)
async function forwardSubmission(bot, user, filename, url){

	if (!module.exports.hasSubmitted(user.id)) return console.log("SOMETHING WENT WRONG: COULD NOT FORWARD SUBMISSION")

	// need a better way to get the ID of the submission
	var submission = module.exports.getSubmission(user.id)
	var result = ` uploaded ${fileExt(filename)} ${url}`

	if (completedTeam(user.id)) { // notify partner
		try {
			var partner_dm = await bot.getDMChannel(Teams[user.id])
			partner_dm.createMessage(user.username + result)
		} catch (error) {
			try {
				var submitter_dm = await user.getDMChannel()
				submitter_dm.createMessage("Failed to notify your teammate of the newly submitted file")
			} catch (error) { // I hope this never happens
				console.log("Failed to notify task entrant that their partner was failed to be notified of a submission")
			}
		}
	}
	
	// should this still use submission name in case of nicknames?
	result = user.username + " (" + submission.id + ")" + result // [AF] submission.submission.name instead of user.username
	notifyHosts(bot, result, `File`)

}

// Sends file back in a message to the submitter and sends that url to the hosts
// Stores the attachment url in the submission (quick access for get command)
// Save files into local folder /saves/Submissions/userid.extension (for compiling zip)
async function storeFile(bot, msg, attachment_url, extension, allow_autotime) {
	var name = await submissionName(bot, msg.author.id, true)
	let filename = module.exports.properFileName(name)
	let filepath = Save.getSavePath() + "/Submissions/" + msg.author.id + extension
	
	Save.downloadFromUrl(
		attachment_url,
		filepath,
		async () => { // upload the file then delete it locally
			let file = {
				file: fs.readFileSync(filepath),
				name: filename + extension // exclude id when uploading it back
			}
			try {
				LOG(msg.author.id, "Submitted " + extension)
				//let name = Submissions.filter(s => s.id == msg.author.id)[0].name // [AF] let them know what their name is
				let submitter_notif = fileExt(file) + " submitted. Use `$status` to check your submitted files. "/* Your alias is " + name [AF]*/
				if (!AllowAutoTime) submitter_notif += "Autotiming is currently disabled."
				let message = await bot.createMessage(msg.channel.id, submitter_notif, file)
				var attachment = message.attachments[0]
				update_submission_file(msg.author.id, attachment.url, attachment.size) // save the url and filesize in submission
				forwardSubmission(bot, msg.author, file.name, attachment.url) // notify hosts of updated file
		
			} catch (e) {
				notifyHosts(bot, "Failed to store submission from " + msg.author.username, `Error`)
			}
			//console.log(`Downloaded ${filepath} (${filename+extension}) [Autotime: ${allow_autotime ? "enabled" : "disabled"}]`)
			if (allow_autotime) { // sometimes disable depending on submission order
				CheckAutoTiming(bot, msg)
			}
		}
	)

}

// Deletes the submissions message and returns status
async function deleteSubmissionMessage(bot){
	if (Message_IDs.length == 0) {
		return "No message to delete. "
	}
	let err = false
	for (const mid of Message_IDs) {
		try {
			var message = await bot.getMessage(Channel_ID, mid);
			message.delete();
		} catch (e) {
			err = true
		}
	}
	Channel_ID = "";
	Message_IDs = [];
	module.exports.save();
	if (err) {
		return "Error deleting message. "
	}
	return "Deleted message(s)"
}

// edits the stored message with the current submissions list
// force_new will force a new submission message ONLY IF the SubmissionsChannel is defined
// this allows nickname changes to be edits [TODO], while new submissions are new messages
async function updateSubmissionMessage(bot, force_new = false){
	let msgs = await SubmissionsToMessage(bot)
	let updated = false
	
	if (force_new && Channel_ID != "" && Message_IDs.length) {
		await deleteSubmissionMessage(bot)
	}

	if (AllowSubmissions && !force_new) return

	// create one if none exists
	if ((Channel_ID == "" || Message_IDs.length == 0) && SubmissionsChannel != ""){
		updated = true
		Channel_ID = SubmissionsChannel
		try {
			for (const text of msgs) {
				let message = await bot.createMessage(SubmissionsChannel, text)
				Message_IDs.push(message.id)
			}
		} catch (e) {
			//console.log("Failed to send submission message")
			notifyHosts(bot, `Failed to send submission update to <#${SubmissionsChannel}> \`(${SubmissionsChannel})\``)
		}
	} else if (Channel_ID != "" && Message_IDs.length){
		try {
			for (let i = 0; i < msgs.length; ++i) {
				if (i < Message_IDs.length) {
					let message = await bot.getMessage(Channel_ID, Message_IDs[i])
					await message.edit(msgs[i])
				} else {
					let message = await bot.createMessage(Channel_ID, msgs[i])
					Message_IDs.push(message.id)
					updated = true
				}
			}
			while (Message_IDs.length > msgs.length) { // possibly someone removed from msg
				let mid = Message_IDs.pop()
				updated = true
				let message = await bot.getMessage(Channel_ID, mid)
				await message.delete()
			}
		} catch (e) {
			console.log("Failed to edit submission message")
			notifyHosts(bot, "Failed to edit submission message ```" + e + "```")
		}
	}
	if (updated) {
		module.exports.save()
	}
}

/* Downloads m64 and st files
Uploads them back to the person who sent it, this time with the proper file name
Deletes the local files, and stores the discord urls

attachment = {filename, url, size} */
async function filterFiles(bot, msg, attachment, allow_autotime){
	
	// make sure the file is an m64 or st
	let extension = fileExt(attachment)
	if (!is_required_ext(extension)) {
		bot.createMessage(msg.channel.id, "Attachment ``"+attachment.filename+"`` is not an ``m64`` or ``st``")
		return
	}
	extension = '.' + extension
	
	// if they have not submitted, add a new submission
	if (!module.exports.hasSubmitted(msg.author.id)){
		//for (let i = 0; i < NAMES_PER_ENTRANT && NamesPool.length; ++i) { // [AF] add new names to the pool
		//	NamesFree.push(NamesPool.pop())
		//}
		//module.exports.addSubmissionName(msg.author.id, RandomName()) // [AF]
		//notifyHosts(bot, `${await submissionName(bot, msg.author.id)} (${Submissions.length})`, `New Submission`) // [AF] no tracking userid for hosts too!
		module.exports.addSubmissionName(msg.author.id, msg.author.username)
		updateSubmissionMessage(bot, true)
		notifyHosts(bot, `${await submissionName(bot, msg.author.id)} (${Submissions.length}) \`(${msg.author.id})\``, `New Submission`)
	}/* else { // [AF] 
		let sub = Submissions.filter(s => s.id == msg.author.id)[0]
		// if they only have half a submission, don't assign a new name
		if (sub.m64_size && sub.st_size) {
			// old submissions get removed from the leaderboard when the names are reused
			// so, just append '-' to the end of the user_id so it's not detected anywhere else
			// this might break things that try to access those particular submissions by id
			let new_name = RandomName() // get random name before old one is freed
			for (let i = 0; i < Submissions.length; ++i) {
				if (Submissions[i].id == msg.author.id) {
					let cur_name = Submissions[i].name // this name is now fair game to use again
					NamesUsed.splice(NamesUsed.indexOf(cur_name), 1)
					NamesFree.push(cur_name)
					Submissions[i].id += '-'
					// submit m64 => copy old st
					// submit st => copy old m64
					if (extension == ".m64") {
						module.exports.addSubmission(msg.author.id, new_name, "", 0, Submissions[i].st, Submissions[i].st_size)
					} else {
						module.exports.addSubmission(msg.author.id, new_name, Submissions[i].m64, Submissions[i].m64_size, "", 0)
					}
					break
				} 
			}
		}
	}*/
	
	await storeFile(bot, msg, attachment.url, extension, allow_autotime)
	
	if (RoleStyle == `ON-SUBMISSION`) {
		if (completedTeam(msg.author.id)) module.exports.giveRole(bot, Teams[msg.author.id], msg.author.username + `'s Partner`)
		module.exports.giveRole(bot, msg.author.id, msg.author.username)
	}
	updateSubmissionMessage(bot)

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
		var delta = Math.floor((ReleaseDate - new Date()) / 1000)
		var days = Math.floor(delta / 86400)
		delta -= days * 86400
		var hours = Math.floor(delta / 3600) % 24
		delta -= hours * 3600
		var min = Math.floor(delta / 60) % 60
		Announcement.DelayFunction(bot, "COMP-RELEASE", hours + 24*days, min)
		
		// this is all the now live message
		var msg = `**__Task ${Task}__** is now live!\n\n`
		msg += `You will have **${Hours} hour${Hours == 1 ? '' : 's'} and ${Minutes} minute${Minutes == 1 ? '' : 's'}** to complete this task.\n\n`
		msg += `To start the task, use the command \`$requesttask\`. It may be started anytime before `
		msg += `<t:${timestamp(ReleaseDate)}:F> (<t:${timestamp(ReleaseDate)}:R>) at which point the task will be released publicly.\n\n`

		var deadline = new Date(ReleaseDate)
		deadline.setHours(ReleaseDate.getHours()+Hours)
		deadline.setMinutes(ReleaseDate.getMinutes()+Minutes)
		msg += `The final deadline to submit is <t:${timestamp(deadline)}:F>`

		try {
			bot.createMessage(TaskChannel, msg)
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
			if (Object.keys(Teams).length) result += "Teams removed. "
			result += await module.exports.clearRoles(bot)
			result += await deleteSubmissionMessage(bot)

			Submissions = []
			DQs = []
			TimedTaskStatus.started = []
			TimedTaskStatus.completed = []
			TimedTaskStatus.startTimes = []
			Teams = {}
			while (NamesUsed.length) NamesPool.push(NamesUsed.pop())
			while (NamesFree.length > 6) NamesPool.push(NamesFree.pop())
			COMPLOG = []
			module.exports.save()

			fs.rmSync(Save.getSavePath() + "/Submissions", {recursive:true})
			fs.mkdirSync(Save.getSavePath() + "/Submissions")

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
			updateSubmissionMessage(bot)

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
			updateSubmissionMessage(bot)

			var message = `${msg.author.username} deleted submission from ${await submissionName(bot, deleted.id)} \`(${deleted.id})\`\nm64: ${deleted.m64}\nst: ${deleted.st}`
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
			let filetype = fileExt(args[0])
			if (!is_required_ext(filetype)) {
				return `Invalid Filetype: Must be one of ${REQUIRED_FILES}`
			}
			storeFile(bot, {author:user, channel:msg.channel}, args[0], '.' + filetype, true)
			notifyUserAndHost(filetype)
			return "Successfully updated " + filetype

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

	setTimedTaskRole:{
		name: "setTimedTaskRole",
		aliases: [],
		short_descrip: "Sets the timed task role",
		full_descrip: "Usage: `$setrole [role_id]`\nSets the role to be given out when people are currently competing in a timed task (thier timer is counting down). If no ID is specified or the bot does not have permission to assign the role, it will disable giving roles to users that compete. Set the competition server using `$setServer` before using this command.",
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
				notifyHosts(bot, `Timed Task role has been set to \`${role}\``)
			} catch (e) {
				result += "Invalid Role: Role \`"+role+"\`does not exist or does not match the server. "
				result += "Use `$setServer <id>` to set the server that contains the role. "
				result += "**No role will be given out** \`\`\`"+e+"\`\`\`"
				role = ""
			}

			TimedTaskRole = role;
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

				let msgs = await SubmissionsToMessage(bot)
				message.edit(msgs[0])
				Channel_ID = channel_id
				Message_IDs = [message_id]
				module.exports.save()
				if (msgs.length > 1) {
					return `Message Set <#${Channel_ID}> ${Message_IDs[0]}. Warning: Submissions list is too big for one message.`
				}
				return `Message Set <#${Channel_ID}> ${Message_IDs[0]}`

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
		full_descrip: "Usage: `$lockname <user_id> [Name]`\nPrevents the user from changing their name and sets it to `[Name]`. If no name is specified it will remain the same.",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not Enough Arguments: `<user_id> [Name]`"

			let id = args.shift()
			let nick = args.length ? args.join(' ') : undefined
			let result  = ""
			if (LockedNames.includes(id) && nick == undefined) {
				if (nick !== undefined) {
					Nicknames[id] = nick
					result = `\`$setname\` privleges disabled for ${nick}`
				} else {
					result =  "Their name is already locked"
				}
				
			} else {
				LockedNames.push(id)
				Nicknames[id] = nick
				result = `\`$setname\` privleges disabled for ${nick}`
			}
			module.exports.save()

			updateSubmissionMessage(bot)
			return result
		}
	},

	unlockName:{
		name: "unlockName",
		short_descrip: "Allow users to change their submission name",
		full_descrip: "Usage: `$unlockname <user_id>`\nAllows the user to change their submission name (they can by default).",
		hidden: true,
		function: function(bot, msg, args){
			if (notAllowed(msg)) return
			if (args.length == 0) return "Not Enough Arguments: `<user_id>`"

			if (!LockedNames.includes(args[0])) {
				return "Their name was not locked to begin with"
			}
			LockedNames = LockedNames.filter(id => id != args[0])
			module.exports.save()
			return Nicknames[args[0]] + " can now set their own nickname"
		}
	},

	dqCMD:{
		name: "disqualify",
		aliases: ["dq"],
		short_descrip: "DQs a user",
		full_descrip: "Usage: `$dq <submission number> [reason]`\nDisqualifies a submission. This will not remove their files and the user can still resubmit. It will send them a DM telling them that they've been DQ'd. To see the list of submission numbers use `$listsubmissions`. To prevent someone from submitting, use `$ban`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<submission number> [reason]`"

			let num = getSubmissionNumber(args.shift())
			if (num.message.length) return num.message
			num = num.number - 1
			let reason = args.length ? args.join(` `) : ``

			Submissions[num].dq = true
			Submissions[num].info = reason

			module.exports.save()

			reason = reason.length ? "No reason was provided" : "Provided reason: " + reason
			let modupdate = `${Submissions[num].name} \`(${num + 1})\` has been disqualified. ` + reason
			let userupdate = `Your run has been disqualified. ` + reason

			// DM the person to tell them
			try {
				let dm = await bot.getDMChannel(Submissions[num].id)
				dm.createMessage(userupdate)
			} catch (e) {
				modupdate += `. Failed to notify user. `
			} finally {
				notifyHosts(bot, modupdate + `[disqualified by ${msg.author.username}]`, `DQ`)
				return modupdate
			}
		}
	},

	undqCMD:{
		name: "undoDisqualify",
		aliases: ["undq"],
		short_descrip: "Revokes a DQ",
		full_descrip: "Usage: `$undq <submission number>`\nMarks their run as not disqualified and clears the info field of their run. This DMs the user telling them they're no longer disqualified. To see the list of submission numbers use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<submission number>`"

			let num = getSubmissionNumber(args.shift())
			if (num.message.length) return num.message
			num = num.number - 1

			if (!Submissions[num].dq) return `${Submissions[num].name} \`(${num + 1})\` was not disqualified`

			Submissions[num].dq = false
			Submissions[num].info = ""
			module.exports.save()

			let result = `${Submissions[num].name} \`(${num + 1})\` is no longer disqualified. `

			// DM the person to tell them
			try {
				let dm = await bot.getDMChannel(Submissions[num].id)
				dm.createMessage("Your run is no longer disqualified.")
			} catch (e) {
				result += `Failed to notify user. `
			} finally {
				notifyHosts(bot, result + `[undisqualified by ${msg.author.username}]`, `DQ`)
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
		full_descrip: "Usage: `$get <Submission_Number or 'all' or 'entry name'>`\nReturns the name, id, and links to the files of the submission. If you use `$get all [submissions_per_zip]` the bot will upload zip files with every submission. To see the list of Submission Numbers use `$listsubmissions`",
		hidden: true,
		function: async function(bot, msg, args){

			if (notAllowed(msg)) return

			try {
				if (!Submissions.length && !DQs.length) return "No submissions found"
				if (args.length == 0) return "Not Enough Arguments: `$get <Submission_Number or 'all' or 'entry name'>`"

				var dm = await bot.getDMChannel(msg.author.id)
				if (args[0].toLowerCase() == "all"){
					if (!miscfuncs.isDM(msg)) bot.createMessage(msg.channel.id, "Zip will be sent in DMs")
					let submissions_per_zip = Submissions.length + 1;
					if (args.length > 1) {
						args[1] = Number(args[1])
						if (Number.isInteger(args[1])) {
							submissions_per_zip = args[1]
						}
					}
					module.exports.getAllSubmissions(bot, dm, submissions_per_zip)
					return
				}

				let get_submission_text_and_files = async (submission, i) => {
					let result = `${i+1}. ${submission.name}\nID: ${submission.id}\n`
					if (submission.dq) {
						result += `Time: ||${submission.name} ${submission.time ? getTimeString(submission.time) + ' ' : ''}(DQ) [${submission.info}]||`
					} else {
						result += `Time: ||${getTimeString(submission.time)} (${submission.time/2}f) ${submission.info}||`
					}
					let files = []		
					let filename = await submissionName(bot, submission.id, true)
					filename = module.exports.properFileName(filename)
					// TODO: loop through REQUIRED_FILES correctly
					let filepath = Save.getSavePath() + "/Submissions/" + submission.id
					if (submission.m64.length) {
						files.push({
							file: fs.readFileSync(filepath + ".m64"),
							name: filename + ".m64"
						})
					}
					if (submission.st.length) {
						let st_ext = fs.existsSync(filepath + ".st") ? ".st" : ".savestate"
						files.push({
							file: fs.readFileSync(filepath + st_ext),
							name: filename + st_ext
						})
					}
					return [result, files]
				}
				
				if (isNaN(args[0])) { // attempt to get submission by name
					for (let i = 0; i < Submissions.length; ++i) {
						if (Submissions[i].name == args.join(' ')) {
							let result = await get_submission_text_and_files(Submissions[i], i)
							dm.createMessage(result[0], result[1])
							if (!miscfuncs.isDM(msg)) {
								return 'Submission info sent via DMs'
							}
						}
					}
					return "Invalid Argument: `$get <Submission_Number or 'all' or 'entry name'>`"
				}

				var num = getSubmissionNumber(args[0])
				if (num.message.length) return num.message
				num = num.number - 1 // old system: submission = num.dq ? DQs[num.number-1] : Submissions[num.number - 1]
				let result = await get_submission_text_and_files(Submissions[num], num)
				dm.createMessage(result[0], result[1])
				if (!miscfuncs.isDM(msg)) {
					return 'Submission info sent via DMs'
				}

			} catch (e) {
				return "Failed to send DM```"+e+"```"
			}
		}
	},

	// gets the text for a batch script that will download every submission file `$get all`
	getDownloadScript:async function(bot){

		var text = ''
		text += 'md "Task ' + Task + '"\n'
		text += 'cd "Task ' + Task + '"\n'
		//console.log(Nicknames)
		var addSubmission = async function(submission, dq) {
			// make folder // go into folder
			if (submission.id.substr(submission.id.length-1, submission.id.length) == '-') return
			let name = await submissionName(bot, submission.id) // [AF] name = ""
			try {
				//console.log(submission.id)
				let user = await Users.getUser(bot, submission.id)
				//console.log("what")
				//console.log(user.username)
				name = user.username
			} catch (e) {
				name = await submissionName(bot, submission.id) // use alias?
				name += "(UNKNOWN)"
			}
			if (Nicknames[submission.id] !== undefined) name = Nicknames[submission.id]
			name = module.exports.fileSafeName(name)
			//console.log(submission.id + " " + name)
			
			if (dq) {
				text += 'md "DQ_' + name + '"\n'
				text += 'cd "DQ_' + name + '"\n'
			} else {
				text += 'md "' + name + '"\n'
				text += 'cd "' + name + '"\n'
			}

			// download m64 + st
			var filename = module.exports.properFileName(name)
			let f = (x) => x.substring(0, x.lastIndexOf('?'));
			if (submission.m64) text += `powershell -Command "Invoke-WebRequest ${f(submission.m64)} -OutFile '${filename}.m64'\n`
			if (submission.st) text += `powershell -Command "Invoke-WebRequest ${f(submission.st)} -OutFile '${filename}.st'\n`

			// go back to main folder
			text += 'cd ".."\n'
		}

		for (var i = 0; i < Submissions.length; i++) {
			await addSubmission(Submissions[i], false)
		}
		DQs.forEach(s => addSubmission(s, true))

		return text

	},

	// send FILEPREFIX#.zip to a specified channel
	// the zip will include one folder per entrant, containing userid.ext for each ext in file_extensions
	// file_extensions has the same format as REQUIRED_FILES (so it can choose from options)
	// if submissions_per_zip is negative, then it will put all files in a single zip
	// KNOWN ISSUE: the zips dont save correctly??? There's a warning when extracting but the contents are fine.
	getAllSubmissions:async function(bot, channel, submissions_per_zip, file_extensions = null){
		
		if (file_extensions == null) file_extensions = REQUIRED_FILES

		// Files are saved as /saves/Submissions/userid.extension
		const FOLDER = Save.getSavePath() + "/Submissions/"

		// initial zip
		let submissions_in_zip = 0;
		let zips = [`${FilePrefix}${Task}.zip`];
		let outputs = [fs.createWriteStream(FOLDER + zips[0])];
		let archives = [archiver('zip')];
		archives[0].on('error', (err) => {
			channel.createMessage("Something went wrong```"+err+"```");	
		});
		archives[0].pipe(outputs[0]);

		for (var i = 0; i < Submissions.length; i++) {
			// create a new zip
			if (submissions_in_zip == submissions_per_zip) {
				zips.push(`${FilePrefix}${Task}_${zips.length}.zip`);
				outputs.push(fs.createWriteStream(FOLDER + zips[zips.length - 1]));
				archives.push(archiver('zip'));
				archives[archives.length - 1].on('error', (err) => {
					channel.createMessage("Something went wrong```"+err+"```");	
				});
				archives[archives.length - 1].pipe(outputs[outputs.length - 1]);
				submissions_in_zip = 0;
			}
			// add required files from submission to zip
			let username = await submissionName(bot, Submissions[i].id)
			for (const rf of file_extensions) {
				let extensions = typeof rf == "string" ? [rf] : rf; // go through all possibilities
				let found = false;
				for (const ext of extensions) {
					let filepath = FOLDER + Submissions[i].id + '.' + ext;
					if (fs.existsSync(filepath)) {
						archives[archives.length - 1].file(
							filepath,
							{name:username + '/' + FilePrefix + Task + username + '.' + ext}
						);
						found = true;
						break;
					}
				}
				if (!found) {
					channel.createMessage(
						"**[Error]** Missing File: `"+username+'.'+rf+"` (Submission `"+i+"`)."
					)
				}
			}
			submissions_in_zip++;
		}

		// upload all the zips
		channel.createMessage(`Uploading ${zips.length} zipfiles...`)
		await Promise.all(archives.map((archive, i) => {
			return archive.finalize().then(() => {
				outputs[i].close(); // ensure streams are closed
			});
		}));

		let error_sent = false
		for (const zipname of zips) {
			let stats = fs.statSync(FOLDER + zipname)
			if (stats.size >= 10e6) { // 10MB upload limit
				if (!error_sent) {
					await channel.createMessage("Error: zip filesize is too large. Reduce the number of submissions per zipfile.")
					error_sent = true // don't exit yet so it properly deletes the zip files
				}
			} else {
				await channel.createMessage("** **", {
					file: fs.readFileSync(FOLDER + zipname),
					name: zipname
				})
			}
			fs.rmSync(FOLDER + zipname)
		}
	},

	listSubmissions:{
		name: "listSubmissions",
		short_descrip: "Shows the list of current submissions",
		full_descrip: "Shows the list of users that have submitted. This will include DQ'd submissions as well as user IDs",
		hidden: true,
		function: async function(bot, msg, args){
			if (notAllowed(msg)) return
			//if (!miscfuncs.isDM(msg)) return // [AF] dont allow this in public channels
			let msgs = await SubmissionsToMessage(bot, true)
			if (msgs.length == 1) {
				return "```" + (msgs[0]) + "```"
			}
			for (const text of msgs) {
				msg.channel.createMessage("```" + text + "```")
			}
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
			info += `Auto-timing: ${AllowAutoTime ? `enabled` : `disabled`}\n`
			info += `Teams: ${TeamTask ? `enabled` : `disabled`}\n`
			try {
				var message = await bot.getMessage(Channel_ID, Message_IDs[0])
				info += `Submissions Message URL: https://discordapp.com/channels/${message.channel.guild.id}/${message.channel.id}/${message.id}\n`
			} catch (e) {
				info += `Invalid Current Submissions Message: Could not retrieve URL\n`
				Channel_ID = ""
				Message_IDs = []
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
			info += `Release Date: <t:${timestamp(ReleaseDate)}:F>\n`
			info += `Task Channel: ${TaskChannel == `` ? `\`disabled\`` : `<#${TaskChannel}>`}\n`

			info += `\n**Role Style:** \`${RoleStyle}\`\n`
			info += `Server ID: \`${Guild == `` ? ` ` : Guild}\`\n`
			info += `Submitted Role ID: \`${SubmittedRole == `` ? ` ` : SubmittedRole}\`\n`
			info += `Timed Task Role ID: \`${TimedTaskRole == `` ? ` ` : TimedTaskRole}\`\n`

			// TODO: if (info.length >= 2000) // ...

			return info
		}
	},

	setName:{
		name: "setname",
		short_descrip: "Change your name as seen in #current_submissions",
		full_descrip: "Usage: `$setname <new name here>`\nChange your name in the submissions/filenames. Spaces and special characters are allowed. Moderators are able to remove access if this command is abused. Passing no arguments will reset it to your discord id.",
		hidden: true,
		function: async function(bot, msg, args){

			var user_id = msg.author.id

			if (module.exports.hasSubmitted(user_id) && (module.exports.getSubmission(user_id).submission.namelocked || DQs.filter(user => user.id == user_id).length)) {
				return "Missing Permissions"
			}

			// change their name
			var name = args.join(" ")
			if (name.replace(/\s/g, "").length == 0) name = msg.author.username
			Nicknames[user_id] = name
			module.exports.update_name(user_id, name) // calls save()
			updateSubmissionMessage(bot)
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
				let result = await module.exports.getSubmisssionStatus(bot, msg.author.id)
				if (result[1].length) {
					dm.createMessage(result[0], result[1])
				} else {
					dm.createMessage(result[0])
				}
			} catch (e) {
				return `Something went wrong: Could not DM your submission status: ${e}`
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
				TaskMessage = msg.content.substr("$settaskmsg ".length)
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
			if (LateEntrants.filter(id => id == msg.author.id).length == 0) {
				if (!TimedTask && !AllowSubmissions) return `There is no active timed task to participate in right now`
				if (!TimedTask && AllowSubmissions) return `You don't need to use that command right now - just send in your files!`
			}
			if (!miscfuncs.isDM(msg)) return `This command can only be used in DMs`
			if (TimedTaskStatus.started.includes(msg.author.id)) return `You've already started Task ${Task}!`
			if (TimedTaskStatus.completed.includes(msg.author.id)) return `You've already completed Task ${Task}! Use \`$status\` to check your files.`

			LOG(msg.author.id, "Started Timed Task")
			TimedTaskStatus.started.push(msg.author.id)
			TimedTaskStatus.startTimes.push([msg.author.id, timestamp(new Date())])
			module.exports.save()

			module.exports.addTimeRemainingWarnings(bot, msg.channel.id)
			Announcement.DelayFunction(bot, `COMP-END ${msg.author.id}`, Hours, Minutes)
			module.exports.giveRole(bot, msg.author.id, msg.author.username, TimedTaskRole)

			// send messages
			notifyHosts(bot, `${msg.author.username} \`(${msg.author.id})\` has started Task ${Task}`, `Timer`)
			bot.createMessage(msg.channel.id, TaskMessage)
			bot.createMessage(msg.channel.id, `You have started Task ${Task}. You have ${Hours} hour${Hours == 1 ? "" : "s"} and ${Minutes} minutes to submit.`)
		}
	},

	setLateEntrants:{
		name: "setLateEntrants",
		short_descrip: "Allow entering a timed task late",
		full_descrip: "Usage: `$setLateEntrants [id1] [id2] [...]`\n\nAllow users to use `$requesttask` so long as they have not already participated. If no IDs are given, it will remove all the currently set IDs.",
		hidden: true,
		function: function(bot, msg, args) {
			if (notAllowed(msg)) return
			LateEntrants = []
			while (args.length > 0) LateEntrants.push(args.shift())
			module.exports.save()
			if (LateEntrants.length == 0) return "Late entrants are disabled"
			return "The late entrants are now set to `" + LateEntrants.join(' ') + "`"
		}
	},

	listLateEntrants:{
		name: "listLateEntrants",
		short_descrip: "list users who can enter anytime",
		full_descrip: "Lists the IDs of users who can use `$requesttask` so long as they have not already participated.",
		hidden: true,
		function: function(bot, msg, args) {
			if (notAllowed(msg)) return
			if (LateEntrants.length == 0) return "Late entrants are disabled"
			return "The late entrants are now set to `" + LateEntrants.join(' ') + "`"
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

		if (TimedTaskRole != "") {
			try {
				await bot.removeGuildMemberRole(Guild, id, TimedTaskRole, "Time's up!");
			} catch (e) {
				console.log("Could not remove role from ", user.username, user.id);
			}
		}

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
		if (user_id in Nicknames) name = Nicknames[user_id] // [AF] commented this out to ignore nicknames
		module.exports.addSubmission(user_id, name, "", 0, "", 0)
	},

	// changes the m64 of a submission
	update_m64:function(user_id, new_m64, filesize){
		var partner_id = completedTeam(user_id) ? Teams[user_id] : ""
		for (var i = 0; i < Submissions.length; i++) {
			if (Submissions[i].id == user_id || Submissions[i].id == partner_id) {
				Submissions[i].m64 = new_m64
				Submissions[i].m64_size = filesize
			}
		}
		module.exports.save()
	},

	// changes the st of a submission
	update_st:function(user_id, new_st, filesize){
		var partner_id = completedTeam(user_id) ? Teams[user_id] : ""
		for (var i = 0; i < Submissions.length; i++) {
			if (Submissions[i].id == user_id || Submissions[i].id == partner_id) {
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
	getSubmisssionStatus:async function(bot, user_id){
		if (!module.exports.hasSubmitted(user_id)) {
			var m64 = false
			var st = false
		} else {
			var submission = module.exports.getSubmission(user_id).submission
			var m64 = submission.m64.length != 0;
			var st = submission.st.length != 0;
		}
		var msg = "Submission Status: "
		// TODO: loop through REQUIRED_FILES correctly
		if (m64 && st) {
			msg += "`2/2` Submission complete\n"
			if (submission.dq) {
				msg += `**WARNING** Your run is currently disqualified!\n`
				msg += `Reason: ${submission.info}`
			} else if (submission.time != null) {
				msg += `Time: ${getTimeString(submission.time)} (${submission.time/2}f)`
				if (submission.info != ``) msg += ` ` + submission.info
			} else {
				msg += `Your run has not been timed yet.`
			}
		} else if (m64 && !st){
			msg += "`1/2` No st received."
		} else if (!m64 && st){
			msg += "`1/2` No m64 received."
		} else { // (!m64 && !st)
			msg += "`0/2` No m64 or st received."
		}
		if (completedTeam(user_id)) {
			msg += `\nTeam: ${await submissionName(bot, user_id)}`
		}
		let files = []
		if (m64 || st) {
			let filename = await submissionName(bot, submission.id, true)
			filename = module.exports.properFileName(filename)
			let filepath = Save.getSavePath() + "/Submissions/" + submission.id
			if (m64) {
				files.push({
					file: fs.readFileSync(filepath + ".m64"),
					name: filename + ".m64"
				})
			}
			if (st) {
				let st_ext = fs.existsSync(filepath + ".st") ? ".st" : ".savestate"
				files.push({
					file: fs.readFileSync(filepath + st_ext),
					name: filename + st_ext
				})
			}
		}
		return [msg, files]
	},

	// checks whether a user id is linked to a submission or not
	hasSubmitted:function(user_id){
		//console.log(`Checking if ${user_id} has submitted: ${Submissions.filter(user => (user.id == user_id) || (user_id in Teams && user.id == Teams[user_id])).length}`)
		//if (user_id in Teams && Submissions.filter(user => user.id == Teams[user_id]).length) return true // partner submitted
		return (
			Submissions.filter(
				user => (user.id == user_id) || (user_id in Teams && user.id == Teams[user_id])
			).length ||
			DQs.filter(user => user.id == user_id).length
		)
	},

	// returns the submission object and it's ID given an id
	getSubmission:function(user_id){
		var partner_id = completedTeam(user_id) ? Teams[user_id] : ""
		for (var i = 0; i < Submissions.length; i++) {
			if (Submissions[i].id == user_id || Submissions[i].id == partner_id) {
				return {submission: Submissions[i], id: i + 1}
			}
		}
		for (var i = 0; i < DQs.length; i++) {
			if (DQs[i].id == user_id || DQs[i].id == partner_id) {
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
			timed_role_id: TimedTaskRole,
			late_entrants: LateEntrants,
			hosts: Host_IDs,
			feed: SubmissionsChannel,
			channel_id: Channel_ID,
			message_ids: Message_IDs,
			submissions: Submissions,
			dqs: DQs,
			timedtask: TimedTask,
			hr: Hours,
			min: Minutes,
			taskmsg: TaskMessage,
			timedtaskstatus: TimedTaskStatus,
			taskchannel: TaskChannel,
			releasedate: ReleaseDate,
			warnings: TimeRemainingWarnings,
			roletype: RoleStyle,
			ignoredupdates: IgnoreUpdates,
			autotime: AllowAutoTime,
			nicknames: Nicknames,
			lockednames: LockedNames,
			teamtask: TeamTask,
			teams: Teams,
			namespool: NamesPool,
			namesfree: NamesFree,
			namesused: NamesUsed,
			log: COMPLOG
		}
		Save.saveObject("submissions.json", data)
	},

	// reads relevant information from submissions.json and stores it in memory
	load:function(bot){
		var data = Save.readObject("submissions.json")
		AllowSubmissions = data.acceptingSubmissions
		Task = data.task
		FilePrefix = data.fileprefix
		Guild = data.guild_id
		SubmittedRole = data.role_id
		TimedTaskRole = data.timed_role_id
		while (data.late_entrants && data.late_entrants.length > 0) LateEntrants.push(data.late_entrants.shift())
		Host_IDs = data.hosts
		SubmissionsChannel = data.feed
		Channel_ID = data.channel_id
		while (data.message_ids.length > 0) Message_IDs.push(data.message_ids.shift())
		TimedTask = data.timedtask
		Hours = data.hr
		Minutes = data.min
		TaskMessage = data.taskmsg
		TaskChannel = data.taskchannel
		ReleaseDate = parseDate(data.releasedate)
		if (ReleaseDate == null) ReleaseDate = new Date()
		TimedTaskStatus.started = []
		while (data.timedtaskstatus.started.length > 0) TimedTaskStatus.started.push(data.timedtaskstatus.started.shift())
		TimedTaskStatus.completed = []
		while (data.timedtaskstatus.completed.length > 0) TimedTaskStatus.completed.push(data.timedtaskstatus.completed.shift())
		TimedTaskStatus.startTimes = []
		while (data.timedtaskstatus.startTimes.length > 0) {
			var info = data.timedtaskstatus.startTimes.shift()
			TimedTaskStatus.startTimes.push([info[0], parseDate(info[1])])
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
		Object.keys(data.nicknames).forEach(id => {
			Nicknames[id] = data.nicknames[id]
		})
		while (data.lockednames.length) LockedNames.push(data.lockednames.pop())
		TeamTask = data.teamtask
		Object.keys(data.teams).forEach(id => {
			Teams[id] = data.teams[id]
		})
		NamesPool = []
		NamesFree = []
		NamesUsed = []
		while(data.namespool.length) NamesPool.push(data.namespool.pop())
		while(data.namesfree.length) NamesFree.push(data.namesfree.pop())
		while(data.namesused.length) NamesUsed.push(data.namesused.pop())
		COMPLOG = data.log ? data.log.slice() : []
		updateSubmissionMessage(bot)
		if (!fs.existsSync(Save.getSavePath() + "/Submissions")) { // make sure this path exists on startup
			fs.mkdirSync(Save.getSavePath() + "/Submissions")
		}
	},

	// returns a string with no special characters
	fileSafeName:function(name){
		var string = "";
		name.split('').forEach(char => {
			// dont allow special characters
			if (!["\\","/",":",'?','"','<','>','|',' ','*', "'"].includes(char)) {
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

	// gives the submitted role to a user
	giveRole:async function(bot, user_id, name, role = SubmittedRole){
		if (role == "") return
		try {
			await bot.addGuildMemberRole(Guild, user_id, role, "Submission received");
		} catch (e) {
			console.log("Could not assign role to " + name)
			notifyHosts(bot, `Failed to assign ${name} (\`${user_id}\`) a role (ID: \`${role}\`)`, `ERROR`)
		}
	},


	// this is meant to parse every message and sort submissions
	filterSubmissions:async function(bot, msg){

		if (!miscfuncs.isDM(msg)) return
		if (msg.content.startsWith("$")) return // ignore commands

		if (!msg.attachments.some(file => is_required_ext(fileExt(file)))) return // contains no required files

		if (Users.isBanned(msg.author.id)) return

		if (!AllowSubmissions && LateEntrants.filter(id => id == msg.author.id).length == 0) return bot.createMessage(msg.channel.id, `I am not accepting submissions at this time. `)

		if (DQs.filter(user => user.id == msg.author.id).length) return

		// dont let people who have finished submit when the task is released publicly
		if (TimedTaskStatus.completed.includes(msg.author.id)) {
			bot.createMessage(msg.channel.id, "Your time is up, you can no longer submit files. Thank you for participating.")
			return
		}

		if (TimedTask && !TimedTaskStatus.started.includes(msg.author.id)) return
		
		if (msg.attachments.length == 1) { // independent file, try to autotime (could be st or m64 change)
			filterFiles(bot, msg, msg.attachments[0], true)
			return
		}
		// download the files in order of priority, offset by 10s each time
		let total_files_to_download = msg.attachments.map(fileExt).filter(is_required_ext).reduce((T,t)=>T+t,0) // sum
		msg.attachments.sort((a,b) => fileExt(a).localeCompare(fileExt(b))) // hack to make sure the m64 is downloaded first (this should be faster)
		let num_files_downloaded = 0
		let set_dl_recur = function(arr) { // recursively search through required files in order
			arr.forEach(ext => {
				if (typeof ext == "string") {// compare to attachments
					msg.attachments.forEach(attachment => {
						if (fileExt(attachment) == ext) {
							setTimeout(
								// set an async call to save the file. Autotime on the last required file to download (should be st)
								// there are safeguards later for not timing a submission that doesn't have all the files
								// this safe guard is so that it doesn't time twice if someone submits both st+m64 at the same time
								() => filterFiles(bot, msg, attachment, num_files_downloaded == total_files_to_download - 1),
								10000 * num_files_downloaded
							)
							num_files_downloaded += 1
						}
					})
				} else {
					set_dl_recur(ext)
				}
			})
		}
		set_dl_recur(REQUIRED_FILES)

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

			var date = parseDate(args.join(' '))
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
			//module.exports.addTimeRemainingWarnings(bot, TaskChannel)
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

		var startdate = TimedTaskStatus.startTimes.filter(a => a[0] == msg.author.id)[0][1]
		var end = parseDate(startdate)
		end.setHours(end.getHours()+Hours)
		end.setMinutes(end.getMinutes()+Minutes)
		return `Your deadline to submit is approximately <t:${timestamp(end)}:R>`
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
		full_descrip: `Usage: \`$autotime <submission_number or 'all' or 'entry name'>\`\nAttempts to time the specified submission by playing the tas in Mupen through a timing lua script. If only 1 run is autotimed, this will disable the default time limit (runs longer than 3min can still be timed with the script through this command). This will DM participants if their time changes.\n\n**WARNING** this will respond with the time of the submission (do NOT use this in a public channel)`,
		hidden: true,
		function: async function(bot, msg, args) {
			if (notAllowed(msg)) return `Missing permissions`
			if (args.length < 1) return `Missing Argument: \`$autotime <submission_number or 'all' or 'entry name'>\``
			if (args[0] == 'all') {
				for (var i = 0; i < Submissions.length; ++i) {
					if (Submissions[i].id.substr(Submissions[i].id.length-1,Submissions[i].id.length) != '-') { // [AF] ignore retiming these
						AutoTimeEntry(bot, i, Submissions[i].id) // [AF] not by index
					}
				}
				return `All ${Submissions.length} submissions are in queue to be timed.`
			}
			var submission_number = -1
			if (isNaN(args[0])) { // attempt to look for name in submissions
				for (let i = 0; i < Submissions.length; ++i) {
					if (Submissions[i].name == args.join(' ')) {
						submission_number = i
						break
					}
				}
				if (submission_number == -1) {
					return `Invalid Argument: \`$autotime <submission_number or 'all' or 'entry name'>\``
				}
			} else {
				var submission_number = getSubmissionNumber(args[0])
				submission_number = submission_number.number - 1 // assuming non DQ since I need to rework that anyways
			}
			var pos = AutoTimeEntry(bot, submission_number, Submissions[submission_number].id, -1, msg.channel.id, msg.author.id)
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
			module.exports.save()
			notifyHosts(bot, `\`Auto-timing on submission is now ${AllowAutoTime ? `enabled` : `disabled`}\``, `Update`)
			return `Timing when a new file is received is now \`${AllowAutoTime ? 'enabled' : 'disabled'}\``
		}
	},

	GetGhost:{
		name: `GetCompGhost`,
		short_descrip: `Get a submission ghost file`,
		full_descrip: `Usage: \`$getcompghost [submission_number or 'all']\`\nReturns the ghost data file for a competition submission. If \`all\` is specified, it will send a zip all of the ghost data at once. Note: competition hosts can request data for any submission, and anyone can request their own ghost.`,
		hidden: true,
		function: async function(bot, msg, args) {

			// on_success is a callback is sent the filename of the ghost (properly named to match competition standards)
			// the file exists as LUAPATH + "tmp.ghost"
			let getghost = async function(submission_id, on_success, get_ghost_name) {
				if (get_ghost_name == null) get_ghost_name = true;
				try {
					var dm = await bot.getDMChannel(msg.author.id)
				} catch (e) {
					return `Cannot send DM. No ghost data will be generated: ${e}`
				}

				let filepath = Save.getSavePath() + "/Submissions/" + Submissions[submission_id].id
				let st_ext = fs.existsSync(filepath+".st") ? ".st" : ".savestate"

				const lua_args = ["lua", ...Mupen.lua_scripts(), LUAPATH + "ghost.lua"]
				const args = ["-m64", filepath + ".m64", "--close-on-movie-end", lua_args]
				
				let queue_position = Mupen.Process(
					bot,
					filepath + ".m64",
					filepath + st_ext,
					args,
					() => {
						if (fs.existsSync(LUAPATH + "tmp.ghost")) fs.unlinkSync(LUAPATH + "tmp.ghost")
					},
					async (TLE, MISMATCH_SETTINGS) => {
						let result = ""
						if (TLE) {
							result = `Error: Your TAS exceeded the time limit. Ghost data must be retrieved manually.`
						} else if (MISMATCH_SETTINGS) {
							result = `Error: Your TAS cannot be played back. Please ensure it has only 1 controller with rumblepak disabled. Ghost data must be retrieved manually.`
						} else if (fs.existsSync(LUAPATH + "error.txt")) {
							result = fs.readFileSync(LUAPATH + "error.txt").toString() + "\nGhost data must be retrieved manually."
							fs.unlinkSync(LUAPATH + "error.txt")
						} else if (!fs.existsSync(LUAPATH + "tmp.ghost")) {
							result = `Error: something went wrong, could not produce ghost data for #${submission_id}.`
						} else {
							if (get_ghost_name) {
								return await on_success(await submissionName(bot, Submissions[submission_id].id))
							}
							return await on_success()
						}
						dm.createMessage(result).catch(console.log)
					},
					dm.id,
					msg.author.id,
					3*60*30, // same as AutoTime
					true // local files
				)
				return `Ghost data will be sent in DMs. Position in queue: ${queue_position}`
			}

			let dm_ghost_data = async function(ghost_data_filename) {
				try {
					let dm = await bot.getDMChannel(msg.author.id)
					await dm.createMessage(
						"Here is your ghost data:", 
						{
							file: fs.readFileSync(LUAPATH + "tmp.ghost"),
							name: ghost_data_filename + ".ghost"
						}
					).then(
						fs.unlinkSync(LUAPATH + "tmp.ghost")
					).catch(console.log)
				} catch (e) {
					console.log(`Failed to send DM after getting ghost: ${e}`)
				}
			}

			if (notAllowed(msg)) { // normal users can request their own ghost
				let allowed_number = Submissions.findIndex(s => s.id == msg.author.id)
				if (allowed_number == -1) {
					return `You do not have a submission to get ghost data for!`
				} else if (args.length > 0 && args[1] != allowed_number.toString()) {
					return `You can only request the ghost data for your own run. Please use \`$getghost ${allowed_number}\``
				}
				return await getghost(allowed_number, dm_ghost_data)
			}

			// hosts can request any ghost
			if (args.length && args[0] == "all") {
				let submissions_per_zip = -1
				if (args.length > 1 && !isNaN(args[1])) {
					submissions_per_zip = Number(args[1])
				}
				for (let i = 0; i < Submissions.length; ++i) {
					let move_ghost = async () => {
						let filepath = Save.getSavePath() + "/Submissions/" + Submissions[i].id + ".ghost"
						if (fs.existsSync(filepath)) {
							fs.unlinkSync(filepath)
						}
						fs.renameSync(LUAPATH + "tmp.ghost", filepath)
						if (i == Submissions.length - 1) { // last one uploads the zips
							try {
								let dm = await bot.getDMChannel(msg.author.id)
								module.exports.getAllSubmissions(bot, dm, submissions_per_zip, ["ghost"])
							} catch (e) {
								console.log(`[ERROR] Fail to not upload zips: ${e}`)
							}
						}
					}
					await getghost(i, move_ghost, false) // queue everything
				}
				return `Generating ghost data for all ${Submissions.length} submissions. Data will be sent in DMs.`
			}

			// individual ghosts
			let ghost_submission_index = -1
			if (args.length == 0) { // shortcut request their own ghost
				ghost_submission_index = Submissions.findIndex(s => s.id == msg.author.id)
			} else if (isNaN(args[0])) {
				return `Invalid argument: \`$getghost <submission_number or 'all'>\``
			} else {
				ghost_submission_index = Number(args[0]) - 1
			}

			if (ghost_submission_index < 0 || Submissions.length <= ghost_submission_index) {
				return `Invalid argument: 1 <= \`submission_number\` < ${Submissions.length}`
			}
			return await getghost(ghost_submission_index, dm_ghost_data)
		}
	},

	GetResults:{
		name: `GetResults`,
		short_descrip: `Get the results for the task`,
		full_descrip: `Usage: \`$getresults [num_bold] [header]\`\nGets the results for a task. \`num_bold\` is the number of players who will be highlighted in the results. Header adds a line "Task X Results" at the top. This uses the information provided from \`$settime\`. And produces the format: 1. Name Ti"me info, DQ: name (reason). If anyone's time has not been added to the database, they will be put at the top of the list. `,
		hidden: true,
		function:async function(bot, msg, args) {
			if (notAllowed(msg)) return

			var num_bold = 0
			if (args.length > 0 && !isNaN(args[0])) num_bold = args[0]

			var result = (args.length > 1 && Boolean(args[1])) ? `**__Task ${Task} Results:__**\n` : ""

			var untimed = [...Submissions].filter(a => a.time == null)
			var dqs = [...Submissions].filter(a => a.dq)
			var timed = [...Submissions].filter(a => !a.dq && a.time != null && !a.id.endsWith('-')).sort((a,b) => a.time - b.time)

			var ordinal_suffix = function(n) {
				if ((n % 100) in {11:1, 12:1, 13:1}) {
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

			var placements = []
			timed.forEach((s, i) => {
				if (i == 0 || s.time > timed[i-1].time) {
					placements.push(i+1)
				} else {
					placements.push(placements[i-1])
				}
			})

			for (var i = 0; i < timed.length; i++) {
				var line = `${placements[i]}${ordinal_suffix(placements[i])}. `
				line += `${await submissionName(bot, timed[i].id)} ${getTimeString(timed[i].time)} ${timed[i].info}`.trim()
				if (placements[i] <= num_bold) line = `**${line}**`
				result += line + `\n`
			}
			result += `\n`
			dqs.forEach(dq => { // may need to use a for loop here as well to get proper name (if a team DQs)
				result += `\nDQ: ${dq.name} ${dq.time ? getTimeString(dq.time) + ' ' : ''}[${dq.info}]`
			})
			result += `\n**Untimed Runs:**\n`
			untimed.forEach(s => {
				result += `\n${s.name}`
			})

			bot.createMessage(msg.channel.id, `Task ${Task} Results:`, {
				file: Buffer.from(result),
				name: `SPOILER_TASCompetitionTask${Task}Results.txt`
			})
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
	},
	
	broadcast:{
		name: `broadcast`,
		aliases: [],
		short_descrip: `send a message to entrants`,
		full_descrip: "Usage: `$broadcast <msg...>`\nSend a message to everyone who currently has a submission in the ongoing TAS competition. Even if submissions are not being accepted, this will send a message to any recorded submissions.",
		hidden: true,
		function:function(bot, msg, args) {
			return // untested
			if (notAllowed(msg)) return
			if (args.length == 0) return `Error: No message provided.`
			if (Submissions.length == 0) return `Error: there are no entrants to send the message to`
			async function send_msg(submission) {
				try {
					var dm = await bot.getDMChannel(submission.id)
					dm.createMessage(' '.join(args))
				} catch (e) {
					bot.createMessage(msg.channel.id, `Failed to broadcast message to <@${submission.id}> (${submission.id})`)
				}
			}
			Submissions.forEach(send_msg)
			return "The following message is being sent to all entrants: ```" + (' '.join(args)) + "```"
		}
	},
	// I should move some functions from m64_editor.js to save.js because they are applicable here too for saving the file
	updateTimingScript:{
		name: `UpdateTimingScript`,
		aliases: [`UpdateConditions`, `UpdateTimingLua`],
		short_descrip: `Change the conditions.lua file`,
		full_descrip: `Usage: \`$UpdateTimingScript <.lua attachment>\`\nThis will replace the \`Conditions.lua\` file that is run with the timing script (for automatically timing competition submissions). To retime the current submissions, use \`$autotime all\`.`,
		hidden: true,
		function:function(bot, msg, args) {
			if (notAllowed(msg)) return
			var lua_files = msg.attachments.filter(a => a.filename.substr(-4).toLowerCase() == `.lua`)
			if (lua_files.length == 0) return `Missing Argument: \`$UpdateTimingScript <.lua attachment>\``
			downloadAndRun(lua_files[0], () => {
				fs.rename(process.cwd()+save.getSavePath().substring(1)+'\\'+lua_files[0].filename, LUAPATH + `Conditions.lua`, (err) => {
					bot.createMessage(msg.channel.id, err ? `Error moving file: \`\`\`${err}\`\`\`` : `Successfully uploaded \`Conditions.lua\``)
					notifyHosts(bot, `\`Conditions.lua\` has been updated by ${msg.author.username}`)
				})
			})
		}
	},

	toggleTeamTask:{
		name: `ToggleTeamTask`,
		aliases: [`ToggleCoopTask`, `ToggleTeams`],
		short_descrip: `ennable/disable co-op task`,
		full_descrip: `Usage: \`$toggleteamtask\`. Allows competitors to team up and submit together.`,
		hidden: true,
		function:function(bot, msg, args) {
			if (notAllowed(msg)) return
			TeamTask = !TeamTask
			module.exports.save()
			notifyHosts(bot, `\`Teams are now ${TeamTask ? `enabled` : `disabled`}\``, `Update`)
			return `Teams are now \`${TeamTask ? 'enabled' : 'disabled'}\` for the current task`
		}
	},

	setTeam:{
		name: `SetTeam`,
		aliases: [`SetTeammate`, `SetPartner`],
		short_descrip: `Choose your partner for co-op tasks`,
		full_descrip: `Usage: \`$setteam <mention/user_id>\`\nThis selects your partner for co-op tasks. Both people in the team need to use this command to finalize the team. You and your teammate will both be notified when either of you submits a new file.`,
		hidden: true,
		function:async function(bot, msg, args) {
			if (!TeamTask) return `Teams are currently disabled`

			var team_previously_complete = completedTeam(msg.author.id)

			if (team_previously_complete && module.exports.hasSubmitted(msg.author.id)) {
				return `You cannot change your teammate after submitting as a team.`
			}
			
			var partner = null
			if (msg.mentions.length) partner = msg.mentions[0]
			if (partner == null && args.length) partner = await Users.getUser(bot, args[0])
			if (partner && partner.id == msg.author.id) return `You're always in a team with yourself!`
			
			if (team_previously_complete && (partner == null || Teams[msg.author.id] != partner.id)) { // changed team
				delete Teams[[msg.author.id, Teams[msg.author.id]]] // remove old team name if it exists
				delete Teams[[Teams[msg.author.id], msg.author.id]]
				try {
					var old_partner_dm = await bot.getDMChannel(Teams[msg.author.id])
					old_partner_dm.createMessage(msg.author.username + ` has removed you as their partner`)
				} catch (error) {
					bot.createMessage(msg.channel.id, `**Warning:** could not notify previously set partner (\`${Teams[msg.author.id]}\`) of this change.`)
				}

			} else if (partner == null) {
				return `Missing Arguments: No mention or user_id detected`

			} else if (!team_previously_complete && Teams[partner.id] == msg.author.id) { // just completed the team
				try {
					var partner_dm = await bot.getDMChannel(partner.id)
					partner_dm.createMessage(msg.author.username + ` has confirmed your team`)
				} catch (error) {
					bot.createMessage(msg.channel.id, `**Warning:** could not notify partner (\`${partner.id}\`) that your team is confirmed.`)
				}
			}

			if (partner == null) { // update teams
				delete Teams[msg.author.id]
			} else {
				Teams[msg.author.id] = partner.id
			}
			module.exports.save()

			if (!team_previously_complete) { 
				if (partner == null) {
					return `You are no longer teaming with anyone.`
				} else if (Teams[partner.id] == msg.author.id) {
					return `Your team is now complete! You and ` + partner.username + ` are set to team.`
				}
			}
			return `You have set your partner to ` + partner.username + `. To complete your team, they must add you as their teammate.`
		}
	},

	setTeamName:{
		name: `SetTeamName`,
		aliases: [],
		short_descrip: `Choose your team name for co-op tasks`,
		full_descrip: `Usage: \`$setteamname <team name>\`\nSet your team name for co-op tasks! Either partner can use this command. Your partner will be notified of the change.`,
		hidden: true,
		function:async function(bot, msg, args) {
			if (!completedTeam(msg.author.id)) return `You are not part of a team.`
			if (args.length == 0) {
				delete Teams[[msg.author.id, Teams[msg.author.id]]]
				delete Teams[[Teams[msg.author.id], msg.author.id]]
			} else {
				Teams[[msg.author.id, Teams[msg.author.id]]] = args.join(' ')
				Teams[[Teams[msg.author.id], msg.author.id]] = args.join(' ')
			}
			updateSubmissionMessage(bot)
			module.exports.save()
			try {
				var partner_dm = await bot.getDMChannel(Teams[msg.author.id])
				partner_dm.createMessage(`Your partner has updated your team name to \`${args.join(' ')}\``)
			} catch (error) {
				bot.createMessage(msg.channel.id, `Failed to notify partner of team name change`)
			}
			if (args.length == 0) return `Your team name has been removed`
			return `Your team name has been set to \`${args.join(' ')}\``
		}
	},

	getlog:{
		name: `GetCompLog`,
		aliases: [],
		short_descrip: "See log file",
		full_descrip: "Usage: \`$getcomplog\`\nReturns a text file containing a log of various competition-related actions. Each line will have a timestamp, user_id, and an action description.",
		hidden: true,
		function:async function(bot, msg, args) {
			if (notAllowed(msg)) return
			let result = ""
			COMPLOG.map(data => {
				result += data.join(' ') + '\n'
			})
			msg.channel.createMessage(
				"Here is the competition log:", 
				{file: Buffer.from(result), name: "SPOILER_complog.txt"})
		}
	}
}
