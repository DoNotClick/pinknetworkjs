(function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
const bankroll_management = require("./bankroll-management");

module.exports = function (io, request) {
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

        async getBankrollBalance() {
            let resp = await this.request("balance");

            if (resp["success"]) {
                return resp["data"];
            }

            throw resp;
        }

        async getBankrollBalanceHistory(step = 3600 * 6, time = Math.floor(Date.now() / 1000) - 3600 * 24 * 7) {
            let resp = await this.request("balance/history", {
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
                if (method === "GET") {
                    return await request({
                        "method": "GET",
                        "uri": url,
                        "json": true
                    });
                } else if (method === "POST") {
                    return await request({
                        "method": "GET",
                        "uri": url,
                        "body": params,
                        "json": true
                    });
                }

                throw {"code": 500, "message": "INTERNAL_SERVER_ERROR"};
            } catch (e) {
                return {"success": false, "data": null, "code": 500, "message": "Internal Server Error"}
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
            this.on = this.socket.on;

            this.bankroll = 0;

            this.bankrollcallbacks = [];
            this.rollcallbacks = [];

            let self = this;
            this.socket.on("bankroll_update", function (data) {
                self.bankroll = data;

                for (let i = 0; i < self.bankrollcallbacks.length; i++) {
                    self.bankrollcallbacks[i](data);
                }
            });

            this.socket.on("new_roll", function (data) {
                for (let i = 0; i < self.rollcallbacks.length; i++) {
                    self.rollcallbacks[i](data);
                }
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

        onNewRollResult(cb) {
            this.rollcallbacks.push(cb);
        }

        onBankrollUpdate(cb) {
            this.bankrollcallbacks.push(cb);
        }

        /**
         *
         * @param {BetConfig} bet_config
         * @returns {number}
         */
        getMaxBet(bet_config) {
            return bankroll_management.getMaxBet([], bet_config, this.bankroll);
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
            this.on = this.socket.on;

            this.bankroll = 0;
            this.bets = [];

            this.betcallbacks = [];
            this.rollcallbacks = [];
            this.bankrollcallbacks = [];

            let self = this;

            this.socket.on("bankroll_update", function (data) {
                self.bankroll = data;
            });

            this.socket.on("new_roll", function (data) {
                self.bets = [];

                for (let i = 0; i < self.rollcallbacks.length; i++) {
                    self.rollcallbacks[i](data);
                }
            });

            this.socket.on("new_bet", function (data) {
                self.bets.push(data);

                for (let i = 0; i < self.betcallbacks.length; i++) {
                    self.betcallbacks[i](data);
                }
            });

            this.socket.on("bankroll_update", function (data) {
                self.bankroll = data;

                for (let i = 0; i < self.bankrollcallbacks.length; i++) {
                    self.bankrollcallbacks[i](data);
                }
            });
        }

        onBankrollUpdate(cb) {
            this.bankrollcallbacks.push(cb);
        }

        onNewRollResult(cb) {
            this.rollcallbacks.push(cb);
        }

        onNewBet(cb) {
            this.betcallbacks.push(cb);
        }

        /**
         *
         * @param {BetConfig} bet_config
         * @returns {number}
         */
        getMaxBet(bet_config) {
            return bankroll_management.getMaxBet(this.bets, bet_config, this.bankroll);
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
},{"./bankroll-management":2}],2:[function(require,module,exports){
/**
 * This is a modified linked list
 * It is used because of the relatively efficient inserting of new elements in the middle
 */
class ChainedRange {

    constructor(lowerBound, upperBound, payout) {
        this.next = null;
        this.lower_bound = lowerBound;
        this.upper_bound = upperBound;
        this.payout = payout;
    }

    /**
     * Inserts a bet in the range list, by passing it through the chain until it is fully inserted
     * @param {Object} bet
     */
    insertBet(bet) {
        if (bet.upper_bound > this.upper_bound) {
            this.next.insertBet(bet)
        }

        if (bet.lower_bound <= this.upper_bound) {
            if (bet.lower_bound <= this.lower_bound) {
                if (bet.upper_bound >= this.upper_bound) {
                    //Bet is in whole range
                    this.payout += parseFloat(bet.amount) * parseFloat(bet.multiplier);
                } else {
                    //Bet is in the left of the range
                    const newRange = new ChainedRange(bet.upper_bound + 1, this.upper_bound, this.payout);
                    this.upper_bound = bet.upper_bound;
                    this.insertNextRange(newRange);
                    this.payout += parseFloat(bet.amount) * parseFloat(bet.multiplier);
                }
            } else {
                if (bet.upper_bound >= this.upper_bound) {
                    //Bet is on the right of the range
                    const newRange = new ChainedRange(bet.lower_bound, this.upper_bound, this.payout + parseFloat(bet.amount) * parseFloat(bet.multiplier));
                    this.upper_bound = bet.lower_bound - 1;
                    this.insertNextRange(newRange);
                } else {
                    //Bet is in the middle of the range
                    const newMiddleRange = new ChainedRange(bet.lower_bound, bet.upper_bound, this.payout + parseFloat(bet.amount) * parseFloat(bet.multiplier));
                    const newRightRange = new ChainedRange(bet.upper_bound + 1, this.upper_bound, this.payout);
                    this.upper_bound = bet.lower_bound - 1;
                    this.insertNextRange(newMiddleRange);
                    newMiddleRange.insertNextRange(newRightRange);
                }
            }
        }
    }

    /**
     *
     * @param {ChainedRange} nextRange
     */
    insertNextRange(nextRange) {
        nextRange.next = this.next;
        this.next = nextRange;
    }
}

/**
 * Calculates the minimum bankroll required to accept the bets in the chained ranges
 * Mirrors the bankroll management function used in the smart contract
 * @param {ChainedRange} chainedRangeStart
 * @param {number} amountCollected
 * @param {number} maxResult
 */
function calculateMinBankroll(chainedRangeStart, amountCollected, maxResult) {
    let variance = 0;
    let currentRange = chainedRangeStart;
    while (currentRange !== null) {
        if (currentRange.payout > amountCollected) {
            //Odds of this range winning
            const odds = (currentRange.upper_bound - currentRange.lower_bound + 1) / maxResult;
            //This factor is the max percentage of the bankroll that could be bet on this result, if it were the only bet
            const maxBetFactor = 5 / Math.sqrt(1 / odds - 1) - 0.2;
            //This is the amount that the bankroll has to play if this range wins, plus the initial bet amount on this range
            const effectivePayout = currentRange.payout - amountCollected + currentRange.payout * odds;
            //The odds of going losing 50% of the bankroll in 100 bets approximately grows proportional to the cube of the relative size of the bet
            variance += Math.pow(effectivePayout * odds / maxBetFactor, 3);
        }
        currentRange = currentRange.next;
    }
    return Math.cbrt(variance) * 100
}


/**
 * Simulates the minBankroll for an additional bet by first adding it in the ranges that it has to be in
 * and then removing it again afterwards, in order not to change the original chained range
 *
 * @param {ChainedRange} chainedRangeStart - First of the chained ranges
 * @param {number} amountCollected - The amount collected from all bets
 * @param {number} maxResult - The max result of the roll
 * @param {ChainedRange[]} betRanges - The ranges that the bet is to be inserted into
 * @param {number} betAmount - The amount of the bet to be inserted
 * @param {number} betMultiplier - The multiplier of the bet to be inserted
 * @param {number} betEV - the EV of the bet to be inserted
 */
function simulateMinBankrollWithInsertedBet(chainedRangeStart, amountCollected, maxResult, betRanges, betAmount, betMultiplier, betEV) {
    for (let i in betRanges) {
        betRanges[i].payout += betAmount * betMultiplier
    }
    const minBankroll = calculateMinBankroll(chainedRangeStart, amountCollected + betAmount * (0.007 + betEV), maxResult);
    for (let i in betRanges) {
        betRanges[i].payout -= betAmount * betMultiplier
    }
    return minBankroll
}


/**
 * Returns the maximum amount that can be bet with the specified betconfig, taking into account the already placed bets
 * This is not an exact number, but rather an educated guess that is slightly lower than the real maximum
 *
 * Note: This function could be implemented a lot more efficient, however it is still easily quick enough to not cause any problem as it is
 *
 * @param {Object[]} bets - already filled with all previous bets
 * @param {BetConfig} betConfig
 * @param {number} bankroll
 */
function getMaxBet(bets, betConfig, bankroll) {
    //Setting up ranges
    const firstRange = new ChainedRange(1, betConfig.max_roll, 0);
    let totalAmountBet = 0;
    for (let i in bets) {
        firstRange.insertBet(bets[i]);
        const ev = (bets[i].upper_bound - bets[i].lower_bound + 1) / betConfig.max_roll * parseFloat(bets[i].multiplier);
        totalAmountBet += parseFloat(bets[i].amount) * (0.007 + ev);
    }

    // Inserting dummy bet to split ranges if necessary
    firstRange.insertBet({
        lower_bound: betConfig.lower_bound,
        upper_bound: betConfig.upper_bound,
        amount: "0",
        multiplier: "0"
    });

    //Finding the ranges that the new bets is in
    const betRanges = [];     // The ranges that this bet is in
    let currentRange = firstRange;
    while (currentRange != null) {
        if (currentRange.lower_bound <= betConfig.upper_bound && currentRange.upper_bound >= betConfig.lower_bound) {
            betRanges.push(currentRange)
        }
        currentRange = currentRange.next;
    }

    //Calculating start value for approximation = max bet, if this bet were the only bet
    const odds = (betConfig.upper_bound - betConfig.lower_bound + 1) / betConfig.max_roll;
    const maxBetFactor = 5 / Math.sqrt(1 / odds - 1) - 0.2;
    let soloMaxBet = bankroll * maxBetFactor / 100 * 2;

    const betEV = betConfig.multiplier * odds;

    for (let i = 100; i >= 0; i--) {
        const amount = i / 100 * soloMaxBet;
        const difference = simulateMinBankrollWithInsertedBet(firstRange, totalAmountBet, betConfig.max_roll, betRanges, amount, betConfig.multiplier, betEV) - bankroll;
        if (difference < 0) {
            // -1% for security for rounding errors
            return amount * 0.99
        }
    }
    return 0
}


module.exports = {
    getMaxBet: getMaxBet
};
},{}],3:[function(require,module,exports){
const request = function(options) {
    return new Promise(function (resolve, reject) {
        if(options["method"] === "GET") {
            $.ajax({
                method: "GET",
                url: options["uri"],
                dataType: options["json"] ? "json" : "text",
                success: function (data) {
                    resolve(data);
                },
                error: function () {
                    reject()
                }
            });
        }
        else if(options["method"] === "POST") {
            $.ajax({
                method: "POST",
                url: options["uri"],
                data: options["body"],
                dataType: options["json"] ? "json" : "text",
                success: function (data) {
                    resolve(data);
                },
                error: function () {
                    reject();
                }
            });
        }
        else {
            reject();
        }
    })
};

pinknetwork = {
    "bankroll": require("./bankroll-core")(io, request),
    "chat": require("./chat-core")(io, request)
};
},{"./bankroll-core":1,"./chat-core":4}],4:[function(require,module,exports){
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
},{}]},{},[3]);
