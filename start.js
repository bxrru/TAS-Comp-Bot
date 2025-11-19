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
if (!process.argv[2].startsWith(`./`)) process.argv[2] = `./` + process.argv[2]
const Info = require(process.argv[2])

// Helper function
var deleteFolderRecursive = function(path) {
  if (!fs.existsSync(path)) return // if it doesnt exist, end
  fs.readdirSync(path).forEach(function(file,index) { // loop through each subfile
    var filepath = `${path}/${file}`
    if (fs.lstatSync(filepath).isDirectory()) {
      deleteFolderRecursive(filepath) // recurse
    } else {
      fs.unlinkSync(filepath)
    }
  })
  fs.rmdirSync(path)
}

// Helper function
var copyFolderRecursive = function(path, destination) {
  if (!fs.existsSync(path)) return
  if (!fs.existsSync(destination)) fs.mkdirSync(destination) // create destination folder if none exists
  fs.readdirSync(path).forEach(file => {
    var filepath = `${path}/${file}`
    if (fs.lstatSync(filepath).isDirectory()) {
      copyFolderRecursive(filepath, `${destination}/${file}`) // recurse
    } else {
      fs.copyFileSync(filepath, `${destination}/${file}`)
    }
  })
}

var updateFiles = function(useDev = false) {

  if (!AllowUpdates) return

  try {

    // the conditions.lua file is the task specific script (not updated on github)
    // make sure this file is preserved (if it exists)
    if (fs.existsSync("./TimingLua/Conditions.lua")) {
      fs.copyFileSync("./TimingLua/Conditions.lua", "./saves/temp_conditions.lua")
    }

    // download new files
    deleteFolderRecursive('./TAS-Comp-Bot') // just incase it's leftover
    if (useDev) {
      cp.execSync(`git clone "https://github.com/bxrru/TAS-Comp-Bot" --branch dev`)
    } else {
      cp.execSync(`git clone "https://github.com/bxrru/TAS-Comp-Bot"`)
    }

    deleteFolderRecursive(Info.Bot_Files_Path)
    copyFolderRecursive('./TAS-Comp-Bot/bot-files/', Info.Bot_Files_Path)
    
    deleteFolderRecursive("./TimingLua/")
    copyFolderRecursive("./TAS-Comp-Bot/TimingLua/", "./TimingLua")
    if (fs.existsSync("./saves/temp_conditions.lua")) {
      fs.copyFileSync("./saves/temp_conditions.lua", "./TimingLua/Conditions.lua")
    }

    deleteFolderRecursive('./TAS-Comp-Bot/') // temp download

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
      try {
        fs.writeFileSync(`./crash.log`, `${error}`)
      } catch (e) {
        console.error(`Failed to write crash log ${e}\n${error}`)
      }
    }
  });

  // forward STDOUT to console
  CompBot.stdout.on('data', data => console.log(data.toString()))

  // State exit code & update bot-files on custom exit code
  CompBot.on('close', (number, signal) => {
    console.log(`Exit Code: ${number}` + (number == 42 || number == 43 ? ` UPDATING` : ` (No Update)`))
    Started = false
    if (number == 42) {
      updateFiles()
    } else if (number == 43) {
      updateFiles(true)
    } else /*if (number == 0 || number == 69)*/{
      start() // keep the bot alive intentionally (always)
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
