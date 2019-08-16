const fs = require("fs");
const miscfuncs = require("./miscfuncs.js");
const request = require("request");

//function cfgchange(thingToChange
function saveFile(filename, content){
	module.exports.makeFolderIfNotExist("./saves/");
	try {
		fs.writeFileSync("./saves/"+filename, content)
	} catch (e) {
		console.log("FAILED TO LOAD " + filename)
	}
}

module.exports = {
	makeFolderIfNotExist:function(path) {
		if (!fs.existsSync(path)){
			fs.mkdirSync(path);
		}
	},
	downloadFromUrl:function(url, path) {
		request.get(url)
        .on('error', console.error)
        .pipe(fs.createWriteStream(path));
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
			console.log("Could not read file " + filename);
			return null;
		}
	}

	// TODO
	// add cfg checker and fix if cfg is missing something / broken
};
