const fs = require('fs').promises;
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

            let output;

            const start = process.hrtime.bigint();

            try {

                output = execSync(
                    `docker exec -i ${containerId} node /sandbox/main.js`,
                    {
                        input: tc.input,
                        timeout: 2000,
                        stdio: ['pipe', 'pipe', 'pipe']
                    }
                ).toString().trim();

            } catch (err) {

                // TLE
                if (
                    err.code === 'ETIMEDOUT' ||
                    err.signal === 'SIGTERM'
                ) {
                    return res.status(200).json({
                        verdict: "Time Limit Exceeded",
                        testcase: i + 1,
                        passedCount
                    });
                }

                const stderr =
                    err.stderr?.toString() ||
                    err.message;

                // JS syntax error
                if (
                    stderr.includes("SyntaxError") ||
                    stderr.includes("Unexpected token")
                ) {
                    return res.status(200).json({
                        verdict: "Compilation Error",
                        testcase: i + 1,
                        error: stderr
                    });
                }

                // Runtime Error
                return res.status(200).json({
                    verdict: "Runtime Error",
                    testcase: i + 1,
                    passedCount,
                    error: stderr
                });
            }

            const end = process.hrtime.bigint();

            const timeMs =
                Number(end - start) / 1_000_000;

            let memory = "Unknown";

            try {
                memory = execSync(
                    `docker stats ${containerId} --no-stream --format "{{.MemUsage}}"`
                ).toString().trim();
            } catch {}

            const passed =
                output === tc.expectedOutput.trim();

            results.push({
                testcase: i + 1,
                input: tc.input,
                expected: tc.expectedOutput,
                output,
                passed,
                timeMs: Number(timeMs.toFixed(3)),
                memory
            });

            if (!passed) {

                return res.status(200).json({
                    verdict: "Wrong Answer",
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
            verdict: "Internal Judge Error",
            error:
                err.stderr?.toString() ||
                err.message
        });

    } finally {

        if (filePath) {
            try {
                await fs.unlink(filePath);
            } catch (err) {
                console.error(
                    "File deletion error:",
                    err
                );
            }
        }

        if (containerId) {
            try {
                execSync(`docker rm -f ${containerId}`);
            } catch {}
        }
    }
}

module.exports = judgeJs;