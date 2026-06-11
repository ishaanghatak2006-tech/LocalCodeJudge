class globalQueue {
    constructor() {
        this.queue = [];
    }

    push(job) {
        this.queue.push(job);
    }

    pop() {
        return this.queue.shift();
    }

    front() {
        return this.queue[0];
    }

    size() {
        return this.queue.length;
    }
}

const queue = new globalQueue();
module.exports = queue;