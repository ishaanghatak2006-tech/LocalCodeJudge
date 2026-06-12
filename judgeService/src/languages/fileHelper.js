//to handle the dile being send one one whever a queue is non empty
const queue = require('../queue.js');
const judgeCpp = require('../languages/cppRunner.js');
const judgePy = require('../languages/pyRunner.js');
const judgeJs = require('../languages/jsRunner.js');

const jobResults = {};

function makeFakeResponse() {
    return {
        statusCode: 200,
        payload: null,
        status(code) {
            this.statusCode = code;
            return this;
        },
        json(payload) {
            this.payload = payload;
            return payload;
        },
        send(payload) {
            this.payload = payload;
            return payload;
        },
    };
}

async function callRunners() {
    let jobId;
    try {
        if (queue.size() > 0) {
            const metaData = queue.front();
            queue.pop();

            const testcases = metaData.testcases;
            jobId = metaData.jobId;

            const filePath = metaData.filePath;
            const fakeRes = makeFakeResponse();
            console.log('callRunners processing job', jobId, 'language', metaData.language, 'filePath', filePath);

            if (metaData.language == 'cpp') {
                await judgeCpp({ body: { filePath, testcases } }, fakeRes);
            } else if (metaData.language == 'python') {
                await judgePy({ body: { filePath, testcases } }, fakeRes);
            } else if (metaData.language == 'javascript') {
                await judgeJs({ body: { filePath, testcases } }, fakeRes);
            } else {
                throw new Error('Unsupported language');
            }

            const results = fakeRes.payload;
            console.log('callRunners job', jobId, 'runner result', results && results.verdict);

            let TotTime = 0;
            let peakMemory = 0;
            const resultList = results && results.results ? results.results : [];

            for (const re of resultList) {
                TotTime += re.timeMs || 0;
                const mem = parseFloat((re.memory || '0').split('/')[0]) || 0;
                peakMemory = Math.max(peakMemory, mem);
            }

            jobResults[jobId] = {
                jobId,
                verdict: results ? results.verdict : 'Unknown',
                passedCount: results ? results.passedCount || 0 : 0,
                testResults: resultList,
                TotTime,
                peakMemory,
            };

            if(results.verdict!='Accepted'){
                jobResults[jobId].error=results.error;
            }

            console.log('callRunners job', jobId, 'stored result, verdict:', results ? results.verdict : 'Unknown');
        }
    } catch (err) {
        if (jobId) {
            jobResults[jobId] = {
                verdict: 'System Error',
                error: err.message,
            };
        }
        console.error(err);
    }
};

async function startQueueProcessor() {
    console.log('queue processor started');
    while (true) {
        if (queue.size() > 0) {
            try {
                await callRunners();
            } catch (err) {
                console.error('Queue processor error:', err);
            }
        }
        await new Promise((resolve) => setTimeout(resolve, 100));
    }
}

function getJobResult(jobId) {
    return jobResults[jobId] || null;
}

module.exports = {
    startQueueProcessor,
    getJobResult,
};

