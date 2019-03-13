process.title = "CompBOT";
console.log("Starting...");

const Eris = require("eris");

// other js files
var miscfuncs = require("./miscfuncs.js");
var users = require("./users.js");

// token
var bot = new Eris("");

bot.on("ready", () => {
    console.log("Ready! (" + miscfuncs.getDateTime() + ")");
});

bot.on("messageCreate", (msg) => {
    if(msg.content === "!ping") {
        bot.createMessage(msg.channel.id, "Pong!");
    }
});

bot.connect();