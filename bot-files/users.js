const fs = require("fs");

module.exports = {
	hasCmdAccess:function(userid) {
		return fs.readFileSync("./bot-files/users/use_cmds.txt", "utf8").includes(userid);
	}
};