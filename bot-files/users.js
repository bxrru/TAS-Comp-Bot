const Save = require("./save.js")
const XANDER = "129045481387982848"
Bans = []
Admin = {
	users: [],
	channels: []
}

module.exports = {
	load:function(){
		Admin = Save.readObject("admin.json")
		Bans = Save.readObject("bans.json")
		if (Admin == null) Admin = {users:[],channels:[]}
		if (Bans == null) Bans = []
	},

	addCmdAccessUser:function(user_id){
		if (Admin.users.filter(id=>id==user_id).length) return
		Admin.users.push(user_id)
		Save.saveObject("admin.json", Admin)
	},

	addCmdAccessChannel:function(channel_id){
		if (Admin.channels.filter(id=>id==channel_id).length) return
		Admin.channels.push(channel_id)
		Save.saveObject("admin.json", Admin)
	},

	removeCmdAccessUser:function(user_id){
		Admin.users = Admin.users.filter(id => id != user_id)
		Save.saveObject("admin.json", Admin)
	},

	removeCmdAccessChannel:function(channel_id){
		Admin.channels = Admin.channels.filter(id => id != channel_id)
		Save.saveObject("admin.json", Admin)
	},

	hasCmdAccess:function(message){
		return message.author.id == XANDER || Admin.users.includes(message.author.id) || Admin.channels.includes(message.channel.id)
	},

	// COMMAND returns a list of names with IDs and channel mentions that have command access
	listAccessCMD:async function(bot, msg, args){
		if (!module.exports.hasCmdAccess(msg)) return

		var result = `**Users:**\n`
		for (const id of Admin.users) {
			var user = await module.exports.getUser(bot, id)
			result += `${user.username} \`(${id})\`\n`
		}

		result += "**Channels:**\n"
		Admin.channels.forEach(id => {
			result += `<#${id}>\n`
		})

		return result
	},

	// COMMAND allows a user or every message from a channel to use every commands
	addCmdAccessCMD:function(bot, msg, args){
		if (!module.exports.hasCmdAccess(msg)) return

		if (args.length && !msg.channelMentions.length && !msg.mentions.length)
			return "Incorrect Usage: `$addCmdAccess [@user, #channel...]`"

		var result = `Command access given to: `

		if (args.length == 0){ // add current channel
			module.exports.addCmdAccessChannel(msg.channel.id)
			result += `<#${msg.channel.id}> `
		}

		msg.channelMentions.forEach(id => {
			module.exports.addCmdAccessChannel(msg.channel.id)
			result += `<#${id}> `
		})

		msg.mentions.forEach(user => {
			module.exports.addCmdAccessUser(user.id)
			result += `<@${user.id}> `
		})

		return result

	},

	// COMMAND that removes a user's or channel's access to every command
	removeCmdAccessCMD:function(bot, msg, args){
		if (!module.exports.hasCmdAccess(msg)) return

		if (args.length && !msg.channelMentions.length && !msg.mentions.length)
			return "Incorrect Usage: `$addCmdAccess [@user, #channel...]`"

		var result = `Command access removed from: `

		if (args.length == 0){ // add current channel
			module.exports.removeCmdAccessChannel(msg.channel.id)
			result += `<#${msg.channel.id}> `
		}

		msg.channelMentions.forEach(id => {
			module.exports.removeCmdAccessChannel(msg.channel.id)
			result += `<#${id}> `
		})

		msg.mentions.forEach(user => {
			module.exports.removeCmdAccessUser(user.id)
			result += `<@${user.id}> `
		})

		return result
	},

	getUser:async function(bot, user_id){
		try {
			var self = await bot.getSelf()
			if (self.id == user_id) return self
			var dm = await bot.getDMChannel(user_id)
			return dm.recipient
		} catch (error) {
			console.log(error)
			return null
		}
	},

	addBan:function(user_id){
		if (!Bans.includes(user_id)) Bans.push(user_id)
		Save.saveObject("bans.json", Bans)
	},

	removeBan:function(user_id){
		Bans = Bans.filter(id => id != user_id)
		Save.saveObject("bans.json", Bans)
	},

	isBanned:function(user_id){
		return Bans.includes(user_id)
	},

	// COMMAND shows the current list of banned users with their ids
	listBansCMD:async function(bot, msg, args){
		if (!module.exports.hasCmdAccess(msg)) return
		if (Bans.length == 0) return "There are no banned users"
		var message = "Banned Users:\n"
		for (const id of Bans){
			var user = await module.exports.getUser(bot, id)
			message += user == null ? `NULL \`(${id})\`\n` : `${user.username} \`(${id})\`\n` //
		}
		return message
	},

	// COMMAND bans a user from the competition. DMs them if possible
	BanCMD:async function(bot, msg, args){
		if (!module.exports.hasCmdAccess(msg)) return

		if (args.length == 0) return "Not Enough Arguments: `<user_id or @user> [reason]`>"

		// use mention if the message contains one
		var id = msg.mentions.length ? msg.mentions[0].id : args[0]

		// if the mention isnt the first argument, assume the first argument is the id
		// this is in case an @mention is used in the reason
		if (msg.mentions.length && `<@${id}}>` == args[0]) id = args[0]

		var user = await module.exports.getUser(bot, id)
		if (user == null) return `User ID \`${id}\` Not Recognized`

		if (Bans.includes(id)) return `${user.username} \`(${id})\` is already banned`
		module.exports.addBan(id)

		args.shift()
		var reason = args.length ? "Provided Reason: " + args.join(" ") : "No reason has been provided"

		var result = `${user.username} \`(${id})\` has been banned from the competition. `
		try {
			var dm = await bot.getDMChannel(id)
			dm.createMessage(`You have been banned from the TAS Competition. Submissions you send in will no longer be accepted. ${reason}`)
		} catch (e) {
			result += `Failed to notify user. `

		} finally {
			return `${result}[banned by ${msg.author.username}]`
		}

	},

	// COMMAND
	unbanCMD:async function(bot, msg, args){
		if (!module.exports.hasCmdAccess(msg)) return

		if (args.length == 0) return "Not Enough Arguments: `<user_id or @user>`>"

		var id = msg.mentions.length ? msg.mentions[0].id : args[0]

		var user = await module.exports.getUser(bot, id)
		if (user == null) return `User ID \`${id}\` Not Recognized`
		module.exports.removeBan(id)

		var result = `${user.username} \`(${id})\` has been unbanned from the competition. `
		try {
			var dm = await bot.getDMChannel(id)
			dm.createMessage(`You are no longer banned from the TAS Competition. Submissions you send in will now be accepted`)
		} catch (e) {
			result +=  `Failed to notify user. `

		} finally {
			return `${result}[unbanned by ${msg.author.username}]`
		}

	},

	commandInfo:function(){
		var msg = "**CompBot** - User Module\n"

		msg += "\n**User Commands:**\n"
		msg += "\t**addCmdAccess** - Gives permissions to use commands\n"
		msg += "\t**removeCmdAccess** - Removes permissions to use commands\n"
		msg += "\t**listAccess** - List the users and channels with command access\n"
		msg += "\n"

		msg += "\t**ban** - Bans a user\n"
		msg += "\t**unban** - Unbans a user\n"
		msg += "\t**listbans** - List the banned users\n"

		msg += "\nType $help <command> for more info on a command."
		return msg
	}
};
