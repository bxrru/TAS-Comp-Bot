const fs = require("fs");

module.exports = {
	hasCmdAccess:function(member) {
		var content = fs.readFileSync("./bot-files/users/use_cmds.txt", "utf8");
		return content.includes(member.id) || content.includes(member.username + "#" + member.discriminator);
	},
	// TODO test
	addCmdAccess:function(member) {
		fs.appendFile("./bot-files/users/use_cmds.txt", member.username + "#" + member.discriminator, function (err) {
			if (err)
				console.log(err);
  			console.log("added member " + member.username + "#" + member.discriminator);
		});
	}
};
