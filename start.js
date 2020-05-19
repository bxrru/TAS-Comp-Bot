const cp = require('child_process')
const fs = require('fs')
var bar = "\n====================================================\n"
var AllowUpdates = true
var Started = false
var CompBot

if (process.argv.length < 3) {
  console.log(`Error: Missing Argument. You must specify a bot ex: node .\\start.js .\\my_bot.js`)
  process.exit(0)
}
process.argv[2] = process.argv[2].replace(/\\/, `/`)
const Info = require(process.argv[2])

// Helper function
var deleteFolderRecursive = function(path) {
  if (!fs.existsSync(path)) return // if it doesnt exist, end
  fs.readdirSync(path).forEach(function(file,index) { // loop through each subfile
    var filepath = `${path}/${file}`
    if (fs.lstatSync(filepath).isDirectory()) {
      deleteFolderRecursive(filepath) // recusive call
    } else {
      fs.unlinkSync(filepath) // delete file
    }
  })
  fs.rmdirSync(path) // delete directory
}

// Helper function
var copyFolderRecursive = function(path, destination) {
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

var updateFiles = function() {

  if (!AllowUpdates) return

  try {

    // download new files
    deleteFolderRecursive('./TAS-Comp-Bot') // just incase it's leftover
    cp.execSync(`git clone "https://github.com/Barryyyyyy/TAS-Comp-Bot"`)

    // delete old files
    deleteFolderRecursive(Info.Bot_Files_Path)

    // copy new files
    copyFolderRecursive('./TAS-Comp-Bot/bot-files/', Info.Bot_Files_Path)

    // delete temp download
    deleteFolderRecursive('./TAS-Comp-Bot/')

  } catch (e) {
    AllowUpdates = false
    console.log("UPDATE FAILED. Updates disabled", e)

  } finally {
    start()
  }

}

var start = function() {

  if (Started) return

  if (Info.Bot_Token == ''){
    console.log(`${bar}No Bot Token found in ${process.argv[2]}\nUnable to start bot${bar}`)
    process.exit()
  }

  console.log("Starting Bot...")
  Started = true

  var CompBot = cp.exec(`node ${Info.Bot_Files_Path}/main.js ${process.argv[2]}`, (error, stdout, stderr) => {
    if (error) {
      Started = false
      console.error(`Error: ${error}`)
      console.log("Press Enter to restart bot...")
    }
  });

  // forward STDOUT to console
  CompBot.stdout.on('data', data => console.log(data.toString()))

  // State exit code & update bot-files on custom exit code
  CompBot.on('close', (number, signal) => {
    console.log(`Exit Code: ${number}` + number == 42 ? ` UPDATING` : ` (No Update)`)
    Started = false
    if (number == 42) {
      updateFiles()
    } else if (number == 0 || number == 69){
      start() // keep the bot alive
    }
  })

}


var gitTest = function(){
  try {
    var git = cp.execSync('git --version')
    console.log("git installed. Auto-updates enabled")
  } catch (e) {
    AllowUpdates = false
    console.log(`${bar}WARNING: git is not installed. Auto-updates disabled${bar}`)
  }
}

gitTest()
start()

// Restart on key press if there's an error
var readline = require('readline');
var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

rl.on('line', line => start())
