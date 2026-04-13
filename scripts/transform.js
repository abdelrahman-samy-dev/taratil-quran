const fs = require('fs');

const rawData = fs.readFileSync('./adkar.json', 'utf8');
const obj = JSON.parse(rawData);

const map = {
    'أذكار الصباح': 'morning',
    'أذكار المساء': 'evening',
    'أذكار بعد السلام من الصلاة المفروضة': 'post_prayer',
    'تسابيح': 'general',
    'أذكار النوم': 'sleep',
    'أذكار الاستيقاظ': 'wakeup',
    'أدعية قرآنية': 'quranic',
    'أدعية الأنبياء': 'prophets'
};

const azkarData = {};

for (const [arKey, enKey] of Object.entries(map)) {
    if (obj[arKey]) {
        azkarData[enKey] = obj[arKey].map(item => {
            // handle cases where count might be empty or missing
            let count = parseInt(item.count || "1", 10);
            if (isNaN(count) || count < 1) count = 1;

            return {
                text: item.content || '',
                virtue: item.description || '',
                reference: item.reference || '',
                count: count
            }
        });
    }
}

const originalDataFile = fs.readFileSync('./data.js', 'utf8');
const azkarDataStr = JSON.stringify(azkarData, null, 4);

// The original file defines azkarData then quotesData...
// We can just replace the definition of azkarData.
// Or simply rebuild it since we know the rest of the file.
const restOfData = originalDataFile.substring(originalDataFile.indexOf('const quotesData'));

const newDataFile = `// بيانات الأذكار والحكم المأثورة\nconst azkarData = ${azkarDataStr};\n\n${restOfData}`;

fs.writeFileSync('./data.js', newDataFile);

console.log("Successfully transformed data.js");
