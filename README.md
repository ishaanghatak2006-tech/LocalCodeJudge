# LocalCodeJudge

LocalCodeJudge is a Docker-based local code judging service. It accepts user code + test cases, runs code in isolated language containers (`cpp`, `python`, `javascript`), and returns verdicts such as **Accepted**, **Wrong Answer**, **Time Limit Exceeded**, **Compilation Error**, and **Runtime Error**.

## What this project does

- Queues incoming submissions.
- Writes submitted code to a temp file.
- Executes code inside Docker containers (never on host directly).
- Runs test cases one-by-one with a 2s timeout per test case.
- Returns per-test output, time, memory, and final verdict.
- Cleans up temporary files and copied sandbox files.

## Tech stack

- Node.js + Express
- Docker
- Language sandbox images:
  - `cppsandbox` (GCC)
  - `pysandbox` (Python 3.12)
  - `jssandbox` (Node 22)

## Project structure

```text
LocalCodeJudge/
├─ judgeService/
│  ├─ src/
│  │  ├─ server.js
│  │  ├─ routes/judgeRoutes.js
│  │  ├─ services/sandBox.js
│  │  ├─ languages/
│  │  │  ├─ cppRunner.js
│  │  │  ├─ pyRunner.js
│  │  │  ├─ jsRunner.js
│  │  │  └─ fileHelper.js
│  │  └─ queue.js
│  └─ docker/
│     ├─ cppsandbox/Dockerfile
│     ├─ pysandbox/Dockerfile
│     └─ jssandbox/Dockerfile
└─ README.md
```

## Prerequisites

- Node.js (18+ recommended)
- Docker Desktop installed
- Docker Engine running

## Setup

1. Install dependencies:

```bash
cd judgeService
npm install
```

2. Build sandbox images (required names must match exactly):

```bash
docker build -t cppsandbox ./docker/cppsandbox
docker build -t pysandbox ./docker/pysandbox
docker build -t jssandbox ./docker/jssandbox
```

3. Configure environment:

- Create `judgeService/src/.env`
- Add:

```env
DOCKERPATH=YOUR_C_PATH_FOR_DOCKER
```

Example (Windows):

```env
DOCKERPATH=C:\Program Files\Docker\Docker\Docker Desktop.exe
```

4. Start server:

```bash
node src/server.js
```

Server runs on:

```text
http://localhost:8000
```

## API overview

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/judge` | Submit code + testcases (job gets queued) |
| GET | `/status/:jobId` | Fetch final processed result of a job |
| POST | `/submit` | Debug echo endpoint |

## Request format (`POST /judge`)

```json
{
  "language": "python",
  "code": "n = int(input())\nprint(n * 2)",
  "testcases": [
    { "input": "2", "expectedOutput": "4" },
    { "input": "11", "expectedOutput": "22" }
  ]
}
```

### Field details

- `language`: one of `cpp`, `python`, `javascript`
- `code`: source code string
- `testcases`: array of:
  - `input` (string)
  - `expectedOutput` (string)

## Required request calls (typical flow)

1. **Submit job**

```bash
curl -X POST http://localhost:8000/judge ^
  -H "Content-Type: application/json" ^
  -d "{\"language\":\"python\",\"code\":\"n=int(input())\nprint(n*2)\",\"testcases\":[{\"input\":\"2\",\"expectedOutput\":\"4\"},{\"input\":\"5\",\"expectedOutput\":\"10\"}]}"
```

Response:

```json
{
  "message": "Code queued for execution",
  "jobId": "8f8e3ad2-9a6b-47b3-b91e-f2de7a3c57e0",
  "fileName": "1751378589123-ab12cde34",
  "timestamp": 1751378589123,
  "wrapResult": {
    "message": "Code wrapped successfully and queued",
    "jobId": "8f8e3ad2-9a6b-47b3-b91e-f2de7a3c57e0",
    "filePath": "C:\\...\\tempSubmittedFiles\\1751378589123-ab12cde34.py"
  }
}
```

2. **Check status using returned `jobId`**

```bash
curl http://localhost:8000/status/8f8e3ad2-9a6b-47b3-b91e-f2de7a3c57e0
```

If still not available:

```json
{
  "message": "Job not found or still queued",
  "jobId": "8f8e3ad2-9a6b-47b3-b91e-f2de7a3c57e0"
}
```

When processed (example output format):

```json
{
  "jobId": "8f8e3ad2-9a6b-47b3-b91e-f2de7a3c57e0",
  "verdict": "Accepted",
  "passedCount": 2,
  "testResults": [
    {
      "testcase": 1,
      "input": "2",
      "expected": "4",
      "output": "4",
      "passed": true,
      "timeMs": 4.163,
      "memory": "17.86MiB / 62.74GiB"
    },
    {
      "testcase": 2,
      "input": "5",
      "expected": "10",
      "output": "10",
      "passed": true,
      "timeMs": 3.902,
      "memory": "17.86MiB / 62.74GiB"
    }
  ],
  "TotTime": 8.065,
  "peakMemory": 17.86
}
```

## Possible verdicts

- `Accepted`
- `Wrong Answer`
- `Time Limit Exceeded`
- `Compilation Error`
- `Runtime Error`
- `Internal Judge Error`
- `System Error` (queue processor/internal failure path)

## Thunder Client testing (VS Code)

1. Create request: `POST http://localhost:8000/judge`
2. Set header: `Content-Type: application/json`
3. Paste the JSON payload from **Request format** section.
4. Send request and copy `jobId` from response.
5. Create second request: `GET http://localhost:8000/status/{{jobId}}`
6. Send until result is available.

### Thunder Client screenshot

I can’t capture a GUI screenshot from this CLI environment, but you can add one in your repo and it will render in GitHub:

```md
![Thunder Client Test](docs/images/thunder-client-test.png)
```

Suggested path to add screenshot:

```text
docs/images/thunder-client-test.png
```

## Security model

- User code runs inside Docker containers.
- The host machine is not used to directly execute submitted code.
- Temporary source files are deleted after execution.
- Copied files/binaries in containers are cleaned after each run.

## Notes

- Queue processor is single-worker and processes jobs sequentially.
- Timeout is set to 2000 ms per testcase in current implementation.
- Exact memory string format can differ by Docker/cgroup environment.
