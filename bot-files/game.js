const users = require("./users.js")
const miscfuncs = require("./miscfuncs.js")
const Save = require("./save.js")

// 35 default emoji
const DefaultEmoji = ["smiley", "smile", "grin", "sweat_smile", "joy", "innocent", "slight_smile", "upside_down", "wink", "heart_eyes", "kissing_heart", "stuck_out_tongue", "smirk", "sunglasses", "pensive", "weary", "cry", "rage", "flushed", "scream", "thinking", "grimacing", "frowning", "open_mouth", "cowboy", "smiling_imp", "clown", "robot", "thumbsup", "thumbsdown", "clap", "ok_hand", "wave", "pray", "eyes"]
let DisabledServers = []
let BoundSlots = true
const Rigged_Ids = []

function disabled(guild_id) {
    return DisabledServers.includes(guild_id)
}

module.exports = {
    name: "Games",
    short_name: "games",
    save: () => {
        console.log("Saving games...")
        Save.saveObject("games.json", DisabledServers)
    },
    load: () => {
        const data = Save.readObject("games.json")
        DisabledServers = []
        while (data.length > 0) DisabledServers.push(data.pop())
    },
    toggle: {
        name: "tg",
        aliases: ["toggleGames", "toggleGame"],
        short_descrip: "Toggle game functions",
        full_descrip: "Switches the game functions on/off for a specific server",
        hidden: true,
        function: (bot, msg, args) => {
            if (!users.hasCmdAccess(msg)) return

            for (let i = 0; i < DisabledServers.length; i++) {
                if (DisabledServers[i] === msg.channel.guild.id) {
                    DisabledServers.splice(i, 1)
                    module.exports.save()
                    return `Games enabled in \`\`${ msg.channel.guild.id }\`\``
                }
            }

            DisabledServers.push(msg.channel.guild.id)
            module.exports.save()
            return `Games disabled in \`\`${ msg.channel.guild.id }\`\``
        }
    },
    bound: {
        name: "bound",
        aliases: ["unbound"],
        short_descrip: "Bound/Unbound slots",
        full_descrip: "A global switch to bound/unbound slots. Bounded means that it limits $slots to 1 message. If it's unbounded it will send as many messages as it takes to send all the requested emoji (**WARNING** Walls of emoji may cause discord to lag)",
        hidden: true,
        function: (bot, msg, args) => {
            if (!users.hasCmdAccess(msg)) return
            BoundSlots = !BoundSlots
            return `Bounded = ${BoundSlots ? "True" : "False"}`
        }
    },
    giveaway: {
        name: "giveaway",
        short_descrip: "Randomly selects from a list",
        full_descrip: "Randomly selects a winner from arguments for a giveaway.",
        hidden: true,
        function: (bot, msg, args) => {
            if (disabled(msg.channel.guild.id)) return
            const rand = randInt(args.length)
            return `And the winner is... \`\`${ args[rand] }\`\` Congratulations!`
        }
    },
    slots: {
        name: "slots",
        short_descrip: "Spin to Win",
        full_descrip: "Chooses a number of random emojis. This number is specified by the user and defaults to 3. The limit is 10000 emojis, or as many characters that can fit in a message if slots is bounded. This will use the server's custom emoji. If it has none, or this is used in DMs this will use a selection of 35 default emoji",
        hidden: true,
        function: (bot, msg, args) => {
            if (!miscfuncs.isDM(msg) && disabled(msg.channel.guild.id)) return

            const numEmoji = Math.max(parseInt(args[0]) || 3, 2)
            const defaultEmoji = miscfuncs.isDM(msg) || msg.channel.guild.emojis.length === 0
            const emojis = defaultEmoji ? DefaultEmoji : msg.channel.guild.emojis
            const rigged = Rigged_Ids.includes(msg.author.id) ? randInt(emojis.length) : -1

            let emoji = (rigged >= 0) ? emojis[rigged] : getRandomEmoji(emojis)
            let last = defaultEmoji ? emoji : emoji.id
            let win = true
            let result = printEmoji(emoji)

            for (let i = 0; i < numEmoji - 1; i++) {
                emoji = (rigged >= 0) ? emojis[rigged] : getRandomEmoji(emojis)

                if (defaultEmoji ? last !== emoji : last !== emoji.id) win = false
                last = defaultEmoji ? emoji : emoji.id

                if (result.length + printEmoji(emoji).length > 2000) {
                    if (BoundSlots) break
                    else {
                        bot.createMessage(msg.channel.id, result)
                        result = ""
                    }
                }

                result += printEmoji(emoji)
            }

            bot.createMessage(msg.channel.id, result)
            bot.createMessage(msg.channel.id, win ? `WINNER! ${msg.author.mention}` : "Please Play Again")
        }
    },
    rig: {
        name: "rig",
        short_descrip: "Rig the game to win slots",
        full_descrip: "Usage: `$rig <user_id>`\nToggles the user winning slots everytime",
        hidden: true,
        function: (bot, msg, args) => {
            if (!users.hasCmdAccess(msg)) return
            if (args.length < 1) return "Missing Argument: `$rig <user_id>`"
            for (let i = 0; i < Rigged_Ids.length; i++) if (Rigged_Ids[i] === args[0]) return `Removed ${Rigged_Ids.splice(i, 1)}`
            Rigged_Ids.push(args[0])
            return `Added ${JSON.stringify(args[0])}`
        }
    },
    spin: {
        name: "spin",
        short_descrip: "Spin to Win 2: Electric Boogaloo",
        full_descrip: "Spin the classic slot machine to choose n^2 (9 by default, 49 at most) random emoji. Win by getting n in a row in any row, column, or diagonal! This will use the server's custom emoji. If it has none, or this is used in DMs this will use a selection of 35 default emoji",
        hidden: true,
        function: (bot, msg, args) => {
            if (!miscfuncs.isDM(msg) && disabled(msg.channel.guild.id)) return

            const dim = Math.min(Math.max(parseInt(args[0]) || 3, 2), 7)

            const emojis = (miscfuncs.isDM(msg) || msg.channel.guild.emojis.length === 0) ? DefaultEmoji : msg.channel.guild.emojis
            const roll = []
            let win = false
            let result = ""

            for (let i = 0; i < dim**2; i++) roll.push(getRandomEmoji(emojis))

            for (let i = 0; i < dim; i++) {
                // if (rows || columns)
                if (new Set(roll.slice(dim*i, dim*(i + 1))).size === 1 || new Set(roll.filter((_, j) => j % dim === i)).size === 1) {
                    win = true
                    break
                }
            }

            // diagonals
            if (!win && (new Set(roll.filter((_, i) => i % (dim + 1) === 0)).size === 1 || new Set(roll.filter((_, i) => i > 0 && i < dim**2 - 1 && i % (dim - 1) === 0)).size === 1)) win = true

            for (let i = 0; i < dim**2; i++) {
                result += printEmoji(roll[i])
                if (i % dim === dim - 1) result += "\n"
            }

            bot.createMessage(msg.channel.id, result)
            bot.createMessage(msg.channel.id, win ? `WINNER! ${msg.author.mention}` : "Please Play Again")
        }
    },
    // COMMAND: for every user @mentioned in the command, the bot will DM each one a different name on the list (meant for secret santa deligation)
    assign_random: {
        name: "secretsanta",
        aliases: ["ss"],
        short_descrip: "Chooses your Secret Santa",
        full_descrip: "Sends a DM to everyone @ mentioned in the command, with a name of another person on the list. No 2 users will get each other, and nobody will get themself.",
        hidden: true,
        function: async (bot, msg, args) => {
            const users = []

            if (msg.mentions.length < 3) return "Minimum of 3 people required"

            msg.mentions.forEach((person) => {
                users.push({
                    username: person.username,
                    id: person.id,
                })
            })

            shuffle(users)

            for (let i = 0, j = users.length; i < j; i++) {
                const dm = await bot.getDMChannel(users[i].id).catch((e) => `DM Failed \`\`${ e }\`\``)
                dm.createMessage(users[(i + 1) % j].username)
            }
        }
    },
    blackjack: (bot, msg, args) => {
        //TODO
    }
}

// Various helping commands

function getRandomEmoji(emojis) {
    let i = randInt(emojis.length)
    while (!canUseEmoji(emojis[i])) i = randInt(emojis.length)
    return emojis[i]
}

function randInt(exclusiveUpperBound) {
    return Math.floor(Math.random() * exclusiveUpperBound)
}

function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = randInt(i + 1);
        [arr[i], arr[j]] = [arr[j], arr[i]]
    }
}

function canUseEmoji(emoji) {
    return !emoji.id || !emoji.roles.length // !emoji.id is used to detect default emoji
}

function printEmoji(emoji) {
    if (emoji.animated) return `<a:${emoji.name}:${emoji.id}> `
    else if (emoji.name) return `<:${emoji.name}:${emoji.id}> `
    else return `:${emoji}: `
}