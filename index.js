/*
 *   Define required dependecies
 */

var parseargs = require('minimist');
var steamuser = require('steam-user');
var jsonfile = require('jsonfile');
var steamtotp = require('steam-totp');
var readline = require('readline');
var winston = require('winston');
var steamid = require('steamid');

var rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
var logger;
var client = new steamuser({
    promptSteamGuardCode: false,
    enablePicsCache: true,
    picsCacheAll: true
});
var launchArgs = parseargs(process.argv.slice(2));
var temporaryArgs = {};
var configArgs;
var configArgsPath = __dirname + '/configs/instances.json';

var appOwnershipIsCached = false;

var urlregex = new RegExp(/((?:(?:https?|ftp)?:\/\/)?(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\x\u00a1-\uffff0-9]+-?)*[a-z\x\u00a1-\uffff0-9]+)(?:\.(?:[a-z\x\u00a1-\uffff0-9]+-?)*[a-z\x\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\x\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?)/igm);

/*### steam-user logOn function ###*/
function logOn(username, password) {
    if (temporaryArgs["s_account_loginkey"] && temporaryArgs["b_use_account_loginkey"]) {
        client.logOn({
            accountName: username,
            password: password,
            rememberPassword: true,
            loginKey: temporaryArgs["s_account_loginkey"]
        });
    } else {
        client.logOn({
            accountName: username,
            password: password,
            rememberPassword: true,
        });
    }
}

/*### steam-user logOn account details check function ###*/
function logOnCheck() {
    if (("s_account_login" in temporaryArgs) && ("s_account_password" in temporaryArgs)) {
        logOn(temporaryArgs["s_account_login"], temporaryArgs["s_account_password"]);
    } else {
        logger.error('No login details present!');
        process.exit(9);
    }
}

/*### Save config function ###*/
function JSONSave() {
    for (var key in configArgs[launchArgs["selectinstance"]]) {
        configArgs[launchArgs["selectinstance"]][key] = temporaryArgs[key];
    }
    jsonfile.writeFile(configArgsPath, configArgs, {
        spaces: 4,
        EOL: '\r\n'
    }, function(err) {
        if (err != null) {
            console.log(err);
        }
    });
}

/*### Read config function ###*/
jsonfile.readFile(configArgsPath, function(err, obj) {
    if (err != null || launchArgs["selectinstance"] == undefined) {
        console.log((err != null ? err : '--selectinstance is not defined!'));
        process.exit(1);
    } else {
        configArgs = obj;
        if (!(configArgs[launchArgs["selectinstance"]])) {
            configArgs[launchArgs["selectinstance"]] = {
                s_account_login: null,
                s_account_password: null,
                s_account_base64secret: null,
                b_use_account_loginkey: 0,
                s_account_loginkey: null,
                i_account_setpersonastate: 1,
                i_account_clientgamesplayed: [],
                b_use_misc_passphrase: 0,
                s_misc_passphrase: Math.random().toString(36).slice(-8),
                i_use_misc_replymessage: 1,
                s_misc_replymessage: null,
                i_account_friendrequests: 0,
                i_account_grouprequests: 0,
                b_misc_friendrequests_rejecturlname: 0,
                i_misc_friendrequests_rejectaccountrank: 0,
                b_misc_friendmessages_rejecturlstring: 0,
                b_cmd_groupinvite: 0
            };
        }
        for (var key in configArgs[launchArgs["selectinstance"]]) {
            temporaryArgs[key] = configArgs[launchArgs["selectinstance"]][key];
            if (launchArgs[key]) {
                temporaryArgs[key] = launchArgs[key];
            }
        }
        if (typeof temporaryArgs["i_account_clientgamesplayed"] === "string") {
            temporaryArgs["i_account_clientgamesplayed"] = (temporaryArgs["i_account_clientgamesplayed"].toString()).split(',');
            for (var key in temporaryArgs["i_account_clientgamesplayed"]) {
                if ((temporaryArgs["i_account_clientgamesplayed"][key]).match(/\d{1,6}/)) {
                    temporaryArgs["i_account_clientgamesplayed"][key] = parseInt(temporaryArgs["i_account_clientgamesplayed"][key]);
                }
            }
        }
        logger = new(winston.Logger)({
            transports: [new(winston.transports.Console)({
                colorize: true,
                level: 'debug'
            }), new(winston.transports.File)({
                level: 'info',
                timestamp: true,
                filename: __dirname + '/logs/log_[' + launchArgs["selectinstance"] + '].log',
                json: false
            })]
        });
        JSONSave();
        logOnCheck();
    }
});

/*### This function called only on Steam Guard code request ###*/
client.on('steamGuard', function(domain, callback, lastCodeWrong) {
    if (lastCodeWrong) {
        logger.warn('Last code was wrong, try again!');
    }
    if (temporaryArgs["s_account_base64secret"]) {
        logger.info('Trying to use provided shared secret...');
        callback(steamtotp.generateAuthCode(temporaryArgs["s_account_base64secret"]));
    } else {
        logger.info('Looks like we are going to need Steam Guard ' + (!domain ? 'App ' : '') + 'code...');
        rl.question('question: Steam Guard ' + (!domain ? 'App ' : '') + 'code: ', function(code) {
            callback(code);
            rl.close();
        });
    }
});

client.on('loggedOn', function() {
    logger.info('Successfully logged in!');
    if (temporaryArgs["i_account_setpersonastate"]) {
        client.setPersona(temporaryArgs["i_account_setpersonastate"]);
    } else {
        client.setPersona(0);
    }
    client.setUIMode(3);
    if (temporaryArgs["i_account_clientgamesplayed"]) {
        var clientGamesPlayedArray = [];
        for (var key in temporaryArgs["i_account_clientgamesplayed"]) {
            if (temporaryArgs["i_account_clientgamesplayed"][key].toString().match(/\d{1,6}/)) {
                clientGamesPlayedArray.push(parseInt(temporaryArgs["i_account_clientgamesplayed"][key]));
            }
        }
        client.gamesPlayed(clientGamesPlayedArray);
    }
});

function getSenderName(steamID, callback) {
    var sender, senderName;
    client.getPersonas([steamID], function(personas) {
        sender = personas[steamID.getSteamID64()]; 
        senderName = sender ? sender.player_name : ("[" + steamID.getSteamID64() + "]");
        if(callback) callback(senderName);
    });
}

function logReceivedMessage(steamID, message) {
    getSenderName(steamID, function(senderName){
        logger.info("Incomming message from [" + senderName + "][" + steamID + "]: \"" + message + "\"");
    });
}

function logReceivedCommand(steamID, message) {
    getSenderName(steamID, function(senderName){
        logger.info("Received command from [" + senderName + "][" + steamID + "]: \"" + message + "\"");
    });
}

function logReceivedEvent(steamID, type) {
    getSenderName(steamID, function(senderName) {
        logger.info("Received event from [" + senderName + "][" + steamID + "] [" + type + "]");
    });
}

function logReceivedUnknownCommand(steamID, message) {
    getSenderName(steamID, function(senderName){
        logger.info("Unknown command from [" + senderName + "][" + steamID + "]: \"" + message + "\"");
    });
}

function logCommandProcessed(steamID, message, reply, callback) {
    getSenderName(steamID, function(senderName){
        logger.info("Successfully processed command from [" + senderName + "][" + steamID + "]: \"" + message + "\"");
    });
    if (temporaryArgs["i_use_misc_replymessage"] && reply) {
        client.chatMessage(steamID, reply);
    }
    if(callback) callback();
}

function logEventProcessed(steamID, type, reply, callback) {
    getSenderName(steamID, function(senderName) {
        logger.info("Successfully processed event from [" + senderName + "][" + steamID + "] [" + type + "]");
    });
    if (temporaryArgs["i_use_misc_replymessage"] && reply) {
        client.chatMessage(steamID, reply);
    }
    if(callback) callback();
}

function logCommandNotProcessed(steamID, message, err, callback) {
    getSenderName(steamID, function(senderName){
        logger.info("Cannot process command from [" + senderName + "][" + steamID + "]: \"" + message + "\" [" + err + "]");
    });
    if (temporaryArgs["i_use_misc_replymessage"] && err) {
        client.chatMessage(steamID, "err: " + err);
    }
    if(callback) callback();
}

client.on('friendMessage', function(steamID, message) {
    var incomingMessage = message.split("|");
    if (incomingMessage[0].match(/^[\/]/) && temporaryArgs["b_use_misc_passphrase"]) {
        switch (incomingMessage[0].slice(1)) {
            //A
            //B
            //C
            //D
            //E
            //F
            case "friend.add": //friend.add|steamID|remoteControlPassphrase
                logReceivedCommand(steamID, message);
                try {
                    var steamIDValidCheck = new steamid(incomingMessage[1]);
                    if (steamIDValidCheck.isValid()) {
                        if (incomingMessage[2] == (temporaryArgs["s_misc_passphrase"])) {
                            logCommandProcessed(steamID, message, "Request proccessed");
                            client.addFriend(steamIDValidCheck.getSteamID64().toString());
                        } else {
                            logCommandNotProcessed(steamID, message, "Invalid remoteControlPassphrase");
                        }
                    } else {
                        logCommandNotProcessed(steamID, message, "Invalid steamID");
                    }
                } catch(io) {
                    return;
                }
                break;
            case "friend.blk": //friend.blk|steamID|remoteControlPassphrase
                logReceivedCommand(steamID, message);
                try {
                    var steamIDValidCheck = new steamid(incomingMessage[1]);
                    if (steamIDValidCheck.isValid()) {
                        if (incomingMessage[2] == (temporaryArgs["s_misc_passphrase"])) {
                            logCommandProcessed(steamID, message, "Request proccessed");
                            client.blockUser(steamIDValidCheck.getSteamID64().toString());
                        } else {
                            logCommandNotProcessed(steamID, message, "Invalid remoteControlPassphrase");
                        }
                    } else {
                        logCommandNotProcessed(steamID, message, "Invalid steamID");
                    }
                } catch(io) {
                    return;
                }
                break;
            case "friend.inv": //friend.inv|steamID|groupID
                logReceivedCommand(steamID, message);
                try {
                    if (temporaryArgs["b_cmd_groupinvite"]) {
                        if (incomingMessage[1] == "") {
                            logCommandProcessed(steamID, message, "Request proccessed", function(){ 
                                client.inviteToGroup(steamID, incomingMessage[2].toString());
                            });
                        } else {
                            var steamIDValidCheck = new steamid(incomingMessage[1]);
                            if (steamIDValidCheck.isValid()) {
                                logCommandProcessed(steamID, message, "Request proccessed", function(){
                                    client.inviteToGroup(steamIDValidCheck, incomingMessage[2].toString());
                                });
                            } else {
                                logCommandNotProcessed(steamID, message, "Invalid steamID");
                            }
                        }
                    } else {
                        logCommandNotProcessed(steamID, message, "Feature disabled");
                    }
                } catch(io) {
                    return;
                }
                break;
            case "friend.rmv": //friend.rmv|steamID|remoteControlPassphrase
                logReceivedCommand(steamID, message);
                try {
                    var steamIDValidCheck = new steamid(incomingMessage[1]);
                    if (steamIDValidCheck.isValid()) {
                        if (incomingMessage[2] == (temporaryArgs["s_misc_passphrase"])) {
                            logCommandProcessed(steamID, message, "Request proccessed");
                            client.removeFriend(steamIDValidCheck.getSteamID64().toString());
                        } else {
                            logCommandNotProcessed(steamID, message, "Invalid remoteControlPassphrase");
                        }
                    } else {
                        logCommandNotProcessed(steamID, message, "Invalid steamID");
                    }
                } catch(io) {
                    return;
                }
                break;
            //G
            //H
            //I
            //J
            //K
            //L
            //M
            //N
            //O
            //P
            //R
            //S
            case "self.set.games": //self.set.games|clientGamesPlayedArray|remoteControlPassphrase
                logReceivedCommand(steamID, message);
                try {
                    if (incomingMessage[2] == (temporaryArgs["s_misc_passphrase"])) {
                        var clientGamesPlayedArray = incomingMessage[1].split(',');
                        if (clientGamesPlayedArray == "") {
                            temporaryArgs["i_account_clientgamesplayed"] = [];
                            client.gamesPlayed([]);
                            logCommandProcessed(steamID, message, "Request proccessed", function() {
                                JSONSave();
                            });
                        } else if (clientGamesPlayedArray == "all") {
                            if (appOwnershipIsCached) {
                                temporaryArgs["i_account_clientgamesplayed"] = client.getOwnedApps();
                                client.gamesPlayed(client.getOwnedApps());
                                logCommandProcessed(steamID, message, "Request proccessed", function() {
                                    JSONSave();
                                });
                            } else {
                                logCommandNotProcessed(steamID, message, "App ownership is not cached yet");
                            }
                        } else {
                            for (var key in clientGamesPlayedArray) {
                                if (clientGamesPlayedArray[key].match(/\d{1,6}/)) {
                                    clientGamesPlayedArray[key] = parseInt(clientGamesPlayedArray[key]);
                                } else {
                                    logCommandNotProcessed(steamID, message, "Invalid appID: " + clientGamesPlayedArray[key]);
                                }
                            }
                            if (clientGamesPlayedArray) {
                                temporaryArgs["i_account_clientgamesplayed"] = clientGamesPlayedArray;
                                client.gamesPlayed(clientGamesPlayedArray);
                                logCommandProcessed(steamID, message, "Request proccessed", function() {
                                    JSONSave();
                                });
                            }
                        }
                    } else {
                        logCommandNotProcessed(steamID, message, "Invalid remoteControlPassphrase");
                    }
                } catch(io) {
                    return;
                }
                break;
            //T
            //U
            //V
            //W
            //X
            //Y
            //Z
            //#
            default:
            logCommandNotProcessed(steamID, message, "No such command available");
        }
    } else if (incomingMessage[0].match(/^[\.\/]/) && temporaryArgs["i_use_misc_replymessage"] == 3) {
        client.chatMessage(steamID, message.slice(1));
    } else {
        logReceivedMessage(steamID, message);
        if (temporaryArgs["i_use_misc_replymessage"] == 2 && temporaryArgs["i_account_clientgamesplayed"].length > 0 && steamID != "76561198345603327") {
            client.chatMessage(steamID, temporaryArgs["s_misc_replymessage"]);
        }
        if (urlregex.test(message.toString()) && temporaryArgs["b_misc_friendmessages_rejecturlstring"]) {
            logReceivedEvent(steamID, "friendRelationship.RequestRecipient.Block");
            client.chatMessage(steamID, "Automatically blocked.\nReason: Friend Messages manage mode is: RejectURLString");
            client.removeFriend(steamID);
            client.blockUser(steamID);
        }
    }
});

client.on('friendRelationship', function(steamID, relationship) {
    if (relationship == steamuser.Steam.EFriendRelationship.RequestRecipient) {
        getSenderName(steamID, function(senderName){
            if (urlregex.test(senderName) && temporaryArgs["b_misc_friendrequests_rejecturlname"]) {
                logReceivedEvent(steamID, "friendRelationship.RequestRecipient.Block");
                client.addFriend(steamID, function() {
                    client.chatMessage(steamID, "Friend request auto-rejected.\nReason: Friend Requests manage mode is: RejectURLName");
                    client.removeFriend(steamID);
                    client.blockUser(steamID);
                });
            }
            if (temporaryArgs["i_account_friendrequests"] == 0) {
                logReceivedEvent(steamID, "friendRelationship.RequestRecipient.NoAction");
            }
            if (temporaryArgs["i_account_friendrequests"] == 1) {
                if (temporaryArgs["i_misc_friendrequests_rejectaccountrank"]) {
                    client.getSteamLevels([steamID], function(results) {
                        if (results[steamID.getSteamID64()] >= temporaryArgs["i_misc_friendrequests_rejectaccountrank"]) {
                            logReceivedEvent(steamID, "friendRelationship.RequestRecipient.Accept");
                            logEventProcessed(steamID, "friendRelationship.RequestRecipient.Accept", "Request Accepted");
                            client.addFriend(steamID);
                        } else {
                            logReceivedEvent(steamID, "friendRelationship.RequestRecipient.Reject");
                            client.addFriend(steamID, function() {
                                client.chatMessage(steamID, "Friend request auto-rejected.\nReason: Friend Requests manage mode is: RejectAccountRank[ < " + temporaryArgs["i_misc_friendrequests_rejectaccountrank"] + "]");
                                client.removeFriend(steamID);
                            });
                        }
                    });
                } else {
                    logReceivedEvent(steamID, "friendRelationship.RequestRecipient.Accept");
                    logEventProcessed(steamID, "friendRelationship.RequestRecipient.Accept", "Request Accepted");
                    client.addFriend(steamID);
                }
            }
            if (temporaryArgs["i_account_friendrequests"] == 2) {
                logReceivedEvent(steamID, "friendRelationship.RequestRecipient.Reject");
                logEventProcessed(steamID, "friendRelationship.RequestRecipient.Reject", "Request Rejected");
                client.addFriend(steamID, function() {
                    client.chatMessage(steamID, "Friend request auto-rejected.\nReason: Friend Requests manage mode is: Reject");
                });
                client.removeFriend(steamID);
            }
        });
    }
    if (relationship == steamuser.Steam.EFriendRelationship.Blocked) {
        logReceivedEvent(steamID, "friendRelationship.Blocked");
        logEventProcessed(steamID, "friendRelationship.Blocked");
        client.removeFriend(steamID);
    }
    if (relationship == steamuser.Steam.EFriendRelationship.None) {
        logReceivedEvent(steamID, "friendRelationship.None");
        logEventProcessed(steamID, "friendRelationship.None");
    }
});

client.on('groupRelationship', function(steamID, relationship) {
    if (relationship == steamuser.Steam.EClanRelationship.Invited) {
        if (temporaryArgs["i_account_grouprequests"] == 0) {
            logReceivedEvent(steamID, "groupRelationship.EClanRelationship.NoAction");
        }
        if (temporaryArgs["i_account_grouprequests"] == 1) {
            logReceivedEvent(steamID, "groupRelationship.EClanRelationship.Accept");
            logEventProcessed(steamID, "groupRelationship.EClanRelationship.Accept");
            client.respondToGroupInvite(steamID, true);
        }
        if (temporaryArgs["i_account_grouprequests"] == 2) {
            logReceivedEvent(steamID, "groupRelationship.EClanRelationship.Reject");
            logEventProcessed(steamID, "groupRelationship.EClanRelationship.Reject");
            client.respondToGroupInvite(steamID, false);
        }
    }
    if (relationship == steamuser.Steam.EFriendRelationship.Member) {
        logReceivedEvent(steamID, "friendRelationship.Member");
        logEventProcessed(steamID, "friendRelationship.Member");
    }
    if (relationship == steamuser.Steam.EFriendRelationship.None) {
        logReceivedEvent(steamID, "friendRelationship.None");
        logEventProcessed(steamID, "friendRelationship.None");
    }
    if (relationship == steamuser.Steam.EClanRelationship.Blocked) {
        logReceivedEvent(steamID, "groupRelationship.Blocked");
        logEventProcessed(steamID, "groupRelationship.Blocked");
    }
    if (relationship == steamuser.Steam.EFriendRelationship.Kicked) {
        logReceivedEvent(steamID, "friendRelationship.Kicked");
        logEventProcessed(steamID, "friendRelationship.Kicked");
    }
    if (relationship == steamuser.Steam.EFriendRelationship.KickAcknowledged) {
        logReceivedEvent(steamID, "friendRelationship.KickAcknowledged");
        logEventProcessed(steamID, "friendRelationship.KickAcknowledged");
    }
});

client.on('appOwnershipCached', function() {
    appOwnershipIsCached = true;
});

client.on('loginKey', function(key) {
    temporaryArgs["s_account_loginkey"] = key;
    JSONSave();
});

client.on('error', function(err, eresult) {
    logger.error(err);
});