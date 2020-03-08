const fs = require("fs");
const request = require("request");
const LOG_LOADS = false;

function saveFile(filename, content){
	module.exports.makeFolderIfNotExist("./saves/");
	try {
		fs.writeFileSync("./saves/"+filename, content)
	} catch (e) {
		console.log("FAILED TO SAVE " + filename)
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
		if (!filename.toUpperCase().endsWith(".JSON")) filename += ".json"
		if (LOG_LOADS) console.log(`Saving ${filename}...`)
		saveFile(filename, JSON.stringify(object));
	},
	readObject:function(filename){
		try {
			if (!filename.toUpperCase().endsWith(".JSON")) filename += ".json"
			var data = fs.readFileSync("./saves/"+filename);
			var obj = JSON.parse(data);
			if (LOG_LOADS) console.log(`${filename} loaded`)
			return obj
		} catch (err) {
			console.log("Could not read file " + filename);
			return null;
		}
	}
};
