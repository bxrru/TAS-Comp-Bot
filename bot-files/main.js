process.title = "CompBOT";
console.log("Starting main.js...");

const Eris = require("eris");

// other js files
var miscfuncs = require("./miscfuncs.js");
var users = require("./users.js");

// token
var bot = new Eris("NTU1NDg5Njc5NDc1MDgxMjI3.D2smAQ.wJYGkGHK5mdC15kEX3_0wThBA7w");

bot.on("ready", () => {
    console.log("Ready! (" + miscfuncs.getDateTime() + ")");
});

bot.on("messageCreate", (msg) => {
	if (msg.content === "$ping" && users.hasCmdAccess(msg.member)) {
		bot.createMessage(msg.channel.id, "baited (" + new Date().getTime() - msg.timestamp + "ms)");
	} else if (msg.content == "$restart" && users.hasCmdAccess(msg.member)) {
		bot.createMessage(msg.channel.id, "restarting");
		console.log("restarting");
		restart();
	} else if (msg.content == "$test" && users.hasCmdAccess(msg.member)) {
		bot.createMessage(msg.channel.id, msg.member.id);
		console.log("test");
		bot.createMessage(msg.channel.id, users.hasCmdAccess(msg.member.id));
	} else if (msg.content == "$uptime" && users.hasCmdAccess(msg.member)) {
		bot.createMessage(msg.channel.id, miscfuncs.formatSecsToStr(process.uptime()));
	}
});

bot.connect();
