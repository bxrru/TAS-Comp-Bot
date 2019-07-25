const fs = require("fs");
const miscfuncs = require("./miscfuncs.js");

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
	editFileLine:function(directory, line, newshit, callback){
		var data = fs.readFileSync(directory, 'utf8');
		var lines = data.split("\n");

		if(+line > lines.length)
			throw new Error("line number larger than file lines count");

		lines[line] = newshit;

		var newlines = "";

		for (var i = 0; i < lines.length; i++)
			newlines = lines[i] + "\n";

		fs.writeFile(directory, newlines, function(err, data) {
			if (err) throw new err;
		});
	},
	makeFolderIfNotExist:function(path) {
		if (!fs.existsSync(path)){
			fs.mkdirSync(path);
		}
	},
	deleteFilesInFolder:function(directory) {
		fs.readdir(directory, (err, files) => {
			if (err) throw err;

			for (const file of files) {
				fs.unlink(path.join(directory, file), err => {
					if (err) throw err;
				});
			}
		});
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
			console.log("Successfully read "+filename);
			return obj
		} catch (err) {
			console.log("Could not read file " + filename, err);
			return {};
		}
	}

	// TODO
	// add cfg checker and fix if cfg is missing something / broken
};
