const USERS = require("./users.js")
const SAVE = require("./save.js")
const AC = require("./announcement.js")
const MISC = require("./miscfuncs.js")
const CHRONO = require("chrono-node")

var TimeAndDate = CHRONO.parseDate("12pm") // default
var Length = 1 // hours
var Channel = "" // ID

var QuizRunning = false // status for overall daily quiz
var QuizOpen = false // status for submissions/current quiz
var SkipDays = []

var Pokemon = "Pikachu"
var Descrip = "The Electric Mouse Pokemon"
var QuestionImage = "https://media.discordapp.net/attachments/196442189604192256/685615689419194369/WhosThatPokemon.png"
var AnswerImage = "https://media.discordapp.net/attachments/196442189604192256/685615705143377973/Pikachu.png"

var Responses = [] // ["user_id", "response"]

module.exports = {
  name:"Who's That Pokemon!?",
  short_name:"pkmn",
  save:function(){
    var data = {
      date: TimeAndDate.toString(),
      length: Length,
      channel: Channel,
      running: QuizRunning,
      open: QuizOpen,
      skip: SkipDays,
      name: Pokemon,
      description: Descrip,
      prompt: QuestionImage,
      solution: AnswerImage,
      guesses: Responses
    }
    SAVE.saveObject(`quizinfo`, data)
  },
  load:function(){
    var data = SAVE.readObject(`quizinfo`)
    TimeAndDate = CHRONO.parseDate(data.date)
    var now = new Date()
    while (TimeAndDate - now < 0) TimeAndDate.setHours(TimeAndDate.getHours()+24)
    Length = data.length
    Channel = data.channel
  },

  SetQuizChannel:{
    name: "SetQuizChannel",
    short_descrip: "Sets the channel for pokemon quizes!",
    full_descrip: "Usage: \`$setquizchannel [channel]\`\n\`[channel]\` can be either a channel mention or ID. It defaults to the channel the command was called in.",
    hidden: true,
    function: async function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return

      var id = msg.channel.id
      if (args.length > 0) id = MISC.getChannelID(args[0])
      try {
        await bot.createMessage(id, "Testing...").then((msg) => msg.delete())
        Channel = id
        module.exports.save()
        return `Channel set to <#${Channel}>`
      } catch (e) {
        return `Invalid Argument: Could not send message to channel <#${id}> \`\`\`${e}\`\`\``
      }
    }
  },

  // TODO: stop next one and make it go at the specified time
  SetQuizTime:{
    name: "SetQuizTime", // alias: [SetQuizDate]
    short_descrip: "Set the daily start time",
    full_descrip: "Usage: \`$setquizdate <time and date>\`\nNo specific format is required for \`<time and date>\`. If the time has already passed it will set it to the next day at the same time.",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      var date = CHRONO.parseDate(args.join(' '))
      if (date == null) return `Invalid Argument: Date not detected \`${args.join(' ')}\``

      var now = new Date()
      while (date - now < 0) date.setHours(date.getHours()+24)
      TimeAndDate = date
      module.exports.save()

      var result = `Next daily quiz will start at \`${date.toString()}\`. `
      if (!QuizOpen) { // called during a downtime. Next quiz needs to change time
        if (AC.KillDelayedFunction("PKMN-START")) { // if it was there, start it again
          AC.DelayFunction(bot, "PKMN-START", TimeAndDate.getHours()-now.getHours(), TimeAndDate.getMinutes()-now.getMinutes())
          result += `The next quiz's time has been adjusted.`
        }
      }
      return result
    }
  },

  SetQuizLength:{
    name: "SetQuizLength",
    short_descrip: "Set how long each quiz lasts",
    full_descrip: "Usage: `$setquizlength <hours>`\n\`<hours>\` is a positive float. Decimals will be converted to minutes. After the quiz starts, the answer will be automatically posted after this much time.",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      if (args.length == 0) return `Missing Argument: \`$setquizlength <hours>\``
      if (isNaN(args[0]) || args[0] <= 0) return `Invalid Argument: \`length\` must be a positive float`

      Length = args[0]
      module.exports.save()
      var hours = Math.floor(Length)
      var min = Math.floor((Length - hours)*60)

      return `Quiz will now last ${hours} hour${hours == 1 ? "" : "s"} and ${min} minute${min == 1 ? "" : "s"}`
    }
  },

  SetPokemon:{
    name:"SetPokemon",
    short_descrip: "Sets the Pokemon for the quiz!",
    full_descrip: "Usage: `$setpokemon <name>`\nSets the name that will appear in the answer for the upcoming quiz",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      if (args.length == 0) return `Missing Argument: \`$setpokemon <name>\``

      Pokemon = args[0]
      module.exports.save()

      return `It's **${Pokemon}**!`
    }
  },

  SetDescription:{
    name:"SetDescription",
    short_descrip: "Sets the Dex Info for the quiz answer",
    full_descrip: "Usage: `$setdescription <info...>`\nSets the description that will appear in the answer for the upcoming quiz",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      if (args.length == 0) return `Missing Argument: \`$setdescription <info...>\``

      Descrip = args.join(' ')
      module.exports.save()

      return `Description set \`\`\`${Descrip}\`\`\``
    }
  },

  SetSkipDays:{
    name:"SetSkipDays",
    short_descrip: "Sets the days the quiz wont take place on",
    full_descrip: "Usage: `$setskipdays <days...>`\nSets the days that the quiz will **NOT** take place on. Input is a list of space separated numbers from 0 (sunday) to 6 (saturday) inclusive. Other input will be ignored. To have the quiz everyday, call this command with no other input.",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return

      SkipDays = []
      args.forEach(a => {
        if (!isNaN(a) && 0 <= Math.floor(a) && Math.floor(a) <= 6) {
          SkipDays.push(Math.floor(a))
        }
      })
      module.exports.save()

      return SkipDays.length == 0 ? `No days will be skipped` : `Days that will be skipped: \`${SkipDays.join(', ')}\``
    }
  },

  SetQuestionImage:{
    name:"SetQuestionImage", // aliases: [setquestion, setprompt]
    short_descrip: "Set the image for the quiz",
    full_descrip: "Usage: `$setquestionimage <attachment or url>`\nSets the image prompt that will appear at the start upcoming quiz. If no attachment is provided, it will assume the first argument is a url.",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      if (msg.attachments.length == 0 && args.length == 0) return `Missing Argument: \`$setquestionimage <attachment or url>\``

      var url = args[0]
      if (msg.attachments.length > 0) url = msg.attachments[0].url
      QuestionImage = url
      module.exports.save()

      return `Image set: ${QuestionImage}`
    }
  },

  SetAnswerImage:{
    name:"SetAnswerImage", // alias: [setanswer]
    short_descrip: "Set the image for the answer to the quiz",
    full_descrip: "Usage: `$setanswerimage <attachment or url>`\nSets the image that will appear when the answer to the quiz is posted. If no attachment is provided, it will assume the first argument is a url.",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      if (msg.attachments.length == 0 && args.length == 0) return `Missing Argument: \`$setanswerimage <attachment or url>\``

      var url = args[0]
      if (msg.attachments.length > 0) url = msg.attachments[0].url
      AnswerImage = url
      module.exports.save()

      return `Image set: ${AnswerImage}`
    }
  },

  StartQuiz:function(bot, override) {
    if (QuizOpen) return // skip if forced start
    if (!QuizRunning && override == undefined) return

    var now = new Date()
    if (SkipDays.includes(now.getDay() % 7) && override != undefined) {
      AC.DelayFunction(bot, "PKMN-START", 0, 2)
      return
    }

    QuizOpen = true
    Responses = []
    module.exports.save()

    bot.createMessage(Channel, `Who's that Pokemon!? ${QuestionImage}`) // assumes valid channel
    var hours = Math.floor(Length)
    var min = Math.floor((Length - hours)*60)
    AC.DelayFunction(bot, "PKMN-END", hours, min) // set end of the quiz
  },

  GetSolutionMessage:function(){
    var msg = `It's **${Pokemon}**!`
    if (Responses.length > 0) {
      msg += `\n\nResponses (${Responses.length} Total)\n`
      Responses.forEach(r => msg += `• <@${r[0]}>: ${r[1]}\n`)
    }
    msg += `\n${Descrip}\n${AnswerImage}`
    return msg
  },

  PostSolution:function(bot, override) {
    if (!QuizOpen) return // skip if force stopped
    QuizOpen = false
    module.exports.save()

    // AC called function but quizzes stopped
    // I dont think this is necessary but just in case...
    if (!QuizRunning && override == undefined) return

    bot.createMessage(Channel, module.exports.GetSolutionMessage()) // Assumes valid channel

    // start next quiz at the specified time the next day
    // this is complicated in case the quiz was force started / stopped (IE not just 24-Length hours from now)
    var now = new Date()
    while (TimeAndDate - now < 0) TimeAndDate.setHours(TimeAndDate.getHours()+24)
    var hours = TimeAndDate.getHours() - now.getHours()
    var min = TimeAndDate.getMinutes() - now.getMinutes()
    AC.DelayFunction(bot, "PKMN-START", hours, min)
  },

  ForceStartQuiz:{
    name:"StartQuiz",
    short_descrip: "Starts the next quiz right now!",
    full_descrip: "Usage: `$startquiz`\nThis will start the quiz and allow people to submit responses. If \`$startdailyquizzes\` has not been used, this will only start a one time quiz, otheriwse it starts the next one early. This can be used to override skipped days.",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      if (Channel == "") return `No channel has been selected. Please use \`$setquizchannel\` first`
      if (QuizOpen) return `Quiz has already started!`
      module.exports.StartQuiz(bot, true)
    }
  },

  ForceStopQuiz:{
    name:"StopQuiz",
    short_descrip: "Stops the currnet quiz",
    full_descrip: "Usage: `$stopquiz`\nThis will stop people from submitting responses and post the solution. The quizzes will still take place at the next scheduled time",
    hidden: true,
    function: function(bot, msg, args) {
      if (!USERS.hasCmdAccess(msg)) return
      if (!QuizOpen) return `Quiz has already stopped!`
      module.exports.PostSolution(bot, true)
    }
  },

  SubmitResponse:{
    name:"guess",
    short_descrip: "Take a guess for the current quiz",
    full_descrip: "Usage: `$guess <name>`\nSubmits a response to the quiz! Names with spaces are acceptable.",
    hidden: true,
    function: function(bot, msg, args) {
      if (!QuizOpen) return `Sorry, no quiz seems to be open right now!`
      if (args.length == 0) `No response detected: \`$guess <name>\``

      for (var i = 0; i < Responses.length; i++) {
        if (Responses[i][0] == msg.author.id) {
          Responses[i][1] = args.join(' ').trim()
          module.exports.save()
          return `Your response has been updated: \`${args.join(' ').trim()}\``
        }
      }
      Responses.push([msg.author.id, args.join(' ').trim()]) // new response
      module.exports.save()
      return `Your response has been added: \`${args.join(' ').trim()}\``
    }
  },

  prompt:{
    name: "prompt",
    short_descrip: "Show the current quiz image",
    full_descrip: "Usage: \`$prompt\`\nIf there is currently an active quiz, this will show the quiz image to anyone. This will display the image if someone with command access calls this (regardless of current quiz status)",
    hidden: true,
    function:function(bot, msg, args){
      if (!QuizOpen && !USERS.hasCmdAccess(msg)) return `There's no quiz running right now`
      return `Who's that Pokemon!? ${QuestionImage}`
    },
  },

  StartDailyQuizzes:{
    name: "StartDailyQuizzes",
    short_descrip: "Start the daily quizzes",
    full_descrip: "Usage: \`$startdailyquizzes\`\nStarts the daily quizzes! This can be used to restart the quizzes at their scheduled time. Make sure to setup the quiz channel, length, and start time before using this command. Once started, the quiz will automatically run every day (besides days that are set to skip)",
    hidden: true,
    function:function(bot, msg, args){
      if (!USERS.hasCmdAccess(msg)) return
      QuizRunning = true
      module.exports.save()
      AC.KillDelayedFunction("PKMN-START")
      AC.KillDelayedFunction("PKMN-STOP")

      var now = new Date()
      while (TimeAndDate - now < 0) TimeAndDate.setHours(TimeAndDate.getHours()+24)
      var hours = TimeAndDate.getHours() - now.getHours()
      var min = TimeAndDate.getMinutes() - now.getMinutes()
      AC.DelayFunction(bot, "PKMN-START", hours, min)
      return `Daily quizzes enabled. The first quiz will take place in ${hours} hour${hours == 1 ? '' : 's'} and ${min} minute${min == 1 ? '' : 's'}`
    },
  },

  StopDailyQuizzes:{
    name: "StopDailyQuizzes",
    short_descrip: "Stops the daily quizzes",
    full_descrip: "Usage: \`$stopdailyquizzes\`\nStops the daily quizzes. If something goes wrong, use this command to shut everything down. If a current quiz is open, it will stop it without posting the answer.",
    hidden: true,
    function:function(bot, msg, args){
      if (!USERS.hasCmdAccess(msg)) return
      QuizRunning = false
      QuizOpen = false
      module.exports.save()
      while (AC.KillDelayedFunction("PKMN-START")) // in case something goes horribly wrong
      while (AC.KillDelayedFunction("PKMN-STOP")) // delete every instance of these
      return `Daily quizzes disabled`
    },
  },

  Info:{
    name: "pkmnSettings",
    short_descrip: "Show current settings",
    full_descrip: "Usage: \`$pkmnsettings\`\nShows the current settings for quizzes. For example: when the next one is scheduled, how long each quiz runs, which days are skipped, what channel it's posted to, etc.",
    hidden: true,
    function:function(bot, msg, args){
      if (!USERS.hasCmdAccess(msg)) return
      var info = `**Who's That Pokemon!? - Settings**\n\n`
      info += `Quizzes ${QuizRunning ? 'enabled' : 'disabled'}\n`
      info += `Current status: \`${QuizOpen ? '' : 'Not'} Accepting Responses\`\n`
      info += `Next scheduled quiz: \`${TimeAndDate.toString()}\`\n`
      info += `Quiz length: ${Length} hour${Length == 1 ? '' : 's'}\n`
      info += `Channel: <#${Channel}>\n`
      info += SkipDays.length == 0 ? `No days are set to skip\n` : `Days that are skipped: \`${SkipDays.join(', ')}\`\n`
      info += `\nTo see what the answer to the quiz looks like, use \`$previewAnswer\`. `
      info += `To see the current image that you need to guess, use \`$prompt\`. `
      return info
    },
  },

  PreviewAnswer:{
    name: "PreviewAnswer", // aliases [previewSolution]
    short_descrip: "See what the quiz answer looks like",
    full_descrip: "Usage: \`$previewanswer\`\nThis will send a DM with the message that is currently planned to be posted at the end of the next/current quiz.",
    hidden: true,
    function:async function(bot, msg, args){
      if (!USERS.hasCmdAccess(msg)) return
      try {
        var dm = await bot.getDMChannel(msg.author.id)
        dm.createMessage(module.exports.GetSolutionMessage())
        return `A DM with the preview has been sent.`
      } catch (e) {
        return `Could not send a DM with the preview\`\`\`${e}\`\`\``
      }
    },
  },

  SetupNextQuiz:{
    name: "SetupQuiz",
    short_descrip: "Walks through setting up the next quiz",
    full_descrip: "Usage: \`$setupquiz\`\nWalks a user through setting up the next quiz. This is a shortcut for using \`$setquestionimage\`, \`$setpokemon\`, \`$setdescription\`, \`$setanswerimage\` in that order. It will send prompting messages and wait 30s for a reply in the same channel. If it doesn't receive a reply it will exit out of the command but any info updated before the timeout will remain as the updated value. Make sure to setup the daily start time, length, and channel for the quizzes before hand!",
    hidden: true,
    function:async function(bot, msg, args){
      if (!USERS.hasCmdAccess(msg)) return
      const WAIT_TIME = 30000 // ms

      async function processResponse(prompt, success, command) {
        await msg.channel.createMessage(prompt)
        var responses = await msg.channel.awaitMessages(m => true, {time: WAIT_TIME, maxMatches: 1})
        if (responses.length == 0) return `Command Timed Out`
        var result = command.function(bot, responses[0], responses[0].content.split(' '))
        if (!result.startsWith(success)) return result
        return 0
      }

      var prompts = [
        ["Please upload the prompt image:", "Image set", module.exports.SetQuestionImage],
        ["Who's that Pokemon? (What's their name)", "It's", module.exports.SetPokemon],
        ["What's the description of this Pokemon?", "Description set", module.exports.SetDescription],
        ["Please upload the answer image:", "Image set", module.exports.SetAnswerImage]
      ]

      for (var i = 0; i < prompts.length; i++) {
        var result = await processResponse(prompts[i][0], prompts[i][1], prompts[i][2])
        if (result) return result
      }

      return `Setup complete. Use \`$previewAnswer\` to see what the results will look like`
    }
  }
}
