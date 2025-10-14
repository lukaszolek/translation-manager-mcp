/**
 * Utility module for inserting non-breaking spaces in text based on language rules
 * Used by both the blog translation script and MCP translation manager
 * 
 * This is the JavaScript version for Node.js compatibility
 */

const NON_BREAKING_SPACE_RULES = {
    // Polski - najbardziej rozbudowane reguły
    'pl': {
        singleLetterWords: ['a', 'i', 'o', 'u', 'w', 'z'],
        shortWords: ['na', 'po', 'do', 'od', 'za', 'ze', 'we', 'wi', 'wo', 'ku', 'by', 'ta', 'te', 'to', 'ty', 'co', 'że', 'ja', 'ty', 'on', 'my', 'wy', 'or', 'bo', 'no', 'ah', 'oj', 'eh', 'mu', 'go', 'ją', 'je', 'ję', 'mi', 'ci', 'si', 'ma', 'są'],
        numberUnits: true
    },
    // Czeski - podobne reguły do polskiego
    'cs': {
        singleLetterWords: ['a', 'i', 'o', 'u', 'v', 'z', 'k', 's'],
        shortWords: ['na', 'po', 'do', 'od', 'za', 'ze', 've', 'ku', 'by', 'ta', 'te', 'to', 'ty', 'co', 'že', 'ja', 'ty', 'on', 'my', 'vy', 'bo', 'no', 'se', 'si', 'je', 'ho', 'mu', 'mi'],
        numberUnits: true
    },
    // Słowacki - podobne do czeskiego
    'sk': {
        singleLetterWords: ['a', 'i', 'o', 'u', 'v', 'z', 'k', 's'],
        shortWords: ['na', 'po', 'do', 'od', 'za', 'zo', 've', 'ku', 'by', 'ta', 'te', 'to', 'ty', 'čo', 'že', 'ja', 'ty', 'on', 'my', 'vy', 'bo', 'no', 'sa', 'si', 'je', 'ho', 'mu', 'mi'],
        numberUnits: true
    },
    // Francuski - specjalne znaki interpunkcyjne
    'fr': {
        singleLetterWords: ['a', 'à', 'y'],
        shortWords: ['le', 'la', 'de', 'du', 'et', 'ou', 'ce', 'se', 'ne', 'me', 'te', 'je', 'tu', 'il', 'un', 'au', 'si', 'en', 'on'],
        beforePunctuation: [':', ';', '!', '?', '»'],
        numberUnits: true
    },
    // Niemiecki - podstawowe reguły
    'de': {
        singleLetterWords: [],
        shortWords: ['am', 'an', 'im', 'in', 'um', 'zu', 'ob', 'wo', 'so', 'da', 'es', 'er', 'du', 'zu'],
        numberUnits: true
    },
    // Węgierski - podstawowe reguły
    'hu': {
        singleLetterWords: ['a', 'é', 's'],
        shortWords: ['az', 'el', 'le', 'be', 'ki', 'fel', 'meg', 'el', 'át', 'rá', 'el', 'oda'],
        numberUnits: true
    },
    // Hiszpański - podstawowe reguły
    'es': {
        singleLetterWords: ['a', 'e', 'o', 'u', 'y'],
        shortWords: ['el', 'la', 'de', 'en', 'un', 'es', 'se', 'no', 'te', 'le', 'me', 'lo', 'al', 'mi', 'tu', 'su', 'si', 'ya', 'da'],
        numberUnits: true
    },
    // Włoski - podstawowe reguły
    'it': {
        singleLetterWords: ['a', 'e', 'è', 'o'],
        shortWords: ['il', 'la', 'di', 'in', 'un', 'è', 'si', 'no', 'te', 'le', 'me', 'lo', 'al', 'mi', 'tu', 'su', 'se', 'da', 'ma', 'ha'],
        numberUnits: true
    },
    // Holenderski - podstawowe reguły
    'nl': {
        singleLetterWords: ['a'],
        shortWords: ['de', 'in', 'en', 'op', 'te', 'is', 'ze', 'me', 'je', 'we', 'ze', 'al', 'om', 'nu', 'zo', 'er'],
        numberUnits: true
    }
};

// Common units for number formatting
const COMMON_UNITS = [
    // Podstawowe jednostki SI
    'm', 'km', 'cm', 'mm', 'g', 'kg', 'l', 'ml', 's', 'min', 'h',
    // Jednostki objętości i powierzchni
    'm²', 'm³', 'ha', 'l/min', 'km/h',
    // Waluty podstawowe
    'zł', 'PLN', 'EUR', 'USD', 'CZK', 'HUF',
    // Procenty i promile
    '%', '‰',
    // Temperatury
    '°C', '°F', 'K',
    // Moce i energia
    'W', 'kW', 'MW', 'kWh', 'J', 'kJ',
    // Częstotliwość
    'Hz', 'kHz', 'MHz', 'GHz',
    // Ciśnienie
    'Pa', 'kPa', 'bar', 'atm',
    // Informatyka
    'B', 'kB', 'MB', 'GB', 'TB', 'bit', 'bps', 'Mbps'
];

/**
 * Insert non-breaking spaces in text based on language rules
 * @param {string} content The text content to process
 * @param {string} language Language code (e.g., 'pl', 'fr', 'de')
 * @returns {string} Text with non-breaking spaces inserted according to language rules
 */
function insertNonBreakingSpaces(content, language) {
    const languageRules = NON_BREAKING_SPACE_RULES[language];
    if (!languageRules) {
        // If we don't have rules for this language, return unchanged
        return content;
    }

    let processedContent = content;

    // 1. Non-breaking spaces after single letters/short words
    const allShortWords = [...languageRules.singleLetterWords, ...languageRules.shortWords];
    
    if (allShortWords.length > 0) {
        // Create regex that matches short words followed by regular space
        // Add negative lookahead to avoid inserting spaces before headers
        const shortWordsPattern = `\\b(${allShortWords.map(word => 
            word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // escape special regex characters
        ).join('|')}) +(?!#{1,6})`;
        
        const shortWordsRegex = new RegExp(shortWordsPattern, 'gi');
        processedContent = processedContent.replace(shortWordsRegex, (match, word) => {
            // Insert non-breaking space after short word
            return `${word}\u00A0`;
        });
    }

    // 2. Non-breaking spaces between numbers and units (if language supports it)
    if (languageRules.numberUnits) {
        const unitsPattern = `\\s+(${COMMON_UNITS.map(unit => 
            unit.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        ).join('|')})\\b`;
        
        const numberUnitsRegex = new RegExp(`(\\d)${unitsPattern}`, 'g');
        processedContent = processedContent.replace(numberUnitsRegex, (match, number, unit) => {
            return `${number}\u00A0${unit}`;
        });
    }

    // 3. Special rules for French - space before colon, semicolon, exclamation mark, question mark
    if (language === 'fr' && languageRules.beforePunctuation) {
        const punctuationPattern = `\\s+([${languageRules.beforePunctuation.join('')}])`;
        const punctuationRegex = new RegExp(punctuationPattern, 'g');
        processedContent = processedContent.replace(punctuationRegex, (match, punct) => {
            return `\u00A0${punct}`;
        });
    }

    // 4. Non-breaking spaces before single digits (for Slavic languages)
    if (['pl', 'cs', 'sk'].includes(language)) {
        // Space before digits 1-9 when they appear as separate words
        const singleDigitRegex = /\s+([1-9])\s+/g;
        processedContent = processedContent.replace(singleDigitRegex, (match, digit) => {
            return `\u00A0${digit} `;
        });
    }

    return processedContent;
}

/**
 * Get the language code from locale
 * @param {string} locale Locale code (e.g., 'pl-pl', 'en-gb')
 * @returns {string} Language code (e.g., 'pl', 'en')
 */
function getLanguageFromLocale(locale) {
    return locale.split('-')[0];
}

/**
 * Check if language has non-breaking space rules
 * @param {string} language Language code
 * @returns {boolean} True if the language has rules defined
 */
function hasNonBreakingSpaceRules(language) {
    return language in NON_BREAKING_SPACE_RULES;
}

// Export for CommonJS and ES modules
export {
    insertNonBreakingSpaces,
    getLanguageFromLocale,
    hasNonBreakingSpaceRules,
    NON_BREAKING_SPACE_RULES
};

// Also export as default for CommonJS compatibility
export default {
    insertNonBreakingSpaces,
    getLanguageFromLocale,
    hasNonBreakingSpaceRules,
    NON_BREAKING_SPACE_RULES
};