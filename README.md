# Node.js + Express + Redis (ioredis) Starter

This repository is a minimal starter project that shows how to connect a **Node.js/Express** server to a **Redis** cache using the **ioredis** package, and how to make sure your server only starts _after_ the Redis connection is ready. It's meant as a learning reference for beginners who want to understand how caching gets wired into a backend app.

---

## 1. What this repo demonstrates

- How to configure and create a Redis client with `ioredis`.
- How to structure an Express app so the app definition (`app.js`) is separate from the server startup logic (`index.js`).
- How to make the Express server wait until Redis is actually connected before it starts listening for requests.
- How to run the project in development using `nodemon` (auto-restarts on file changes).

---

## 2. Project structure

```
project-root/
│
├── src/
│   ├── config/
│   │   └── cache.config.js   # Redis client setup (ioredis)
│   ├── examples/
│   │   └── redis-operations.js  # SET/GET, List, Hash, Sorted Set examples
│   ├── queues/
│   │   └── myQueue.js          # BullMQ queue (adds jobs)
│   ├── workers/
│   │   └── myWorker.js         # BullMQ worker (processes jobs)
│   ├── app.js                 # Express app definition
│   └── index.js                # Server entry point (starts everything)
│
├── package.json
└── README.md
```

> Note: adjust the paths above if your actual folders differ slightly — the important part is the _relationship_ between the three files, explained below.

---

## 3. Prerequisites

Before you start, make sure you have:

1. **Node.js** installed (v16 or later is recommended).
   Check with:
   ```bash
   node -v
   ```
2. **Redis server** installed and running locally on port `6379` (the default port).
   - On Linux: `sudo apt install redis-server` then `redis-server`
   - On Mac (Homebrew): `brew install redis` then `redis-server`
   - On Windows: use WSL, Docker, or a Redis Windows build.
   - Check it's running with:
     ```bash
     redis-cli ping
     ```
     It should reply `PONG`.

---

## 4. Installing the packages

Clone the repo, then install dependencies:

```bash
git clone <your-repo-url>
cd <your-repo-folder>
npm install
```

This project depends on two main packages:

| Package   | Purpose                                          |
| --------- | ------------------------------------------------ |
| `express` | Web framework used to build the HTTP server/API. |
| `ioredis` | Redis client used to connect Node.js to Redis.   |

Install them manually if they aren't already in `package.json`:

```bash
npm install express ioredis
```

For development convenience, install `nodemon` as a dev dependency. `nodemon` automatically restarts your server whenever you save a file, so you don't have to stop and restart it manually every time you make a change:

```bash
npm install --save-dev nodemon
```

Then add a script to your `package.json` so you can start the dev server easily:

```json
"scripts": {
  "start": "node src/index.js",
  "dev": "nodemon src/index.js"
}
```

Now you can run the project in development mode with:

```bash
npm run dev
```

---

## 5. How the Redis client is set up (`cache.config.js`)

```javascript
const { Redis } = require("ioredis");

const redisConfig = {
  port: 6379,
  host: "127.0.0.1",
};

const client = new Redis(redisConfig);

client.on("connect", () => console.log("Client is Connected Successfully!"));
client.on("close", () => console.log("Client Connection Closed!"));
client.on("error", (err) =>
  console.log("Error While Connecting to Client", err),
);

module.exports = client;
```

Let's break this down line by line:

1. **`const { Redis } = require("ioredis");`**
   This imports the `Redis` class from the `ioredis` package. `ioredis` is a Node.js library that lets your app talk to a Redis server (send commands like `SET`, `GET`, etc.).

2. **`redisConfig` object**
   This is just a plain JavaScript object holding the connection details:
   - `port: 6379` — the default port Redis listens on.
   - `host: "127.0.0.1"` — meaning "this same machine" (localhost). If your Redis server were running elsewhere (e.g. a cloud server), you'd put its IP or hostname here instead.

3. **`const client = new Redis(redisConfig);`**
   This creates a new Redis client instance using the config above. As soon as this line runs, `ioredis` starts trying to connect to the Redis server in the background. Note that this happens asynchronously — the rest of your code keeps running while the connection is being established.

4. **Event listeners (`client.on(...)`)**
   `ioredis` clients emit _events_ you can listen to, similar to how you'd listen for events in the browser (like a button click). Here:
   - `"connect"` fires once the client successfully connects to Redis.
   - `"close"` fires if the connection to Redis is closed.
   - `"error"` fires if something goes wrong (e.g. Redis isn't running, wrong host/port, etc.). It's important to always listen for `"error"`, otherwise an unhandled error event can crash your Node.js process.

5. **`module.exports = client;`**
   This exports the connected client object so other files in the project (like `index.js`) can import and reuse the _same_ Redis connection, instead of creating a new connection every time. This is important — you generally want **one shared client** per application, not a new one per request.

---

## 6. How the Express app is set up (`app.js`)

```javascript
const express = require("express");
const app = express();

module.exports = app;
```

This file's only job is to create the Express application object and export it. Keeping this separate from the server-starting logic (`index.js`) is a common and useful pattern because:

- It keeps `app.js` focused purely on defining routes, middleware, etc. (as the project grows, you'd add `app.use(...)` and `app.get(...)` calls here).
- It makes the app easier to test — testing tools can import `app` directly without actually starting a live server on a port.

Right now `app` doesn't have any routes defined yet, but this is the file where you'd add them later, for example:

```javascript
app.get("/", (req, res) => res.send("Hello World"));
```

---

## 7. How everything connects and starts (`index.js`)

```javascript
const app = require("./app");
const client = require("./config/cache.config.js");

const startServer = () => {
  try {
    client.once("ready", () => {
      app.listen(4000, "127.0.0.1", () => {
        console.log("Server is Running on Port 4000");
      });
    });
  } catch (error) {
    console.log("error While Connecting to server", error);
  }
};

startServer();
```

This is the **entry point** of the application — the file you actually run to start everything. Here's what happens step by step:

1. **Imports**
   - `const app = require("./app");` imports the Express app object created in `app.js`.
   - `const client = require('./config/cache.config.js')` imports the _already-created_ Redis client from `cache.config.js`. Because `cache.config.js` runs its connection logic as soon as it's first imported anywhere in the app, and Node.js caches modules, this `client` is the exact same connected instance — not a new one.

2. **`startServer` function**
   This wraps the startup logic in a function so it's easy to read and call explicitly at the bottom of the file.

3. **`client.once("ready", () => { ... })`**
   This is the key idea of the whole setup: **don't start accepting HTTP requests until Redis is actually ready to use.**
   - `"ready"` is a special `ioredis` event that fires once the client has connected _and_ Redis has confirmed it's ready to accept commands (this happens after `"connect"`).
   - `.once(...)` (instead of `.on(...)`) means this callback will only run **one time** — exactly what you want for a startup action, since you don't want to try to re-start the server every time Redis reconnects later.

4. **`app.listen(4000, "127.0.0.1", () => {...})`**
   Only once Redis is ready does the code call `app.listen(...)`, which tells Express to start listening for incoming HTTP requests.
   - `4000` is the port number the server will run on.
   - `"127.0.0.1"` means the server will only accept connections from the local machine (not from other computers on the network). Change this to `"0.0.0.0"` if you want it accessible from other devices on your network.
   - The callback logs a confirmation message once the server has successfully started.

5. **`try/catch`**
   This catches any _synchronous_ errors thrown while setting things up (e.g. if `client` or `app` were undefined). Note that it won't catch asynchronous errors from the Redis connection itself — those are already handled separately by the `"error"` event listener inside `cache.config.js`.

6. **`startServer();`**
   Finally, this line actually calls the function, kicking off the whole process.

### Why wait for Redis before starting the server?

If your routes rely on Redis (for caching, sessions, rate-limiting, etc.), starting the Express server _before_ Redis is ready could mean the first few incoming requests fail or throw errors because the cache isn't available yet. Waiting for the `"ready"` event guarantees that by the time your server can receive traffic, Redis is fully usable.

---

## 8. Putting it all together — the startup flow

When you run `npm run dev` (or `node src/index.js`), here's the order of events:

1. `index.js` runs and requires `app.js` and `cache.config.js`.
2. Requiring `cache.config.js` immediately creates the Redis client and starts connecting in the background.
3. `index.js` sets up a one-time listener waiting for Redis's `"ready"` event.
4. Once Redis confirms it's ready, the listener's callback runs.
5. Inside that callback, `app.listen(4000, ...)` starts the Express server on port 4000.
6. You'll see console logs in this rough order:
   ```
   Client is Connected Successfully!
   Server is Running on Port 4000
   ```

If Redis isn't running at all, you'll instead see the `"error"` log from `cache.config.js` repeating (as `ioredis` retries the connection by default), and the server will never start listening, because the `"ready"` event never fires.

---

## 9. Quick start summary

```bash
# 1. Make sure Redis is running
redis-server

# 2. Install dependencies
npm install

# 3. Install nodemon for development (if not already installed)
npm install --save-dev nodemon

# 4. Run the app in development mode
npm run dev
```

Once running, you should see:

```
Client is Connected Successfully!
Server is Running on Port 4000
```

---

## 10. Working with Redis data types using ioredis

Redis isn't just a simple key-value store — it supports several data structures, each suited to a different job. Below are examples of the most common ones, using the shared `client` from `cache.config.js`. You can put this code in a new file, e.g. `src/examples/redis-operations.js`, and run it with `node src/examples/redis-operations.js`.

### 10.1 Strings — `SET` / `GET`

The simplest Redis data type: a key mapped to a single string value. Good for caching things like a rendered page, a session token, or a single computed value.

```javascript
const client = require("../config/cache.config.js");

async function stringExample() {
  // Store a value
  await client.set("username", "john_doe");

  // Optionally set an expiry (in seconds) so the key auto-deletes later
  await client.set("session:123", "active", "EX", 60); // expires in 60s

  // Retrieve a value
  const username = await client.get("username");
  console.log("username:", username); // "john_doe"

  // Delete a key
  await client.del("username");
}
```

- `client.set(key, value)` stores a value.
- `client.set(key, value, "EX", seconds)` stores a value with a time-to-live (TTL), after which Redis deletes it automatically — useful for caches and sessions.
- `client.get(key)` returns the value, or `null` if the key doesn't exist.
- `client.del(key)` removes a key.

### 10.2 Lists — ordered collections

A Redis List is like an array: an ordered sequence of values you can push to either end. Useful for things like a queue of recent activity, a simple feed, or a to-do list.

```javascript
async function listExample() {
  // Add items to the list
  await client.rpush("recent-logins", "alice"); // push to the right (end)
  await client.rpush("recent-logins", "bob");
  await client.lpush("recent-logins", "charlie"); // push to the left (start)

  // Read the whole list (0 to -1 means "from first to last element")
  const logins = await client.lrange("recent-logins", 0, -1);
  console.log("recent-logins:", logins); // ["charlie", "alice", "bob"]

  // Remove and return the first element
  const first = await client.lpop("recent-logins");

  // Remove and return the last element
  const last = await client.rpop("recent-logins");

  // Get the number of items in the list
  const count = await client.llen("recent-logins");
}
```

- `rpush` / `lpush` add an item to the right/left end of the list.
- `lrange(key, start, stop)` reads a range of items (`0, -1` means "everything").
- `lpop` / `rpop` remove and return an item from either end.
- `llen` returns how many items are in the list.

### 10.3 Hashes — `HSET` (objects/records)

A Redis Hash is like a mini object or a database row: a single key that maps to multiple field-value pairs. Great for storing something like a user profile under one key instead of many separate string keys.

```javascript
async function hashExample() {
  // Set multiple fields on a hash at once
  await client.hset("user:1", {
    name: "John Doe",
    email: "john@example.com",
    age: "28",
  });

  // Or set one field at a time
  await client.hset("user:1", "city", "Hyderabad");

  // Get a single field
  const email = await client.hget("user:1", "email");

  // Get all fields and values
  const user = await client.hgetall("user:1");
  console.log("user:1 ->", user);
  // { name: 'John Doe', email: 'john@example.com', age: '28', city: 'Hyderabad' }

  // Check if a field exists
  const hasAge = await client.hexists("user:1", "age");

  // Delete a single field
  await client.hdel("user:1", "age");
}
```

- `hset(key, fieldsObject)` sets multiple fields at once (or use `hset(key, field, value)` for one field).
- `hget(key, field)` reads one field.
- `hgetall(key)` reads the entire hash as an object.
- `hdel(key, field)` removes a single field without deleting the whole hash.

### 10.4 Sorted Sets — `ZADD` (leaderboards, rankings)

A Sorted Set stores unique values, each with an associated numeric **score**, and keeps them automatically ordered by that score. This is the classic data structure behind leaderboards, "most recent" feeds (using a timestamp as the score), and priority queues.

```javascript
async function sortedSetExample() {
  // Add members with scores
  await client.zadd("leaderboard", 100, "alice");
  await client.zadd("leaderboard", 250, "bob");
  await client.zadd("leaderboard", 175, "charlie");

  // Get all members, ordered lowest score to highest
  const ascending = await client.zrange("leaderboard", 0, -1);
  console.log("ascending:", ascending); // ["alice", "charlie", "bob"]

  // Get all members, highest score to lowest (typical leaderboard order)
  const descending = await client.zrevrange("leaderboard", 0, -1);
  console.log("descending:", descending); // ["bob", "charlie", "alice"]

  // Get members with their scores included
  const withScores = await client.zrevrange("leaderboard", 0, -1, "WITHSCORES");
  console.log("withScores:", withScores); // ["bob", "250", "charlie", "175", "alice", "100"]

  // Get a member's rank (0-based position, ascending order)
  const rank = await client.zrank("leaderboard", "charlie");

  // Get a member's score
  const score = await client.zscore("leaderboard", "bob");

  // Increment a member's score (e.g. add points)
  await client.zincrby("leaderboard", 50, "alice"); // alice: 100 -> 150

  // Remove a member
  await client.zrem("leaderboard", "charlie");
}
```

- `zadd(key, score, member)` adds or updates a member with a score.
- `zrange` / `zrevrange` read members in ascending/descending score order; add `"WITHSCORES"` to include the scores in the result.
- `zrank(key, member)` returns a member's position (rank) in the sorted order.
- `zscore(key, member)` returns a member's current score.
- `zincrby(key, amount, member)` adds to a member's existing score — handy for "+1 point" type updates.
- `zrem(key, member)` removes a member.

> All `ioredis` commands return **Promises**, so they should be used with `async/await` (as shown above) or `.then()`.

---

## 11. Building a background worker with BullMQ

**BullMQ** is a job queue library built on top of Redis. It lets you push "jobs" (units of work, e.g. "send this email" or "resize this image") onto a queue, and have one or more separate **worker** processes pick them up and run them — without blocking your main Express server. This is the standard pattern for offloading slow or heavy tasks so your API can respond quickly.

### 11.1 Install BullMQ

```bash
npm install bullmq
```

BullMQ needs its own Redis connection settings. It's common (and recommended) to give BullMQ a plain connection-options object rather than reusing the same `ioredis` client instance used elsewhere, because BullMQ configures some connection options internally.

```javascript
// src/config/queue.connection.js
const connection = {
  host: "127.0.0.1",
  port: 6379,
};

module.exports = connection;
```

### 11.2 Create a Queue (the "producer" side)

The Queue is how you **add** jobs. Typically this file is imported wherever you need to enqueue work — for example, inside an Express route.

```javascript
// src/queues/myQueue.js
const { Queue } = require("bullmq");
const connection = require("../config/queue.connection.js");

const myQueue = new Queue("emailQueue", { connection });

module.exports = myQueue;
```

- `new Queue("emailQueue", { connection })` creates (or connects to) a queue named `"emailQueue"`. The name is how workers know which queue to listen to — it must match on both sides.

Adding a job to the queue looks like this (e.g. inside a route handler):

```javascript
const myQueue = require("./queues/myQueue.js");

async function sendWelcomeEmail(userEmail) {
  const job = await myQueue.add("send-email", {
    to: userEmail,
    subject: "Welcome!",
    body: "Thanks for signing up.",
  });

  console.log("Job added with id:", job.id);
}
```

- `queue.add(jobName, data)` pushes a new job onto the queue. `jobName` is a label for the type of job (useful when a queue handles more than one kind of task), and `data` is any JSON-serializable payload the worker will need to do the work.
- This call returns almost instantly — it doesn't wait for the job to actually be processed. That's the whole point: your Express route can respond to the user right away while the email gets sent in the background.

### 11.3 Create a Worker (the "consumer" side)

The Worker is a separate process (or at least separate logic) that continuously watches the queue and actually executes each job. This is usually run as its own script (e.g. `node src/workers/myWorker.js`), separate from your Express server.

```javascript
// src/workers/myWorker.js
const { Worker } = require("bullmq");
const connection = require("../config/queue.connection.js");

const myWorker = new Worker(
  "emailQueue",
  async (job) => {
    console.log(`Processing job ${job.id} (${job.name})`);
    console.log("Job data:", job.data);

    // ... do the actual work here, e.g. send an email ...
    // Simulate work with a delay:
    await new Promise((resolve) => setTimeout(resolve, 1000));

    return { status: "sent" }; // this becomes the job's "return value"
  },
  { connection },
);

myWorker.on("completed", (job, result) => {
  console.log(`Job ${job.id} completed with result:`, result);
});

myWorker.on("failed", (job, err) => {
  console.log(`Job ${job.id} failed:`, err.message);
});

module.exports = myWorker;
```

Breaking this down:

- `new Worker("emailQueue", processorFn, { connection })` — the queue name (`"emailQueue"`) **must match** the name used in `myQueue.js`, otherwise the worker will never see jobs added to that queue.
- The **processor function** (the second argument) is where the actual job logic lives. BullMQ calls this function automatically whenever a new job is available, passing in the `job` object. `job.data` contains whatever payload was passed to `queue.add(...)`.
- Whatever the processor function `return`s becomes the job's result, available in the `"completed"` event.
- If the processor function throws an error (or the returned Promise rejects), BullMQ marks the job as failed and emits the `"failed"` event — by default it can also automatically retry the job depending on configuration.
- `"completed"` and `"failed"` are events on the worker itself, similar to the `"connect"`/`"error"` events on the `ioredis` client you saw earlier — they're just for observability/logging.

### 11.4 Running the queue and worker together

In development, you'd typically run two things side by side:

```bash
# Terminal 1: your normal Express server (adds jobs via routes)
npm run dev

# Terminal 2: the BullMQ worker (processes jobs)
node src/workers/myWorker.js
```

You can also use `nodemon` on the worker file for auto-restart during development:

```bash
npx nodemon src/workers/myWorker.js
```

### 11.5 Why run the worker separately from the Express server?

- **Isolation**: if a job crashes or hangs, it doesn't take down your API server.
- **Scalability**: you can run multiple worker processes (even on different machines) all pointed at the same Redis instance, and BullMQ will distribute jobs between them automatically.
- **Responsiveness**: your Express routes stay fast because they only need to _enqueue_ work, not perform it synchronously.

---

## 12. Next steps / ideas to extend this project

- Add actual routes in `app.js` that use `client` to `GET`/`SET` cached values.
- Add environment variables (using a `.env` file and the `dotenv` package) instead of hardcoding the host/port.
- Add a `client.quit()` call on process shutdown (e.g. listening for `SIGINT`) to close the Redis connection gracefully.
- Add error-handling middleware to the Express app.
- Add a route that enqueues a BullMQ job, and check its result via the job's `id`.
- Add retry/backoff configuration to the BullMQ queue for jobs that fail intermittently.