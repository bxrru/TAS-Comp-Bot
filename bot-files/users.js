const fs = require("fs");

module.exports = {
	hasCmdAccess:function(member) {
		var content = fs.readFileSync("./bot-files/users/use_cmds.txt", "utf8");
		return content.includes(member.id) || content.includes(member.username + "#" + member.discriminator);
	}
};