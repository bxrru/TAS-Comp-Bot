const fs = require("fs");

module.exports = {
	hasCmdAccess:function(member) {
		var content = fs.readFileSync("./bot-files/users/use_cmds.txt", "utf8");
		return content.includes(member.id) || content.includes(member.username + "#" + member.discriminator);
	},
	isBanned:function(member) {
		var content = fs.readFileSync("./bot-files/users/comp_banned.txt", "utf8");
		return content.includes(member.id) || content.includes(member.username + "#" + member.discriminator);
	},
	// TODO test
	addCmdAccess:function(usernameAndTag) {
		fs.appendFile("./bot-files/users/use_cmds.txt", "\n" + usernameAndTag, function (err) {
			if (err)
				console.log(err);
  			console.log("added member " + usernameAndTag);
		});
	},
	// TODO test
	addBan:function(usernameAndTag) {
		fs.appendFile("./bot-files/users/comp_banned.txt", "\n" + usernameAndTag, function (err) {
			if (err)
				console.log(err);
  			console.log("banned member " + usernameAndTag);
		});
	}
};
