const fs = require('fs')
const path = require('path')
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
            const filePath = path.join(directoryPath, file)
            const fileBuffer = fs.readFileSync(filePath)

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
}