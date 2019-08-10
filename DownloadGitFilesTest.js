const fs = require('fs')
const cp = require('child_process')

var username = ""
var password = ""

cp.execSync(`git clone "https://${username}:${password}@github.com/Barryyyyyy/TAS-Comp-Bot"`)
console.log("Downloaded")

var deleteFolderRecursive = function(path){
  if (!fs.existsSync(path)) return // if it doesnt exist, end
  fs.readdirSync(path).forEach(function(file,index) { // loop through each subfile
    var filepath = `${path}/${file}`
    if (fs.lstatSync(filepath).isDirectory()) {
      deleteFolderRecursive(filepath) // recusive call
    } else {
      fs.unlinkSync(filepath) // delete file
    }
  })
  fs.rmdirSync(path)
}

deleteFolderRecursive('./bot-files/')
console.log("Deleted Old Files")

var copyFolderRecursive = function(path, destination){
  if (!fs.existsSync(path)) return
  if (!fs.existsSync(destination)) fs.mkdirSync(destination) // create destination folder if none exists
  fs.readdirSync(path).forEach(file => {
    var filepath = `${path}/${file}`
    if (fs.lstatSync(filepath).isDirectory()) {
      copyFolderRecursive(filepath, `${destination}/${file}`) // copy files in the subfolder
    } else {
      fs.copyFileSync(filepath, `${destination}/${file}`) // copy file
    }
  })
}

copyFolderRecursive('./TAS-Comp-Bot/bot-files/', './bot-files/')
console.log("Copied Files")

deleteFolderRecursive('./TAS-Comp-Bot/')
console.log("Deleted Git Copy")
