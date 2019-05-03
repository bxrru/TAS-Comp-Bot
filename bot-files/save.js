const fs = require("fs");

// make sure the length of lists are the same
var saves = [
	"allowsubmission",
	"tasknum"
];

var defaultVars = [
	false,
	0
];

//function cfgchange(thingToChange 

module.exports = {
	saveoption:function(thingToSave, newVar){
		for (i = 0; i < saves.length; i++){
			if (saves[i] == thingToSave){
				// TODO finish editing save option
				// file.change
			}
		}
	},
	// makes new cfg file with default vars
	makeNewSaveFile:function(){
		var newfilecontent = ""
		for (i = 0;i < saves.length;i++)
			newfilecontent += saves[i] + ": " + defaultVars[i] + "\n";
		
		fs.writeFile("save.cfg", newfilecontent.substring(0, newfilecontent.length - 1), function(err, data) {
			if (err) console.log(err);
			console.log("Successfully made new save config");
		});
	},
	setDefaultVar:function(thingToReset){
		for (i = 0;i < saves.length;i++){
			//if (thingToReset == saves[i])
				//saves[i] = defaultVars[i];
		}
	}
	
	// TODO
	// add cfg checker and fix if cfg is missing something / broken
};
