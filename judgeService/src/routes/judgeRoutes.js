const express = require('express');
const router = express.Router();
const wrapCode = require('../services/Sandbox.js');
const { getJobResult } = require('../languages/fileHelper');
const { randomUUID } = require('crypto');

router.post('/judge', async (req, res) => {
    try {
        const { language, code, testcases } = req.body;
        if (!language || !code || !testcases) {
            return res.status(400).json({
                message:'Please send the correct request format',
            });
        }
        if (language !=='cpp' && language !== 'python' && language !== 'javascript') {
            return res.status(400).json({
                message: 'Please choose from either cpp/js/python',
            });
        }
        const timestamp=Date.now();
        const jobId=randomUUID();
        const status='queued';
        const result=null;
        const fileName=`${timestamp}-${Math.random().toString(36).substr(2, 9)}`;

        const metaData = {
            jobId,
            language,
            code,
            testcases,
            fileName,
            timestamp,
            status,
            result,
        };
        const wrapResult = await wrapCode(metaData);
        return res.status(200).json({
            message: 'Code queued for execution',
            jobId,
            fileName,
            timestamp,
            wrapResult,
        });
    } catch (err) {
        return res.status(500).json({
            message: err.message + ' sorry could not receive request',
        });
    }
});

router.get('/status/:jobId', (req, res) => {
    try {
        const jobId = req.params.jobId;
        const jobResult = getJobResult(jobId);
        console.log('status query for jobId:', jobId, 'result exists:', !!jobResult);
        if (!jobResult) {
            return res.status(404).json({
                message: 'Job not found or still queued',
                jobId,
            });
        }
        return res.status(200).json(jobResult);
    } catch (err) {
        return res.status(500).json({
            message: err.message,
        });
    }
});

module.exports = router;
