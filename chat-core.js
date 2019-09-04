module.exports = function (io, fetch) {
    const API_ENDPOINT = "https://api.pink.network/wax/chat/";

    class ChatAPI {

        constructor(room) {
            this.socket = io(API_ENDPOINT + "v1/rooms/" + room, {
                "path": "/wax/chat/socket", "forceNew": true
            });

            let self = this;

            this.room = room;
            this.nonce = null;
            this.authenticated = false;
            this.sig_sent = false;

            this.socket.on('login', function(){
                self.authenticated = true;
            });

            this.socket.on('logout', function() {
                self._delete_cookie("chat-auth:" + self.room);

                self.authenticated = false;
            });

            this.socket.on('authenticate', function(msg) {
                self.authenticated = false;
                self.sig_sent = false;
                self.nonce = msg;
            });

            if(this._get_cookie("chat-auth:" + this.room)) {
                this.socket.emit("authenticate", this._get_cookie("chat-auth:" + this.room))
            }
        }

        login(signature, publicKey, account) {
            if(this.sig_sent) {
                return;
            }

            this.sig_sent = true;

            this.socket.emit("login", {"pub": publicKey, "sig": signature, "account": account});
        }

        async authenticate_arbitrary(signature, publicKey, account, stay_logged_in = true) {
            if(this.isAuthenticated()) {
                return;
            }

            let self = this;

            let auth_token = await this.request("authenticate", {
                "method": "arbitrary",
                "room": self.room,
                "account": account,
                "public_key": publicKey,
                "signature": signature,
                "nonce": self.nonce
            }, 1, "POST");

            if(stay_logged_in) {
                self._set_cookie("chat-auth:" + self.room, auth_token["data"]);
            }

            if(auth_token["success"] !== true) {
                return null;
            }

            this.socket.emit("authenticate", auth_token["data"]);

            return auth_token["data"];
        }

        async authenticate_transaction(signature, publicKey, account, permission, stay_logged_in = true) {
            if(this.isAuthenticated()) {
                return;
            }

            let self = this;

            let auth_token = await this.request("authenticate", {
                "method": "transaction",
                "room": self.room,

                "account": account,
                "permission": permission,

                "public_key": publicKey,
                "signature": signature,
                "nonce": self.nonce
            }, 1, "POST");

            if(stay_logged_in) {
                self._set_cookie("chat-auth:" + self.room, auth_token["data"]);
            }

            if(auth_token["success"] !== true) {
                return null;
            }

            this.socket.emit("authenticate", auth_token["data"]);

            return auth_token["data"];
        }

        async logout() {
            if(!this.isAuthenticated()) {
                return;
            }

            if(this._get_cookie("chat-auth:" + this.room)) {
                await this.request("logout", {
                    "token": this._get_cookie("chat-auth:" + this.room)
                },1, "POST");

                this._delete_cookie("chat-auth:" + this.room)
            }

            this.socket.emit("logout");
        }

        isAuthenticated() {
            return this.authenticated;
        }

        getNonce() {
            return this.nonce;
        }

        getAuthenticationSignText() {
            return "chat " + this.room + " " + this.nonce;
        }

        getAuthenticationTransaction(account, permission) {
            let self = this;

            return {
                actions: [{
                    account: 'pinknetworkx',
                    name: 'chatauth',
                    authorization: [{
                        actor: account,
                        permission: permission,
                    }],
                    data: {
                        room: self.room,
                        nonce: self.nonce
                    },
                }],
                expiration: "2019-06-05T12:00:00.000",
                ref_block_num: 1,
                ref_block_prefix: 405914617
            }
        }

        send(message) {
            this.socket.emit('chat_message', message);
        }

        onError(cb) { this.socket.on("error_message", cb); }
        onLoad(cb) { this.socket.on("chat_load", cb); }
        onMessage(cb) { this.socket.on("chat_message", cb); }
        onLogout(cb) { this.socket.on("logout", cb); }
        onLogin(cb) { this.socket.on("login", cb); }

        /**
         *
         * @param endpoint
         * @param params
         * @param version
         * @param method
         * @returns {Promise<{code: number, data: null, success: boolean, message: string}>}
         */
        async request(endpoint, params = {}, version = 1, method = "GET") {
            let url = API_ENDPOINT + "v" + version + "/" + endpoint;

            let querystring = "";

            if (method === "GET") {
                for (let key in params) {
                    if(params[key] === null) {
                        continue;
                    }

                    if (querystring !== "") {
                        querystring += "&";
                    }

                    querystring += key + "=" + encodeURIComponent(params[key]);
                }

                if (querystring.length > 0) {
                    url += "?" + querystring;
                }
            }

            try {
                if (method.toLowerCase() === "get") {
                    return (await fetch(url, {
                        "mode": "cors"
                    })).json();
                } else if (method.toLowerCase() === "post") {
                    return (await fetch(url, {
                        "method": "post",
                        "mode": "cors",
                        "body": JSON.stringify(params),
                        "headers": {
                            'Content-Type': 'application/json',
                        },
                    })).json();
                }

                throw {"code": 500, "message": "Internal Server Error"};
            } catch (e) {
                return {"success": false, "data": null, "code": 500, "message": String(e)}
            }
        }

        _set_cookie(name, value, days = 365) {
            if(!document.cookie) {
                return;
            }

            let expires = "";

            if (days) {
                let date = new Date();
                date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));

                expires = "; expires=" + date.toUTCString();
            }

            document.cookie = name + "=" + (value || "")  + expires + "; path=/";
        }

        _get_cookie(name) {
            if(!document.cookie) {
                return null;
            }

            let nameEQ = name + "=";
            let ca = document.cookie.split(';');

            for(let i=0;i < ca.length;i++) {
                let c = ca[i];

                while(c.charAt(0) == ' ') {
                    c = c.substring(1, c.length);
                }

                if(c.indexOf(nameEQ) == 0) {
                    return c.substring(nameEQ.length, c.length);
                }
            }

            return null;
        }

        _delete_cookie(name) {
            if(document.cookie) {
                document.cookie = name+'=; Max-Age=-99999999;';
            }
        }
    }

    return ChatAPI;
};