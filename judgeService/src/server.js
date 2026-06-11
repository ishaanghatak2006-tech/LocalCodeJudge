const express = require('express');
const judge = require('./routes/judgeRoutes');
const queue = require('./queue.js');
const fileHelper = require('./languages/fileHelper');

const app = express();
app.use(express.json());
app.use('/', judge);

app.post('/submit', (req, res) => {
    console.log(req.body);
    res.status(200).json({
        message: 'request received',
        data: req.body,
    });
});

app.listen(8000, () => {
    console.log('server started on port 8000');
    console.log('queue has been initialized and its current size is ' + queue.size());
    fileHelper.startQueueProcessor();
});
