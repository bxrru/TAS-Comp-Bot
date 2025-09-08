const fs = require('fs')
const request = require('request')
const LOG_LOADS = false
var SAVE_PATH = './saves'

function saveFile(filename, content) {
    module.exports.makeFolderIfNotExist(SAVE_PATH + '/')
    try {
        fs.writeFileSync(SAVE_PATH + '/' + filename, content)
    } catch (e) {
        console.log('FAILED TO SAVE ' + filename)
    }
}

module.exports = {
    setSavePath: function (path) {
        if (path == undefined) path = './saves'
        SAVE_PATH = path
    },
    getSavePath: function () {
        return SAVE_PATH
    },
    makeFolderIfNotExist: function (path) {
        if (!fs.existsSync(path)) {
            fs.mkdirSync(path)
        }
    },
    downloadFromUrl: function (url, path, callback) {
        request
            .get(url)
            .on('error', console.error)
            .pipe(fs.createWriteStream(path))
            // Some callers provide no callback
            .on('close', callback ? callback : () => {})
    },
    downloadAllFromUrl: async function (urls, paths, callback) {
        for (let i = 0; i < urls.length; i++) {
            await new Promise((resolve, reject) => {
                request
                    .get(urls[i])
                    .pipe(fs.createWriteStream(paths[i]))
                    .on('error', console.error)
                    .on('close', resolve)
            })
        }
        if (callback) callback()
    },
    saveObject: function (filename, object) {
        if (!filename.toUpperCase().endsWith('.JSON')) filename += '.json'
        if (LOG_LOADS) console.log(`Saving ${filename}...`)
        saveFile(filename, JSON.stringify(object))
    },
    readObject: function (filename) {
        try {
            if (!filename.toUpperCase().endsWith('.JSON')) filename += '.json'
            var data = fs.readFileSync(SAVE_PATH + '/' + filename)
            var obj = JSON.parse(data)
            if (LOG_LOADS) console.log(`${filename} loaded`)
            return obj
        } catch (err) {
            console.log('Could not read file ' + filename)
            return null
        }
    },
}
