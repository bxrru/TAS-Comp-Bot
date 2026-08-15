const fs = require('node:fs')
const path = require('node:path')
const levenshtein = require('fast-levenshtein');

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
            const filePath = path.join(directoryPath, file);

            let fd;
            try {
                fd = fs.openSync(filePath, "r");

                const { size } = fs.statSync(filePath);
                if (size < 20) {
                    console.error(`File too small: ${file} (${size} bytes)`);
                    return;
                }

                const buffer = Buffer.alloc(4);

                fs.readSync(fd, buffer, 0, 4, 16);

                const crc = buffer.readUInt32BE(0);
                const romName = path.parse(file).name;

                known_crcs[crc] = romName;

            } catch (e) {
                console.error(`Error reading ${file}:`, e);
            } finally {
                if (fd !== undefined) fs.closeSync(fd);
            }
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
     * Finds and returns a list of name-CRC pairs similar to the given query.
     * @param {Array<{crc: string, name: string}>} known_crcs 
     * @param {string} query 
     * @param {number} max_results 
     * @returns {{elements: Array<{crc: string, name: string}>, count: number}}
     */
    getNameCRCPairsSimilarTo: (known_crcs, query, max_results = 5) => {
        const pairs = Object.entries(known_crcs).map(([crc, name]) => ({ crc, name }));

        const lowerQuery = query.toLowerCase();

        pairs.sort((a, b) => {
            const aName = a.name.toLowerCase();
            const bName = b.name.toLowerCase();

            const aContains = aName.includes(lowerQuery) ? -1 : 0;
            const bContains = bName.includes(lowerQuery) ? -1 : 0;
            if (aContains !== bContains) return aContains - bContains;

            const distA = levenshtein.get(lowerQuery, aName) / Math.max(lowerQuery.length, aName.length);
            const distB = levenshtein.get(lowerQuery, bName) / Math.max(lowerQuery.length, bName.length);

            return distA - distB;
        });

        return { elements: pairs.slice(0, max_results), count: pairs.length };
    },

    /**
     * Gets a well-formatted ROM name from an M64 buffer.
     * @param {Buffer} buffer
     * @returns {string}
     */
    getRomNameFromM64Buffer: (buffer) => {
        return (Buffer.copyBytesFrom(buffer.subarray(0xC4, 0xC4 + 32)).toString())
            .replace(/\x00+$/, "")
            .trim();
    }
}