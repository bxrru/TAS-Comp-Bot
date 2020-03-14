const Save = require("./save.js")
const XANDER = "129045481387982848"
Bans = []
Admin = {
	users: [],
	channels: []
}

module.exports = {
	name: "Users",
	short_name: "mod",
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
		return message.author.id == XANDER || Admin.users.includes(message.author.id) || Admin.channels.includes(message.channel.id) || message.author == "BOT"
	},

	// COMMAND returns a list of names with IDs and channel mentions that have command access
	listAccessCMD:{
		name: "listAccess",
		short_descrip: "List the users and channels with command access",
		full_descrip: "Every command may be used by the people listed and from the channels listed. To give access or remove it use `$addCmdAccess` or `$removeCmdAccess` respectively",
		hidden: true,
		function: async function(bot, msg, args){
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
		}
	},

	// COMMAND allows a user or every message from a channel to use every commands
	addCmdAccessCMD:{
		name: "addCommandAccess",
		aliases: ["addCmdAccess"],
		short_descrip: "Gives permissions to use commands",
		full_descrip: "Usage: `$addCmdAccess [@user, #channel, <id>...]`\nDefaults to the channel the message was sent in. It will give access to any users or channels mentioned in the command. If an ID is given it will give access to the appropriate user or channel.",
		hidden: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

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

			args.forEach(async(id) => {
				if (!id.startsWith('<')) {

					var user = await module.exports.getUser(bot, id) // try to get a user
					if (user != null) {
						module.exports.addCmdAccessUser(user.id)
						result += `<@${user.id}> `

					} else {
						var channel = await bot.getChannel(id) // try to get a channel
						if (channel != undefined) {
							module.exports.addCmdAccessChannel(channel.id)
							result += `<#${id}> `
						}
					} // otherwise ignore
				}
			})

			return result
		}
	},

	// COMMAND that removes a user's or channel's access to every command
	removeCmdAccessCMD:{
		name: "removeCommandAccess",
		aliases: ["removeCmdAccess"],
		short_descrip: "Removes permissions to use commands",
		full_descrip: "Usage: `$removeCmdAccess [@user, #channel, <id>...]`\nDefaults to the channel the message was sent in. It will give access to any users or channels mentioned in the command",
		hidden: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			var result = `Command access removed from: `

			if (args.length == 0){ // remove current channel
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

			args.forEach(async(id) => {
				if (!id.startsWith('<')) { // look at non-mentions

					var user = await module.exports.getUser(bot, id) // try to get a user
					if (user != null) {
						module.exports.removeCmdAccessUser(user.id)
						result += `<@${user.id}> `

					} else {
						var channel = await bot.getChannel(id) // try to get a channel
						if (channel != undefined) {
							module.exports.removeCmdAccessChannel(channel.id)
							result += `<#${id}> `
						}
					} // otherwise ignore
				}
			})

			return result
		}
	},

	getUser:async function(bot, user_id){
		try {
			var self = await bot.getSelf()
			if (self.id == user_id) return self
			var dm = await bot.getDMChannel(user_id)
			return dm.recipient
		} catch (error) {
			//console.log(error)
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
	listBansCMD:{
		name: "listBans",
		short_descrip: "List the banned users",
		full_descrip: "Users listed are not allowed to submit to the competition. To add a ban or remove one use `$ban` or `$unban` respectively",
		hidden: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return
			if (Bans.length == 0) return "There are no banned users"
			var message = "Banned Users:\n"
			for (const id of Bans){
				var user = await module.exports.getUser(bot, id)
				message += user == null ? `NULL \`(${id})\`\n` : `${user.username} \`(${id})\`\n` //
			}
			return message
		}
	},

	// COMMAND bans a user from the competition. DMs them if possible
	BanCMD:{
		name: "ban",
		short_descrip: "Bans a user",
		full_descrip: "Usage: `$ban <@user or user_id> [reason]`\nPrevents the specified user from interacting with this bot. This will DM the user being banned. To see the current list of banned users use `$listbans`",
		hidden: true, custom: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id or @user> [reason]`>"

			// use mention if the message contains one
			var id = msg.mentions.length ? msg.mentions[0].id : args[0]

			// if the mention isnt the first argument, assume the first argument is the id
			// this is in case an @mention is used in the reason
			if (msg.mentions.length && `<@${id}}>` == args[0]) id = args[0]

			var user = await module.exports.getUser(bot, id)
			if (user === null) return `User ID \`${id}\` Not Recognized`

			if (Bans.includes(id)) return `${user.username} \`(${id})\` is already banned`
			module.exports.addBan(id)

			args.shift()
			var reason = args.length ? "Provided Reason: " + args.join(" ") : "No reason has been provided"

			var result = `${user.username} \`(${id})\` has been banned from the competition. `
			try {
				var dm = await bot.getDMChannel(id)
				dm.createMessage(`You have been banned from using this bot and can no longer use any of its commands. ${reason}`)
			} catch (e) {
				result += `Failed to notify user. `

			} finally {
				return `${result}[banned by ${msg.author.username}]`
			}
		}
	},

	// COMMAND
	unbanCMD:{
		name: "unban",
		short_descrip: "Unbans a user",
		full_descrip: "Usage: `$ban <@user or user_id>`\nLift a ban and allow the specified user to interact with this bot again. This will DM the user being unbanned. To see the current list of banned users use `$listbans`",
		hidden: true, custom: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id or @user>`>"

			var id = msg.mentions.length ? msg.mentions[0].id : args[0]

			var user = await module.exports.getUser(bot, id)
			if (user == null) return `User ID \`${id}\` Not Recognized`
			module.exports.removeBan(id)

			var result = `${user.username} \`(${id})\` has been unbanned from the competition. `
			try {
				var dm = await bot.getDMChannel(id)
				dm.createMessage(`You are no longer banned from using this bot and can now use its commands again.`)
			} catch (e) {
				result +=  `Failed to notify user. `

			} finally {
				return `${result}[unbanned by ${msg.author.username}]`
			}
		}
	}
};
