const express=require('express');
const router=express.Router();
const { execSync } = require("child_process");

async function judgeJs(req, res) {
    const { filePath, testcases } = req.body;

    let containerId;
    let passedCount = 0;

    try {
        containerId = execSync(
            "docker run -dit jssandbox"
        ).toString().trim();

        execSync(
            `docker cp "${filePath}" ${containerId}:/sandbox/main.js`
        );

        const results = [];

        for (let i = 0; i < testcases.length; i++) {
            const tc = testcases[i];

            const start = process.hrtime.bigint();

            const output = execSync(
                `docker exec -i ${containerId} node /sandbox/main.js`,
                {
                    input: tc.input,
                    timeout: 2000
                }
            ).toString().trim();

            const end = process.hrtime.bigint();

            const timeMs =
                Number(end - start) / 1_000_000;

            const stats = execSync(
                `docker stats ${containerId} --no-stream --format "{{.MemUsage}}"`
            ).toString().trim();

            const passed =
                output === tc.expectedOutput.trim();

            results.push({
                testcase: i + 1,
                input: tc.input,
                expected: tc.expectedOutput,
                output,
                passed,
                timeMs: Number(timeMs.toFixed(3)),
                memory: stats
            });

            if (!passed) {
                return res.status(200).json({
                    verdict: "Failed",
                    passedCount,
                    failedTestcase: i + 1,
                    expected: tc.expectedOutput,
                    got: output,
                    results
                });
            }

            passedCount++;
        }

        return res.status(200).json({
            verdict: "Accepted",
            passedCount,
            totalTestcases: testcases.length,
            results
        });

    } catch (err) {
        return res.status(500).json({
            verdict: "Runtime Error",
            passedCount,
            error: err.message
        });

    } finally {
        if (containerId) {
            try {
                execSync(`docker rm -f ${containerId}`);
            } catch {}
        }
    }
}

module.exports = judgeJs;
