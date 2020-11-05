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
  0x000: [Bytes,	4,	`Signature: 44 54 4D 1A "DTM\\x1A"`],
  0x004: [String,	6,	`Game ID`],
  0x00A: [Boolean,	1,	`Is Wii game`],
  0x00B: [BitField,	1,	`Controllers plugged in (from least to most significant, the bits are GC controllers 1-4 and Wiimotes 1-4)`],
  0x00C: [Boolean,	1,	`Starts from savestate`],
  0x00D: [Integer,	8,	`VI count`],
  0x015: [Integer,	8,	`Input count`],
  0x01D: [Integer,	8,	`Lag counter`],
  //0x025: [N/A,	8,	`Reserved`],
  0x02D: [Integer,	4,	`Rerecord count`],
  0x031: [String,	32,	`Author`],
  0x051: [String,	16,	`Video Backend`],
  0x061: [Integer,	16,	`Audio Emulator`],
  0x071: [Bytes,	16,	`MD5 hash of game file`],
  0x081: [Integer,	8,	`Recording start time (UNIX time)`],
  0x089: [Boolean,	1,	`Saved config valid?`],
  0x08A: [Boolean,	1,	`Idle Skipping on?`],
  0x08B: [Boolean,	1,	`Dual Core enabled?`],
  0x08C: [Boolean,	1,	`Progressive Scan enabled?`],
  0x08D: [Boolean,	1,	`DSP HLE enabled? (false means LLE)`],
  0x08E: [Boolean,	1,	`Fast disc speed enabled?`],
  0x08F: [Integer,	1,	`CPU core (0 for interpreter, 1 for JIT, 2 for JITIL)`],
  0x090: [Boolean,	1,	`EFB Access Enabled?`],
  0x091: [Boolean,	1,	`EFB Copy Enabled?`],
  0x092: [Boolean,	1,	`Copy EFB To Texture? (1 for texture, 0 for ram)`],
  0x093: [Boolean,	1,	`EFB Copy Cache Enabled?`],
  0x094: [Boolean,	1,	`Emulate Format Changes?`],
  0x095: [Boolean,	1,	`Use XFB emulation?`],
  0x096: [Boolean,	1,	`Use real XFB emulation?`],
  0x097: [BitField,	1,	`Memory cards present (from least to most significant, the bits are slot A and B)`],
  0x098: [Boolean,	1,	`Memory card blank?`],
  0x099: [BitField,	1,	`Bongos plugged in (from least to most significant, the bits are ports 1-4)`],
  0x09A: [Boolean,	1,	`Sync GPU thread enabled?`],
  0x09B: [Boolean,	1,	`Recorded in a netplay session?`],
  0x09C: [Boolean,	1,	`SYSCONF PAL60 setting (this setting only applies to Wii games that support both 50 Hz and 60 Hz)`],
  0x09D: [Integer,	1,	`Language (the numbering scheme is different for GC and Wii)`],
  //0x09E: [N/A,	1,	`Reserved`],
  0x09F: [Boolean,	1,	`JIT branch following enabled?`],
  //0x0A0: [N/A,	9,	`Reserved`],
  0x0A9: [String,	40,	`Name of second disc iso`],
  0x0D1: [Bytes,	20,	`SHA-1 hash of git revision`],
  0x0E5: [Integer,	4,	`DSP IROM Hash`],
  0x0E9: [Integer,	4,	`DSP COEF Hash`]
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
  var hex = int.toString(16).toUpperCase()              // convert to hex
  while (hex.length < 2 * byteLength) hex = `0` + hex   // fill the size
  var bytes = hex.match(/.{2}/g)                        // split into pairs
  var reverse = []
  bytes.forEach(byte => reverse.unshift(`0x` + byte))   // reverse order
  return Buffer.from(reverse)                           // convert to buffer
}

// littleEndianToInt(Buffer)
// converts a buffer in little endian to an int in base 10
// Ex: littleEndianToInt(<0b 1d 00 00>) => 7435
function littleEndianToInt(buffer) {
  var hex = ``
  var array = [...buffer]
  array.forEach(byte => {
    byte = byte.toString(16).toUpperCase() // force hex
    hex = byte.padStart(2, "0") + hex // reverse bytes
  })
  return parseInt(hex, 16)
}

// bufferToBitField(Buffer)
// Converts the first byte of a buffer to a binary string
// Ex: bufferToBitField(<FE>) => "11111110"
function bufferToBitField(buffer) {
  buffer = buffer.slice(0, 1) // force length 1
  var n = littleEndianToInt(buffer)
  return (n >>> 0).toString(2).padStart(8, "0")
}

// BitFieldToBuffer(String)
// converts a string to a 1 byte buffer
// Ex: BitFieldToBuffer("11111111") => <FF>
function BitFieldToBuffer(bitfield) {
  var n = parseInt(bitfield, 2)
  if (isNaN(n)) {
    return Buffer.alloc(1)
  } else if (n > 0xFF) {
    n = 0xFF
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
  array.forEach(byte => {
    byte = byte.toString(16).toUpperCase() // force hex
    result += byte.padStart(2, "0") + ` `
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
    buffer.slice(end, buffer.length)
  ])
}

// stringLiteralToBuffer(string, size)
// Converts the string to a buffer
// pads the right with 0 to fill size
// Any non-hex characters are set to F
// Ex: stringLiteralToBuffer("ABG21", 8) => <AB F2 10 00>
function stringLiteralToBuffer(str, size) {
  str = str.toUpperCase().replace(/ /g, ``).replace(/[^0-9A-F]/, `F`)
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
    var file = fs.readFileSync(save.getSavePath() + "/" + filename)
    return file.byteLength == filesize
  } catch (e) {
    return false
  }
}

// run a callback function when a file downloads
// async callback(file, filename) takes a Buffer and a String
async function onDownload(filename, filesize, callback) {
  if (!hasDownloaded(filename, filesize)) {
    setTimeout(() => {onDownload(filename, filesize, callback)}, 1000) // recursive call after 1s
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
// Controller Data Handling // TODO
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
    data[i] = ((data[i] - key[i] + 0x100) % 0x100) ^ key[8 + i]
  }
  return data
}

// changeControllerEncryption(Buffer, Buffer, Buffer)
// returns dtm but with the nunchuk data encrypted using a different key
function changeControllerEncryption(dtm, decryption_key, encryption_key) {

  var new_dtm = Buffer.from(dtm)

  var i = 0x100 // controller data start point
  while (i + 1 < dtm.length) {

    var isWiimote = dtm[i + 1] == 0xA1 // No false positives on 5.0
    var poll_length = isWiimote ? dtm[i++] : 8 // assume gcc otherwise

    var poll = Buffer.alloc(poll_length)
    dtm.copy(poll, 0, i, i + poll_length)

    if (isWiimote && poll_length == 0x17 && poll[1] == 0x37) { // nunchuk extension
      var data_length = 6
      var nunchuk_data = Buffer.alloc(data_length) // init buffer
      poll.copy(nunchuk_data, 0, poll_length - data_length) // copy encrypted data
      nunchuk_data = encrypt(decrypt(nunchuk_data, decryption_key), encryption_key) // change encryption
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
  var controllers = read(0xB, dtm)
  var new_controllers = controllers.substring(0, 4) + `0000`
  var new_dtm = write(0xB, dtm, new_controllers)

  // controller data
  var i = 0x100 // start point
  var j = 0x100 // location in new file

  while (i + 1 < dtm.length) {

    var isWiimote = dtm[i + 1] == 0xA1 // No false positives on 5.0

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


// ======================
// Command Input Handling
// ======================


// returns {offset: hex, error: String}
function parseOffset(arg) {
  var offset = parseInt(arg, 16)
  if (isNaN(offset)) {
    return {error: `Invalid Argument: offset must be a number`}
  } else if (!validOffset(offset)) {
    return {error: `Invalid Argument: offset is not a valid start location`}
  }
  return {offset: offset, error: false}
}

// returns {url: String, error: String}
function parseFile(msg) {
  if (msg.attachments.length == 0) {
    return {error: `Missing Arguments: No dtm specified`}
  } else if (!msg.attachments[0].url.endsWith(`.dtm`)) {
    return {error: `Invalid Argument: file is not a dtm`}
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

  header:{
    name: `header`,
    short_descrip: `List header table`,
    full_descrip: `Usage: \`$header\`\nLists the dtm header table`,
    hidden: true,
    function: async function(bot, msg, args) {
      var result = ``
      Object.keys(Header).forEach(offset => {
        result += `0x${parseInt(offset).toString(16).toUpperCase().padStart(2, `0`)} ${Header[offset][2]}\n`
      })
      return "```" + result + "```"
    }
  },

  read:{
    name: `read`,
    short_descrip: `Read specific header data`,
    full_descrip: `Usage: \`$read <offset> <dtm attachment>\`\nReads the specified offset in the header. The offset must be a valid start location of some data.`,
    hidden: true,
    function: async function(bot, msg, args) {

      if (args.length == 0) return `Missing Arguments: \`$read <offset> <dtm attachment>\``

      var offset = parseOffset(args[0])
      if (offset.error) return offset.error
      offset = offset.offset

      var attachment = parseFile(msg)
      if (attachment.error) return attachment.error

      async function readdata(dtm, filename) {
        var data = read(offset, dtm)
        try {
          await bot.createMessage(msg.channel.id, `${Header[offset][2]}: \`${data}\``)
        } catch (e) {
          console.log(e)
        }
      }

      downloadAndRun(attachment, readdata)

    }
  },

  dtminfo:{
    name: `dtminfo`,
    short_descrip: `Reads all header data`,
    full_descrip: `Usage: \`$dtminfo <dtm attachment>\`\nReads all of the header data.`,
    hidden: true,
    function: async function(bot, msg, args) {

      var attachment = parseFile(msg)
      if (attachment.error) return attachment.error

      async function readheader(dtm, filename) {
        var result = ``
        Object.keys(Header).forEach(offset => {
          result += `${Header[offset][2]}: ${read(offset, dtm)}\n`
        })
        await bot.createMessage(msg.channel.id, "```" + result + "```")
      }

      downloadAndRun(attachment, readheader)

    }
  },

  write:{
    name: `write`,
    short_descrip: `Edit header data`,
    full_descrip: `Usage: \`$write <offset> <arguments...> <dtm attachment>\`\nWrites the arguments to the specified offset in the header. The offset must be a valid start location of some data.`,
    hidden: true,
    function: async function(bot, msg, args) {

      // it's a known side effect that you cannot pass an empty string. Might change this later.
      if (args.length < 2) return `Missing Arguments: \`$write <offset> <arguments...> <dtm attachment>\``

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
        input = !(parseInt(input) == 0 || input == `FALSE` || input == `F`)

      } else { // Bytes, String
        input = args.join(` `)

      }

      async function writedata(dtm, filename) {
        var old_data = read(offset, dtm)
        var new_file = write(offset, dtm, input)
        try {
          await bot.createMessage(
            msg.channel.id,
            `Value changed from \`${old_data}\` to \`${input}\``,
            {file: new_file, name: filename}
          )
        } catch (e) {
          console.log(e)
        }
      }

      downloadAndRun(attachment, writedata)

    }
  },

  changeencryption:{
    name: `recrypt`,
    short_descrip: `Changes wiimote encryption`,
    full_descrip: `Usage: \`$recrypt <old_key> <new_key> <dtm attachment>\`\nChanges the nunchuk encryption of a .dtm file. The keys must be given without spaces Ex: \`$recrypt E36AFD0319A646ECA9188B6AE319C520 76AC6BC38A54EEFBB1087A3AC19776B5\`. It *should* handle any combination of controllers (untested).`,
    hidden: true,
    function: async function(bot, msg, args) {

      if (args.length < 2) return `Missing Arguments: \`$recrypt <old_key> <new_key> <dtm attachment>\``

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
            {file: new_file, name: filename}
          )
        } catch (e) {
          console.log(e)
        }
      }

      downloadAndRun(attachment, recrypt)

    }
  },

  removegccs:{
    name: `removegcc`,
    short_descrip: `Removes gcc input data`,
    full_descrip: `Usage: \`removegcc <dtm attachment>\`\nRemoves all gamecube controller data from a dtm.`,
    hidden: true,
    function: async function(bot, msg, args) {

      var attachment = parseFile(msg)
      if (attachment.error) return attachment.error

      async function removegcc(dtm, filename) {
        if (read(0xB, dtm).substr(4) == `0000`) {
          bot.createMessage(msg.channel.id, `Invalid Argument: DTM does not contain any GCC data`)
        } else {
          var new_dtm = removeGamecubeControllers(dtm)
          try {
            await bot.createMessage(
              msg.channel.id,
              `Removed GCC data`,
              {file: new_dtm, name: filename}
            )
          } catch (e) {
            console.log(e)
          }
        }
      }

      downloadAndRun(attachment, removegcc)
    }
  }
}
