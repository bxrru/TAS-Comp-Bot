const cp = require('child_process')
var bar = "\n====================================================\n"
var AllowUpdates = true
var Started = false
var CompBot

var updateFiles = function() {

  if (!AllowUpdates) return

  var username = ''
  var password = ''

  if (username == '' || password == '') {
    AllowUpdates = false
    console.log(`${bar}WARNING: No username or password entered. Updates Disabled${bar}`)
    return
  }

  try {

    // download new files
    cp.execSync(`git clone "https://${username}:${password}@github.com/Barryyyyyy/TAS-Comp-Bot"`)

    // delete old files
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

    // copy new files
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

    // delete temp download
    deleteFolderRecursive('./TAS-Comp-Bot/')

    start()

  } catch (e) {
    AllowUpdates = false
    console.log("UPDATE FAILED. Updates disabled", e)
  }

}

var start = function() {

  if (Started) return
  console.log("Starting Bot...")
  Started = true

  var CompBot = cp.exec('node ./bot-files/main.js', (error, stdout, stderr) => {
    if (error) {
      Started = false
      console.error(`Error: ${error}`)
      console.log("Press any key to restart bot...")
    }
  });

  // forward STDOUT to console
  CompBot.stdout.on('data', data => console.log(data.toString()))

  // State exit code & update bot-files on custom exit code
  CompBot.on('close', (number, signal) => {
    console.log(`Exit Code: ${number}`)
    Started = false
    if (number == 42) {
      updateFiles()
    } else {
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
