const io = require("socket.io-client");
const fetch = require("node-fetch");

module.exports = {
    "bankroll": require("./bankroll-core")(io, fetch),
    "chat": require("./chat-core")(io, fetch),
};