const { Redis } = require("ioredis");

const redisConfig = {
    port: 6379,
    host: "127.0.0.1"
};


const client = new Redis(redisConfig);

client.on("connect", () => console.log("Client is Connected Successfully!"));
client.on("close", () => console.log("Client Connection Closed!"));
client.on("error", (err) => console.log("Error While Connecting to Client", err));

module.exports = client;

