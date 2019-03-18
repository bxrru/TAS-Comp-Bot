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

var pingCommand = bot.registerCommand("ping", (msg, args) => {
	return args.length < 2 ? "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)" : "";
},
{
	description: "ping",
	fullDescription: "To check if the bot is not dead. Tells you time it takes to ping you in ms"
});

// message handle
bot.on("messageCreate", (msg) => {
	var str = msg.content.split(" ")[0];
	switch (str) {
		case "$restart":
			if (users.hasCmdAccess(msg.member) && msg.content.split(" ").length < 2) {
				bot.createMessage(msg.channel.id, "restarting");
				console.log("restarting");
				restart();
			}
			break;
		case "$uptime":
			if (users.hasCmdAccess(msg.member) && msg.content.split(" ").length < 2) {
				bot.createMessage(msg.channel.id, miscfuncs.formatSecsToStr(process.uptime()));
				console.log("uptime : " + miscfuncs.formatSecsToStr(process.uptime()));
			}
			break;
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
		case "$test":
			if (users.hasCmdAccess(msg.member)) {
				bot.createMessage(msg.channel.id, "$test");
				console.log("test");
			}
		default:
			break;
	}
});

bot.connect();
