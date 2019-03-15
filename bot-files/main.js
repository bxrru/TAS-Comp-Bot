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
    // bot's status)
    bot.user.setPresence({
        game: { 
            name: "codes inside me",
            type: 'WATCHING'
        },
        status: "dnd"
    })
});

// message handle
bot.on("messageCreate", (msg) => {
	switch (msg.content) {
		case "$ping":
			bot.createMessage(msg.channel.id, "baited (" + (new Date().getTime() - msg.timestamp) / 1000 + "ms)");
			break;
		case "$restart":
			if (users.hasCmdAccess(msg.member)) {
				bot.createMessage(msg.channel.id, "restarting");
				console.log("restarting");
				restart();
			}
			break;
		case "$uptime":
			if (users.hasCmdAccess(msg.member)) {
				bot.createMessage(msg.channel.id, miscfuncs.formatSecsToStr(process.uptime()));
				console.log("uptime : " + miscfuncs.formatSecsToStr(process.uptime()));
			}
			break;
		default:
			if (msg.content.startsWith("$addCmdAccess ") && users.hasCmdAccess(msg.member)) {
				var user = msg.content.split(" ", 2)[1].replace("@", "");
				users.addCmdAccess(user);
				bot.createMessage(msg.channel.id, "successfully added user " + user + " to CmdAccess");
				console.log("successfully added user " + user + " to CmdAccess");
			} else if (msg.content.startsWith("$addBan ") && users.hasCmdAccess(msg.member)) {
				var user = msg.content.split(" ", 2)[1].replace("@", "");
				users.addBan(user);
				bot.createMessage(msg.channel.id, "successfully banned user " + user);
				console.log("successfully banned user " + user);
			} else if (msg.content.startsWith("$test") && users.hasCmdAccess(msg.member)) {
				bot.createMessage(msg.channel.id, "got time : " + (new Date().getTime()) + " and msg time stamp " + msg.timestamp);
				console.log("test");
			}
			break;
	}
});

bot.connect();
