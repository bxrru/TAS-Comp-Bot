process.title = "CompBOT";
log("Starting...");

const Eris = require("eris");
var miscfuncs = require("./miscfuncs.js");

var bot = new Eris("token");

bot.on("ready", () => {
    log("Ready!");
	miscfuncs.test();
});

bot.connect();