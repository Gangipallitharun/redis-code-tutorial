const app = require("./app");
const client = require('./config/cache.config.js')

const startServer = () => {
    try {

        client.once("ready", () => {
            app.listen(4000, "127.0.0.1", () => {
                console.log("Server is Running on Port 4000");
            })
        })
    } catch (error) {
        console.log("error While Connecting to server", error);
    }
};


startServer();