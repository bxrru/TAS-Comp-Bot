const users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const chrono = require("chrono-node")
const save = require("./save.js")

var Announcements = [] // {id, channel, interval, time, message, user}
var Timers = [] // {id, timer}

// delays for repeated announcements
var Delays = {
    once: 0,
		daily: 86400000,
    weekly: 604800000,
    biweekly: 1209600000
}

module.exports = {

	AddAnnouncement:{
		name: "acadd",
		short_descrip: "Add an accouncement",
		full_descrip: "Sets a message that will automatically be sent to the specified channel at the given time and date. Usage: `$acadd <channel> <interval> \"message\" date and time`. To use quotations within the announcement type \`\\\"\`. Otherwise, everything between the first two quotations will be used. Everything after the last quotation will be interpreted as a time and date. To see a list of intervals use `$acinterval`",
		hidden: true,
		function: async function(bot, msg, args){

			if (!users.hasCmdAccess(msg)) return

			if (args.length < 4)
				return `Missing Arguments: \`$addac <channel> <interval> "message" date and time\``

			if (Delays[args[1]] === undefined)
				return "Unknown interval. For a list of supported intervals use `$acinterval`"

			var text = args.slice(2, args.length).join(' ')
			var text = module.exports.getMessage(text)

			if (text[1].length == 0)
				return `No time or date specified: \`$addac <channel> <interval> "message" date and time\``
			var date = chrono.parseDate(text[1])

			var announcement = {
				id: Announcements.length,
				channel: miscfuncs.getChannelID(args[0]),
				interval: Delays[args[1]],
				time: `${date}`,
				message: text[0],
				user: msg.author
			}

			var now = new Date()
			var delay = date - now

			if (delay < 0)
				return "Specified time has already passed."

			Announcements.push(announcement)
			module.exports.SetAnnouncement(bot, announcement, delay)
			module.exports.save()

			return `Announcement Added (ID: ${announcement.id}). For a list of announcements use $aclist`

		}
	},

	// getMessage(`test "Please say \\\"Hello\\\"" everything else`)
	// = [`Please say "Hello"`, ` everything else`]
	getMessage: function(text){
		var result = [``, ``]
		var counter = 0
		text = text.split('')

		for (var i = 0; i<text.length; i++){

			if (counter == 0 && text[i] == `"`) {
				counter++

			} else if (counter == 1) {
				if (text[i] == `\\` && i < (text.length - 1) && text[i+1] == `"`){
					i++
					result[0] += text[i]
				} else if (text[i] == `"`) {
					counter++
				} else {
					result[0] += text[i]
				}

			} else if (counter == 2){
				result[1] += text[i]
			}
		}

		return result

	},

	// Sets the initial Timout for the announcement and adds it to the list of Timers
	SetAnnouncement:function(bot, announcement, delay){
		var timer = {
			id: announcement.id,
			timer: setTimeout(async() => {
				await module.exports.SendAnnouncement(bot, announcement) // send message
				module.exports.LoopAnnouncement(bot, announcement) // repeat announcement
			}, delay)
		}
		Timers.push(timer)
	},

	// Sends a message
	SendAnnouncement:async function(bot, announcement){

		try {
			// try to send the announcement
			await bot.createMessage(announcement.channel, {content: announcement.message, disableEveryone: false})
		} catch (e) {
			// log any error
			console.log(`Failed Announcement #${announcement.id}\n${e}`)
			announcement.interval = 0 // remove it
			try {
				// try to notify the user that it failed
				var dm = await bot.getDMChannel(announcement.user.id)
				dm.createMessage(`Failed Announcement #${announcement.id}\n\`\`\`${e}\`\`\``)
			} catch (e2) {
				// log if that fails
				console.log(`Could not notify user: ${announcement.user.username} (${announcement.user.id})\n${e2}`)
			}
		}

	},

	LoopAnnouncement:function(bot, announcement){

		// remove a one time announcement
		if (announcement.interval == 0){
			module.exports.RemoveAnnouncement(announcement.id)

		} else {

			for (var i = 0; i<Timers.length; i++){

				if (Timers[i].id == announcement.id){

					// clear the current one
					clearTimeout(Timers[i].timer)

					// set an interval to loop
					Timers[i].timer = setInterval(async() => {
						await module.exports.SendAnnouncement(bot, announcement)
					}, announcement.interval)

				}
			}
		}

		module.exports.save()

	},

	// returns the removed announcement given it's ID
	RemoveAnnouncement:function(id){
		// remove the Timer
		for (var i = 0; i<Timers.length; i++){
			if (Timers[i].id == id){
				clearTimeout(Timers[i].timer)
				Timers.pop(i)
			}
		}

		// remove the Announcement
		for (var i = 0; i<Announcements.length; i++){
			if (Announcements[i].id == id)
				return Announcements.pop(i)
		}

		// not found
		return null
	},

	save:function(){
		save.saveObject("announcements.json", Announcements)
	},

	load:async function(bot){
		var data = save.readObject("announcements.json")

		var recoverAnnouncement = async function(announcement){
			var date = chrono.parseDate(announcement.time)
			var now = new Date()
			var delay = date - now

			if (delay < 0 && announcement.interval == 0){

				console.log("Announcement Missed", announcement)

				try { // message the user to tell them that the announcement was missed
					var dm = await bot.getDMChannel(announcement.user.id)
					dm.createMessage(`Announcement Missed \`\`\`Channel: ${announcement.channel}\nTime: ${announcement.time}\nMessage: ${announcement.message}\`\`\``)
				} catch (e) {
					console.log(`Failed to notify user ${announcement.user.username} (${announcement.user.id})`)
				}

			} else {
				// if it passed but happens regularly, shift it to the next time
				while (delay < 0) delay += announcement.interval
				module.exports.SetAnnouncement(bot, announcement, delay)
				Announcements.push(announcement) // save it in memory
			}

		}

		await data.forEach(async(a) => await recoverAnnouncement(a))
		module.exports.save() // in case any announcements were skipped

	},

	AnnouncementInfo:{
		name: "acinfo",
		short_descrip: "Gets info about an announcement",
		full_descrip: "Usage: \`$acinfo <id>\`. For a list of announcement IDs, use $aclist",
		hidden: true,
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			if (Announcements.length == 0) return `No scheduled announcements at this time.`
			if (args.length == 0) return "Missing Arguments: \`$acinfo <id>\`"

			var result = ""

			Announcements.forEach(a => {

				if (a.id == args[0]){

					result += `\`\`\`Announcement Info (ID ${a.id})\n`
					result += `\tadded by: ${a.user.username} (${a.user.id})\n`
					result += `\tchannel: #${bot.getChannel(a.channel).name} (${a.channel})\n`
					result += `\tinterval: ${a.interval} `
					result += a.interval == 0 ? `(Once)\n` : `ms (repeated)\n`
					result += `\ttime: ${a.time}\n`
					result += `\tmessage: ${a.message}`

					// make sure it fits in a discord message
					if (result.length > 2000 - 7){
						while (result.length > 2000 - 7) result = result.substr(0, result.length-1)
						result += "..."
					}

					result += "```"
				}
			})

			return result.length == 0 ? `ID \`${args[0]}\` Not Found. For a list of announcement IDs, use $aclist` : result
		}
	},

	AnnouncementList:{
		name: "aclist",
		short_descrip: "Lists all the announcements",
		full_descrip: "Lists some information about scheduled announcements. Usage: \`$aclist [page]\`. For more information on a specific announcement, use $acinfo",
		hidden: true,
		function:function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			if (Announcements.length == 0) return `No scheduled announcements at this time.`

			var result = [`\`\`\`ID | Message Preview | Channel\n`, ``]

			var PreviewLength = 50

			Announcements.forEach(a => {
				var entry = `${a.id} | `
				entry += `${a.message.substr(0,PreviewLength) + (a.message.length < PreviewLength ? "" : "...")} | `
				entry += `#${bot.getChannel(a.channel).name}\n`

				// only guarantees support for up to 99 pages of entries (Page AB/XY)
				// any more and this could potentially pass the discord character limit by 2 ("Page ABC/XYZ")
				if (result[0].length + entry.length + result[result.length-1] + "```Page AB/XY".length > 2000){
					result[result.length-1] += entry

				} else { // message too big, add another page
					result.push(entry)
				}
			})

			var page = 1
			if (args.length > 0 && !isNaN(args[0]) && result[Number(args[0])] != undefined)
				page = Number(args[0])

			return `${result[0]}${result[page]}\`\`\`Page ${page}/${result.length-1}`
		}
	},

	ClearAnnouncement:{
		name: "acclear", // acdelete, acremove
		short_descrip: "Remove an announcement",
		full_descrip: "Unschedules a planned announcement given its ID. The person who added the announcement will be notified. For a list of announcement IDs, use $aclist",
		hidden: true,
		function: async function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			if (Announcements.length == 0) return `No scheduled announcements at this time.`
			if (args.length == 0) return "Missing Arguments: \`$acclear <id>\`"

			var a = module.exports.RemoveAnnouncement(args[0])

			if (a == null) return `ID \`${args[0]}\` Not Found. For a list of announcement IDs, use $aclist`

			module.exports.save()

			var result = `Announcement Removed by ${msg.author.username} (${msg.author.id})`
			result += `\`\`\`Announcement Info (ID ${a.id})\n`
			result += `\tadded by: ${a.user.username} (${a.user.id})\n`
			result += `\tchannel: #${bot.getChannel(a.channel).name} (${a.channel})\n`
			result += `\tinterval: ${a.interval} `
			result += a.interval == 0 ? `(Once)\n` : `ms (repeated)\n`
			result += `\ttime: ${a.time}\n`
			result += `\tmessage: ${a.message}`
			if (result.length > 2000 - 7){
				while (result.length > 2000 - 7) result = result.substr(0, result.length-1)
				result += "..."
			}
			result += "```"

			console.log(result)

			// DM the person who added the announcement
			try {
				var dm = await bot.getDMChannel(a.user.id)
				dm.createMessage(result)
			} catch (e) {
				console.log(`Failed to notify ${a.user.username} (${a.user.id})`)
			}

			return result

		}
	},

	ListIntervals:{
		name: "acinterval",
		short_descrip: "List the supported announcement intervals",
		full_descrip: "Shows the different interval keywords that can be used when adding an announcement, and how long (in ms) before the announcement will be sent again.",
		hidden: true,
		function: function(bot, msg, args){
			if (!users.hasCmdAccess(msg)) return

			var result = "Currently supported intervals are:\n"
			Object.keys(Delays).forEach(k => {
				result += `\t${k}: ${Delays[k]}\n`
			})

			return result
		}
	},

	CommandInfo:function(){
		var msg = "**CompBot** - Announcement Module\n"
		msg += "\n**Announcement Commands:**\n"

		var cmds = [
			module.exports.AddAnnouncement,
			module.exports.ClearAnnouncement,
			module.exports.AnnouncementInfo,
			module.exports.AnnouncementList,
			module.exports.ListIntervals
		]

		cmds.forEach(obj => {
				msg += `\t**${obj.name}** - ${obj.short_descrip}\n`
		})

		msg += "\nType $help <command> for more info on a command."
		return msg
	}

}
