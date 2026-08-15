const fs = require("fs");
const path = require('path')
const request = require("request");
const LOG_LOADS = false;
var SAVE_PATH = "./saves"

function saveFile(filename, content){
	module.exports.makeFolderIfNotExist(SAVE_PATH+"/");
	try {
		fs.writeFileSync(SAVE_PATH+"/"+filename, content)
	} catch (e) {
		console.log("FAILED TO SAVE " + filename)
	}
}

module.exports = {
	setSavePath:function(newpath) {
		if (newpath == undefined) newpath = "./saves"
		SAVE_PATH = newpath
	},
	getSavePath:function() {
		return SAVE_PATH
	},
	getFullSavePath:function() {
		if (SAVE_PATH.startsWith("./")) {
			return path.join(process.cwd(), SAVE_PATH)
		}
		return SAVE_PATH
	},
	makeFolderIfNotExist:function(folderpath) {
		if (!fs.existsSync(folderpath)){
			fs.mkdirSync(folderpath);
		}
	},
	downloadFromUrl:function(url, savepath, callback) {
		request.get(url)
        .on('error', console.error)
        .pipe(fs.createWriteStream(savepath))
		// Some callers provide no callback
		.on('close', callback ? callback : () => {});
	},
	downloadAllFromUrl:async function(urls, paths, callback) {
		for (let i = 0; i < urls.length; i++) {
			await new Promise((resolve, reject) => {
				request.get(urls[i])
				.pipe(fs.createWriteStream(paths[i]))
				.on('error', console.error)
				.on('close', resolve)
			})
		}
		if (callback) callback()
	},
	saveObject:function(filename, object){
		if (!filename.toUpperCase().endsWith(".JSON")) filename += ".json"
		if (LOG_LOADS) console.log(`Saving ${filename}...`)
		saveFile(filename, JSON.stringify(object));
	},
	readObject:function(filename){
		try {
			if (!filename.toUpperCase().endsWith(".JSON")) filename += ".json"
			var data = fs.readFileSync(SAVE_PATH+"/"+filename);
			var obj = JSON.parse(data);
			if (LOG_LOADS) console.log(`${filename} loaded`)
			return obj
		} catch (err) {
			console.log("Could not read file " + filename);
			return null;
		}
	}
};
