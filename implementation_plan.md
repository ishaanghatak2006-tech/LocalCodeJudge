# Implementation Plan - Optimize Code Execution Speed

Currently, each code evaluation request takes approximately 10 seconds because:
1. **Container Startup/Teardown Overhead**: A new Docker container is spun up (`docker run -dit`) and torn down/deleted (`docker rm -f`) on every single submission. This adds 3–4 seconds of overhead.
2. **Docker Stats Overhead**: Inside the testcase loop, `docker stats --no-stream` is executed for *each* testcase to fetch memory usage. Because `docker stats` waits for CPU/memory sampling, it takes 1–2 seconds per testcase. If there are 5 testcases, this command alone adds 5–10 seconds of delay.
3. **Shell Quoting Issues on Windows**: Standard execution uses shell strings which require complex escaping and have parsing overhead on Windows.

To reduce execution time to **under 0.5–1 second (or milliseconds)**, we propose the following changes:

---

## Proposed Changes

We will optimize the runners for the three supported languages: Python, JavaScript, and C++.

### 1. Container Reuse (Persistent Containers)
We will keep a single persistent container running for each language (`local-judge-python`, `local-judge-cpp`, `local-judge-javascript`) rather than starting and stopping them for every submission.
* **On Request**: We check if the persistent container is running. If not, we start it once.
* **Copy/Compile/Run**: Copy the files using `docker cp` and run the code.
* **Cleanup**: At the end of execution, instead of destroying the container, we delete the temporary files inside the container (e.g., `docker exec rm -f ...`).

### 2. High-Speed Memory Tracking using Linux Cgroups v2
Instead of invoking `docker stats` sequentially in a loop:
* We will retrieve the peak memory usage directly from the Linux control groups (cgroups v2) file `/sys/fs/cgroup/memory.peak` inside the container.
* By combining the code execution and memory reading in a single command using POSIX shell syntax:
  ```bash
  python3 /sandbox/main.py; EXIT_CODE=$?; echo; echo ===MEM===; cat /sys/fs/cgroup/memory.peak; exit $EXIT_CODE
  ```
  we perform only **one** exec call per testcase instead of two. This reduces memory retrieval overhead to **0 milliseconds**.

### 3. Process Cleanup in Container on Timeout (TLE)
When `spawnSync` times out, we will run a clean process scavenger script in the container:
```bash
for pid in $(ls /proc | grep -E '^[0-9]+$'); do
    if [ "$pid" != "$$" ] && [ "$pid" != "$PPID" ]; then
        cmd=$(cat /proc/$pid/cmdline 2>/dev/null)
        if echo "$cmd" | grep -q "/sandbox/"; then
            kill -9 $pid 2>/dev/null
        fi
    fi
done
```
This guarantees that any infinite loops are terminated, keeping the persistent container clean and preventing CPU starvation.

---

### [Component Name] Runners & Languages

#### [MODIFY] [pyRunner.js](file:///C:/Users/Ishaan/OneDrive/Documents/GitHub/LocalCodeJudge/judgeService/src/languages/pyRunner.js)
* Implement container reuse checks for `local-judge-python`.
* Swap `execSync` with `spawnSync` for execution and memory extraction.
* Handle exit status, parse `===MEM===`, and format memory as `MiB`.
* Clean up temp files and kill timed-out processes in the container.

#### [MODIFY] [cppRunner.js](file:///C:/Users/Ishaan/OneDrive/Documents/GitHub/LocalCodeJudge/judgeService/src/languages/cppRunner.js)
* Implement container reuse checks for `local-judge-cpp`.
* Reuse container for compilation and execution.
* Swap `execSync` with `spawnSync` for execution and memory extraction.
* Clean up compiled binary and source code in the container.

#### [MODIFY] [jsRunner.js](file:///C:/Users/Ishaan/OneDrive/Documents/GitHub/LocalCodeJudge/judgeService/src/languages/jsRunner.js)
* Implement container reuse checks for `local-judge-javascript`.
* Swap `execSync` with `spawnSync` for execution and memory extraction.
* Clean up temp files in the container.

---

## Verification Plan

### Automated/Local Tests
We will verify:
1. **Performance benchmark**: Submit python/cpp/javascript code to the API and measure the execution time (verify it is under 1 second).
2. **Memory accuracy**: Ensure memory is parsed and displayed correctly in the final status JSON.
3. **Timeout handling**: Verify that an infinite loop returns `Time Limit Exceeded` and that all background processes inside the container are successfully killed.

### Manual Verification
1. Start the server: `node src/server.js`.
2. Make a `/judge` request using `Invoke-RestMethod` or `curl` and measure time.
3. Query the status: `/status/:jobId` and inspect performance.
