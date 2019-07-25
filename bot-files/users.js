const fs = require("fs");

module.exports = {
	hasCmdAccess:function(author) {
		var content = fs.readFileSync("./bot-files/users/use_cmds.txt", "utf8");
		return content.includes(author.id) || content.includes(author.username + "#" + author.discriminator);
	},
	isBanned:function(author) {
		var content = fs.readFileSync("./bot-files/users/comp_banned.txt", "utf8");
		return content.includes(author.id) || content.includes(author.username + "#" + author.discriminator);
	},
	// TODO test
	addCmdAccess:function(id) {
		fs.appendFile("./bot-files/users/use_cmds.txt", "\n" + id, function (err) {
			if (err)
				console.log(err);
  			console.log("added member " + id);
		});
	},
	// TODO test
	addBan:function(usernameAndTag) {
		fs.appendFile("./bot-files/users/comp_banned.txt", "\n" + usernameAndTag, function (err) {
			if (err)
				console.log(err);
  			console.log("banned member " + usernameAndTag);
		});
	},
	getUserCallback:function(bot, ID, callback){
		bot.getDMChannel(ID).then((dm) => {
			return callback && callback(null, dm.recipient, bot);
		}).catch((err) => {
			console.log("Failed to retrieve user: " + err)
			return callback && callback(err);
		})
	},
	getUserAsync:async function(bot, ID){
		try {
			let dm = await bot.getDMChannel(ID);
			return dm.recipient;
		} catch (error) {
			console.log("Failed to retrieve user: " + error);
			return {};
		}
	}
};
/*
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
*/
