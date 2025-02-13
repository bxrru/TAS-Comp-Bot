// m64 header information source: http://tasvideos.org/EmulatorResources/Mupen/M64.html

const fs = require("fs")
const users = require("./users.js")
const save = require("./save.js")
const cp = require("child_process")
const process = require("process")
const request = require("request")
const path = require("path")

// The following are used for the encoding command
// They will need to be manually set before running an instance of the bot
// Make sure that the manage bad roms (etc.) settings in Mupen are disabled so that romhacks can be run from commandline

// these values are loaded from /saves/m64.json (don't edit them here)
var MUPEN_PATH = "C:\\..."
let LUA_SCRIPTS = []
var GAME_PATH = "C:\\..." // all games will be run with GAME_PATH + game + .z64 (hardcoded J to run with .n64)
var KNOWN_CRC = { // supported ROMS // when the bot tries to run the ROMs, it will replace the spaces in the names here with underscores
    //"AF 5E 2D 01": "Ghosthack v2", // depricated
    //"63 83 23 38": "No Speed Limit 64 (Normal)"
}
var MUPEN_USES_FFMPEG = false

var EncodingQueue = [] // {st url, m64 url, filename, discord channel id, user id}

// Note: the lua script needs to have a built in failsafe. Sample code:
/*
local f = io.open("maxtimelimit.txt")
local MAX_WAIT_TIME = f:read("*n")
local timer = 0
local last_frame = -1

function autoexit()
    if emu.samplecount() ~= last_frame then
        timer = timer + 1
    end
    last_frame = emu.samplecount()
    if timer == MAX_WAIT_TIME then
        f = io.open("TLE.txt", "w")
        io.close(f)
        os.exit()
    end
end

emu.atinput(autoexit)
*/

const BitField = 0
const UInt = 1
const Integer = 2 // little endian
const AsciiString = 3
const UTFString = 4
const Bytes = 5

// m64 header information source: http://tasvideos.org/EmulatorResources/Mupen/M64.html
// each entry is offset: [type, byte size, description]
const HEADER = {
    0x000: [Bytes, 4, "Signature: 4D 36 34 1A \"M64\\x1A"],
    0x004: [Integer, 4, "Version number (3)"],
    0x008: [Integer, 4, "Movie UID (recording epoch time)"],
    0x00C: [UInt, 4, "Number of VIs"],
    0x010: [UInt, 4, "Rerecord count"],
    0x014: [UInt, 1, "VIs per second"],
    0x015: [UInt, 1, "Number of controllers"],
    //0x016: [UInt, 2, `Reserved (0)`],
    0x018: [Integer, 4, "number of input samples for any controller"],
    0x01C: [UInt, 2, "Movie start type (from snapshot is 1, from power-on is 2)"],
    0x01E: [UInt, 2, "Reserved (0)"],
    0x020: [BitField, 4, "Controllers (from least to most significant, the bits are for controllers 1-4: present, has mempack, has rumblepak)"],
    //0x024: [UInt, 160, `Reserved (0)`],
    0x0C4: [AsciiString, 32, "internal name of ROM used when recording (directly from ROM)"],
    0x0E4: [UInt, 4, "ROM CRC32"],
    0x0E8: [UInt, 2, "ROM country code"],
    //0x0EA: [UInt, 56 `Reserved (0)`],
    0x122: [AsciiString, 64, "Video plugin used when recording"],
    0x162: [AsciiString, 64, "Sound plugin used when recording"],
    0x1A2: [AsciiString, 64, "Input plugin used when recording"],
    0x1E2: [AsciiString, 64, "RSP plugin used when recording"],
    0x222: [UTFString, 222, "Movie author (UTF-8)"],
    0x300: [UTFString, 256, "Movie description (UTF-8)"]
}

// ===============
// Buffer Handling
// ===============

// intToLittleEndian(int, int)
// returns a buffer containing the base 10 int in little endian form
// Ex: intToLittleEndian(7435, 4) => <0b 1d 00 00>
function intToLittleEndian(int, byteLength) {
    var hex = int.toString(16).toUpperCase() // convert to hex
    while (hex.length < 2 * byteLength) hex = `0${ hex}` // fill the size
    var bytes = hex.match(/.{2}/g) // split into pairs
    var reverse = []
    bytes.forEach((byte) => reverse.unshift(`0x${byte}`)) // reverse order
    return Buffer.from(reverse) // convert to buffer
}

// littleEndianToInt(Buffer)
// converts a buffer in little endian to an int in base 10
// Ex: littleEndianToInt(<0b 1d 00 00>) => 7435
function littleEndianToInt(buffer) {
    var hex = ""
    var array = [...buffer]
    array.forEach((byte) => {
        byte = byte.toString(16).toUpperCase() // force hex
        if (byte.toString().length < 2) {
            hex = `0${ byte }${hex}`
        } else {
            hex = byte + hex
        }
    })
    return parseInt(hex, 16)
}

// bufferToString(Buffer)
// converts a buffer to a string and removes trailing zeros
function bufferToString(buffer, encoding = "utf8") {
    while (Buffer.byteLength(buffer) > 0 && buffer[Buffer.byteLength(buffer) - 1] == 0) {
        buffer = buffer.subarray(0, Buffer.byteLength(buffer) - 1)
    }
    return buffer.toString(encoding)
}

// bufferToStringLiteral(Buffer)
// displays a buffer as a string
// Ex: bufferToStringLiteral(<58 61 6E 64 65 72>) => "58 61 6E 64 65 72"
function bufferToStringLiteral(buffer) {
    var result = ""
    var array = [...buffer]
    array.forEach((byte) => {
        byte = byte.toString(16).toUpperCase() // force hex
        result += `${byte.padStart(2, "0")} `
    })
    return result.substring(0, result.length - 1)
}

// bufferInsert(Buffer, int, int, Buffer)
// inclusive lower bound, exclusive upper bound
// Ex: bufferInsert(<00 01 02 03 04>, 2, 4, <06, 09>) => <00, 01, 06, 09, 04>
function bufferInsert(buffer, start, end, insert) {
    return Buffer.concat([
        buffer.subarray(0, start),
        insert,
        buffer.subarray(end, Buffer.byteLength(buffer))
    ])
}

// stringLiteralToBuffer(string, size)
// Converts the string to a buffer
// pads the right with 0 to fill size
// Any non-hex characters are set to F
// Ex: stringLiteralToBuffer("ABG21", 8) => <AB F2 10 00>
function stringLiteralToBuffer(str, size) {
    str = str.toUpperCase().replace(/ /g, "").replace(/[^0-9A-F]/, "F")
    if (str.length % 2 == 1) str += "0"
    str = str.match(/.{2}/g)
    var bytes = []
    for (let i = (size + (size % 2)) / 2 - 1; i >= 0; i--) {
        if (i < str.length) {
            bytes.unshift(`0x${str[i]}`)
        } else {
            bytes.unshift("0x00")
        }
    }
    return Buffer.from(bytes)
}

function read(addr, file) {
    if (!(addr in HEADER)) return
    var type = HEADER[addr][0]
    var data = file.subarray(addr, addr+HEADER[addr][1])

    switch (type) {
        case BitField:
            return littleEndianToInt(data).toString(2) // todo: interpret so there's a message like "P1, P2 (mempack), P4 (mempack+rumble)"
        case UInt: case Integer:
            return littleEndianToInt(data)
        case AsciiString:
            return bufferToString(data, "ascii")
        case UTFString:
            return bufferToString(data)
        case Bytes:
            return bufferToStringLiteral(data)
    }
}

function write(addr, data, file) {
    if (!(addr in HEADER)) return
    var type = HEADER[addr][0]
    
    switch (type) {
        case BitField:
            if (isNaN(data)) {
                data = 1 // default to enable P1
            } else if (isNaN(`0b${data}`)) {
                data = Number(data)
            } else {
                data = Number(`0b${data}`) // parseInt(data, 2)
            }
            data = intToLittleEndian(data, HEADER[addr][1])
            break
        case UInt:
            if (isNaN(data) || Number(data) < 0) {
                data = 0
            } else {
                data = Number(data)
            }
            data = intToLittleEndian(data, HEADER[addr][1])
            break
        case Integer:
            data = isNaN(data) ? 0 : Number(data)
            data = intToLittleEndian(data, HEADER[addr][1])
            break
        case AsciiString:
            data = Buffer.from(data, "ascii")
            break
        case UTFString:
            data = Buffer.from(data)
            break
        case Bytes:
            data = stringLiteralToBuffer(data, HEADER[addr][1])
    }
    
    return bufferInsert(file, addr, addr+HEADER[addr][1], data)
}

// returns true if m64 is updated
function only_1P_no_rumblepak(m64) {
    var ctrlr_flags = littleEndianToInt(m64.subarray(0x20, 0x20  + 4))

    // We can only have controller 1 connected and it mustn't have rumblepak
    // Other controllers' pak state can be ignored as long as they aren't connected
    const controller_1_present = (ctrlr_flags >> 0) & 1
    const controller_1_rumblepak = (ctrlr_flags >> 8) & 1
    const controller_2_present = (ctrlr_flags >> 1) & 1
    const controller_3_present = (ctrlr_flags >> 2) & 1
    const controller_4_present = (ctrlr_flags >> 3) & 1

    return (controller_1_present && !controller_1_rumblepak 
        && !controller_2_present && !controller_3_present && !controller_4_present)
}

function fix_controllers(m64) {
    let newtas = m64.subarray(0, 0x400) // copy header
    newtas[0x20] = 1 // set controller flags
    newtas[0x21] = 0
    newtas[0x23] = 0
    let num_controllers = m64[0x15]
    newtas[0x15] = 1 // set number of controllers
    let sample_count = read(0x18, m64)
    newtas = write(0x18, sample_count / num_controllers, newtas)
    for (let i = 0x400; i < m64.length; i += 0x4 * num_controllers) { // copy controller 1 data
        newtas = Buffer.concat([newtas, m64.subarray(i, i+4)])
    }
    return newtas
}

// =============
// File Handling (this should be moved to save.js)
// =============

// repeated code. allows for url/filename/size to be entered manually,
// it will use the attachment's properties if they arent passed
function downloadAndRun(attachment, callback, url, filename, filesize) {
    if (!url) url = attachment.url
    if (!filename) filename = attachment.filename
    if (!filesize) {
        if (attachment) {
            filesize = attachment.size
        } else {
            request({
                url: url,
                method: "HEAD"
            }, (err, response) => { // find the filesize
                save.downloadFromUrl(url, `${save.getSavePath()}/${filename}`, () => callback(filename))
            })
            return
        }
    }

    save.downloadFromUrl(url, `${save.getSavePath()}/${filename}`, () => callback(filename))
}

// ===========
// Mupen Queue
// ===========

const DEFAULT_TIME_LIMIT = 5 * 60 * 30 // 5 minutes
var previous_time_limit = DEFAULT_TIME_LIMIT + 1
var MupenQueue = []

function NextProcess(bot, retry = true) {
    //console.log(JSON.stringify(MupenQueue))
    if (MupenQueue.length == 0 || MupenQueue[0].process != null) {
        return // nothing to run, or something is currently running
    }
    var request = MupenQueue[0]
    while (request.skip) {
        if (MupenQueue.length == 0) return
        MupenQueue.shift()
        request = MupenQueue[0]
    }

    const processing_start_time = process.hrtime.bigint()
    
    let preprocessTAS = () => {
        // auto detect game
        let tasfile = request.local ? request.m64_url : save.getSavePath() + "/tas.m64"
        var m64 = fs.readFileSync(tasfile)
        var crc = Buffer.copyBytesFrom(m64.subarray(0xE4, 0xE4 + 4))
        crc = bufferToStringLiteral(crc.reverse())
        //console.log(KNOWN_CRC)
        //console.log(crc)
        if (crc in KNOWN_CRC == false) { // what if the user is the bot (internal calls?)
            if (crc == "") {
                // this is a strange case... maybe I'm opening the file too many times in this code?
                // for some reason, retrying immediately (0s delay) has worked every time this error has come up
                // Edit 2025: this error also comes up if the downloaded file is "no longer available"
                // a future fix is to access the message containing an m64 url and get an updated url to that attachment
                // this needs to be fixed in the command methods that call QueueAdd
                if (retry) {
                    setTimeout(() => NextProcess(bot, false), 5000) // try again in 5s (just to be safe)
                    return
                } else if (request.channel_id == null) {
                    console.log(`ERROR: double empty CRC when running Mupen\n${JSON.stringify(request)}`)
                } else {
                    bot.createMessage(request.channel_id, "Error: Failed to read CRC twice (could not read file?). Please ensure that links to files are not expired.")
                }
            } else if (request.channel_id == null) {
                console.log(`ERROR: unknown CRC ${crc} when running Mupen\n${JSON.stringify(request)}`)
            } else {
                bot.createMessage(request.channel_id, `<@${request.user_id}> Unknown CRC: ${crc}. For a list of supported games, use $ListCRC`)
            }
            MupenQueue.shift() // this request cannot be run
            NextProcess(bot)
            return
        }
        
        if (!only_1P_no_rumblepak(m64)) {
            console.log(`Fixing controller flags for ${tasfile}`)
            m64 = fix_controllers(m64)
            fs.unlinkSync(tasfile)
            fs.writeFileSync(tasfile, m64)
        }
        
        // set timelimit if it's different
        if (request.time_limit != previous_time_limit) {
            // open timelimit.txt and put in the number // edit 2025: wait do I not do this here... ???
            // have timelimit.lua read that number
            previous_time_limit = request.time_limit
        }

        let runMupen = async () => {
            if (MupenQueue.length == 0) {
                //console.log("runMupen ignored (queue empty)")
                return
            }
            await request.startup()
            const GAME = ` -g "${GAME_PATH}${KNOWN_CRC[crc].replace(/ /g, `_`)}.z64" `
            const CMD = `"${MUPEN_PATH}"${GAME}${request.cmdflags}`
            //console.log(CMD)
            let Mupen = cp.exec(CMD)
            MupenQueue[0].process = Mupen
            Mupen.on("close", async (code, signal) => {

                if (fs.existsSync("TLE.txt")) { // currently do nothing on time limit exceeded...
                    fs.unlinkSync("TLE.txt")
                    await request.callback(true, true, processing_start_time, m64) // pass true if the run timed out
                } else {
                    await request.callback(false, false, processing_start_time, m64)
                }
                //if (code) console.log(`${code}: ${signal}`)

                MupenQueue.shift()
                NextProcess(bot)

            })
        }

        let start_type = m64.subarray(0x1C, 0x1C + 1)
        start_type = bufferToStringLiteral(start_type) // "01" = from savestate, "02" = from start
        if (!request.st_url) { // no savestate given, skip downloading savestate
            // force it to start from power on
            if (start_type == "01") { 
                // "Your movie starts from savestate, but no st was provided"
                m64 = bufferInsert(m64, 0x1C, 0x1C + 1, Buffer.from([2]))
                fs.unlinkSync(tasfile)
                fs.writeFileSync(tasfile, m64)
            }
            runMupen()
            downloadAndRun( // should this just be runMupen(); return; ??
                undefined,
                runMupen,
                request.m64_url,
                "tas.m64"
            )
            return
        } else if (start_type == "02" && request.st_url) {
            // make it start from a savestate and jump to this state
            m64 = bufferInsert(m64, 0x1C, 0x1C + 1, Buffer.from([1]))
            fs.unlinkSync(tasfile)
            fs.writeFileSync(tasfile, m64)
        }  // else: from savestate and has savestate

        if (request.local) {
            runMupen()
            return
        }
        downloadAndRun(
            undefined,
            runMupen,
            request.st_url,
            "tas.st"
        )
    }

    if (request.local) {
        preprocessTAS()
        return
    }
    downloadAndRun(
        undefined,
        preprocessTAS,
        request.m64_url,
        "tas.m64"
    )
}

// adds a mupen request to the queue. Returns the 0-indexed position of the request
// the m64/st are saved as tas.m64/st
// if you want to run mupen with the -m64 argument that must be explicitly passed here
// startup is called after the download is complete but before mupen is run
// callback is called once the mupen process closes, it is passed whether the time limit was exceeded or not (bool)
//    callback(TLE?: bool, CANT_RUN?: bool, START_TIME: bigint, M64: Buffer<ArrayBufferLike>)
// all processes are run with -lua ./timelimit.lua;
// channel_id is used to send a message if no game matches the tas being loaded
// user_id will be pinged if no game matches the tas being loaded (and a valid channel_id is provided)
// local_files = true means that m64_url is a filepath to an existing local tas file which will be run with -m64
// Ex. QueueAdd(bot, "...m64", "...st", ["-avi", "encode.avi", "-lua", "C:\\file.lua"], ()=>{}, ()=>{}, 0, 0, false)
function QueueAdd(
    bot,
    m64_url,
    st_url,
    cmdline_args,
    startup,
    callback,
    channel_id = null,
    user_id = null,
    time_limit = DEFAULT_TIME_LIMIT,
    local_files = false
) {
    //console.log(`Adding ${m64_url}\n${st_url}\n${cmdline_args}\n${channel_id} ${user_id}\n${time_limit}`)
    var cmd = ""
    if (local_files && cmdline_args.indexOf("-m64") < 0) {
        cmdline_args = ["-m64", m64_url, ...cmdline_args]
    }
    for (var i = 0; i < cmdline_args.length; ++i) {

        // Lua scripts are included in an array formatted as follows:
        // [ "lua", "script1.lua", "script2.lua" ]
        if (Array.isArray(cmdline_args[i]) && cmdline_args[i][0] == "lua") {
            const scripts = cmdline_args[i].slice(1);
            const str = scripts.join(';')
            cmd += ` -lua "${str}" `;
            //console.log(`Added lua scripts: ${str}`);
            continue;
        }

        if (cmdline_args[i].startsWith("-")) {
            cmd += cmdline_args[i]
        } else {
            cmd += ` "${cmdline_args[i]}" `
        }
    }

    //console.log(`cmd: "${cmd}"`)
    MupenQueue.push({
        m64_url: m64_url,
        st_url: st_url,
        cmdflags: cmd,
        startup: startup,
        callback: callback,
        channel_id: channel_id,
        user_id: user_id,
        time_limit: time_limit,
        skip: false,
        local: local_files,
        process: null
    })
    //console.log(MupenQueue)
    if (MupenQueue.length == 1) {
        NextProcess(bot)
    }
    return MupenQueue.length
}

// ================
// Discord Commands
// ================

// return a list of urls to files that end with something in extensions
function parse_urls(extensions, msg, args) {
    if (!Array.isArray(extensions)) { // allow ".txt" or [".txt"]
        extensions = [extensions]
    }
    let urls = []
    for (const link of [...args, ...msg.attachments.map((v) => v.url)]) {
        let url = link.substring(0, link.lastIndexOf('?')) || link
        for (const ext of extensions) {
            if (url.endsWith(ext)) {
                urls.push(link)
            }
        }
    }
    return urls
}

/*function parseOffset(arg) {
    var offset = parseInt(arg, 16);
    if (isNaN(offset)) {
        return {error: "Invalid Argument: offset must be a number"};
    } else if (!validOffset(offset)) {
        return {error: "Invalid Argument: offset is not a valid start location"};
    }
    return {offset: offset, error: false};
}*/

module.exports = {
    name: "m64 Editor",
    short_name: "m64",

    rerecords: {
        name: "rerecords",
        aliases: ["rerecord", "rr"],
        short_descrip: "Change rerecord amount",
        full_descrip: "Usage: `$rr <num_rerecords> <m64 attachment>`\nChanges the rerecords count in the attached m64. If the number provided is less than 0, it will edit it to be 0. If it exceeds the maximum 4-byte integer (4294967295) then it will edit it to be the max.",
        hidden: true,
        function: async function(bot, msg, args) {

            // make sure there's enough arguments
            if (args.length == 0) {
                return "Missing Arguments: `$rr <num_rerecords> <m64 attachment>`"
            } else if (msg.attachments.length == 0) {
                return "Missing Arguments: No m64 specified `$rr <num_rerecords> <m64 attachment>`"
            } else if (isNaN(args[0])) {
                return "Invalid Argument: rerecords must be a number"
            } else if (!msg.attachments[0].url.endsWith(".m64")) {
                return "Invalid Argument: file is not an m64"
            }

            // force rerecords in range of [0, 4 byte max]
            const MAX_RR = parseInt(0xFFFFFFFF)
            const LOCATION = parseInt(0x10)
            const SIZE = 4

            var rerecords = parseInt(args[0])
            if (rerecords > MAX_RR) {
                rerecords = MAX_RR
                bot.createMessage(msg.channel.id, "WARNING: Max rerecord count exceeded")
            } else if (rerecords < 0) {
                rerecords = 0
                bot.createMessage(msg.channel.id, "WARNING: Min rerecord count exceeded")
            }

            function updateRerecords(filename) {
                fs.readFile(`${save.getSavePath() }/${ filename}`, async (err, m64) => {
                    if (err) {
                        bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                    } else {

                        var rr_hex = intToLittleEndian(rerecords, SIZE)
                        var old_rr = littleEndianToInt(m64.subarray(LOCATION, LOCATION + SIZE))
                        var new_m64 = bufferInsert(m64, LOCATION, LOCATION + SIZE, rr_hex)

                        try {
                            await bot.createMessage(
                                msg.channel.id,
                                `Rerecords changed from ${old_rr} to ${rerecords}`, {
                                    file: new_m64,
                                    name: filename
                                }
                            )
                            fs.unlinkSync(`${save.getSavePath() }/${ filename}`)
                        } catch (err) {
                            bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                        }
                    }
                })
            }

            downloadAndRun(msg.attachments[0], updateRerecords)

        }
    },

    description: {
        name: "description",
        aliases: ["descrip"],
        short_descrip: "Edit description",
        full_descrip: "Usage: `$descrip [new description] <m64 attachment>`\nChanges the description in the attached m64. Spaces are allowed in the new description.",
        hidden: true,
        function: async function(bot, msg, args) {

            if (msg.attachments.length == 0) {
                return "Missing Arguments: No m64 specified `$descrip [new description] <m64 attachment>`"
            } else if (!msg.attachments[0].url.endsWith(".m64")) {
                return "Invalid Argument: file is not an m64"
            }

            const LOCATION = parseInt(0x300)
            const SIZE = 256

            var descrip = Buffer.from(args.join(" "), "utf8")
            if (Buffer.byteLength(descrip) > SIZE) {
                descrip = descrip.subarray(0, SIZE)
                bot.createMessage(msg.channel.id, "WARNING: Max length exceeded")
            }
            while (Buffer.byteLength(descrip) < SIZE) { // force to fill
                descrip = Buffer.concat([descrip, Buffer.from([0])])
            }

            function updateDescrip(filename) {
                fs.readFile(`${save.getSavePath() }/${ filename}`, async (err, m64) => {
                    if (err) {
                        bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                    } else {

                        var old_descrip = m64.subarray(LOCATION, LOCATION + SIZE)
                        var new_m64 = bufferInsert(m64, LOCATION, LOCATION + SIZE, descrip)

                        try {
                            await bot.createMessage(
                                msg.channel.id,
                                `Description changed from \`${bufferToString(old_descrip)}\` to \`${bufferToString(descrip)}\``, {
                                    file: new_m64,
                                    name: filename
                                }
                            )
                            fs.unlinkSync(`${save.getSavePath() }/${ filename}`)
                        } catch (err) {
                            bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                        }
                    }
                })
            }

            downloadAndRun(msg.attachments[0], updateDescrip)

        }
    },

    author: {
        name: "author",
        aliases: ["authors", "auth"],
        short_descrip: "Edit author's name",
        full_descrip: "Usage: `$auth [new name] <m64 attachment>`\nChanges the author in the attached m64 file. You can uses spaces in the new name.",
        hidden: true,
        function: async function(bot, msg, args) {

            if (msg.attachments.length == 0) {
                return "Missing Arguments: No m64 specified `$auth [new name] <m64 attachment>`"
            } else if (!msg.attachments[0].url.endsWith(".m64")) {
                return "Invalid Argument: file is not an m64"
            }

            const LOCATION = parseInt(0x222)
            const SIZE = 222
            var author = Buffer.from(args.join(" "), "utf8")
            if (Buffer.byteLength(author) > SIZE) {
                author = author.subarray(0, SIZE)
                bot.createMessage(msg.channel.id, "WARNING: Max length exceeded")
            }
            while (Buffer.byteLength(author) < SIZE) { // force to fill
                author = Buffer.concat([author, Buffer.from([0])])
            }

            function updateAuthor(filename) {
                fs.readFile(`${save.getSavePath() }/${ filename}`, async (err, m64) => {
                    if (err) {
                        bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                    } else {

                        var old_author = m64.subarray(LOCATION, LOCATION + SIZE)
                        var new_m64 = bufferInsert(m64, LOCATION, LOCATION + SIZE, author)

                        try {
                            await bot.createMessage(
                                msg.channel.id,
                                `Author changed from \`${bufferToString(old_author)}\` to \`${bufferToString(author)}\``, {
                                    file: new_m64,
                                    name: filename
                                }
                            )
                            fs.unlinkSync(`${save.getSavePath() }/${ filename}`)
                        } catch (err) {
                            bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                        }
                    }
                })
            }

            downloadAndRun(msg.attachments[0], updateAuthor)

        }
    },

    header: {
        name: "m64header",
        short_descrip: "List header table",
        full_descrip: "Usage: `$header`\nLists the m64 header table",
        hidden: true,
        function: async function(bot, msg, args) {
            var result = ""
            Object.keys(HEADER).forEach((offset) => {
                result += `0x${parseInt(offset).toString(16).toUpperCase().padStart(2, "0")} ${HEADER[offset][2]}\n`
            })
            return `\`\`\`${ result }\`\`\``
        }
    },

    /*m64read:{ // shortcuts for editing m64s
        name: `m64read`,
        aliases: [],
        short_descrip: `read header data`,
        full_descrip: "Usage: `$m64read <offset> <m64>`\nReads header data given an offset and an m64. To see the list of relevant offsets use `$m64header`. An m64 attachment or url (after the address) will be accepted.",
        hidden: true,
        function: async function(bot, msg, args) {
        if (args.length < 1) return "Missing Argument: `$m64read <address> <m64>`"
        var offset = parseOffset(args.shift())
        if (offset.error) return offset.error
        offset = offset.offset
        }
    },

    m64write:{
        name: `m64write`,
        aliases: [],
        short_descrip: ``,
        full_descrip: "Usage: `$m64write <offset> [data] <m64 attachment>`\n.If `[data]` is nothing, an appropriate default value is used. Note: this requires an attachment to be uploaded with the command (sending a url to an m64 won't work).",
        hidden: true,
        function: async function(bot, msg, args) {
        if (args.length < 1) return "Missing Arguments: "
        var offset = parseOffset(args.shift())
        if (offset.error) return offset.error
        offset = offset.offset


        }
    },

    set_jp:{
        name: ``,
        aliases: [],
        short_descrip: ``,
        full_descrip: ``,
        hidden: true,
        function: async function(bot, msg, args) {
        if (args.length < 1) return "Missing Argument: "
        }
    },

    set_us:{
        name: ``,
        aliases: [],
        short_descrip: ``,
        full_descrip: ``,
        hidden: true,
        function: async function(bot, msg, args) {
        if (args.length < 1) return "Missing Argument: "
        }
    },

    startsave:{
        name: ``,
        aliases: [],
        short_descrip: ``,
        full_descrip: ``,
        hidden: true,
        function: async function(bot, msg, args) {
        if (args.length < 1) return "Missing Argument: "
        }
    },

    startpoweron:{
        name: ``,
        aliases: [],
        short_descrip: ``,
        full_descrip: ``,
        hidden: true,
        function: async function(bot, msg, args) {
        if (args.length < 1) return "Missing Argument: "
        }
    },*/

    info: {
        name: "m64info",
        aliases: [],
        short_descrip: "Reads important header data",
        full_descrip: "Usage: `$m64info <m64 attachment>`\nReads the authors, description, rerecords, and ROM CRC.",
        hidden: true,
        function: async function(bot, msg, args) {

            if (msg.attachments.length == 0) {
                return "Missing Arguments: No m64 specified `$m64info <m64 attachment>`"
            } else if (!msg.attachments[0].url.endsWith(".m64")) {
                return "Invalid Argument: file is not an m64"
            }

            function info(filename) {
                fs.readFile(`${save.getSavePath() }/${ filename}`, async (err, m64) => {
                    if (err) {
                        bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                    } else {
                        var author = bufferToString(m64.subarray(0x222, 0x222 + 222))
                        var descrip = bufferToString(m64.subarray(0x300, 0x300 + 256))
                        var rr = littleEndianToInt(m64.subarray(0x10, 0x10 + 4))
                        var crc = m64.subarray(0xE4, 0xE4 + 4)
                        crc = bufferToStringLiteral(crc.reverse()) // reverse
                        var rom = "?"
                        if (crc in KNOWN_CRC) rom = KNOWN_CRC[crc]

                        var result = `Author(s): ${author}\n`
                        result += `Description: ${descrip}\n`
                        result += `Rerecords: ${rr}\n`
                        result += `ROM: ${crc} (${rom})`

                        try {
                            await bot.createMessage(msg.channel.id, result)
                            fs.unlinkSync(`${save.getSavePath() }/${ filename}`)
                        } catch (err) {
                            bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
                        }
                    }
                })
            }

            downloadAndRun(msg.attachments[0], info)

        }
    },

    encode: {
        name: "encode",
        aliases: ["record"],
        short_descrip: "Encode an m64",
        full_descrip: "Usage: `$encode [cancel/forceskip/queue/nolua/maxvbitrate=<bitrate>/crf=<crf>/abitrate=<bitrate>/constrainsize] <m64> [st/savestate]`\nDownloads the files, makes an encode, and uploads the recording.\n\nIf your encode is queued and you want to cancel it, use `$encode cancel`.\n\nIf the bot is not processing the queue, contact an admin to use `$encode forceskip` to skip the encode at the front of the queue (you cannot cancel your own encode if it is currently processing, you will need to use forceskip instead).\n\nPassing\n`nolua/no-lua/disable-lua` will not run the input visualzing/ram watch lua script,\n`maxvbitrate/max-v-bitrate/maxvrate/max-v-bitrate/mb:v/m-b:v` will set the maximum video bitrate,\n`crf` will set the target constant rate factor (lower is better, defaults to not passing the parameter in ffmpeg),\n`abitrate/a-bitrate/arate/a-rate/b:a` sets the audio bitrate, and\n`constrainsize/clamp` will automatically adjust maximum bitrate such that the video will not exceed the filesize limit, overriding your bitrate settings but still targeting CRF.",
        hidden: true,
        function: async (bot, msg, args) => {
            //return `This command is currently disabled`
            //if (!users.hasCmdAccess(msg)) return `This command is currently disabled`//`You do not have permission to use this command`

            // alternate uses
            // toDo: mupen process command (users with access can cancel anything in the queue after providing an index)
            if (args.length === 1) {
                switch (args[0].toUpperCase()) {
                    case "CANCEL":
                        for (let i = 0; i < MupenQueue.length; i++) {
                            if (MupenQueue[i].user_id == msg.author.id && MupenQueue[i].process === null && !MupenQueue[i].skip) {
                                MupenQueue[i].skip = true // mark to be skipped instead of removing it to try and avoid async problems
                                const url = MupenQueue[i].m64_url.split("/")
                                return `${url[url.length - 1]} will be skipped` // gives filename
                            }
                        }

                        return "You do not have an encode request in queue."
                    case "FORCESKIP":
                        if (users.hasCmdAccess(msg) || msg.author.id === MupenQueue[0].user) {
                            const encode = MupenQueue.shift()
                            encode.process = 0 // ghost process is never killed. EncodingQueue[0].process.kill() // TODO: FIX THIS ?
                            NextProcess(bot)
                            return `Encode skipped: \`\`\`${ JSON.stringify(encode) }\`\`\``
                        }
                        break
                    case "QUEUE": {
                        if (MupenQueue.length == 0) {
                            return "Queue is empty"
                        }
                        let result = ""
                        let dm
                        
                        for (let i = 0; i < MupenQueue.length; ++i) {
                            result += `${index}. `

                            if (MupenQueue[i].user_id === null) {
                              result += "[no user] "
                            } else {
                                dm = await bot.getDMChannel(MupenQueue[i].user_id) // no catch...
                                result += `${dm.recipient.username} `
                            }

                            if (MupenQueue[i].channel_id === null) {
                              result += "(no channel)"
                            } else if (MupenQueue[i].channel_id === dm.id) {
                              result += "(DM)"
                            } else {
                              result += `(<#${MupenQueue[i].channel_id}>)`
                            }

                            result += "\n"
                        }

                        return result
                    }
                }
            }

            // look for m64 & st as either a URL in the arguments, or an attachment
            let m64_url = parse_urls(".m64", msg, args)
            let st_url = parse_urls([".st", ".savestate"], msg, args)
            let ghost_urls = parse_urls(".ghost", msg, args)
            let ghost_paths = []

            if (m64_url.length == 0/* || !st_url*/) return "Missing/Invalid Arguments: `$encode [cancel/forceskip/queue/nolua/maxvbitrate=<bitrate>/crf=<crf>/abitrate=<bitrate>/constrainsize] <m64> [st/savestate]`"
            m64_url = m64_url[0]
            st_url = st_url.length ? st_url[0] : ""
            ghost_urls = ghost_urls.slice(0, 5) // max limit of 5 ghosts just to be safe

            let filename = m64_url.split("/") // doesnt ensure it contains / because it should contain it...
            filename = filename[filename.length - 1]
            filename = filename.substring(0, filename.length - 4)

            const ffmpeg_args = { vcodec: "libx264", acodec: "aac", vrate: "", crf: "", arate: "128", clamp: false }
            let use_lua = true

            for (const arg of args) {
                if (["NOLUA", "NO-LUA", "DISABLE-LUA", "LUABEGONE!"].includes(arg.toUpperCase())) {
                    use_lua = false;
                } else if (["H265", "H.265", "HEVC"].includes(arg.toUpperCase())) {
                    ffmpeg_args.vcodec = "libx265"
                } else if (["CLAMP", "CONSTRAINSIZE"].includes(arg.toUpperCase())) {
                    ffmpeg_args.clamp = true
                } else if (!ffmpeg_args.clamp && arg.includes("=")) {
                    const values = arg.split("=")
                    values[1] = parseInt(values[1])

                    switch (values[0].toUpperCase()) {
                        case "MAXVRATE": case "MAX-V-RATE": case "MAXVBITRATE": case "MAX-V-BITRATE": case "MB:V": case "M-B:V":
                            if (values[1] !== values[1] || values[1] < 64) return "Invalid value for maximum video bitrate."
                            ffmpeg_args.vrate = values[1]
                            break
                        case "CRF":
                            if (values[1] !== values[1] || values[1] < 0 || values[1] > 51) return "Invalid value for CRF."
                            ffmpeg_args.crf = values[1]
                            break
                        case "ARATE": case "A-RATE": case "ABITRATE": case "A-BITRATE": case "B:A":
                            if (values[1] !== values[1] || values[1] < 8 && values[1] !== 0) return "Invalid value for audio bitrate."
                            ffmpeg_args.arate = values[1]
                            break
                    }
                }
            }

            const out_filename = MUPEN_USES_FFMPEG ? "encode.mp4" : "encode.avi";

            let mupen_args = [
                "-m64", 
                `${process.cwd() + save.getSavePath().substring(1)}/tas.m64`,
                "-avi", 
                out_filename]

            if (use_lua) {
                if (ghost_urls.length) {
                    mupen_args.push(["lua", ...LUA_SCRIPTS, process.cwd() + "\\TimingLua\\PlayGhosts.lua"])
                } else {
                    mupen_args.push(["lua", ...LUA_SCRIPTS])
                }
            }
            //console.log(mupen_args)

            const pos = QueueAdd(
                bot,
                m64_url,
                st_url,
                mupen_args,
                async () => { // startup
                    var err = null
                    if (fs.existsSync("./encode.avi")) {
                        fs.unlinkSync("./encode.avi") // ERROR HANDLE BC THIS ACTUALLY THREW AND CRASHED
                    }
                    if (fs.existsSync("./encode.mp4")) {
                        fs.unlinkSync("./encode.mp4")
                    }
                    if (ghost_urls.length) {
                        if (fs.existsSync("./TimingLua/ghostlist.txt")) {
                            fs.unlinkSync("./TimingLua/ghostlist.txt")
                        }
                        ghost_paths = []
                        for (let i = 0; i < ghost_urls.length; i++) {
                            let ghostpath = `${save.getSavePath()}/${i}.ghost`
                            if (fs.existsSync(ghostpath)) {
                                fs.unlinkSync(ghostpath)
                            }
                            ghost_paths.push(ghostpath)
                        }
                        fs.writeFileSync("./TimingLua/ghostlist.txt", ghost_paths.join('\n'))
                        await save.downloadAllFromUrl(ghost_urls, ghost_paths)
                    }
                },
                async (tle, cant_run, start_time, m64) => { // callback
					if (cant_run) {
                        bot.createMessage(msg.channel.id, `Error: m64 cannot be played back. Ensure your TAS has 1 controller and does not use rumblepak <@${msg.author.id}>`)
						return
					}

                    if (!fs.existsSync(`./${out_filename}`)) {
                        if (fs.existsSync(path.dirname(MUPEN_PATH) + `/${out_filename}`)) {
                            fs.renameSync(path.dirname(MUPEN_PATH) + `/${out_filename}`, `./${out_filename}`)
                        } else {
                            bot.createMessage(msg.channel.id, `Error: ${out_filename} not found (Mupen crashed) <@${msg.author.id}>`)
                            console.trace()
                            return
                        }
                    }

                    let stats = fs.statSync(`./${out_filename}`)

                    if (stats.size === 0) {
						fs.unlinkSync(`./${out_filename}`)
                        bot.createMessage(msg.channel.id, `Error: ${out_filename} is 0 bytes. There was likely a crash when attempting to encode <@${msg.author.id}>. If this is a repeated error, request a bot owner to reset the codec by manually starting a capture.`)
                        return
                    }

                    let length = 1000 * Number(cp.execSync(`ffprobe ${out_filename} -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1`))
                    bot.createMessage(msg.channel.id, "Uploading...").catch(() => {})

                    try {
                        const filesize_limit = msg.channel.guild !== undefined ? [25e6, 25e6, 50e6, 100e6][msg.channel.guild.premiumTier] : 25e6 // in bytes
                        let cmd = `ffmpeg -y -i ${out_filename} -c:v ${ffmpeg_args.vcodec} -c:a ${ffmpeg_args.acodec} -vf fps=30 `

                        if (!ffmpeg_args.clamp) {
                            cmd += ffmpeg_args.vrate ? `-maxrate ${ffmpeg_args.vrate}k -bufsize ${ffmpeg_args.vrate}k ` : ""
                            cmd += ffmpeg_args.crf ? `-crf ${ffmpeg_args.crf} ` : ""
                            cmd += ffmpeg_args.arate ? `-b:a ${ffmpeg_args.arate}k ` : "-an "
                        } else {
                            cmd += ffmpeg_args.crf ? `-crf ${Math.max(ffmpeg_args.crf, 1)} ` : "" // crf 0 overrides vbv
                            const trate = 8 * filesize_limit / length // 8 * because bits/bytes

                            if (trate < 128) {
                                bot.createMessage(msg.channel.id, "Your m64 is too long to be size constrained.")
                                return
                            }

                            const arate = Math.min(16*Math.floor(trate / 128), 128) // Multiple of 16kb/s between 0 and 1024kb/s total rate
                            const vrate = (trate - arate) * 0.9 // Make up for header and vbv bitrate overshoot

                            //console.log(length);

                            cmd += `-maxrate ${vrate}k -bufsize ${vrate}k -b:a ${arate}k `
                        }

                        cmd += `-pix_fmt yuv420p -fs ${filesize_limit * 0.9} encode-compressed.mp4` // 0.9 as a hacky workaround for ffmpeg overshoot + header
                        cp.execSync(cmd)
                        //console.log(cmd);
                        
                        stats = fs.statSync("./encode-compressed.mp4")
                        length -= 1000 * Number(cp.execSync("ffprobe encode-compressed.mp4 -v quiet -show_entries format=duration -of default=noprint_wrappers=1:nokey=1"))

                        const elapsed_seconds = Math.max(Number.EPSILON, Number(process.hrtime.bigint() - start_time) / 1_000_000_000);
                        const length_samples = littleEndianToInt(m64.subarray(0x18, 0x18 + 4));
                        const effective_fps = length_samples / elapsed_seconds;

                        let reply = `Encode Complete `
                        reply += Math.abs(length) > 100 ? "(File size limit exceeded) " : ""
                        reply += tle ? "(Time limit exceeded) " : ""
                        reply += `(took ${elapsed_seconds.toFixed(2)}s at roughly ${effective_fps.toFixed(0)} FPS) `
                        reply += `<@${msg.author.id}>`
                        const video = fs.readFileSync("./encode-compressed.mp4")
                        
                        await bot.createMessage(msg.channel.id, reply, {
                            file: video,
                            name: `${filename}.mp4`
                        })
                    } catch (err) {
                        bot.createMessage(msg.channel.id, `Something went wrong <@${msg.author.id}> \`\`\`${err}\`\`\``)
                        console.log(err)
                    } finally {
                        fs.unlinkSync("./encode-compressed.mp4")
                        for (const ghostpath of ghost_paths) {
                            if (fs.existsSync(ghostpath)) { // should exist but just to be safe...
                                fs.unlinkSync(ghostpath)
                            }
                        }
                    }
                },
                msg.channel.id,
                msg.author.id,
                2 * 60 * 30 + 30 * 30 // 2.5 min
            )

            if (pos === 1) {
                return "Queue position 1: your encode is processing..."
            } else if (EncodingQueue.length === 2) {
                return "Queue position 2: your encode will be processed next"
            }

            return `Queue position ${pos}`
        }
    },

    getghost: {
        name: "GetGhost",
        aliases: [],
        short_descrip: "Generate ghost data",
        full_descrip: "Usage: \`$getghost <m64> <st/savestate>\`\nReturns a tas.ghost file that can be used with the Ghost hack while playing back TASes.",
        hidden: true,
        function: async function(bot, msg, args) {
            let m64s = parse_urls(".m64", msg, args)
            let sts = parse_urls([".st", ".savestate"], msg, args)

            if (m64s.length == 0 || sts.length == 0) {
                return `Missing/Invalid Arguments: \`$getghost <m64> <st/savestate>\` both an m64 and savestate are required.`
            }

            const LUAPATH = process.cwd() + "\\TimingLua\\"
            const mupen_args = [
                "-m64", `${process.cwd() + save.getSavePath().substring(1)}/tas.m64`,
                "--close-on-movie-end",
                ["lua", ...LUA_SCRIPTS, LUAPATH + "ghost.lua"]
            ]
            
            let queue_position = QueueAdd(
                bot,
                m64s[0],
                sts[0],
                mupen_args,
                () => {
                    if (fs.existsSync(LUAPATH + "tmp.ghost")) fs.unlinkSync(LUAPATH + "tmp.ghost")
                },
                async (TLE, MISMATCH_SETTINGS, start_time, m64) => {
                    let result = ""
                    if (TLE) {
                        result = `Error: Your TAS exceeded the time limit. Ghost data cannot be generated. <@${msg.author.id}>`
                    } else if (MISMATCH_SETTINGS) {
                        result = `Error: Your TAS cannot be played back. Please ensure it has only 1 controller with rumblepak disabled. <@${msg.author.id}>`
                    } else if (fs.existsSync(LUAPATH + "error.txt")) {
                        result = fs.readFileSync(LUAPATH + "error.txt").toString() + "\nGhost data cannot be generated. <@${msg.author.id}>"
                        fs.unlinkSync(LUAPATH + "error.txt")
                    } else if (!fs.existsSync(LUAPATH + "tmp.ghost")) {
                        result = `Error: something went wrong, could not produce ghost data (ghost file doesn't exist?). <@${msg.author.id}>`
                    } else { // success

                        let filename = m64s[0].split("/")
                        filename = filename[filename.length - 1].split("?")[0]
                        filename = filename.substring(0, filename.length - 4)

                        const elapsed_seconds = Math.max(Number.EPSILON, Number(process.hrtime.bigint() - start_time) / 1_000_000_000);
                        const length_samples = littleEndianToInt(m64.subarray(0x18, 0x18 + 4));
                        const effective_fps = length_samples / elapsed_seconds;

                        await bot.createMessage(
                            msg.channel.id,
                            `Here's your ghost <@${msg.author.id}> (took ${elapsed_seconds.toFixed(2)}s at roughly ${effective_fps.toFixed(0)} FPS)`,
                            {
                                file: fs.readFileSync(LUAPATH + "tmp.ghost"),
                                name: filename + ".ghost"
                            }
                        )
                        fs.unlinkSync(LUAPATH + "tmp.ghost")
                        return
                    }
                    await bot.createMessage(msg.channel.id, result).catch(console.error)
                },
                msg.channel.id,
                msg.author.id,
                2 * 60 * 30 + 30 * 30 // 2.5 min
            )
            return `Generating ghost data. Position in queue: ${queue_position}`
        }
    },

    listcrc: {
        name: "ListCRC",
        aliases: [],
        short_descrip: "See recognized games",
        full_descrip: "Shows a list of ROM CRCs that the `$encode` command supports. If there is a game that you would like added to this list, please contact the owner of this bot",
        hidden: true,
        function: async function(bot, msg, args) {
            var result = "CRC: ROM Name\n" + "```"
            var crc = Object.keys(KNOWN_CRC)
            for (var i = 0; i < crc.length; i++) {
                result += `${crc[i]}: ${KNOWN_CRC[crc[i]]}\n`
            }
            return result + "```"
        }

    },

    load: function() {
        var data = save.readObject("m64.json")
        MUPEN_PATH = data.MupenPath
        GAME_PATH = data.GamePath
        MUPEN_USES_FFMPEG = data.MupenUsesFFmpeg
        // We construct the lua script array from the (optional) hardcoded InputLuaPath and TimeoutLuaPath, and append the optional LuaPaths array from json to it
        LUA_SCRIPTS = []
        if (data.InputLuaPath && data.InputLuaPath.length > 0) {
            LUA_SCRIPTS.push(data.InputLuaPath);
        }
        if (data.TimeoutLuaPath && data.TimeoutLuaPath.length > 0) {
            LUA_SCRIPTS.push(data.TimeoutLuaPath);
        }
        if (data.LuaPaths && data.LuaPaths.length > 0) {
            LUA_SCRIPTS.push(data.LuaPaths);
        }
        Object.keys(data.CRC).forEach((crc) => {
            KNOWN_CRC[crc] = data.CRC[crc]
        })
    },

    lua_scripts: () => LUA_SCRIPTS,

    Process: QueueAdd
}