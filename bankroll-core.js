const bankroll_management = require("./bankroll-management");

module.exports = function (io, fetch) {
    const API_ENDPOINT = "https://api.pink.network/wax/bankroll/";

    class BankrollAPI {
        constructor() {
            this.roll_subscription = new RollSubscription();
            this.cycle_roll_subscriptions = {};
        }

        /**
         * @returns {RollSubscription}
         */
        getRollSubscription() {
            return this.roll_subscription;
        }

        /**
         *
         * @param {number} roll_id
         * @returns {CycleRollSubscription}
         */
        getCycleRollSubscription(roll_id) {
            if (typeof this.cycle_roll_subscriptions[String(roll_id)] === "undefined") {
                this.cycle_roll_subscriptions[String(roll_id)] = new CycleRollSubscription(roll_id);
            }

            return this.cycle_roll_subscriptions[String(roll_id)];
        }

        /**
         *
         * @param {number} multiplier
         * @param {number} rake
         * @param {number} max_roll
         * @returns {BetConfig}
         */
        createBetConfigByMultiplier(multiplier, rake, max_roll = 10000) {
            let lower_bound = 1;
            let upper_bound = Math.floor(((99 - rake) / (100 * multiplier)) * max_roll);

            return new BetConfig(multiplier, lower_bound, upper_bound, max_roll);
        }

        /**
         *
         * @param {number} lower_bound
         * @param {number} upper_bound
         * @param {number} rake
         * @param {number} max_roll
         * @returns {BetConfig}
         */
        createBetConfigByRange(lower_bound, upper_bound, rake, max_roll = 10000) {
            let odds = (upper_bound - lower_bound + 1) / max_roll;
            let multiplier = ((99 - rake) / (100 * odds));

            return new BetConfig(multiplier.toFixed(3), lower_bound, upper_bound, max_roll);
        }

        /**
         *
         * @param {number} multiplier
         * @param {number} lower_bound
         * @param {number} upper_bound
         * @param {number} max_roll
         * @returns {BetConfig}
         */
        createBetConfig(multiplier, lower_bound, upper_bound, max_roll = 10000) {
            return new BetConfig(multiplier, lower_bound, upper_bound, max_roll);
        }

        /**
         *
         * @param {number} amount
         * @param {String} rake_recipient
         * @param {BetConfig} bet_config
         * @returns {boolean|{identifier: string, quantity: string, client_seed: string, memo: string}}
         */
        createRollTransactionMemo(amount, rake_recipient, bet_config) {
            if (amount > this.getRollSubscription().getMaxBet(amount, bet_config)) {
                return false;
            }

            let identifier = random_hex_string(16);
            let client_seed = random_hex_string(16);

            this.getRollSubscription().subscribeIdentifier(identifier);

            return {
                "quantity": parseFloat(amount).toFixed(8) + " WAX",
                "identifier": identifier,
                "client_seed": client_seed,
                "memo": "#bet " + Math.floor(bet_config.getMultiplier() * 1000) + " " + bet_config.getLowerBound() + " " + bet_config.getUpperBound() + " " + rake_recipient + " " + identifier + " " + client_seed
            }
        }

        /**
         *
         * @param {number} roll_id
         * @param {number} amount
         * @param {BetConfig} bet_config
         * @returns {boolean|{quantity: string, client_seed: string, memo: string}}
         */
        createCycleRollTransactionMemo(roll_id, amount, bet_config) {
            if (amount > this.getCycleRollSubscription(roll_id).getMaxBet(amount, bet_config)) {
                return false;
            }

            let client_seed = random_hex_string(16);

            return {
                "quantity": parseFloat(amount).toFixed(8) + " WAX",
                "client_seed": client_seed,
                "memo": "#join " + roll_id + " " + Math.floor(bet_config.getMultiplier() * 1000) + " " + bet_config.getLowerBound() + " " + bet_config.getUpperBound() + " " + client_seed
            };
        }

        /* API ENDPOINTS */
        async getRollHistory(limit = 50, page = 1, rake_recipient = null, bettor = null) {
            let resp = await this.request("rolls", {
                "limit": limit,
                "page": page,
                "rake_recipient": rake_recipient,
                "bettor": bettor
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getRollResult(roll_id) {
            let resp = await this.request("rolls/" + roll_id);

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getRollRanking(rake_recipient = null, sort = "wagered", time = 0, limit = 50, page = 1) {
            let resp = await this.request("rolls/ranking", {
                "rake_recipient": rake_recipient,
                "sort": sort,
                "time": time,
                "limit": limit,
                "page": page
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getRollAccountRanking(account, rake_recipient = null, time = 0) {
            let resp = await this.request("rolls/ranking/" + account, {
                "time": time,
                "rake_recipient": rake_recipient
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getCycleRollInfo(roll_id) {
            let resp = await this.request("cycles/info/" + roll_id);

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getCycleRollRanking(roll_id, sort = "wagered", time = 0, limit = 50, page = 1) {
            let resp = await this.request("cycles/ranking/" + roll_id, {
                "sort": sort,
                "time": time,
                "limit": limit,
                "page": page
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getCycleRollAccountRanking(roll_id, account, time = 0) {
            let resp = await this.request("cycles/ranking/" + roll_id + "/" + account, {
                "time": time,
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getCycleRollHistory(roll_id, limit = 50, page = 1, bettor = null) {
            let resp = await this.request("cycles/" + roll_id, {
                "limit": limit,
                "page": page,
                "bettor": bettor
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getCycleRollResult(roll_id, cycle_id) {
            let resp = await this.request("cycles/" + roll_id + "/" + cycle_id);

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        /* BALANCE ENDPOINTS */

        async getBankrollBalance() {
            let resp = await this.request("available-funds/latest");

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getBankrollBalanceHistory(step = 3600 * 6, time = 0) {
            let resp = await this.request("available-funds", {
                "step": step,
                "time": time
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getExchangeRate(token_1 = "pink", token_2 = "wax") {
            let resp = await this.request("exchange-rate/" + token_1 + "-" + token_2 + "/latest");

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getExchangeRateHistory(token_1 = "pink", token_2 = "wax", step = 3600 * 6, time = 0) {
            let resp = await this.request("exchange-rate/" + token_1 + "-" + token_2, {
                "step": step,
                "time": time
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getBankrollProfit() {
            let resp = await this.request("profit/latest");

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getBankrollProfitHistory(step = 3600 * 6, time = 0) {
            let resp = await this.request("profit", {
                "step": step,
                "time": time
            });

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

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
    }

    class BetConfig {
        /**
         *
         * @param multiplier
         * @param lower_bound
         * @param upper_bound
         * @param max_roll
         */
        constructor(multiplier, lower_bound, upper_bound, max_roll = 10000) {
            this.lower_bound = lower_bound;
            this.upper_bound = upper_bound;
            this.multiplier = multiplier;
            this.max_roll = max_roll;

            if (lower_bound < 1 || lower_bound > upper_bound || upper_bound > max_roll) {
                throw new Error("The bet has illegal bounds");
            }
            if (((upper_bound - lower_bound + 1) / max_roll) * multiplier > 0.99) {
                throw new Error("The bet can't have an EV higher than 0.99")
            }
        }

        /**
         *
         * @returns {number}
         */
        getLowerBound() {
            return this.lower_bound;
        }

        /**
         *
         * @returns {number}
         */
        getUpperBound() {
            return this.upper_bound;
        }

        /**
         *
         * @returns {number}
         */
        getMultiplier() {
            return this.multiplier;
        }

        /**
         * @returns {number}
         */
        getMaxRoll() {
            return this.max_roll;
        }
    }

    class RollSubscription {
        constructor() {
            this.socket = io(API_ENDPOINT + "v1/rolls", {
                "path": "/wax/bankroll/socket", "forceNew": true
            });

            this.bankroll = 0;

            let self = this;
            this.socket.on("bankroll_update", function (data) {
                self.bankroll = data;
            });
        }

        subscribeRakeRecipient(wax_account) {
            this.socket.emit("subscribe_rake_recipient", wax_account)
        }

        subscribeIdentifier(identifier) {
            this.socket.emit("subscribe_identifier", identifier)
        }

        subscribeAll() {
            this.socket.emit("subscribe_all", null)
        }


        onNewRollResult(cb) { this.socket.on("new_roll", cb); }
        onBankrollUpdate(cb) { this.socket.on("bankroll_update", cb); }

        /**
         *
         * @param {BetConfig} bet_config
         * @returns {number}
         */
        getMaxBet(bet_config) {
            return 0.95 * bankroll_management.getMaxBet([], bet_config, this.bankroll);
        }
    }

    class CycleRollSubscription {
        /**
         *
         * @param {number} roll_id
         */
        constructor(roll_id) {
            this.socket = io(API_ENDPOINT + "v1/cycles/" + roll_id, {
                "path": "/wax/bankroll/socket", "forceNew": true
            });

            this.bankroll = 0;
            this.bets = [];

            let self = this;

            this.socket.on("bankroll_update", function (data) {
                self.bankroll = data;
            });

            this.socket.on("new_roll", function (data) {
                self.bets = [];
            });

            this.socket.on("new_bet", function (data) {
                self.bets.push(data);
            });

            this.socket.on("bankroll_update", function (data) {
                self.bankroll = data;
            });
        }

        onBankrollUpdate(cb) { this.socket.on("bankroll_update", cb); }
        onNewRollResult(cb) { this.socket.on("new_roll", cb); }
        onNewBet(cb) { this.socket.on("new_bet", cb); }
        onRollReduction(cb) { this.socket.on("roll_reduction", cb); }

        /**
         *
         * @param {BetConfig} bet_config
         * @returns {number}
         */
        getMaxBet(bet_config) {
            return 0.95 * bankroll_management.getMaxBet(this.bets, bet_config, this.bankroll);
        }
    }

    function random_hex_string(length) {
        let result = '';
        let characters = '0123456789abcdef';
        let charactersLength = characters.length;

        for (let i = 0; i < length; i++) {
            result += characters.charAt(Math.floor(Math.random() * charactersLength));
        }

        return result;
    }

    return BankrollAPI;
};