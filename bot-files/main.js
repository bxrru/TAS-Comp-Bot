process.title = "CompBOT";
console.log("Starting main.js...");

const Eris = require("eris");

// other js files
var miscfuncs = require("./miscfuncs.js");
var users = require("./users.js");

// token
var bot = new Eris.CommandClient("NTU1NDg5Njc5NDc1MDgxMjI3.D2smAQ.wJYGkGHK5mdC15kEX3_0wThBA7w", {}, {
	description: "List of commands",
	prefix: "$"
});

bot.on("ready", () => {
    console.log("Ready! (" + miscfuncs.getDateTime() + ")");
});

// public commands
bot.registerCommand("ping", (msg, args) => {
	if (args.length < 1)
		return "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)";
},
{
	description: "ping",
	fullDescription: "To check if the bot is not dead. Tells you time it takes to bait you in ms"
});

// specials
bot.registerCommand("restart", (msg, args) => {
	if (users.hasCmdAccess(msg.member)) {
		restart();
	}
},
{
	description: "restarts bot",
	fullDescription: "This restarts bot.",
	hidden: true
});

bot.registerCommand("test", (msg, args) => {
	if (users.hasCmdAccess(msg.member))
		return args;
},
{
	description: "test (don't use)",
	fullDescription: "its a test command (don't use)",
	hidden: true
});

bot.registerCommand("uptime", (msg, args) => {
	if (users.hasCmdAccess(msg.member) && msg.content.split(" ").length < 2) {
		bot.createMessage(msg.channel.id, miscfuncs.formatSecsToStr(process.uptime()));
		console.log("uptime : " + miscfuncs.formatSecsToStr(process.uptime()));
	}
},
{
	description: "Prints uptime",
	fullDescription: "Prints uptime",
	hidden: true
});

// message handle
bot.on("messageCreate", (msg) => {
	var str = msg.content.split(" ")[0];
	switch (str) {
		case "$addCmdAccess":
			if (users.hasCmdAccess(msg.member) && msg.content.split(" ").length == 2) {
				var user = msg.content.split(" ", 2)[1].replace("@", "");
				users.addCmdAccess(user);
				bot.createMessage(msg.channel.id, "successfully added user " + user + " to CmdAccess");
				console.log("successfully added user " + user + " to CmdAccess");
			}
			break;
		case "$addBan":
			if (users.hasCmdAccess(msg.member) && msg.content.split(" ").length == 2) {
				var user = msg.content.split(" ", 2)[1].replace("@", "");
				users.addBan(user);
				bot.createMessage(msg.channel.id, "successfully banned user " + user);
				console.log("successfully banned user " + user);
			}
			break;
		case "$allowSubmissions":
			break;
		default:
			break;
	}
});

bot.connect();
