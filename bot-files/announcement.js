const users = require('./users.js')
const miscfuncs = require('./miscfuncs.js')
const chrono = require('chrono-node')
const save = require('./save.js')
const chat = require('./chatcommands.js')

var Announcements = [] // {id, channel, interval, time, message, user}
var Timers = [] // {id, timer}

// delays for repeated announcements
var Delays = {}
var DefaultDelays = {
    once: 0,
    daily: 86400000,
    weekly: 604800000,
    biweekly: 1209600000,
}

// gets a new unique ID
function NewID() {
    var id = Announcements.length // arbitrary start point
    while (Announcements.filter((a) => a.id == id).length) id++ // slow
    return id
}

module.exports = {
    name: 'Announcement',
    short_name: 'ac',

    AddAnnouncement: {
        name: 'acadd',
        aliases: ['acset'],
        short_descrip: 'Add an announcement',
        full_descrip:
            'Sets a message that will automatically be sent to the specified channel at the given time and date. Usage: `$acadd <channel> <interval> "message" date and time`. To use quotations within the announcement type \`\\"\`. Otherwise, everything between the first two quotations will be used. Everything after the last quotation will be interpreted as a time and date. To see a list of intervals use `$acinterval`. To send it as a DM, put `DM` before the user id without a space. Ex: `$acadd DM532974459267710987 once "Hi there!" at 4:20pm est tomorrow`',
        hidden: true,
        function: async function (bot, msg, args) {
            if (msg.InternalCall == undefined && !users.hasCmdAccess(msg))
                return

            if (args.length < 4)
                return `Missing Arguments: \`$addac <channel> <interval> "message" date and time\``

            if (Delays[args[1]] === undefined)
                return 'Unknown interval. For a list of supported intervals use `$acinterval`'

            var text = args.slice(2, args.length).join(' ')
            var text = module.exports.getMessage(text)
            if (text[0].length == 0 && msg.InternalCall == undefined)
                return `Invalid Argument: Message cannot be empty`

            if (text[1].length == 0)
                return `No time or date specified: \`$addac <channel> <interval> "message" date and time\``
            var date = chrono.parseDate(text[1])

            var announcement = {
                id: NewID(),
                channel: chat.chooseChannel(args[0]),
                interval: Delays[args[1]],
                time: `${date}`,
                message: text[0],
                user: msg.author,
            }

            var now = new Date()
            var delay = date - now

            if (delay < 0) {
                return `Specified time \`${date.toString()}\` has already passed (\`${now.toString()}\`). Try a more specific date and time.`
            }

            if (msg.InternalCall) announcement.InternalCall = msg.InternalCall

            Announcements.push(announcement)
            module.exports.SetAnnouncement(bot, announcement, delay)
            module.exports.save()
            //console.log(`Announcement Added: ${announcement.InternallCall}`)
            return `Announcement Added (ID: ${announcement.id}). For a list of announcements use $aclist`
        },
    },

    // getMessage(`test "Please say \\\"Hello\\\"" everything else`)
    // = [`Please say "Hello"`, ` everything else`]
    getMessage: function (text) {
        var result = [``, ``]
        var counter = 0
        text = text.split('')

        for (var i = 0; i < text.length; i++) {
            if (counter == 0 && text[i] == `"`) {
                counter++
            } else if (counter == 1) {
                if (
                    text[i] == `\\` &&
                    i < text.length - 1 &&
                    text[i + 1] == `"`
                ) {
                    i++
                    result[0] += text[i]
                } else if (text[i] == `"`) {
                    counter++
                } else {
                    result[0] += text[i]
                }
            } else if (counter == 2) {
                result[1] += text[i]
            }
        }

        return result
    },

    // Sets the initial Timout for the announcement and adds it to the list of Timers
    SetAnnouncement: function (bot, announcement, delay) {
        var timer = {
            id: announcement.id,
            timer: setTimeout(async () => {
                await module.exports.SendAnnouncement(bot, announcement) // send message
                if (announcement.InternalCall)
                    await module.exports.ExternalFunctions(
                        bot,
                        announcement.InternalCall
                    )
                module.exports.LoopAnnouncement(bot, announcement) // repeat announcement
            }, delay),
        }
        Timers.push(timer)
    },

    // Sends a message
    SendAnnouncement: async function (bot, announcement) {
        if (announcement.message == '') {
            announcement.interval = 0
            return
        }

        try {
            // try to send the announcement
            // determine if it's a DM or not
            if (announcement.channel.substr(0, 2).toUpperCase() == 'DM') {
                var dm_ac = await bot.getDMChannel(
                    announcement.channel.substr(2)
                )
                await dm_ac.createMessage(announcement.message)
            } else {
                await bot.createMessage(announcement.channel, {
                    content: announcement.message,
                    allowedMentions: {
                        everyone: true,
                        roles: true,
                        users: true,
                    },
                })
            }
        } catch (e) {
            // log any error
            console.log(`Failed Announcement #${announcement.id}\n${e}`)
            announcement.interval = 0 // remove it
            try {
                // try to notify the user that it failed
                var dm = await bot.getDMChannel(announcement.user.id)
                dm.createMessage(
                    `Failed Announcement #${announcement.id}\n\`\`\`${e}\`\`\``
                )
            } catch (e2) {
                // log if that fails
                console.log(
                    `Could not notify user: ${announcement.user.username} (${announcement.user.id})\n${e2}`
                )
            }
        }
    },

    LoopAnnouncement: function (bot, announcement) {
        // remove a one time announcement
        if (announcement.interval == 0) {
            module.exports.RemoveAnnouncement(announcement.id)
        } else {
            // adjust timer
            for (var i = 0; i < Timers.length; i++) {
                if (Timers[i].id == announcement.id) {
                    // clear the current one
                    clearTimeout(Timers[i].timer)

                    // set an interval to loop
                    Timers[i].timer = setInterval(async () => {
                        await module.exports.SendAnnouncement(bot, announcement)
                    }, announcement.interval)
                }
            }

            // adjust time listed in announcement
            for (var i = 0; i < Announcements.length; i++) {
                if (Announcements[i].id == announcement.id) {
                    var new_time = new Date(Announcements[i].time).getTime()
                    Announcements[i].time = new Date(new_time).toUTCString()
                }
            }
        }

        module.exports.save()
    },

    // returns the removed announcement given it's ID
    RemoveAnnouncement: function (id) {
        // remove the Timer
        for (var i = 0; i < Timers.length; i++) {
            if (Timers[i].id == id) {
                clearTimeout(Timers[i].timer)
                Timers.splice(i, 1)
            }
        }

        // remove the Announcement
        var a = false
        for (var i = 0; i < Announcements.length; i++) {
            if (Announcements[i].id == id) a = Announcements.splice(i, 1)[0]
        }

        if (a) {
            module.exports.save()
            return a
        }

        // not found
        return null
    },

    save: function () {
        var data = { ACs: Announcements, Intervals: Delays }
        save.saveObject('announcements.json', data)
    },

    load: async function (bot) {
        var data = save.readObject('announcements.json')

        if (data.Intervals) {
            Object.keys(data.Intervals).forEach(
                (i) => (Delays[i] = data.Intervals[i])
            )
        } else {
            Delays = DefaultDelays
        }

        var recoverAnnouncement = async function (announcement) {
            var date = chrono.parseDate(announcement.time)
            var now = new Date()
            var delay = date.getTime() - now.getTime()

            if (delay < 0 && announcement.InternalCall) {
                await module.exports.ExternalFunctions(
                    bot,
                    announcement.InternalCall,
                    delay
                )
                await users.getOwners().forEach(async (id) => {
                    try {
                        var dm = await bot.getDMChannel(id)
                        dm.createMessage(
                            `**[ERROR]** Internal announcement call missed: \`\`\`key = \"${announcement.InternalCall}\"\ntime: ${announcement.time}\`\`\``
                        )
                    } catch (e) {
                        console.log('Could not notify OWNER: ' + id)
                    }
                })
            } else if (delay < 0 && announcement.interval == 0) {
                console.log('Announcement Missed', announcement)
                try {
                    // message the user to tell them that the announcement was missed
                    var dm = await bot.getDMChannel(announcement.user.id)
                    dm.createMessage(
                        `Announcement Missed \`\`\`Channel: #${bot.getChannel(announcement.channel).name} (${announcement.channel})\nTime: ${announcement.time}\nMessage: ${announcement.message}\`\`\``
                    )
                } catch (e) {
                    console.log(
                        `Failed to notify user ${announcement.user.username} (${announcement.user.id})`
                    )
                }
            } else {
                // if it passed but happens regularly, shift it to the next time
                if (announcement.interval) delay = delay % announcement.interval
                if (delay < 0) delay += announcement.interval
                announcement.time = new Date(
                    now.getTime() + delay
                ).toUTCString()
                module.exports.SetAnnouncement(bot, announcement, delay)
                Announcements.push(announcement) // save it in memory
            }
        }

        if (data.ACs) {
            await data.ACs.forEach(async (a) => await recoverAnnouncement(a))
        } else {
            Announcements = []
        }
        module.exports.save() // in case any announcements were skipped
    },

    AnnouncementInfo: {
        name: 'acinfo',
        short_descrip: 'Gets info about an announcement',
        full_descrip:
            'Usage: \`$acinfo <id>\`. For a list of announcement IDs, use $aclist',
        hidden: true,
        function: function (bot, msg, args) {
            if (!users.hasCmdAccess(msg)) return

            if (Announcements.length == 0)
                return `No scheduled announcements at this time.`
            if (args.length == 0) return 'Missing Arguments: \`$acinfo <id>\`'

            var result = ''

            var a = Announcements.filter((ac) => ac.id == args[0])
            if (a.length == 0)
                return `ID \`${args[0]}\` Not Found. For a list of announcement IDs, use $aclist`
            a = a[0]

            if (a.InternalCall) {
                result = `\`\`\`Announcement Info (ID ${a.id})\n`
                result += `\tadded by: BOT (internal call)\n`
                result += `\tkey = \"${a.InternalCall}\"\n`
                result += `\ttime: ${a.time}\`\`\``
                return result
            }

            result = `\`\`\`Announcement Info (ID ${a.id})\n`
            result += `\tadded by: ${a.user.username} (${a.user.id})\n`
            if (a.channel.substr(0, 2).toUpperCase() == 'DM') {
                result += `\tUser ID (DM): ${a.channel}\n`
            } else {
                result += `\tchannel: #${bot.getChannel(a.channel).name} (${a.channel})\n`
            }
            result += `\tinterval: ${a.interval} `
            result += a.interval == 0 ? `(Once)\n` : `ms (repeated)\n`
            result += `\ttime: ${a.time}\n`
            result += `\tmessage: ${a.message}`

            // make sure it fits in a discord message
            if (result.length > 2000 - 7) {
                while (result.length > 2000 - 7)
                    result = result.substr(0, result.length - 1)
                result += '...'
            }

            return result + '```'
        },
    },

    AnnouncementList: {
        name: 'aclist',
        short_descrip: 'Lists all the announcements',
        full_descrip:
            "Usage: \`$aclist [page]\`\nLists some information about scheduled announcements. For more information on a specific announcement, use \`$acinfo\`. Announcement's labelled with `key = ...` are internally delayed function calls.",
        hidden: true,
        function: function (bot, msg, args) {
            if (!users.hasCmdAccess(msg)) return

            // optional different message if there are none
            //if (Announcements.length == 0) return `No scheduled announcements at this time.`

            var result = [`\`\`\`ID | Message Preview | Channel\n`, ``]

            var PreviewLength = 50

            Announcements.forEach((a) => {
                var entry = ''
                // escape internal announcement calls (if we want to delay a function call)
                if (a.InternalCall != undefined) {
                    entry = `${a.id} | Key = ${a.InternalCall}\n`
                } else {
                    var entry = `${a.id} | `
                    entry += `${a.message.substr(0, PreviewLength) + (a.message.length < PreviewLength ? '' : '...')} | `

                    if (a.channel.substr(0, 2).toUpperCase() == 'DM') {
                        entry += `DM: ${a.channel.substr(2)}\n`
                    } else {
                        entry += `#${bot.getChannel(a.channel).name}\n`
                    }
                }

                // only guarantees support for up to 99 pages of entries (Page AB/XY)
                // any more and this could potentially pass the discord character limit by 2 ("Page ABC/XYZ")
                if (
                    result[0].length +
                        entry.length +
                        result[result.length - 1].length +
                        '```Page AB/XY'.length <
                    2000
                ) {
                    result[result.length - 1] += entry
                } else {
                    // message too big, add another page
                    result.push(entry)
                }
            })

            var page = 1
            if (
                args.length > 0 &&
                !isNaN(args[0]) &&
                result[Number(args[0])] != undefined
            )
                page = Number(args[0])

            return `${result[0]}${result[page]}\`\`\`Page ${page}/${result.length - 1}`
        },
    },

    ClearAnnouncement: {
        name: 'acclear',
        aliases: ['acdelete', 'acremove'],
        short_descrip: 'Remove an announcement',
        full_descrip:
            'Usage: \`$acclear <id>\`\nUnschedules a planned announcement given its ID. The person who added the announcement will be notified. For a list of announcement IDs, use \`$aclist\`',
        hidden: true,
        function: async function (bot, msg, args) {
            if (!users.hasCmdAccess(msg)) return

            if (Announcements.length == 0)
                return `No scheduled announcements at this time.`
            if (args.length == 0) return 'Missing Arguments: \`$acclear <id>\`'

            var a = module.exports.RemoveAnnouncement(args[0]) // this saves when it removes

            if (a == null)
                return `ID \`${args[0]}\` Not Found. For a list of announcement IDs, use $aclist`

            var result = ``

            if (a.InternalCall) {
                result = `\`\`\`Announcement Info (ID ${a.id})\n`
                result += `\tadded by: BOT (internal call)\n`
                result += `\tkey = \"${a.InternalCall}\"\n`
                result += `\ttime: ${a.time}\`\`\``
                return result
            }

            result = `Announcement Removed by ${msg.author.username} \`(${msg.author.id})\`\n`
            result += `\`\`\`Announcement Info (ID ${a.id})\n`
            result += `\tadded by: ${a.user.username} (${a.user.id})\n`
            result += `\tchannel: #${bot.getChannel(a.channel).name} (${a.channel})\n`
            result += `\tinterval: ${a.interval} `
            result += a.interval == 0 ? `(Once)\n` : `ms (repeated)\n`
            result += `\ttime: ${a.time}\n`
            result += `\tmessage: ${a.message}`
            if (result.length > 2000 - 7) {
                result = result.substr(0, 2000 - 7)
                result += '...'
            }
            result += '```'

            // DM the person who added the announcement
            // if theyre the one that stopped it, dont DM
            if (msg.author.id == a.user.id) return result

            try {
                var dm = await bot.getDMChannel(a.user.id)
                dm.createMessage(result)
            } catch (e) {
                console.log(
                    `Failed to notify ${a.user.username} (${a.user.id})`
                )
            }

            return result
        },
    },

    ListIntervals: {
        name: 'acListIntervals',
        aliases: ['acinterval', 'acintervals', 'aclistinterval'],
        short_descrip: 'List the supported announcement intervals',
        full_descrip:
            'Shows the different interval keywords that can be used when adding an announcement, and how long (in ms) before the announcement will be sent again.',
        hidden: true,
        function: function (bot, msg, args) {
            if (!users.hasCmdAccess(msg)) return

            var result = 'Currently supported intervals (in ms) are:\n'
            Object.keys(Delays).forEach((k) => {
                result += `\t${k}: ${Delays[k]}\n`
            })

            return result
        },
    },

    addInterval: {
        name: 'acAddInterval',
        short_descrip: 'add an announcement interval',
        full_descrip:
            'Usage: \`$acAddInterval <name> <time>\`\nThe given name/alias can be used in place of an interval when adding announcements. The time given must be in milliseconds. This will overwrite preexisting intervals.',
        hidden: true,
        function: function (bot, msg, args) {
            if (!users.hasCmdAccess(msg)) return

            if (args.length < 2)
                return `Missing Arguments: \`$acAddInterval <name> <time>\``
            if (isNaN(args[1])) return `Invalid Argument: time must be a number`

            Delays[args[0]] = args[1]
            console.log(Delays)
            module.exports.save()

            return `Interval \`${args[0]}\` now set to ${args[1]}ms`
        },
    },

    deleteInterval: {
        name: 'acDeleteInterval',
        aliases: ['acRemoveInterval'],
        short_descrip: 'add an announcement interval',
        full_descrip:
            'Usage: \`$acDeleteInterval <name>\`\nDeletes an interval/alias that can be used for announcements. To see the current list of intervals use \`$acListIntervals\`',
        hidden: true,
        function: function (bot, msg, args) {
            if (!users.hasCmdAccess(msg)) return

            if (args.length < 1)
                return `Missing Arguments: \`$acDeleteInterval <name>\``

            if (Delays[args[0]] == undefined)
                return `Interval name \`${args[0]}\` did not exist`

            var interval = Delays[args[0]]
            delete Delays[args[0]]
            module.exports.save()

            return `Interval name \`${args[0]} (${interval}ms)\` was deleted`
        },
    },

    // shortcut for other modules to send announcements
    // it will take place delay_hours and delay_minutes from the moment it is called
    // This does not check for valid input
    AddExternalAnnouncement: function (
        bot,
        channel_id,
        message,
        key,
        delay_hours,
        delay_minutes,
        isDM
    ) {
        var date = new Date()
        date.setHours(date.getHours() + delay_hours)
        date.setMinutes(date.getMinutes() + delay_minutes)
        var args = [
            `${isDM ? 'DM' : ''}${channel_id}`,
            'once',
            `"${message}"`,
            date.toString(),
        ]
        //console.log("ADDING ANNOUNCEMENT...")
        module.exports.AddAnnouncement.function(
            bot,
            { InternalCall: key, author: 'BOT' },
            args
        )
    },

    // Other bot modules can use announcements to delay function calls.
    // They pass 'msg.InternalCall = key' when calling AddAnnouncement and
    // that key is hardcoded here to do said function
    // Late is passed if the internal call was missed
    ExternalFunctions: async function (bot, key, late) {
        key = key.toUpperCase()
        if (late) return // currently: do NOT call the functions late
        if (key == 'NOTHING' || key == '_') {
            return // these keys will not be used
        } else if (key == 'COMP-END') {
            // end the whole thing
            var comp = require('./comp.js')
            await comp.stopSubmissions.function(bot, { author: 'BOT' }, [true])
        } else if (key.split(' ')[0] == 'COMP-END') {
            var comp = require('./comp.js')
            await comp.endTimedTask(bot, key.split(' ')[1], true)
        } else if (key == 'COMP-RELEASE') {
            var comp = require('./comp.js')
            await comp.releaseTask(bot)
        } else if (key.split(' ')[0] == 'COMP-WARN') {
            var comp = require('./comp.js')
            await comp.timerWarning(bot, key.split(' ')[1], key.split(' ')[2]) // pass channel id, warning id
        }
    },

    DelayFunction: function (bot, key, delay_hours, delay_minutes) {
        if (60 * delay_hours + delay_minutes < 0) return // date passed
        module.exports.AddExternalAnnouncement(
            bot,
            '',
            '',
            key,
            delay_hours,
            delay_minutes,
            false
        )
    },

    // search for a specific key to end that announcement
    KillDelayedFunction: function (key, deleteAll) {
        if (deleteAll == undefined) deleteAll = false
        for (var i = 0; i < Announcements.length; i++) {
            if (deleteAll && Announcements[i].InternalCall.startsWith(key)) {
                // startsWith instead of precisely equal
                module.exports.RemoveAnnouncement(Announcements[i].id)
                return module.exports.KillDelayedFunction(key, true) || 1 // recursively delete all copies
            } else if (Announcements[i].InternalCall == key) {
                // found
                module.exports.RemoveAnnouncement(Announcements[i].id)
                return 1
            }
        }
        return null
    },
}
