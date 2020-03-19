const Save = require("./save.js")
const Info = require("../SETUP-INFO.js")

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
		return message.author == "BOT" || Info.Owner_IDs.includes(message.author.id) || Admin.users.includes(message.author.id) || Admin.channels.includes(message.channel.id)
	},

	// COMMAND returns a list of names with IDs and channel mentions that have command access
	listAccessCMD:{
		name: "listAccess",
		aliases: ["la"],
		short_descrip: "List the users and channels with command access",
		full_descrip: "Every command may be used by the people listed and from the channels listed. To give access or remove it use `$addCmdAccess` or `$removeCmdAccess` respectively. The owners are hardcoded into the bot and their access cannot be changed",
		hidden: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			var result = `**Owners:**\n`
			for (const id of Info.Owner_IDs) {
				try {
					var user = await module.exports.getUser(bot, id)
					result += `${user.username} \`(${id})\`\n`
				} catch (e) {
					result += `Unknown User \`(${id})\`\n`
				}
			}

			result += `**Users:**\n`
			for (const id of Admin.users) {
				try {
					var user = await module.exports.getUser(bot, id)
					result += `${user.username} \`(${id})\`\n`
				} catch (e) {
					result += `Unknown User \`(${id})\`\n`
				}
			}

			result += "**Channels:**\n"
			Admin.channels.forEach(id => {
				result += `<#${id}> \`(${id})\`\n`
			})

			return result
		}
	},

	// COMMAND allows a user or every message from a channel to use every commands
	addCmdAccessCMD:{
		name: "addCommandAccess",
		aliases: ["addCmdAccess", "aca"],
		short_descrip: "Gives permissions to use commands",
		full_descrip: "Usage: `$addCmdAccess [@user, #channel, <id>...]`\nDefaults to the channel the message was sent in. It will give access to any users or channels mentioned in the command. If an ID is given it will give access to the appropriate user or channel.",
		hidden: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			var result = `Command access given to: `
			var original = result

			if (args.length == 0 && !Admin.channels.includes(msg.channel.id)){ // add current channel
				module.exports.addCmdAccessChannel(msg.channel.id)
				result += `<#${msg.channel.id}> `
			}

			msg.channelMentions.forEach(id => {
				if (!Admin.channels.includes(id)) {
					module.exports.addCmdAccessChannel(id)
					result += `<#${id}> `
				}
			})

			msg.mentions.forEach(user => {
				if (!Admin.users.includes(user.id)) {
					module.exports.addCmdAccessUser(user.id)
					result += `<@${user.id}> `
				}
			})

			for (var i = 0; i < args.length; i++) {
				var id = args[i]
				if (!id.startsWith('<')) { // look at non-mentions

					var user = await module.exports.getUser(bot, id)
					var channel = await bot.getChannel(id)

					if (!Admin.users.includes(id) && user != null) {
						module.exports.addCmdAccessUser(id)
						result += `<@${user.id}> `

					} else if (!Admin.channels.includes(id) && channel != undefined) {
						module.exports.addCmdAccessChannel(id)
						result += `<#${id}> `
					}
				}
			}

			var error = `Invalid Arguments: No valid mentions or IDs found. Either they already have access, or I do not have access to that user/channel.`
			return result.length == original.length ?  error : result
		}
	},

	// COMMAND that removes a user's or channel's access to every command
	removeCmdAccessCMD:{
		name: "removeCommandAccess",
		aliases: ["removeCmdAccess", "rca"],
		short_descrip: "Removes permissions to use commands",
		full_descrip: "Usage: `$removeCmdAccess [@user, #channel, <id>...]`\nDefaults to the channel the message was sent in. It will give access to any users or channels mentioned in the command",
		hidden: true,
		function: function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			var result = `Command access removed from: `
			var original = result

			if (args.length == 0 && Admin.channels.includes(msg.channel.id)) { // remove current channel
				module.exports.removeCmdAccessChannel(msg.channel.id)
				result += `<#${msg.channel.id}> `
			}

			msg.channelMentions.forEach(id => {
				if (Admin.channels.includes(id)) {
					module.exports.removeCmdAccessChannel(id)
					result += `<#${id}> `
				}
			})

			msg.mentions.forEach(user => {
				if (Admin.users.includes(user.id)) {
					module.exports.removeCmdAccessUser(user.id)
					result += `<@${user.id}> `
				}
			})

			for (var i = 0; i < args.length; i++) {
				var id = args[i]
				if (Admin.users.includes(id)) {
					module.exports.removeCmdAccessUser(id)
					result += `<@${id}> `

				} else if (Admin.channels.includes(id)) {
					module.exports.removeCmdAccessChannel(id)
					result += `<#${id}> `
				}
			}

			var error = `Invalid Arguments: No valid mentions or IDs found.`
			return result.length == original.length ? error : result
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
		hidden: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id or @user> [reason]`>"

			var id = args[0]
			if (id.startsWith('<@')) id = id.substr(2, id.length - 3) // @ mention

			var user = await module.exports.getUser(bot, id)
			if (user === null) return `User ID \`${id}\` Not Recognized`

			if (Bans.includes(id)) return `${user.username} \`(${id})\` is already banned`
			module.exports.addBan(id)

			args.shift()
			var reason = args.length ? "Provided Reason: " + args.join(" ") : "No reason has been provided"

			var result = `${user.username} \`(${id})\` has been banned. `
			try {
				var dm = await bot.getDMChannel(id)
				dm.createMessage(`You have been banned from using this bot and can no longer use any of its commands. ${reason}`)
			} catch (e) {
				result += `Failed to notify user. `

			} finally {
				return result
			}
		}
	},

	// COMMAND
	unbanCMD:{
		name: "unban",
		short_descrip: "Unbans a user",
		full_descrip: "Usage: `$unban <@user or user_id>`\nLift a ban and allow the specified user to interact with this bot again. This will DM the user being unbanned. To see the current list of banned users use `$listbans`",
		hidden: true,
		function: async function(bot, msg, args){
			if (!module.exports.hasCmdAccess(msg)) return

			if (args.length == 0) return "Not Enough Arguments: `<user_id or @user>`>"

			var id = args[0]
			if (id.startsWith('<@')) id = id.substr(2, id.length - 3) // @ mention

			if (!module.exports.isBanned(id)) return `User ID \`${id}\` is not banned`
			module.exports.removeBan(id)

			var user = await module.exports.getUser(bot, id)
			var result = user === null ? `Unknown User ` : `${user.username} `
			result += `\`(${id})\` has been unbanned. `

			try {
				var dm = await bot.getDMChannel(id)
				dm.createMessage(`You are no longer banned from using this bot and can now use its commands again.`)
			} catch (e) {
				result +=  `Failed to notify user. `

			} finally {
				return result
			}
		}
	}
};
