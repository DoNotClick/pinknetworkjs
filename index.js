const io = require("socket.io-client");
const request = require("request-promise-native");

module.exports = {
    "bankroll": require("./bankroll-core")(io, request),
    "chat": require("./chat-core")(io, request),
};