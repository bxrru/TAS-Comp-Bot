const fs = require("fs");
const miscfuncs = require("./miscfuncs.js");

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
function saveFile(filename, content){
	miscfuncs.makeFolderIfNotExist("./saves/");
	fs.writeFile("./saves/"+filename, content, function(err, data) {
		if (err) console.log(err);
		console.log("Successfully created " + filename);
	});
}

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
		saveFile("save.cfg", newfilecontent.substring(0, newfilecontent.length - 1));
	},
	setDefaultVar:function(thingToReset){
		for (i = 0;i < saves.length;i++){
			//if (thingToReset == saves[i])
				//saves[i] = defaultVars[i];
		}
	},

	saveObject:function(filename, object){
		saveFile(filename, JSON.stringify(object));
	},

	readObject:function(filename){
		try {
			var data = fs.readFileSync("./saves/"+filename);
			var obj = JSON.parse(data);
			return obj
		} catch (err) {
			console.log("Could not read file " + filename, err);
			return {};
		}
	}

	// TODO
	// add cfg checker and fix if cfg is missing something / broken
};
