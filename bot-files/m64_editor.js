// m64 header information source: http://tasvideos.org/EmulatorResources/Mupen/M64.html

var fs = require(`fs`)
var save = require(`./save.js`)

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
    if (byte.toString().length < 2) {
      hex = `0` + byte + hex
    } else {
      hex = byte + hex
    }
  })
  return parseInt(hex, 16)
}

// bufferToString(Buffer)
// converts a buffer to a string and removes trailing zeros
function bufferToString(buffer) {
  while (Buffer.byteLength(buffer) > 0 && buffer[Buffer.byteLength(buffer) - 1] == 0) {
    buffer = buffer.slice(0, Buffer.byteLength(buffer) - 1)
  }
  return buffer.toString()
}

// bufferInsert(Buffer, int, int, Buffer)
// inclusive lower bound, exclusive upper bound
// Ex: bufferInsert(<00 01 02 03 04>, 2, 4, <06, 09>) => <00, 01, 06, 09, 04>
function bufferInsert(buffer, start, end, insert) {
  return Buffer.concat([
    buffer.slice(0, start),
    insert,
    buffer.slice(end, Buffer.byteLength(buffer))
  ])
}

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
function onDownload(filename, filesize, callback) {
  if (!hasDownloaded(filename, filesize)) {
    setTimeout(() => {onDownload(filename, filesize, callback)}, 1000) // recursive call after 1s
  } else {
    callback(filename)
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


module.exports = {
	name: `m64 Editor`,
	short_name: `m64`,

  rerecords:{
    name: `rerecords`,
    aliases: [`rerecord`, `rr`],
    short_descrip: `Change rerecord amount`,
    full_descrip: `Usage: \`$rr <num_rerecords> <m64 attachment>\`\nChanges the rerecords count in the attached m64. If the number provided is less than 0, it will edit it to be 0. If it exceeds the maximum 4-byte integer (4294967295) then it will edit it to be the max.`,
    hidden: true,
    function: async function(bot, msg, args) {

      // make sure there's enough arguments
      if (args.length == 0) {
        return `Missing Arguments: \`$rr <num_rerecords> <m64 attachment>\``
      } else if (msg.attachments.length == 0) {
        return `Missing Arguments: No m64 specified \`$rr <num_rerecords> <m64 attachment>\``
      } else if (isNaN(args[0])) {
        return `Invalid Argument: rerecords must be a number`
      } else if (!msg.attachments[0].url.endsWith(`.m64`)) {
        return `Invalid Argument: file is not an m64`
      }

      // force rerecords in range of [0, 4 byte max]
      const MAX_RR = parseInt(0xFFFFFFFF)
      const LOCATION = parseInt(0x10)
      const SIZE = 4

      var rerecords = parseInt(args[0])
      if (rerecords > MAX_RR) {
        rerecords = MAX_RR
        bot.createMessage(msg.channel.id, `WARNING: Max rerecord count exceeded`)
      } else if (rerecords < 0) {
        rerecords = 0
        bot.createMessage(msg.channel.id, `WARNING: Min rerecord count exceeded`)
      }

      function updateRerecords(filename) {
        fs.readFile(save.getSavePath() + `/` + filename, async (err, m64) => {
          if (err) {
            bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
          } else {

            var rr_hex = intToLittleEndian(rerecords, SIZE)
            var old_rr = littleEndianToInt(m64.slice(LOCATION, LOCATION + SIZE))
            var new_m64 = bufferInsert(m64, LOCATION, LOCATION + SIZE, rr_hex)

            try {
              await bot.createMessage(
                msg.channel.id,
                `Rerecords changed from ${old_rr} to ${rerecords}`,
                {file: new_m64, name: filename}
              )
              fs.unlinkSync(save.getSavePath() + `/` + filename)
            } catch (err) {
              bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
            }
          }
        })
      }

      downloadAndRun(msg.attachments[0], updateRerecords)

    }
  },

  description:{
    name: `description`,
    aliases: [`descrip`],
    short_descrip: `Edit description`,
    full_descrip: `Usage: \`$descrip [new description] <m64 attachment>\`\nChanges the description in the attached m64. Spaces are allowed in the new description.`,
    hidden: true,
    function: async function(bot, msg, args) {

      if (msg.attachments.length == 0) {
        return `Missing Arguments: No m64 specified \`$descrip [new description] <m64 attachment>\``
      } else if (!msg.attachments[0].url.endsWith(`.m64`)) {
        return `Invalid Argument: file is not an m64`
      }

      const LOCATION = parseInt(0x300)
      const SIZE = 256

      var descrip = Buffer.from(args.join(` `), `utf8`)
      if (Buffer.byteLength(descrip) > SIZE) {
        descrip = descrip.slice(0, SIZE)
        bot.createMessage(msg.channel.id, `WARNING: Max length exceeded`)
      }
      while (Buffer.byteLength(descrip) < SIZE) { // force to fill
        descrip = Buffer.concat([descrip, Buffer.from([0])])
      }

      function updateDescrip(filename) {
        fs.readFile(save.getSavePath() + `/` + filename, async (err, m64) => {
          if (err) {
            bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
          } else {

            var old_descrip = m64.slice(LOCATION, LOCATION + SIZE)
            var new_m64 = bufferInsert(m64, LOCATION, LOCATION + SIZE, descrip)

            try {
              await bot.createMessage(
                msg.channel.id,
                `Description changed from \`${bufferToString(old_descrip)}\` to \`${bufferToString(descrip)}\``,
                {file: new_m64, name: filename}
              )
              fs.unlinkSync(save.getSavePath() + `/` + filename)
            } catch (err) {
              bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
            }
          }
        })
      }

      downloadAndRun(msg.attachments[0], updateDescrip)

    }
  },

  author:{
    name: `author`,
    aliases: [`authors`, `auth`],
    short_descrip: `Edit athor's name`,
    full_descrip: `Usage: \`$auth [new name] <m64 attachment>\`\nChanges the author in the attached m64 file. You can uses spaces in the new name.`,
    hidden: true,
    function: async function(bot, msg, args) {

      if (msg.attachments.length == 0) {
        return `Missing Arguments: No m64 specified \`$auth [new name] <m64 attachment>\``
      } else if (!msg.attachments[0].url.endsWith(`.m64`)) {
        return `Invalid Argument: file is not an m64`
      }

      const LOCATION = parseInt(0x222)
      const SIZE = 222
      var author = Buffer.from(args.join(` `), `utf8`)
      if (Buffer.byteLength(author) > SIZE) {
        author = author.slice(0, SIZE)
        bot.createMessage(msg.channel.id, `WARNING: Max length exceeded`)
      }
      while (Buffer.byteLength(author) < SIZE) { // force to fill
        author = Buffer.concat([author, Buffer.from([0])])
      }

      function updateAuthor(filename) {
        fs.readFile(save.getSavePath() + `/` + filename, async (err, m64) => {
          if (err) {
            bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
          } else {

            var old_author = m64.slice(LOCATION, LOCATION + SIZE)
            var new_m64 = bufferInsert(m64, LOCATION, LOCATION + SIZE, author)

            try {
              await bot.createMessage(
                msg.channel.id,
                `Author changed from \`${bufferToString(old_author)}\` to \`${bufferToString(author)}\``,
                {file: new_m64, name: filename}
              )
              fs.unlinkSync(save.getSavePath() + `/` + filename)
            } catch (err) {
              bot.createMessage(msg.channel.id, `Something went wrong\`\`\`${err}\`\`\``)
            }
          }
        })
      }

      downloadAndRun(msg.attachments[0], updateAuthor)

    }
  }
}
