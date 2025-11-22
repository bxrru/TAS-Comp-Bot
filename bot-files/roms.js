const fs = require('fs')
const path = require('path')

module.exports = {
    /**
     * Reads all ROM files in a directory and builds a mapping of CRC32 checksums to ROM names.
     * @param {*} directoryPath Path to the directory containing ROM files.
     * @returns {Object} An object mapping CRC32 checksums to ROM names.
     */
    getKnownCRCsFromROMsInDirectory: (directoryPath) => {
        const known_crcs = {}

        const romFilenames = fs.readdirSync(directoryPath)
        romFilenames.forEach(file => {
            const filePath = path.join(directoryPath, file)

            // ignore folders
            if (fs.lstatSync(filePath).isDirectory()) {
                return
            }

            const fileBuffer = fs.readFileSync(filePath);

            if (fileBuffer.length < 20) {
                console.error(`File too small: ${file} (${fileBuffer.length} bytes)`);
                return;
            }

            const crc = fileBuffer.readUInt32BE(16)
            const romName = path.parse(file).name

            known_crcs[crc] = romName
        });
        return known_crcs
    },

    /**
     * Formats a CRC value into a standardized string representation.
     * @param {*} crc CRC value to format.
     */
    formatCRC: (crc) => {
        return [0, 8, 16, 24]
            .map(shift => ((crc >>> shift) & 0xFF).toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
    },

    /**
     * Converts a ROM name into a more user-friendly format.
     * @param {string} name 
     * @returns {string}
     */
    toFriendlyRomName: (name) => {
        return name.replace(/\x00+$/g, '')
    }
}