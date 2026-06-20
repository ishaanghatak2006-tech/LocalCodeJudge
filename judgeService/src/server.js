const express = require('express');
const judge = require('./routes/judgeRoutes');
const queue = require('./queue.js');
const fileHelper = require('./languages/fileHelper');
const {exec}=require('child_process');
const app = express();
app.use(express.json());
app.use('/', judge);

const dockerPath=process.env.DOCKERPATH;


process.on("SIGINT", () => {
    console.log("\nStopping Docker Desktop...");

    exec('taskkill /F /IM "Docker Desktop.exe"', () => {
        process.exit(0);
    });
});

function checkDocker() {
    return new Promise((resolve) => {
        exec('docker info', (err) => {
            resolve(!err);
        });
    });
}

async function startDocker(){
    try{
            if (await checkDocker()) {
                console.log("✅ Docker Engine already running");
                return;
            }

    console.log("Starting Docker Desktop...");
        exec(`start "" "${dockerPath}"`);
        while(true){
            if(await checkDocker()){
                console.log('Docker is running');
                return;
            }
            console.log("⏳ Waiting for Docker Engine...");
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
        return;

    }
    catch(err){
        console.log(err);
    }
}

app.post('/submit', (req, res) => {
    console.log(req.body);
    res.status(200).json({
        message: 'request received',
        data: req.body,
    });
});

(async () => {
    await startDocker();

    app.listen(8000, () => {
        console.log('server started on port 8000');
        console.log('queue has been initialized and its current size is ' + queue.size());
        console.log('send request in http://localhost:8000/judge');

        fileHelper.startQueueProcessor();
    });
})();
