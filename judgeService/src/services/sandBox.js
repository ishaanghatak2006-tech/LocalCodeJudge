const { writeFile } = require('node:fs/promises');
const path = require('path');
const queue = require('../queue.js');

async function wrapCode(metaData) {
    const { language, code, fileName } = metaData;
    let extension;

    if (language === 'cpp') {
        extension = '.cpp';
    } else if (language === 'python') {
        extension = '.py';
    } else if (language === 'javascript') {
        extension = '.js';
    } else {
        throw new Error('Please choose from either cpp/js/python');
    }

    const filePath = path.join(__dirname, '..', 'tempSubmittedFiles', `${fileName}${extension}`);
    await writeFile(filePath, code, 'utf-8');

    metaData.filePath = filePath;
    queue.push(metaData);

    return {
        message: 'Code wrapped successfully and queued',
        jobId: metaData.jobId,
        filePath,
    };
}

module.exports = wrapCode;