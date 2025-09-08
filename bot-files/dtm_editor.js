// dtm header information source: http://tasvideos.org/EmulatorResources/DTM.html

var fs = require(`fs`)
var save = require(`./save.js`)

const BitField = 0
const Bytes = 1
const Integer = 2
const Boolean = 3
const String = 4

// each entry is [offset, type, length, description]
var Header = {
    0x000: [Bytes, 4, `Signature: 44 54 4D 1A "DTM\\x1A"`],
    0x004: [String, 6, `Game ID`],
    0x00a: [Boolean, 1, `Is Wii game`],
    0x00b: [
        BitField,
        1,
        `Controllers plugged in (from least to most significant, the bits are GC controllers 1-4 and Wiimotes 1-4)`,
    ],
    0x00c: [Boolean, 1, `Starts from savestate`],
    0x00d: [Integer, 8, `VI count`],
    0x015: [Integer, 8, `Input count`],
    0x01d: [Integer, 8, `Lag counter`],
    //0x025: [N/A,	8,	`Reserved`],
    0x02d: [Integer, 4, `Rerecord count`],
    0x031: [String, 32, `Author`],
    0x051: [String, 16, `Video Backend`],
    0x061: [Integer, 16, `Audio Emulator`],
    0x071: [Bytes, 16, `MD5 hash of game file`],
    0x081: [Integer, 8, `Recording start time (UNIX time)`],
    0x089: [Boolean, 1, `Saved config valid?`],
    0x08a: [Boolean, 1, `Idle Skipping on?`],
    0x08b: [Boolean, 1, `Dual Core enabled?`],
    0x08c: [Boolean, 1, `Progressive Scan enabled?`],
    0x08d: [Boolean, 1, `DSP HLE enabled? (false means LLE)`],
    0x08e: [Boolean, 1, `Fast disc speed enabled?`],
    0x08f: [Integer, 1, `CPU core (0 for interpreter, 1 for JIT, 2 for JITIL)`],
    0x090: [Boolean, 1, `EFB Access Enabled?`],
    0x091: [Boolean, 1, `EFB Copy Enabled?`],
    0x092: [Boolean, 1, `Copy EFB To Texture? (1 for texture, 0 for ram)`],
    0x093: [Boolean, 1, `EFB Copy Cache Enabled?`],
    0x094: [Boolean, 1, `Emulate Format Changes?`],
    0x095: [Boolean, 1, `Use XFB emulation?`],
    0x096: [Boolean, 1, `Use real XFB emulation?`],
    0x097: [
        BitField,
        1,
        `Memory cards present (from least to most significant, the bits are slot A and B)`,
    ],
    0x098: [Boolean, 1, `Memory card blank?`],
    0x099: [
        BitField,
        1,
        `Bongos plugged in (from least to most significant, the bits are ports 1-4)`,
    ],
    0x09a: [Boolean, 1, `Sync GPU thread enabled?`],
    0x09b: [Boolean, 1, `Recorded in a netplay session?`],
    0x09c: [
        Boolean,
        1,
        `SYSCONF PAL60 setting (this setting only applies to Wii games that support both 50 Hz and 60 Hz)`,
    ],
    0x09d: [
        Integer,
        1,
        `Language (the numbering scheme is different for GC and Wii)`,
    ],
    //0x09E: [N/A,	1,	`Reserved`],
    0x09f: [Boolean, 1, `JIT branch following enabled?`],
    //0x0A0: [N/A,	9,	`Reserved`],
    0x0a9: [String, 40, `Name of second disc iso`],
    0x0d1: [Bytes, 20, `SHA-1 hash of git revision`],
    0x0e5: [Integer, 4, `DSP IROM Hash`],
    0x0e9: [Integer, 4, `DSP COEF Hash`],
    //0x0ED: [Integer,	8,	`Tick count (486 MHz when a GameCube game is running, 729 MHz when a Wii game is running)`]
    //0x0F5: [N/A,	11	`Reserved`],
    //0x100: [N/A, everything else,	Controller data]
}

// ==============
// Buffer Handles
// ==============

// intToLittleEndian(int, int)
// returns a buffer containing the base 10 int in little endian form
// Ex: intToLittleEndian(7435, 4) => <0b 1d 00 00>
function intToLittleEndian(int, byteLength) {
    var hex = int.toString(16).toUpperCase() // convert to hex
    while (hex.length < 2 * byteLength) hex = `0` + hex // fill the size
    var bytes = hex.match(/.{2}/g) // split into pairs
    var reverse = []
    bytes.forEach((byte) => reverse.unshift(`0x` + byte)) // reverse order
    return Buffer.from(reverse) // convert to buffer
}

// littleEndianToInt(Buffer)
// converts a buffer in little endian to an int in base 10
// Ex: littleEndianToInt(<0b 1d 00 00>) => 7435
function littleEndianToInt(buffer) {
    var hex = ``
    var array = [...buffer]
    array.forEach((byte) => {
        byte = byte.toString(16).toUpperCase() // force hex
        hex = byte.padStart(2, '0') + hex // reverse bytes
    })
    return parseInt(hex, 16)
}

// bufferToBitField(Buffer)
// Converts the first byte of a buffer to a binary string
// Ex: bufferToBitField(<FE>) => "11111110"
function bufferToBitField(buffer) {
    buffer = buffer.slice(0, 1) // force length 1
    var n = littleEndianToInt(buffer)
    return (n >>> 0).toString(2).padStart(8, '0')
}

// BitFieldToBuffer(String)
// converts a string to a 1 byte buffer
// Ex: BitFieldToBuffer("11111111") => <FF>
function BitFieldToBuffer(bitfield) {
    var n = parseInt(bitfield, 2)
    if (isNaN(n)) {
        return Buffer.alloc(1)
    } else if (n > 0xff) {
        n = 0xff
    }
    return intToLittleEndian(n, 1)
}

// bufferToString(Buffer)
// converts a buffer to a string and removes trailing zeros
// Ex: bufferToString(<58 61 6E 64 65 72>) => "Xander"
function bufferToString(buffer) {
    while (buffer.length > 0 && buffer[buffer.length - 1] == 0) {
        buffer = buffer.slice(0, buffer.length - 1)
    }
    return buffer.toString()
}

// bufferToStringLiteral(Buffer)
// displays a buffer as a string
// Ex: bufferToStringLiteral(<58 61 6E 64 65 72>) => "58 61 6E 64 65 72"
function bufferToStringLiteral(buffer) {
    var result = ``
    var array = [...buffer]
    array.forEach((byte) => {
        byte = byte.toString(16).toUpperCase() // force hex
        result += byte.padStart(2, '0') + ` `
    })
    return result.substring(0, result.length - 1)
}

// bufferInsert(Buffer, int, int, Buffer)
// inclusive lower bound, exclusive upper bound
// This maintains the size of buffer: if the insert length is too short,
//   it will fill the end with zeros, too long and it will cut it off
// Ex: bufferInsert(<00 01 02 03 04>, 2, 4, <06, 09>) => <00, 01, 06, 09, 04>
// Ex: bufferInsert(<00 01 02 03 04>, 1, 4, <42>) => <00 42 00 00 04>
// Ex: bufferInsert(<00 01 02 03>, 1, 2, <42, 69, 42>) => <00 42 02 03>
function bufferInsert(buffer, start, end, insert) {
    // make sure the insert will fill the proper length
    if (insert.length < end - start) {
        insert = Buffer.concat([insert, Buffer.alloc(end - start - 1)])
    } else if (insert.length > end - start) {
        insert = insert.slice(0, end - start)
    }

    return Buffer.concat([
        buffer.slice(0, start),
        insert,
        buffer.slice(end, buffer.length),
    ])
}

// stringLiteralToBuffer(string, size)
// Converts the string to a buffer
// pads the right with 0 to fill size
// Any non-hex characters are set to F
// Ex: stringLiteralToBuffer("ABG21", 8) => <AB F2 10 00>
function stringLiteralToBuffer(str, size) {
    str = str
        .toUpperCase()
        .replace(/ /g, ``)
        .replace(/[^0-9A-F]/, `F`)
    if (str.length % 2 == 1) str += `0`
    str = str.match(/.{2}/g)
    var bytes = []
    for (i = (size + (size % 2)) / 2 - 1; i >= 0; i--) {
        if (i < str.length) {
            bytes.unshift(`0x` + str[i])
        } else {
            bytes.unshift(`0x00`)
        }
    }
    return Buffer.from(bytes)
}

// ====================
// File Reading/Writing
// ====================

// returns true if the offset is present in the header, false otherwise
// Ex: validOffset(parseInt("0x4", 16)) => true
// Ex: alidOffset(parseInt("0x6", 16)) => false
function validOffset(offset) {
    return Header[offset] != undefined
}

// read(hex, Buffer) reads the correct data type from the file
// requires hex is a valid offset in the header
// Ex: read(0x004, f) => "RMGE01"
// Ex: read(0x00A, f) => true
function read(offset, file) {
    var type = Header[offset][0]
    var size = Header[offset][1]
    var text = Header[offset][2]

    // copy the section of interest so the file can be read multiple times
    var data = Buffer.alloc(size)
    file.copy(data, 0, offset, offset + size)

    if (type == BitField) {
        return bufferToBitField(data)
    } else if (type == Bytes) {
        return bufferToStringLiteral(data)
    } else if (type == Integer) {
        return littleEndianToInt(data)
    } else if (type == Boolean) {
        return data[0] == 1
    } else if (type == String) {
        return bufferToString(data)
    }
}

// write(hex, Buffer, input)
// Converts the input into a buffer and inserts it into the file
// This assumes input is the right type for the offset
function write(offset, file, input) {
    var type = Header[offset][0]
    var size = Header[offset][1]

    if (type == BitField) {
        input = BitFieldToBuffer(input)
    } else if (type == Bytes) {
        input = stringLiteralToBuffer(input, size)
    } else if (type == Integer) {
        input = intToLittleEndian(input, size)
    } else if (type == Boolean) {
        input = input ? Buffer.from([1]) : Buffer.from([0])
    } else if (type == String) {
        input = Buffer.from(input)
    }
    return bufferInsert(file, offset, offset + size, input)
}

// ================
// File Downloading
// ================

// check if a file has been fully downloaded
function hasDownloaded(filename, filesize) {
    try {
        var file = fs.readFileSync(save.getSavePath() + '/' + filename)
        return file.byteLength == filesize
    } catch (e) {
        return false
    }
}

// run a callback function when a file downloads
// async callback(file, filename) takes a Buffer and a String
async function onDownload(filename, filesize, callback) {
    if (!hasDownloaded(filename, filesize)) {
        setTimeout(() => {
            onDownload(filename, filesize, callback)
        }, 1000) // recursive call after 1s
    } else {
        try {
            var file = fs.readFileSync(save.getSavePath() + `/` + filename)
            await callback(file, filename)
        } catch (e) {
            console.log(e)
        } finally {
            fs.unlink(save.getSavePath() + `/` + filename, console.error)
        }
    }
}

// repeated code. allows for url/filename/size to be entered manually,
// it will use the attachment's properties if they arent passed
function downloadAndRun(attachment, callback, url, filename, filesize) {
    if (!url) url = attachment.url
    if (!filename) filename = attachment.filename
    if (!filesize) filesize = attachment.size

    save.downloadFromUrl(url, save.getSavePath() + `/` + filename)

    onDownload(filename, filesize, callback)
}

// ========================
// Controller Data Handling
// ========================

// Encryption/Decryption Algorithms:
//https://github.com/dolphin-emu/dolphin/blob/9ffa72ad1fb8574ecda9e120d8a7fb930d053b01/Source/Core/Core/HW/WiimoteEmu/Encryption.cpp

// decrypt(Buffer, Buffer)
// Ex: decrypt(<34 0E 08 17 79 44>, <E3 6A FD 03 19 A6 46 EC A9 18 8B 6A E3 19 C5 20>) => <80 80 80 80 B3 03>
function decrypt(data, key) {
    for (i = 0; i < 6; i++) {
        data[i] = ((data[i] ^ key[8 + i]) + key[i]) % 0x100
    }
    return data
}

// encrypt(Buffer, Buffer)
// Ex: encrypt(<80 80 80 80 B3 03>, <76 AC 6B C3 8A 54 EE FB B1 08 7A 3A C1 97 76 B5>) => <BB DC 6F 87 E8 38>
function encrypt(data, key) {
    for (i = 0; i < 6; i++) {
        data[i] = (data[i] - key[i] + 0x100) % 0x100 ^ key[8 + i]
    }
    return data
}

// changeControllerEncryption(Buffer, Buffer, Buffer)
// returns dtm but with the nunchuk data encrypted using a different key
function changeControllerEncryption(dtm, decryption_key, encryption_key) {
    var new_dtm = Buffer.from(dtm)

    var i = 0x100 // controller data start point
    while (i + 1 < dtm.length) {
        var isWiimote = dtm[i + 1] == 0xa1 // No false positives on 5.0
        var poll_length = isWiimote ? dtm[i++] : 8 // assume gcc otherwise

        var poll = Buffer.alloc(poll_length)
        dtm.copy(poll, 0, i, i + poll_length)

        if (isWiimote && poll_length == 0x17 && poll[1] == 0x37) {
            // nunchuk extension
            var data_length = 6
            var nunchuk_data = Buffer.alloc(data_length) // init buffer
            poll.copy(nunchuk_data, 0, poll_length - data_length) // copy encrypted data
            nunchuk_data = encrypt(
                decrypt(nunchuk_data, decryption_key),
                encryption_key
            ) // change encryption
            nunchuk_data.copy(poll, poll_length - data_length) // copy back into poll
        }

        poll.copy(new_dtm, i, 0, poll_length) // change poll in new dtm
        i += poll_length
    }

    return new_dtm
}

// removeGamecubeControllers(Buffer)
// returns dtm but with gamecube controller data removed
// this assumes that the dtm does have gcc data
function removeGamecubeControllers(dtm) {
    // header data
    var controllers = read(0xb, dtm)
    var new_controllers = controllers.substring(0, 4) + `0000`
    var new_dtm = write(0xb, dtm, new_controllers)

    // controller data
    var i = 0x100 // start point
    var j = 0x100 // location in new file

    while (i + 1 < dtm.length) {
        var isWiimote = dtm[i + 1] == 0xa1 // No false positives on 5.0

        if (isWiimote) {
            var poll_length = dtm[i] + 1 // include the byte that has the length
            dtm.copy(new_dtm, j, i, i + poll_length)
            j += poll_length
            i += poll_length
        } else {
            i += 8
        }
    }

    return new_dtm.slice(0, j) // remove leftover data
}

// pollToControllerData(Buffer, Buffer)
// converts a data stream (input poll) into a readable object with the data
// Examples:
// Input: <13 A1 33 00 00 80 66 80 01 C6 6A 65 C6 6A F7 C6 5A 6F C6 6A>
// Output: {mode:0x33, accel:[512,408,512], ir:[512,384], extension:NULL}
// Input: <17 A1 37 00 00 80 66 80 3C D2 66 9F D2 32 D2 66 A9 D2 BB DC 6F 87 E8 38>
// Output: {mode:0x37, accel:[512,512,616], ir:[512,384], buttons:"",
//          extension:{accel:[512,512,512], stick:[128,128], buttons:""}}
function pollToControllerData(poll, extension_decryption_key) {
    var obj = {
        mode: 0,
        length: 0,
        isWiimote: 0,
        accel: [0, 0, 0],
        ir: [0, 0],
        buttons: '', //"A B + - 1 2 UP DOWN LEFT RIGHT HOME",
        extension: {
            accel: [0, 0, 0],
            stick: [0, 0],
            buttons: '', //"Z C"
        },
    }

    obj.length = poll[0]
    obj.isWiimote = poll[1] == 0xa1 // No false positives on 5.0
    obj.mode = poll[2]

    // buttons
    if (poll[3] & 0x01) obj.buttons += 'LEFT '
    if (poll[3] & 0x02) obj.buttons += 'RIGHT '
    if (poll[3] & 0x04) obj.buttons += 'DOWN '
    if (poll[3] & 0x08) obj.buttons += 'UP '
    if (poll[3] & 0x10) obj.buttons += '+ '
    if (poll[4] & 0x10) obj.buttons += '- '
    if (poll[4] & 0x08) obj.buttons += 'A '
    if (poll[4] & 0x04) obj.buttons += 'B '
    if (poll[4] & 0x02) obj.buttons += '1 '
    if (poll[4] & 0x01) obj.buttons += '2 '
    if (poll[4] & 0x80) obj.buttons += 'HOME '
    obj.buttons = obj.buttons.trim() // remove space

    // acceleration
    // least significant bits stored in button bytes
    // for y,z least significant bit is always 0
    obj.accel[0] = (poll[5] << 2) + ((poll[3] & 0x60) >> 5)
    obj.accel[1] = (poll[6] << 2) + ((poll[4] & 0x20) >> 4)
    obj.accel[2] = (poll[7] << 2) + ((poll[4] & 0x40) >> 5)

    if (obj.mode == 0x33) {
        // no nunchuk
        for (var i = 0; i < 4; i++) {
            // 12 byte IR
            obj.ir[0] += poll[8 + i * 2] + ((poll[10 + i * 2] & 0x30) << 8)
            obj.ir[1] += poll[9 + i * 2] + ((poll[10 + i * 2] & 0xc0) << 8)
            // size = poll[10] & 0x0F // unused
        }
    } else if (obj.mode == 0x37) {
        // with nunchuk
        for (var i = 0; i < 2; i++) {
            // 10 byte IR
            obj.ir[0] += poll[8 + i * 5] + ((poll[10 + i * 5] & 0x30) << 8)
            obj.ir[1] += poll[9 + i * 5] + ((poll[10 + i * 5] & 0xc0) << 8)
            obj.ir[0] += poll[11 + i * 5] + ((poll[10 + i * 5] & 0x03) << 8)
            obj.ir[1] += poll[12 + i * 5] + ((poll[10 + i * 5] & 0x0c) << 8)
        }

        var data_length = 6
        var nunchuk = Buffer.alloc(data_length)
        poll.copy(nunchuk, 0, obj.length - data_length + 1)
        nunchuk = decrypt(nunchuk, extension_decryption_key)

        // stick
        obj.extension.stick[0] = nunchuk[0]
        obj.extension.stick[1] = nunchuk[1]

        // accel
        obj.extension.accel[0] = (nunchuk[2] << 2) + ((nunchuk[5] & 0x0c) >> 2)
        obj.extension.accel[1] = (nunchuk[3] << 2) + ((nunchuk[5] & 0x30) >> 4)
        obj.extension.accel[2] = (nunchuk[4] << 2) + ((nunchuk[5] & 0xc0) >> 6)

        // buttons
        if ((nunchuk[5] & 0x01) == 0) obj.extension.buttons += 'Z '
        if ((nunchuk[5] & 0x02) == 0) obj.extension.buttons += 'C '
        obj.extension.buttons = obj.extension.buttons.trim()
    }
    // fix IR // should always be an integer anyways
    obj.ir[0] = Math.floor(obj.ir[0] / 4)
    obj.ir[1] = Math.floor(obj.ir[1] / 4)
    if (obj.ir[0] > 1023) obj.ir[0] = 1023 // FFFFFF => max
    if (obj.ir[1] > 1023) obj.ir[1] = 1023

    //console.log(poll)
    //console.log(obj)
    return obj
}

// controllerDataToPoll(Object, Buffer)
// the reverse of the function above
// returns a buffer (including the buffer length as the first byte)
function controllerDataToPoll(obj, extension_encryption_key) {
    if (!obj.isWiimote) {
        // handle gamecube controllers later
        return NULL
    }

    var poll = Buffer.alloc(obj.length + 1)
    poll[0] = obj.length
    poll[1] = 0xa1
    poll[2] = obj.mode

    if (obj.buttons.includes('LEFT')) poll[3] += 0x01
    if (obj.buttons.includes('RIGHT')) poll[3] += 0x02
    if (obj.buttons.includes('DOWN')) poll[3] += 0x04
    if (obj.buttons.includes('UP')) poll[3] += 0x08
    if (obj.buttons.includes('+')) poll[3] += 0x10
    if (obj.buttons.includes('-')) poll[4] += 0x10
    if (obj.buttons.includes('A')) poll[4] += 0x08
    if (obj.buttons.includes('B')) poll[4] += 0x04
    if (obj.buttons.includes('1')) poll[4] += 0x02
    if (obj.buttons.includes('2')) poll[4] += 0x01
    if (obj.buttons.includes('HOME')) poll[4] += 0x80

    poll[5] += obj.accel[0] >> 2
    poll[6] += obj.accel[1] >> 2
    poll[7] += obj.accel[2] >> 2
    poll[3] += (obj.accel[0] & 0x3) << 5
    poll[4] += (obj.accel[0] & 0x2) << 4
    poll[4] += (obj.accel[0] & 0x2) << 5

    // set IR 4 points as (x-60,y), (x-50,y), (x+50,y), (x+60,y)
    if (obj.mode == 0x33) {
        for (var i = 0; i < 4; i++) {
            poll[9 + i * 3] = obj.ir[1] & 0xff
            poll[10 + i * 3] += (obj.ir[1] & 0x300) >> 2
        }
        if (obj.ir[0] - 50 > 0) {
            // x1
            poll[8] = (obj.ir[0] - 50) & 0xff
            poll[10] += ((obj.ir[0] - 50) & 0x300) >> 4
        }
        poll[11] = (obj.ir[0] + 50) & 0xff // x2
        poll[13] += ((obj.ir[0] + 50) & 0x300) >> 4
        if (obj.ir[0] - 60 > 0) {
            // x3
            poll[14] = (obj.ir[0] - 60) & 0xff
            poll[16] += ((obj.ir[0] - 60) & 0x300) >> 4
        }
        poll[17] = (obj.ir[0] + 60) & 0xff // x4
        poll[19] += ((obj.ir[0] + 60) & 0x300) >> 8
    } else if (obj.mode == 0x37) {
        for (var i = 0; i < 2; i++) {
            poll[9 + i * 5] = obj.ir[1] & 0xff
            poll[10 + i * 5] += (obj.ir[1] & 0x300) >> 2
            poll[12 + i * 5] = obj.ir[1] & 0xff
            poll[10 + i * 5] += (obj.ir[1] & 0x300) >> 6
        }
        if (obj.ir[0] - 50 > 0) {
            // x1
            poll[8] = (obj.ir[0] - 50) & 0xff
            poll[10] += ((obj.ir[0] - 50) & 0x300) >> 4
        }
        poll[11] = (obj.ir[0] + 50) & 0xff // x2
        poll[10] += ((obj.ir[0] + 50) & 0x300) >> 8
        if (obj.ir[0] - 60 > 0) {
            // x3
            poll[13] = (obj.ir[0] - 60) & 0xff
            poll[15] += ((obj.ir[0] - 60) & 0x300) >> 4
        }
        poll[16] = (obj.ir[0] + 60) & 0xff // x4
        poll[15] += ((obj.ir[0] + 60) & 0x300) >> 8

        // nunchuk poll[18] = nunchul[0]
        var data_length = 6
        var nunchuk = Buffer.alloc(data_length)
        nunchuk[0] = obj.extension.stick[0]
        nunchuk[1] = obj.extension.stick[1]

        nunchuk[2] = obj.extension.accel[0] >> 2
        nunchuk[3] = obj.extension.accel[1] >> 2
        nunchuk[4] = obj.extension.accel[2] >> 2
        nunchuk[5] = (obj.extension.accel[0] & 0x3) << 2
        nunchuk[5] = (obj.extension.accel[1] & 0x3) << 4
        nunchuk[5] = (obj.extension.accel[2] & 0x3) << 6

        nunchuk = encrypt(nunchuk, extension_encryption_key)
        nunchuk.copy(poll, 18)
    }

    return poll
}

// ======================
// Command Input Handling
// ======================

// returns {offset: hex, error: String}
function parseOffset(arg) {
    var offset = parseInt(arg, 16)
    if (isNaN(offset)) {
        return { error: `Invalid Argument: offset must be a number` }
    } else if (!validOffset(offset)) {
        return {
            error: `Invalid Argument: offset is not a valid start location`,
        }
    }
    return { offset: offset, error: false }
}

// returns {url: String, error: String}
function parseFile(msg) {
    if (msg.attachments.length == 0) {
        return { error: `Missing Arguments: No dtm specified` }
    }
    let url = msg.attachments[0].url
    url = url.substring(0, url.lastIndexOf('?')) || url
    if (!url.endsWith(`.dtm`)) {
        return { error: `Invalid Argument: file is not a dtm` }
    }
    msg.attachments[0].error = false
    return msg.attachments[0]
}

// ================
// Discord Commands
// ================

module.exports = {
    name: `DTM Editor`,
    short_name: `dtm`,

    header: {
        name: `dtmheader`,
        short_descrip: `List header table`,
        full_descrip: `Usage: \`$header\`\nLists the dtm header table`,
        hidden: true,
        function: async function (bot, msg, args) {
            var result = ``
            Object.keys(Header).forEach((offset) => {
                result += `0x${parseInt(offset).toString(16).toUpperCase().padStart(2, `0`)} ${Header[offset][2]}\n`
            })
            return '```' + result + '```'
        },
    },

    read: {
        name: `dtmread`,
        short_descrip: `Read specific header data`,
        full_descrip: `Usage: \`$read <offset> <dtm attachment>\`\nReads the specified offset in the header. The offset must be a valid start location of some data.`,
        hidden: true,
        function: async function (bot, msg, args) {
            if (args.length == 0)
                return `Missing Arguments: \`$read <offset> <dtm attachment>\``

            var offset = parseOffset(args[0])
            if (offset.error) return offset.error
            offset = offset.offset

            var attachment = parseFile(msg)
            if (attachment.error) return attachment.error

            async function readdata(dtm, filename) {
                var data = read(offset, dtm)
                try {
                    await bot.createMessage(
                        msg.channel.id,
                        `${Header[offset][2]}: \`${data}\``
                    )
                } catch (e) {
                    console.log(e)
                }
            }

            downloadAndRun(attachment, readdata)
        },
    },

    dtminfo: {
        name: `dtminfo`,
        short_descrip: `Reads all header data`,
        full_descrip: `Usage: \`$dtminfo <dtm attachment>\`\nReads all of the header data.`,
        hidden: true,
        function: async function (bot, msg, args) {
            var attachment = parseFile(msg)
            if (attachment.error) return attachment.error

            async function readheader(dtm, filename) {
                var result = ``
                Object.keys(Header).forEach((offset) => {
                    result += `${Header[offset][2]}: ${read(offset, dtm)}\n`
                })
                await bot.createMessage(msg.channel.id, '```' + result + '```')
            }

            downloadAndRun(attachment, readheader)
        },
    },

    write: {
        name: `dtmwrite`,
        short_descrip: `Edit header data`,
        full_descrip: `Usage: \`$write <offset> <arguments...> <dtm attachment>\`\nWrites the arguments to the specified offset in the header. The offset must be a valid start location of some data.`,
        hidden: true,
        function: async function (bot, msg, args) {
            // it's a known side effect that you cannot pass an empty string. Might change this later.
            if (args.length < 2)
                return `Missing Arguments: \`$write <offset> <arguments...> <dtm attachment>\``

            var offset = parseOffset(args.shift())
            if (offset.error) return offset.error
            offset = offset.offset

            var attachment = parseFile(msg)
            if (attachment.error) return attachment.error

            // verify input is of the right type
            var type = Header[offset][0]
            var input
            // potentially want to also handle binary strings as input for bitfields
            if (type == BitField || type == Integer) {
                if (isNaN(parseInt(args[0]))) {
                    return `Invalid Argument: offset 0x${parseInt(offset).toString(16).toUpperCase()} coressponds to a number`
                }
                input = parseInt(args[0])
            } else if (type == Boolean) {
                input = args[0].toUpperCase()
                input = !(
                    parseInt(input) == 0 ||
                    input == `FALSE` ||
                    input == `F`
                )
            } else {
                // Bytes, String
                input = args.join(` `)
            }

            async function writedata(dtm, filename) {
                var old_data = read(offset, dtm)
                var new_file = write(offset, dtm, input)
                try {
                    await bot.createMessage(
                        msg.channel.id,
                        `Value changed from \`${old_data}\` to \`${input}\``,
                        { file: new_file, name: filename }
                    )
                } catch (e) {
                    console.log(e)
                }
            }

            downloadAndRun(attachment, writedata)
        },
    },

    changeencryption: {
        name: `recrypt`,
        short_descrip: `Changes wiimote encryption`,
        full_descrip: `Usage: \`$recrypt <old_key> <new_key> <dtm attachment>\`\nChanges the nunchuk encryption of a .dtm file. The keys must be given without spaces Ex: \`$recrypt E36AFD0319A646ECA9188B6AE319C520 76AC6BC38A54EEFBB1087A3AC19776B5\`. It *should* handle any combination of controllers (untested).`,
        hidden: true,
        function: async function (bot, msg, args) {
            if (args.length < 2)
                return `Missing Arguments: \`$recrypt <old_key> <new_key> <dtm attachment>\``

            var attachment = parseFile(msg)
            if (attachment.error) return attachment.error

            async function recrypt(dtm, filename) {
                var key1 = stringLiteralToBuffer(args[0], 32)
                var key2 = stringLiteralToBuffer(args[1], 32)
                var new_file = changeControllerEncryption(dtm, key1, key2)
                try {
                    await bot.createMessage(
                        msg.channel.id,
                        `Nunchuk encryption changed from \`${bufferToStringLiteral(key1)}\` to \`${bufferToStringLiteral(key2)}\``,
                        { file: new_file, name: filename }
                    )
                } catch (e) {
                    console.log(e)
                }
            }

            downloadAndRun(attachment, recrypt)
        },
    },

    removegccs: {
        name: `removegcc`,
        short_descrip: `Removes gcc input data`,
        full_descrip: `Usage: \`removegcc <dtm attachment>\`\nRemoves all gamecube controller data from a dtm.`,
        hidden: true,
        function: async function (bot, msg, args) {
            var attachment = parseFile(msg)
            if (attachment.error) return attachment.error

            async function removegcc(dtm, filename) {
                if (read(0xb, dtm).substr(4) == `0000`) {
                    bot.createMessage(
                        msg.channel.id,
                        `Invalid Argument: DTM does not contain any GCC data`
                    )
                } else {
                    var new_dtm = removeGamecubeControllers(dtm)
                    try {
                        await bot.createMessage(
                            msg.channel.id,
                            `Removed GCC data`,
                            { file: new_dtm, name: filename }
                        )
                    } catch (e) {
                        console.log(e)
                    }
                }
            }

            downloadAndRun(attachment, removegcc)
        },
    },
}

// ==================
// Editing local DTMs // INCOMPLETE
// ==================

// editLocalDTM(filename, command, args...)
// this assumes you pass the right number of arguments
// this code is currently untested
function editLocalDTM(a, b, c, d, e, f, g) {
    var args = [a, b, c, d, e, f, g]
    var SAVE_TO_NEW_FILE = true
    try {
        var dtm = fs.readFileSync(`./${args[0]}.dtm`)
        var save_filename = SAVE_TO_NEW_FILE
            ? `./${args[0]}_edit.dtm`
            : `./${args[0]}.dtm`
        switch (args[1]) {
            case `read`:
                var offset = parseOffset(args[2])
                console.log(`${Header[offset][2]}: ${read(offset, dtm)}`)
                break

            case `dtminfo`:
                var offset = parseOffset(args[2])
                Object.keys(Header).forEach((offset) => {
                    console.log(`${Header[offset][2]}: ${read(offset, dtm)}`)
                })
                break

            case `write`:
                var offset = parseOffset(args[2])
                var old_data = read(offset, dtm)
                var new_dtm = write(offset, dtm, args[3])
                fs.writeFileSync(save_filename, new_dtm)
                console.log(
                    `Value changed from \`${old_data}\` to \`${args[3]}\``
                )
                break

            case `recrypt`:
                var key1 = stringLiteralToBuffer(args[2], 32)
                var key2 = stringLiteralToBuffer(args[3], 32)
                var new_dtm = changeControllerEncryption(dtm, key1, key2)
                fs.writeFileSync(save_filename, new_dtm)
                console.log(
                    `Nunchuk encryption changed from \`${bufferToStringLiteral(key1)}\` to \`${bufferToStringLiteral(key2)}\``
                )
                break

            case `removegcc`:
                var new_dtm = removeGamecubeControllers(dtm)
                fs.writeFileSync(save_filename, new_dtm)
                console.log(`Removed GameCube controllers`)
                break

            case `parsepolls`:
                var key = stringLiteralToBuffer(args[2], 32)
                function print_poll(obj) {
                    var s = obj.buttons
                    s += ` ACC:${obj.accel.join(`,`)}`
                    s += ` IR:${obj.ir.join(`,`)}`
                    if (obj.mode == 0x37) {
                        if (obj.extension.buttons.length > 0) s += ` `
                        s += obj.extension.buttons
                        s += ` N-ACC:${obj.extension.accel.join(`,`)}`
                        s += ` ANA:${obj.extension.stick.join(`,`)}`
                    }
                    console.log(s.trim())
                }
                var i = 0x100 // controller data start point
                while (i + 1 < dtm.length) {
                    var isWiimote = dtm[i + 1] == 0xa1 // No false positives on 5.0
                    var poll_length = isWiimote ? dtm[i] + 1 : 8
                    var poll = Buffer.alloc(poll_length)
                    dtm.copy(poll, 0, i, i + poll_length)
                    if (isWiimote) {
                        var obj = pollToControllerData(poll, key)
                        print_poll(obj)
                    }
                    i += poll_length
                }
                break

            case `convert2poll`:
                var key = stringLiteralToBuffer(args[2], 32)
                console.log(controllerDataToPoll(args[3], key))
                break

            default:
                console.log(`Command not recognized`)
        }
    } catch (e) {
        console.error(e)
    }
}
//editLocalDTM(`in`, `dtminfo`, 31, `Xander`) // edit author
//editLocalDTM(`a`, `write`, parseInt(0xD), 71583) // vi // input 447692
//editLocalDTM(`Sky_Station_G1`, `parsepolls`, `C835F094A02E880301700735C8A09866`)
/*var frame = {
    mode: 0,
    length: 0,
    isWiimote: 0,
    accel: [0,0,0],
    ir: [0,0],
    buttons: "", //"A B + - 1 2 UP DOWN LEFT RIGHT HOME",
    extension: {
      accel: [0,0,0],
      stick: [0,0],
      buttons: "", //"Z C"
    }
}*/
//editLocalDTM(`a`, `convert2poll`, `C835F094A02E880301700735C8A09866`, frame) // currently untested

// changePolls(String, String, String)
// takes in 3 filenames. dtmpoll and desiredpoll are formatted:
// [[frame, # of polls], ...]
// assumes 2 wiimotes with no other controllers
function changePolls(
    dtmname,
    dtmpoll,
    desiredpoll,
    startFrame,
    convertedStartFrame
) {
    var dtm = fs.readFileSync(`./` + dtmname)

    var pollfile1 = fs.readFileSync(`./` + dtmpoll)
    var current_num_polls = JSON.parse(pollfile1.toString())

    var pollfile2 = fs.readFileSync(`./` + desiredpoll)
    var desired_num_polls = JSON.parse(pollfile2.toString())

    var new_dtm = Buffer.from(dtm)
    var i = 0x100 // controller data start
    var j = 0x100 // location in new file

    // keep track of what the polls are on the current frame
    var cpi = 0 // current poll index
    while (current_num_polls[cpi][0] != startFrame) {
        for (var x = 0; x < current_num_polls[cpi][1]; x++) i += dtm[i] + 1
        cpi++
    }
    console.log(cpi, i)
    var dpi = 0 // desired poll index
    while (desired_num_polls[dpi][0] != convertedStartFrame) dpi++
    console.log(dpi)

    while (cpi < current_num_polls.length && dpi < desired_num_polls.length) {
        var p1_poll_length = dtm[i] + 1 // include the byte that has the length
        //console.log(`p1 len`, p1_poll_length)
        var p1 = dtm.slice(i, i + p1_poll_length)
        //console.log(p1)

        var p2_poll_length = dtm[i] + 1
        var p2 = dtm.slice(
            i + p1_poll_length,
            i + p1_poll_length + p2_poll_length
        )
        //console.log(p2)

        // copy the new poll amount to the new file
        for (var x = 0; x < desired_num_polls[dpi][1] / 2; x++) {
            j += p1.copy(new_dtm, j) // returns number of bytes copyies
            j += p2.copy(new_dtm, j)
        }

        // pass over the current number of polls
        for (var x = 0; x < current_num_polls[cpi][1]; x++) {
            i += dtm[i] + 1
        }

        cpi++
        dpi++
    }

    fs.writeFileSync(`out.dtm`, new_dtm.slice(0, j))
}
//changePolls(`in.dtm`, `polls_GE3.txt`, `polls.txt`, 168, 62971)
