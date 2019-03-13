process.title = "CompBOT";
console.log("Starting...");

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
    if(msg.content === "$ping") {
        bot.createMessage(msg.channel.id, "Pong!");
    } else if (msg.content == "$restart") {
		restart();
	}
});

bot.connect();