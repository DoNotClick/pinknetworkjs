module.exports = function (io, request) {
    const API_ENDPOINT = "https://api.pink.network/wax/chat/";

    class ChatAPI {
        constructor(room) {
            this.socket = io(API_ENDPOINT + "v1/rooms/" + room, {
                "path": "/wax/chat/socket", "forceNew": true
            });

            this.room = room;

            this.loadcallbacks = [];
            this.messagecallbacks = [];
            this.errorcallbacks = [];

            let self = this;

            this.auth_token = null;
            this.authenticated = false;
            this.sig_sent = false;

            this.socket.on('chat_load', function(messages) {
                for (let i = 0; i < self.loadcallbacks.length; i++) {
                    self.loadcallbacks[i](messages);
                }
            });

            this.socket.on('chat_message', function(message) {
                for (let i = 0; i < self.messagecallbacks.length; i++) {
                    self.messagecallbacks[i](message);
                }
            });

            this.socket.on('error_message', function(message) {
                for (let i = 0; i < self.errorcallbacks.length; i++) {
                    self.errorcallbacks[i](message);
                }
            });

            this.socket.on('login', function(msg){
                self.authenticated = true;
            });

            this.socket.on('logout', function(msg){
                self.authenticated = false;
            });

            this.socket.on('authenticate', function(msg) {
                self.authenticated = false;
                self.sig_sent = false;
                self.auth_token = msg;
            });
        }

        login(signature, publicKey, account_name, avatar = null) {
            if(this.sig_sent) {
                return;
            }

            this.sig_sent = true;

            this.socket.emit("login", {"pub": publicKey, "sig": signature, "account": account_name, "avatar": avatar});
        }

        logout() {
            if(!this.isAuthenticated()) {
                return;
            }

            this.socket.emit("logout");
        }

        send(message) {
            this.socket.emit('chat_message', message);
        }

        isAuthenticated() {
            return this.authenticated;
        }

        getAuthToken() {
            return this.auth_token;
        }

        onError(cb) {
            this.errorcallbacks.push(cb);
        }

        onLoad(cb) {
            this.loadcallbacks.push(cb);
        }

        onMessage(cb) {
            this.messagecallbacks.push(cb);
        }
    }

    return ChatAPI;
};