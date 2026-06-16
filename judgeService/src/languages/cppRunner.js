const fs = require('fs').promises;
const { spawnSync,execSync } = require('child_process');

const CONTAINER_NAME = "local-judge-cpp";

function ensureCppContainer() {
    try {
        const running = execSync(
            `docker inspect -f "{{.State.Running}}" ${CONTAINER_NAME}`,
            { stdio: ['pipe', 'pipe', 'ignore'] }
        ).toString().trim();

        if (running !== "true") {
            execSync(`docker start ${CONTAINER_NAME}`);
        }

        return CONTAINER_NAME;
    } catch {
        execSync(
            `docker run -dit --name ${CONTAINER_NAME} cppsandbox tail -f /dev/null`
        );

        return CONTAINER_NAME;
    }
}

async function judgeCpp(req, res) {
    const { filePath, testcases } = req.body;

    let containerId;
    let passedCount = 0;

    try {

        // Start container
        containerId = ensureCppContainer();
        // Copy source file
        execSync(
            `docker cp "${filePath}" ${containerId}:/sandbox/main.cpp`
        );

        // Compile
        try {
            execSync(
                `docker exec ${containerId} g++ /sandbox/main.cpp -o /sandbox/main`,
                {
                    stdio: 'pipe'
                }
            );
        } catch (err) {

            return res.status(200).json({
                verdict: "Compilation Error",
                passedCount: 0,
                error:
                    err.stderr?.toString() ||
                    err.message
            });
        }

        const results = [];

        // Run testcases
        for (let i = 0; i < testcases.length; i++) {
            const tc = testcases[i];
            const start = process.hrtime.bigint();

            const combinedCmd = `/sandbox/main; EXIT_CODE=$?; echo; echo ===MEM===; cat /sys/fs/cgroup/memory.peak; exit $EXIT_CODE`;

            const runResult = spawnSync(
                'docker',
                ['exec', '-i', containerId, 'sh', '-lc', combinedCmd],
                {
                    input: tc.input,
                    encoding: 'utf8',
                    timeout: 2000
                }
            );

            if (runResult.error) {
                if (runResult.error.code === 'ETIMEDOUT') {
                    try {
                        execSync(
                            `docker exec ${containerId} sh -c "for pid in $(ls /proc | grep -E '^[0-9]+$'); do if [ \"$pid\" != \"$$\" ] && [ \"$pid\" != \"$PPID\" ]; then cmd=$(cat /proc/$pid/cmdline 2>/dev/null); if echo \"$cmd\" | grep -q \"/sandbox/\"; then kill -9 $pid 2>/dev/null; fi; fi; done"`
                        );
                    } catch (e) {}

                    return res.status(200).json({
                        verdict: "Time Limit Exceeded",
                        testcase: i + 1,
                        passedCount
                    });
                }

                throw runResult.error;
            }

            const rawStdout = (runResult.stdout || "").toString();
            const rawStderr = (runResult.stderr || "").toString();

            const MEM_MARKER = "===MEM===";
            let output = rawStdout;

            const markerIdx = rawStdout.indexOf(MEM_MARKER);
            if (markerIdx !== -1) {
                output = rawStdout.slice(0, markerIdx).trim();
                const memPart = rawStdout.slice(markerIdx + MEM_MARKER.length).trim();
                const memBytes = Number(memPart);
                if (!Number.isNaN(memBytes)) {
                    memory = (memBytes / 1024 / 1024).toFixed(2) + " MiB";
                } else if (memPart.length > 0) {
                    memory = memPart;
                }
            }

            if (runResult.status !== 0) {
                const combinedErr = rawStderr || output || "";
                return res.status(200).json({
                    verdict: "Runtime Error",
                    testcase: i + 1,
                    passedCount,
                    error: combinedErr
                });
            }
            
            const end = process.hrtime.bigint();
            const timeMs =
                Number(end - start) / 1_000_000;
            let memory = "Unknown";
            try {
                const memResult = spawnSync(
                    'docker',
                    [
                        'stats',
                        containerId,
                        '--no-stream',
                        '--format',
                        '{{.MemUsage}}'
                    ],
                    {
                        encoding: 'utf8'
                    }
                );
                memory = memResult.stdout.trim() || "Unknown";
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

            // Wrong Answer
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

        // Accepted
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
            //delete the main.cpp
            try {
                execSync(
                   `docker exec ${containerId} rm -f /sandbox/main.cpp /sandbox/main`
                );
            } catch {}
        }
    }
}

module.exports = judgeCpp;