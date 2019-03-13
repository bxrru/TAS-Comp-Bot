process.title = "CompBOT";
log("Starting...");

const Eris = require("eris");
var miscfuncs = require("./miscfuncs.js");

// token
var bot = new Eris("qe2Ts0zy6dZgKvDBWG2zLmB7MTQC2XwK");

bot.on("ready", () => {
    log("Ready!");
	miscfuncs.test();
});

bot.connect();