const YTDL = require("ytdl-core")
var VoiceChannelID = null
var VoiceConnection = null
var Queue = []

/* Commands to add
play / q / resume
pause
stop / quit / leave
queue / q
move
shuffle
unshuffle
nowplaying / np
skip
*/

module.exports = {
	name: `Voice`,
	short_name: `voice`,

  // TODO: No permissions handling
  connect:{
    name: `join`,
    aliases: [`connect`],
    short_descrip: `joins a vc`,
    full_descrip: `Usage: \`$connect [channel_id]\`\nIf no ID is specified, it will join the voice chat you are currently in. If it is currently in a different voice channel, it will move channels.`,
    hidden: true,
    function: async function(bot, msg, args) {

        if (args.length == 0) {
            if (msg.member == null) {
                return `Invalid Arguments: \`$connect [id]\` or you must be connected to a voice channel and call this command from that server`
            } else if (msg.member.voiceState.channelID == null) {
                return `Invalid Arguments: \`$connect [id]\` or you must be connected to a voice channel`
            } else { // valid vc id
                VoiceChannelID = msg.member.voiceState.channelID
            }
        } else { // args > 0
            if (bot.getChannel(args[0]) == undefined) {
                return `Invalid Argument: id is not a channel`
            } else if (bot.getChannel(args[0]).type != 2) {
                return `Invalid Argument: channel is not a voice channel`
            } else {
                VoiceChannelID = args[0]
            }
        }

        if (VoiceConnection != null) {
            if (bot.getChannel(VoiceConnection.channelID).guild == bot.getChannel(VoiceChannelID).guild) {
                VoiceConnection.switchChannel(VoiceChannelID)
                return `Moved channels`

            } else {
                await bot.createMessage(msg.channel.id, `Connecting...`)
                await bot.leaveVoiceChannel(VoiceConnection.channelID) // leave the server it's currently in
                VoiceConnection = await bot.joinVoiceChannel(VoiceChannelID)//.catch((err) => {})
                return `Moved servers`
            }

        } else {
            await bot.createMessage(msg.channel.id, `Connecting...`)
            VoiceConnection = await bot.joinVoiceChannel(VoiceChannelID)
            return `Connected`
        }
    }
  },

  disconnect:{
    name: `disconnect`,
    aliases: [`dc`, `leave`, `quit`],
    short_descrip: `leave a voice channel`,
    full_descrip: `Usage: \`$disconnect\`\n`,
    hidden: true,
    function: async function(bot, msg, args) {

      if (VoiceChannelID == null) {
          return `I'm not currently connected to any voice channel`

      } else {
          await bot.leaveVoiceChannel(VoiceChannelID)
          VoiceChannelID = null
          VoiceConnection = null
          return `Disconnected`
      }
    }
  },

  play:{
    name: `play`,
		aliases: [`p`],
    short_descrip: `Play a song`,
    full_descrip: `Usage: \`$play <url>\`\nPlays a song from a url. If another song is playing it stops it and plays the newly requested one.`,
    hidden: true,
    function: async function(bot, msg, args) {

      if (args.length < 1) {
        return `Missing Arguments: \`$play <url>\``

      } else if (VoiceConnection == null) {
				VoiceConnection = await bot.joinVoiceChannel(msg.member.voiceState.channelID)
        //return `I'm not currently connected to voice. Use \`$join\` first`

      } else if (VoiceConnection.connecting) {
        return `I'm currently connecting. Please try again momentarily`

      } else if (VoiceConnection.playing) {
        await VoiceConnection.stopPlaying()
      }

      try {
				var info = await YTDL.getInfo(args[0])
				console.log("returned", info.video_url)
				/*YTDL.getInfo(args[0], (err, info) => {
					if (err) throw err
					console.log(info)
				})*/

				//console.log("returned")
				/*var result = "```"
				Object.keys(info).forEach(k => {
					result += `${k}: ${info[k]}\n`
				})
				return result + "```"*/
				for (var i = 0; i < info.formats.length; i++) {
					//bot.createMessage(msg.channel.id, info.formats[i])
					if (info.formats[i].codecs.includes('opus')) {
						//bot.createMessage(msg.channel.id, `\`\`\`${JSON.stringify(info.formats[i])}\`\`\``)
						//console.log(info.formats[i].codecs)
						VoiceConnection.play(info.formats[i].url)
						break
					}
				}

        //VoiceConnection.play(info.formats[0].url)//.once("end", () => {
					//bot.createMessage(msg.channel.id, `Finished playing`)
				//})
        return `Now playing \`${args[0]}\``
      } catch (e) {
				console.log(e)
        return `Something went wrong \`\`\`${e}\`\`\``
      }
    }
  },

  stop:{
    name: ``,
    short_descrip: ``,
    full_descrip: `Usage: \`$\`\n`,
    hidden: true,
    function: async function(bot, msg, args) {
			return
    }
	}

	/*,

  stop:{
    name: `stop`,
    short_descrip: `Stops playing audio`,
    full_descrip: `Usage: \`$stop\`\nStops playing audio if it currently connected to voice chat`,
    hidden: true,
    function: async function(bot, msg, args) {
			return
    }
  }*/
}
