const cp = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')
const BAR = '\n====================================================\n'
let AllowUpdates = true
let Started = false
let CompBot = null

if (process.argv.length < 3) {
    console.log(
        `Error: Missing Argument. You must specify a bot ex: node .\\start.js .\\my_bot.js`
    )
    process.exit(0)
}
process.argv[2] = process.argv[2].replace(/\\/, `/`)
if (!process.argv[2].startsWith(`./`)) process.argv[2] = `./` + process.argv[2]
const Info = require(process.argv[2])

// Helper function
function deleteFolderRecursive(folderpath) {
    if (!fs.existsSync(folderpath)) return // if it doesnt exist, end
    fs.readdirSync(folderpath).forEach(function (file, index) {
        // loop through each subfile
        const filepath = path.join(folderpath, file)
        if (fs.lstatSync(filepath).isDirectory()) {
            deleteFolderRecursive(filepath) // recurse
        } else {
            fs.unlinkSync(filepath)
        }
    })
    fs.rmdirSync(folderpath)
}

// Helper function
function copyFolderRecursive(folder, destination) {
    if (!fs.existsSync(folder)) return
    if (!fs.existsSync(destination)) fs.mkdirSync(destination) // create destination folder if none exists
    fs.readdirSync(folder).forEach((file) => {
        const filepath = path.join(folder, file)
        if (fs.lstatSync(filepath).isDirectory()) {
            copyFolderRecursive(filepath, path.join(destination, file)) // recurse
        } else {
            fs.copyFileSync(filepath, path.join(destination, file))
        }
    })
}

function updateFiles() {
    if (!AllowUpdates) return

    try {
        // the conditions.lua file is the task specirfic script (not updated on github)
        // make sure this file is preserved (if it exists)
        if (fs.existsSync('./TimingLua/Conditions.lua')) {
            fs.copyFileSync(
                './TimingLua/Conditions.lua',
                './saves/temp_conditions.lua'
            )
        }

        // download new files
        deleteFolderRecursive('./TAS-Comp-Bot') // just incase it's leftover
        cp.execSync(`git clone "https://github.com/bxrru/TAS-Comp-Bot"`)

        deleteFolderRecursive(Info.Bot_Files_Path)
        copyFolderRecursive('./TAS-Comp-Bot/bot-files/', Info.Bot_Files_Path)

        deleteFolderRecursive('./TimingLua/')
        copyFolderRecursive('./TAS-Comp-Bot/TimingLua/', './TimingLua')
        if (fs.existsSync('./saves/temp_conditions.lua')) {
            fs.copyFileSync(
                './saves/temp_conditions.lua',
                './TimingLua/Conditions.lua'
            )
        }

        deleteFolderRecursive('./TAS-Comp-Bot/') // temp download
    } catch (e) {
        AllowUpdates = false
        console.log('UPDATE FAILED. Updates disabled', e)
    } finally {
        CompBot = start()
    }
}

function start() {
    if (Started) return

    if (Info.Bot_Token == '') {
        console.log(
            `${BAR}No Bot Token found in ${process.argv[2]}\nUnable to start bot${BAR}`
        )
        process.exit()
    }

    console.log('Starting Bot...')
    Started = true

    const newCompBot = cp.exec(
        `node ${Info.Bot_Files_Path}/main.js ${process.argv[2]}`,
        (error, stdout, stderr) => {
            if (error) {
                try {
                    fs.writeFileSync(`./crash.log`, `${error}`)
                } catch (e) {
                    console.error(`Failed to write crash log ${e}\n${error}`)
                }
            }
        }
    )

    // forward STDOUT to console
    newCompBot.stdout.on('data', (data) => console.log(data.toString()))

    // State exit code & update bot-files on custom exit code
    newCompBot.on('close', (number, signal) => {
        console.log(
            `Exit Code: ${number}` +
                (number == 42 ? ` UPDATING` : ` (No Update)`)
        )
        Started = false
        if (number == 42) {
            updateFiles()
        } /*if (number == 0 || number == 69)*/ else {
            CompBot = start() // keep the bot alive intentionally (always)
        }
    })

    return newCompBot
}

function gitTest() {
    try {
        cp.execSync('git --version')
        console.log('git installed. Auto-updates enabled')
    } catch (e) {
        AllowUpdates = false
        console.log(
            `${BAR}WARNING: git is not installed. Auto-updates disabled${BAR}`
        )
    }
}

gitTest()
CompBot = start()

// Restart on key press if there's an error
const readline = require('node:readline')
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false,
})

rl.on('line', (line) => start())
