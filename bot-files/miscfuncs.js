var users = require("./users.js");
var chat = require("./chatcommands.js");

module.exports = {
    name: "Miscellaneous",
    short_name: "misc",
    getDateTime: () => {
        const now = new Date(),
              year = now.getFullYear(),
              month = now.getMonth() + 1,
              day = now.getDate(),
              hour = now.getHours(),
              minute = now.getMinutes(),
              second = now.getSeconds();

        return `${pad(day)}/${pad(month)}/${pad(year)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
    },
    isDM: msg => msg.channel.type === 1,
    formatSecsToStr: sec => {
        const hours = Math.floor(sec / 3600),
              minutes = Math.floor(sec / 60) - hours * 60,
              seconds = (sec - minutes * 60 - hours * 60 * 60).toFixed(3),
              days = Math.floor(hours / 24);

        let readable = `${days} ${days === 1 ? "day" : "days"}, `;
        readable += `${hours % 24} ${hours % 24 === 1 ? "hour" : "hours"}, `;
        readable += `${minutes} ${minutes === 1 ? "minute" : "minutes"}, `;
        readable += `${seconds} ${seconds === "1.000" ? "second" : "seconds"}`;
        return `${pad(hours)}:${pad(minutes)}:${pad(seconds)} (${readable})`;
    },
    ping: {
        name: "ping",
        short_descrip: "ping",
        full_descrip: "To check if the bot is not dead. Tells you time it takes to bait you in ms",
        hidden: true,
        function: (bot, msg) => "baited (" + (Date.now() - msg.timestamp) / 1000 + "ms)"
    },
    celsiusToInferiorTemp: {
        name: "fahrenheit",
        aliases: ["farenheit", "c->f"],
        short_descrip: "Convert °C to °F",
        full_descrip: "Usage: `$c->f <°C>`",
        hidden: true,
        function: (bot, msg, args) => {
            if (args.length === 0) return "Not Enough Arguments: `<°C>`";
            const C = parseFloat(args[0]);
            if (C !== C) return "Input must be a number"; // better than isNaN
            return (C * 9 / 5 + 32).toFixed(1) + "°F";
        }
    },
    inferiorTempToCelsius: {
        name: "celsius",
        aliases: ["celcius", "f->c"],
        short_descrip: "Convert °F to °C",
        full_descrip: "Usage: `$f->c <°F>`",
        hidden: true,
        function: (bot, msg, args) => {
            if (args.length === 0) return "Not Enough Arguments: `<°F>`";
            const F = parseFloat(args[0]);
            if (F !== F) return "Input must be a number";
            return ((F - 32) * 5 / 9).toFixed(1) + "°C";
        }
    },
    cmToInches: {
        name: "inches",
        aliases: ["cm->inch", "cm->inches", "inch"],
        short_descrip: "Convert cm to inches",
        full_descrip: "Usage: `$cm->inch <cm>`",
        hidden: true,
        function: (bot, msg, args) => {
            if (args.length === 0) return "Not Enough Arguments: `<cm>`";
            const cm = parseFloat(args[0]);
            if (cm !== cm) return "Input must be a number";
            return (cm / 2.54).toFixed(2) + '"';
        }
    },
    inchesToCm: {
        name: "centimeters",
        aliases: ["inch->cm", "inches->cm", "cm"],
        short_descrip: "Convert inches to cm",
        full_descrip: "Usage: `$inch->cm <inches>`",
        hidden: true,
        function: (bot, msg, args) => {
            if (args.length === 0) return "Not Enough Arguments: `<inches>`";
            const inch = parseFloat(args[0]);
            if (inch !== inch) return "Input must be a number";
            return (inch * 2.54).toFixed(2) + "cm";
        }
    },
    // COMMAND that adds a role to a user. Defaults to sender
    addRole: {
        name: "addrole",
        aliases: ["ar"],
        short_descrip: "Gives a user a role",
        full_descrip: "Usage `$ar <role_id> [user_id]`\nuser_id defaults to the user that calls the command. Only works if called from the same server that has the role",
        hidden: true, // T?
        function: async (bot, msg, args) => {
            if (!users.hasCmdAccess(msg)) return;
            if (args.length === 0) return "Not Enough Arguments: `<role_id> [user_id]`";

            const member = args[1] ?? msg.author.id;

            try {
                await bot.addGuildMemberRole(msg.channel.guild.id, member, args[0], `Command Call by ${msg.author.username}`);
                return `Gave user ${member} role ${args[0]}`;
            } catch (e) {
                return "Failed to assign role```" + e + "```";
            }
        }
    },
    // COMMAND removes a role from a user. Defaults to sender
    removeRole: {
        name: "removerole",
		aliases: ["rmr"],
        short_descrip: "Removes a role from a user",
        full_descrip: "Usage `$rmr <role_id> [user_id]\nuser_id defaults to the user that calls the command. Only works if called from the same server that has the role",
        hidden: true,
        function: async (bot, msg, args) => {
            if (!users.hasCmdAccess(msg)) return;
            if (args.length == 0) return "Not Enough Arguments: `<role_id> [user_id]`";

            const member = args[1] ?? msg.author.id;

            try {
                await bot.removeGuildMemberRole(msg.channel.guild.id, member, args[0], `Command Call by ${msg.author.username}`);
                return `Removed role ${args[0]} from user ${member}`;
            } catch (e) {
                return "Failed to remove role```" + e + "```";
            }
        }
    },
    // COMMAND adds a reaction to a given message
    addReaction: {
        name: "react",
        aliases: ["addReaction", "addReactions"],
        short_descrip: "Reacts to a message",
        full_descrip: "Usage `$react <channel_id> <message_id> <emojis...>`\nThis will reacat with multiple space separated emojis. For a list of channel names that can be used instead of `<channel_id>` use `$lc`",
        hidden: true, // T?
        function: async (bot, msg, args) => {
            if (!users.hasCmdAccess(msg)) return;
            if (args.length < 3) return "Not Enough Arguments: `<channel_id> <message_id> <emojis...>`";

            const channel = args.shift(),
                  message = args.shift();

            for (let i = 0; i < args.length; i++) if (args[i].includes(":")) args[i] = args[i].substr(2, -3);

            args.forEach(emoji => {
                bot.addMessageReaction(chat.chooseChannel(channel), message, emoji)
                    .catch((e) => {
                        return "Failed to add reaction```" + e + "```";
                    });
            });
        }
    },
    mentionChannel: channel_id => `<#${channel_id}>`,
    getChannelID: arg => chat.chooseChannel(arg),
    mentionUser: user_id => `<@${user_id}>`,
    getUserID: arg => (arg.startsWith("<@") && arg.endsWith(">")) ? arg.substr(2, -3) : arg
};

function pad(s) {
    return (s < 10 ? "0" : "") + s;
}