const fs = require("fs");

module.exports = {
	makeNewSaveFile:function(){
		fs.writeFile("save.cfg", 
			"allowsubmission: false\ntasknum: 0"
		, function(err, data) {
			if (err) console.log(err);
			console.log("made new save file");
		});
	},
	saveAllowsubmissionAndTaskNum:function(allowsubmissionstatus, tasknum) {
		editFileLine("save.cfg", 1, "allowsubmission: " + allowsubmissionstatus, function(err) {
			if (err) console.log(err);
		});
		editFileLine("save.cfg", 2, "tasknum: " + tasknum, function(err) {
			if (err) console.log(err);
		});
	}
};
