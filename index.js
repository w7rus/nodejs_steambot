var parseargs = require('minimist')
var steamuser = require('steam-user')
var jsonfile = require('jsonfile')
var steamtotp = require('steam-totp')
var inquirer = require('inquirer')
var winston = require('winston')
var steamid = require('steamid')
var crypto = require('crypto')

var fs = require('fs')
if (!fs.existsSync('./data')){
    fs.mkdirSync('./data')
}
if (!fs.existsSync('./logs')){
    fs.mkdirSync('./logs')
}
if (!fs.existsSync('instances.json')){
    fs.writeFile("instances.json", "{}", function(err) {
        if(err) {
            return console.log(err);
        }
    })
}

var logger
var client = new steamuser({
    promptSteamGuardCode: false,
    enablePicsCache: true,
    enablePicsCache: true,
    picsCacheAll: true,
    autoRelogin: true,
    dataDirectory: __dirname + '/data'
})

var steamUser_appOwnershipIsCached = false

var steamUser_messageUrlRegex = new RegExp(/((?:(?:https?|ftp)?:\/\/)?(?:\S+(?::\S*)?@)?(?:(?!10(?:\.\d{1,3}){3})(?!127(?:\.\d{1,3}){3})(?!169\.254(?:\.\d{1,3}){2})(?!192\.168(?:\.\d{1,3}){2})(?!172\.(?:1[6-9]|2\d|3[0-1])(?:\.\d{1,3}){2})(?:[1-9]\d?|1\d\d|2[01]\d|22[0-3])(?:\.(?:1?\d{1,2}|2[0-4]\d|25[0-5])){2}(?:\.(?:[1-9]\d?|1\d\d|2[0-4]\d|25[0-4]))|(?:(?:[a-z\x\u00a1-\uffff0-9]+-?)*[a-z\x\u00a1-\uffff0-9]+)(?:\.(?:[a-z\x\u00a1-\uffff0-9]+-?)*[a-z\x\u00a1-\uffff0-9]+)*(?:\.(?:[a-z\x\u00a1-\uffff]{2,})))(?::\d{2,5})?(?:\/[^\s]*)?)/igm)

var script_messages = Object.freeze({
    instance_missing_key_critical: function(str) {
        return 'Key(s) ' + str + ' are not present in a chosen instance configuration! Append --configure launch argument to execute instance setup.'
    },
    instance_missing_key: function(str) {
        return 'Key(s) ' + str + ' are not present in a chosen instance configuration!'
    },
    script_stage_completion: function(a, b, str) {
        return '[' + a + '/' + b + '] ' + str
    },
    instance_empty_key: function(str) {
        return 'Key(s) ' + str + ' are empty in a chosen instance configuration!'
    }
})
var instance_usereplymessage_enums = Object.freeze({
    "command_validation": 1,
    "mode_idle": 2,
    "mode_gameidle": 3,
    "mode_mirror": 4
})
var instance_friendrequests_auto_enums = Object.freeze({
    "accept_rank": 1,
    "reject_rank": 2,
    "reject_name": 3,
})
var instance_friendmessages_url_enums = Object.freeze({
    "unfriend": 1,
    "block": 2,
})

var questions = [
    {
        type: 'input',
        name: 'instance_username',
        message: 'Steam username:'
    },
    {
        type: 'password',
        name: 'instance_password',
        message: 'Steam password:',
        mask: '*',
        validate: function(answer) {
            if (answer.length < 8) return 'Password length must be not less than 8 symbols!'
            return true
        }
    },
    {
        type: 'list',
        name: 'instance_useloginkey',
        message: 'Remember password?',
        choices: ['No', 'Yes'],
        filter: function(val) {
            return (val.toLowerCase() == 'no') ? 0 : 1
        }
    },
    {
        type: 'password',
        name: 'instance_2fasecret',
        message: 'Steam 2FA secret:',
        mask: '*',
        default: ''
    },
    {
        type: 'password',
        name: 'instance_passphrase',
        message: 'Set chat passphrase:',
        mask: '*',
        default: Math.random().toString(36).slice(-8),
        validate: function(answer) {
            if (answer.length < 8 && answer.length > 0) return 'Passphrase length must be not less than 8 symbols!'
            return true
        }
    },
    {
        type: 'list',
        name: 'instance_usepassphrase',
        message: 'Use chat passphrase?',
        choices: ['No', 'Yes'],
        filter: function(val) {
            return (val.toLowerCase() == 'no') ? 0 : 1
        }
    },
    {
        type: 'input',
        name: 'instance_clientgamesplayed',
        message: 'An array of gameIDs, comma separated:',
        default: [],
        filter: function(answer) {
            var answerResultArray = []
            if (answer == "") return answerResultArray
            var answerArray = answer.split(',')
            if (answerArray == "all" && steamUser_appOwnershipIsCached) {
                answerResultArray = client.getOwnedApps()
            } else {
                for (var key in answerArray) {
                    if (/\d{1,6}/.test(answerArray[key])) {
                        answerResultArray.push(parseInt(answerArray[key]))
                    }
                }
            }
            return answerResultArray
        }
    },
    {
        type: 'input',
        name: 'instance_replymessage_idle',
        message: 'Set Idle mode chat reply',
        default: 'Undefined Idle reply message.'
    },
    {
        type: 'input',
        name: 'instance_replymessage_gameidle',
        message: 'Set Gameidle mode chat reply',
        default: 'Undefined Gameidle reply message.'
    },
    {
        type: 'checkbox',
        name: 'instance_usereplymessage',
        message: 'Use replymessage?',
        choices: [{
                name: 'Command validation'
            },
            {
                name: 'Idle mode'
            },
            {
                name: 'Game idle mode'
            },
            {
                name: 'Mirror mode'
            },
        ],
        filter: function(answer) {
            var answerResultValue = 0
            for (var key in answer) {
                switch (answer[key]) {
                    case 'Command validation':
                        answerResultValue = answerResultValue | (1 << instance_usereplymessage_enums.command_validation - 1)
                        break;
                    case 'Idle mode':
                        answerResultValue = answerResultValue | (1 << instance_usereplymessage_enums.mode_idle - 1)
                        break;
                    case 'Gameidle mode':
                        answerResultValue = answerResultValue | (1 << instance_usereplymessage_enums.mode_gameidle - 1)
                        break;
                    case 'Mirror mode':
                        answerResultValue = answerResultValue | (1 << instance_usereplymessage_enums.mode_mirror - 1)
                        break;
                    default:
                        break;
                }
            }
            return answerResultValue
        }
    },
    {
        type: 'list',
        name: 'instance_friendrequests',
        message: 'How to deal with incoming friend requests?',
        choices: ['No action', 'Accept All', 'Reject All', 'Auto'],
        filter: function(val) {
            switch (val.toLowerCase()) {
                case 'no action':
                    return 0
                    break;
                case 'accept all':
                    return 1
                    break;
                case 'reject all':
                    return 2
                    break;
                case 'auto':
                    return 3
                    break;
                default:
                    break;
            }
        }
    },
    {
        type: 'list',
        name: 'instance_grouprequests',
        message: 'How to deal with incoming group requests?',
        choices: ['No action', 'Accept All', 'Reject All', 'Auto'],
        filter: function(val) {
            switch (val.toLowerCase()) {
                case 'no action':
                    return 0
                    break;
                case 'accept all':
                    return 1
                    break;
                case 'reject all':
                    return 2
                    break;
                case 'auto':
                    return 3
                    break;
                default:
                    break;
            }
        }
    },
    {
        type: 'checkbox',
        name: 'instance_friendrequests_auto',
        message: 'Ruleset for automating incoming friend requests:',
        choices: [
            {
                name: 'Accept (X:rank > ..._autoaccept_rank)'
            },
            {
                name: 'Reject (X:rank < ..._autoreject_rank)'
            },
            {
                name: 'Reject (X:name == URL)'
            },
        ],
        filter: function(answer) {
            var answerResultValue = 0
            for (var key in answer) {
                switch (answer[key]) {
                    case 'Accept (X:rank > ..._autoaccept_rank)':
                        answerResultValue = answerResultValue | (1 << instance_friendrequests_auto_enums.accept_rank - 1)
                        break;
                    case 'Reject (X:rank < ..._autoreject_rank)':
                        answerResultValue = answerResultValue | (1 << instance_friendrequests_auto_enums.reject_rank - 1)
                        break;
                    case 'Reject (X:name == URL)':
                        answerResultValue = answerResultValue | (1 << instance_friendrequests_auto_enums.reject_name - 1)
                        break;
                    default:
                        break;
                }
            }
            return answerResultValue
        }
    },
    {
        type: 'input',
        name: 'instance_autoaccept_rank',
        message: 'Set friend requests autoaccept rank:',
        mask: '*',
        default: 10,
        filter: function(val) {
            return parseInt(val)
        }
    },
    {
        type: 'input',
        name: 'instance_autoreject_rank',
        message: 'Set friend requests autoreject rank:',
        mask: '*',
        default: 10,
        filter: function(val) {
            return parseInt(val)
        }
    },
    {
        type: 'checkbox',
        name: 'instance_friendmessages_url',
        message: 'How to deal with friends sending links in chat?',
        choices: [
            {
                name: 'Unfriend'
            },
            {
                name: 'Block'
            }
        ],
        filter: function(answer) {
            var answerResultValue = 0
            for (var key in answer) {
                switch (answer[key]) {
                    case 'Unfriend':
                        answerResultValue = answerResultValue | (1 << instance_friendmessages_url_enums.unfriend - 1)
                        break;
                    case 'Block':
                        answerResultValue = answerResultValue | (1 << instance_friendmessages_url_enums.block - 1)
                        break;
                    default:
                        break;
                }
            }
            return answerResultValue
        }
    },
]

function main() {
    var lConfig = parseargs(process.argv.slice(2))
    var gConfig = {}
    var iConfig = {}
    var iConfigTemplate = {
        instance_username: "",
        instance_password: "",
        instance_useloginkey: 0,
        instance_2fasecret: "",
        instance_passphrase: "",
        instance_usepassphrase: 0,
        instance_clientgamesplayed: [],
        instance_replymessage_idle: "",
        instance_replymessage_gameidle: "",
        instance_usereplymessage: 3,
        instance_friendrequests: 0,
        instance_grouprequests: 0,
        instance_friendrequests_auto: 0,
        instance_autoaccept_rank: 0,
        instance_autoreject_rank: 0,
        instance_friendmessages_url: 0,
        key: {},
        instance_loginkey: ""
    }
    var iConfigAlias = lConfig['instance']
    var iConfigEdit = lConfig.hasOwnProperty('configure')

    function get_iConfig(L_gConfig, L_lConfig, L_iConfigAlias, L_iConfigEdit, callback) {
        var L_iConfig = {}

        function defineConfigAlias(callback) {
            if (L_iConfigAlias == undefined) {
                inquirer.prompt([{
                    type: 'input',
                    name: 'instance_alias',
                    message: 'Instance alias:'
                }]).then(answers => {
                    L_iConfigAlias = answers['instance_alias']
                    callback(L_iConfigAlias)
                })
            } else {
                callback(L_iConfigAlias)
            }
        }

        function isConfigDefined(callback_1, callback_2, L_iConfigAlias_) {
            if (L_gConfig.hasOwnProperty(L_iConfigAlias_)) {
                callback_1()
            } else {
                callback_2()
            }
        }

        function isConfigNeedsConfiguration(callback_1, callback_2) {
            if (L_iConfigEdit) {
                callback_1()
            } else {
                callback_2()
            }
        }

        defineConfigAlias(function(L_iConfigAlias__) {
            isConfigDefined(
                function() { // If there is an object with key L_iConfigAlias__
                    isConfigNeedsConfiguration(
                        function() {
                            L_iConfig = {}
                            inquirer.prompt(questions).then(answers => {
                                L_iConfig = answers

                                for (var key in L_iConfig) {
                                    if (L_lConfig.hasOwnProperty(key)) {
                                        L_iConfig[key] = L_lConfig[key]
                                    }
                                }

                                var L_iConfig_keysToCrypt = [
                                    'instance_password',
                                    'instance_2fasecret'
                                ]
    
                                if (L_iConfig['key'] == undefined) {
                                    L_iConfig['key'] = crypto.randomBytes(32)
                                }
    
                                for (var key in L_iConfig_keysToCrypt) {
                                    if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' || typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'object') {
                                        if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' && L_iConfig[L_iConfig_keysToCrypt[key]].length > 0) {
                                            encrypt(L_iConfig[L_iConfig_keysToCrypt[key]], L_iConfig['key'], crypto.randomBytes(16), function(encoded_str) {
                                                L_iConfig[L_iConfig_keysToCrypt[key]] = encoded_str
                                            })
                                        }
                                    } else {
                                        console.log(script_messages.instance_missing_key_critical('instance_password, instance_2fasecret'))
                                        process.exit(9);
                                    }
                                }
    
                                callback(L_iConfig, L_iConfigAlias__)
                            })
                        },
                        function() {
                            L_iConfig = iConfigTemplate

                            for (var key in L_iConfig) {
                                L_iConfig[key] = L_gConfig[L_iConfigAlias__][key]
                                if (L_lConfig.hasOwnProperty(key)) {
                                    L_iConfig[key] = L_lConfig[key]
                                }
                            }

                            var L_iConfig_keysToCrypt = [
                                'instance_password',
                                'instance_2fasecret'
                            ]

                            if (L_iConfig['key'] == undefined) {
                                L_iConfig['key'] = crypto.randomBytes(32)
                            }

                            for (var key in L_iConfig_keysToCrypt) {
                                if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' || typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'object') {
                                    if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' && L_iConfig[L_iConfig_keysToCrypt[key]].length > 0) {
                                        encrypt(L_iConfig[L_iConfig_keysToCrypt[key]], L_iConfig['key'], crypto.randomBytes(16), function(encoded_str) {
                                            L_iConfig[L_iConfig_keysToCrypt[key]] = encoded_str
                                        })
                                    }
                                } else {
                                    console.log(script_messages.instance_missing_key_critical('instance_password, instance_2fasecret'))
                                    process.exit(9);
                                }
                            }

                            callback(L_iConfig, L_iConfigAlias__)
                        }
                    )
                },
                function() { // If there is no object with key L_iConfigAlias__
                    isConfigNeedsConfiguration(
                        function() {
                            L_iConfig = {}
                            inquirer.prompt(questions).then(answers => {
                                L_iConfig = answers

                                for (var key in L_iConfig) {
                                    if (L_lConfig.hasOwnProperty(key)) {
                                        L_iConfig[key] = L_lConfig[key]
                                    }
                                }

                                var L_iConfig_keysToCrypt = [
                                    'instance_password',
                                    'instance_2fasecret'
                                ]

                                if (L_iConfig['key'] == undefined) {
                                    L_iConfig['key'] = crypto.randomBytes(32)
                                }
    
                                for (var key in L_iConfig_keysToCrypt) {
                                    if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' || typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'object') {
                                        if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' && L_iConfig[L_iConfig_keysToCrypt[key]].length > 0) {
                                            encrypt(L_iConfig[L_iConfig_keysToCrypt[key]], L_iConfig['key'], crypto.randomBytes(16), function(encoded_str) {
                                                L_iConfig[L_iConfig_keysToCrypt[key]] = encoded_str
                                            })
                                        }
                                    } else {
                                        console.log(script_messages.instance_missing_key_critical('instance_password, instance_2fasecret'))
                                        process.exit(9);
                                    }
                                }
    
                                callback(L_iConfig, L_iConfigAlias__)
                            })
                        },
                        function() {
                            L_iConfig = iConfigTemplate

                            for (var key in L_iConfig) {
                                if (L_lConfig.hasOwnProperty(key)) {
                                    L_iConfig[key] = L_lConfig[key]
                                }
                            }

                            var L_iConfig_keysToCrypt = [
                                'instance_password',
                                'instance_2fasecret'
                            ]

                            if (L_iConfig['key'] == undefined) {
                                L_iConfig['key'] = crypto.randomBytes(32)
                            }

                            for (var key in L_iConfig_keysToCrypt) {
                                if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' || typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'object') {
                                    if (typeof(L_iConfig[L_iConfig_keysToCrypt[key]]) == 'string' && L_iConfig[L_iConfig_keysToCrypt[key]].length > 0) {
                                        encrypt(L_iConfig[L_iConfig_keysToCrypt[key]], L_iConfig['key'], crypto.randomBytes(16), function(encoded_str) {
                                            L_iConfig[L_iConfig_keysToCrypt[key]] = encoded_str
                                        })
                                    }
                                } else {
                                    console.log(script_messages.instance_missing_key_critical('instance_password, instance_2fasecret'))
                                    process.exit(9);
                                }
                            }

                            callback(L_iConfig, L_iConfigAlias__)
                        }
                    )
                },
                L_iConfigAlias__
            )
        })
    }

    function steamUser_SignIn(L_iConfig, callback) {
        if (L_iConfig.hasOwnProperty('instance_username') && L_iConfig.hasOwnProperty('instance_password')) {
            if (L_iConfig.hasOwnProperty('instance_loginkey') && L_iConfig['instance_useloginkey']) {
                logger.info('Use instance_loginkey')
                decrypt(L_iConfig['instance_password'], L_iConfig['key'], function(decrypted_str) {
                    if (L_iConfig['instance_username'] < 1) {
                        logger.warn(script_messages.instance_empty_key('instance_username'))
                    }
                    if (decrypted_str.length < 1) {
                        logger.warn(script_messages.instance_empty_key('instance_password'))
                    }
                    client.logOn({
                        accountName: L_iConfig['instance_username'],
                        password: decrypted_str,
                        rememberPassword: L_iConfig['instance_useloginkey'],
                        loginKey: L_iConfig['instance_loginkey']
                    })
                    if (callback) {
                        callback()
                    }
                })
            } else {
                logger.warn(script_messages.instance_missing_key('instance_loginkey'))
                decrypt(L_iConfig['instance_password'], L_iConfig['key'], function(decrypted_str) {
                    if (L_iConfig['instance_username'] < 1) {
                        logger.warn(script_messages.instance_empty_key('instance_username'))
                    }
                    if (decrypted_str.length < 1) {
                        logger.warn(script_messages.instance_empty_key('instance_password'))
                    }
                    client.logOn({
                        accountName: L_iConfig['instance_username'],
                        password: decrypted_str,
                        rememberPassword: L_iConfig['instance_useloginkey']
                    })
                    if (callback) {
                        callback()
                    }
                })
            }
        } else {
            logger.error(script_messages.instance_missing_key_critical('instance_username, instance_password'))
            process.exit(9);
        }
    }

    console.log(script_messages.script_stage_completion(1, 5, 'Read configuration file...'))
    JSONreadFile(function(R_gConfig) {
        gConfig = R_gConfig
        console.log(script_messages.script_stage_completion(2, 5, 'Get instance configuration...'))
        get_iConfig(gConfig, lConfig, iConfigAlias, iConfigEdit, function(R_iConfig, R_iConfigAlias) {
            iConfig = R_iConfig
            iConfigAlias = R_iConfigAlias
            console.log(script_messages.script_stage_completion(3, 5, 'Save configuration file...'))
            JSONsaveFile(gConfig, iConfig, iConfigAlias, function() {
                console.log(script_messages.script_stage_completion(4, 5, 'Add log output...'))
                logger = new(winston.Logger)({
                    transports: [new(winston.transports.Console)({
                        colorize: true,
                        level: 'info'
                    }), new(winston.transports.File)({
                        level: 'info',
                        timestamp: true,
                        colorize: false,
                        filename: __dirname + '/logs/' + iConfigAlias + '.log',
                        json: false
                    })]
                })
                console.log(script_messages.script_stage_completion(5, 5, 'Sign in Steam...'))
                steamUser_SignIn(iConfig, function() {

                    function steamUser_getSenderName(steamID, callback) {
                        var sender, senderName
                        client.getPersonas([steamID], function(personas) {
                            sender = personas[steamID.getSteamID64()]
                            senderName = sender ? sender.player_name : ("[" + steamID.getSteamID64() + "]")
                            if (callback) callback(senderName)
                        })
                    }

                    function logger_logIncomingMessage(steamID, message) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Incoming message from [" + senderName + "][" + steamID + "]: " + message)
                        })
                    }

                    function logger_logIncomingCommand(steamID, message) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Incoming command from [" + senderName + "][" + steamID + "]: " + message)
                        })
                    }

                    function logger_logIncomingEvent(steamID, type) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Incoming event from [" + senderName + "][" + steamID + "] [" + type + "]")
                        })
                    }

                    function logger_logCommandSuccess(steamID, message, reply, callback) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Successfully processed command from [" + senderName + "][" + steamID + "]: " + message)
                        })
                        if (((iConfig['instance_usereplymessage'] >> instance_usereplymessage_enums.command_validation - 1) & 1) && reply) client.chatMessage(steamID, reply)
                        if (callback) callback()
                    }

                    function logger_logCommandFail(steamID, message, reply, callback) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Failed to process command from [" + senderName + "][" + steamID + "]: " + message)
                        })
                        if (((iConfig['instance_usereplymessage'] >> instance_usereplymessage_enums.command_validation - 1) & 1) && reply) client.chatMessage(steamID, reply)
                        if (callback) callback()
                    }

                    function logger_logCommandUnknown(steamID, message, reply, callback) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Unknown command from [" + senderName + "][" + steamID + "]: " + message)
                        })
                        if (((iConfig['instance_usereplymessage'] >> instance_usereplymessage_enums.command_validation - 1) & 1) && reply) client.chatMessage(steamID, reply)
                        if (callback) callback()
                    }

                    function logger_logEventSuccess(steamID, reason, callback) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Successfully processed event from [" + senderName + "][" + steamID + "]: " + reason)
                        })
                        if (callback) callback()
                    }

                    function logger_logEventFail(steamID, reason, callback) {
                        steamUser_getSenderName(steamID, function(senderName) {
                            logger.info("Failed to process event from [" + senderName + "][" + steamID + "]: " + reason)
                        })
                        if (callback) callback()
                    }

                    client.on('steamGuard', function(domain, callback, lastCodeWrong) {
                        if (iConfig.hasOwnProperty('instance_2fasecret') && (!lastCodeWrong)) {
                            if (typeof(iConfig['instance_2fasecret']) == 'object') {
                                decrypt(iConfig['instance_2fasecret'], iConfig['key'], function(decrypted_str) {
                                    if (decrypted_str.length > 0) {
                                        logger.info('Use instance_2fasecret')
                                        callback(steamtotp.generateAuthCode(decrypted_str))
                                    } else {
                                        logger.warn(script_messages.instance_empty_key('instance_2fasecret'))
                                    }
                                })
                            } else {
                                logger.warn(script_messages.instance_missing_key('instance_2fasecret'))
                            }
                        } else {
                            logger.warn(script_messages.instance_missing_key('instance_2fasecret'))
                        }

                        if (lastCodeWrong) logger.warn('Last Steam Guard Code you have entered was incorrect, try again!')
                        inquirer.prompt([{
                            type: 'input',
                            name: 'instance_authcode',
                            message: 'Steam Guard ' + (!domain ? 'App ' : '') + 'code:'
                        }]).then(answers => {
                            callback(answers['instance_authcode'])
                        })
                    })

                    client.on('loggedOn', function() {
                        logger.info('Logged on Steam!')
                        client.setPersona(1)
                        client.setUIMode(3)
                        client.gamesPlayed(iConfig['instance_clientgamesplayed'])
                    })

                    client.on('loginKey', function(key) {
                        logger.info('Save instance_loginkey')
                        iConfig['instance_loginkey'] = key
                        JSONsaveFile(gConfig, iConfig, iConfigAlias)
                    })

                    client.on('appOwnershipCached', function() {
                        steamUser_appOwnershipIsCached = true
                    })

                    client.on('friendMessage', function(steamID, message) {
                        var incMsg = message.split("|")

                        if (incMsg[0].match(/^[\/]/) && iConfig['instance_usepassphrase']) {
                            switch (incMsg[0].slice(1)) {
                                case 'friend.add': //friend.add|steamID|instance_passphrase
                                    logger_logIncomingCommand(steamID, message)
                                    try {
                                        var L_steamID = new steamid(incMsg[1])
                                        if (L_steamID.isValid()) {
                                            if (incMsg[2] == iConfig['instance_passphrase']) {
                                                logger_logCommandSuccess(steamID, message, 'Request processed!')
                                                client.addFriend(steamIDValidCheck.getSteamID64().toString())
                                            } else {
                                                logger_logCommandFail(steamID, message, 'Incorrect passphrase!')
                                            }
                                        } else {
                                            logger_logCommandFail(steamID, message, 'Incorrect steamID!')
                                        }
                                    } catch (io) {
                                        return
                                    }
                                    break;

                                case 'friend.blk': //friend.blk|steamID32|instance_passphrase
                                    logger_logIncomingCommand(steamID, message)
                                    try {
                                        var L_steamID = new steamid(incMsg[1])
                                        if (L_steamID.isValid()) {
                                            if (incMsg[2] == iConfig['instance_passphrase']) {
                                                logger_logCommandSuccess(steamID, message, 'Request processed!')
                                                client.blockUser(steamIDValidCheck.getSteamID64().toString())
                                            } else {
                                                logger_logCommandFail(steamID, message, 'Incorrect passphrase!')
                                            }
                                        } else {
                                            logger_logCommandFail(steamID, message, 'Incorrect steamID64!')
                                        }
                                    } catch (io) {
                                        return
                                    }
                                    break;

                                case 'friend.rmv': //friend.rmv|steamID32|instance_passphrase
                                    logger_logIncomingCommand(steamID, message)
                                    try {
                                        var L_steamID = new steamid(incMsg[1])
                                        if (L_steamID.isValid()) {
                                            if (incMsg[2] == iConfig['instance_passphrase']) {
                                                logger_logCommandSuccess(steamID, message, 'Request processed!')
                                                client.removeFriend(steamIDValidCheck.getSteamID64().toString())
                                            } else {
                                                logger_logCommandFail(steamID, message, 'Incorrect passphrase!')
                                            }
                                        } else {
                                            logger_logCommandFail(steamID, message, 'Incorrect steamID64!')
                                        }
                                    } catch (io) {
                                        return
                                    }
                                    break;

                                case 'client.set.gamesPlayed': //client.set.gamesPlayed|clientGamesPlayedArray|instance_passphrase
                                    logger_logIncomingCommand(steamID, message)
                                    try {
                                        if (incMsg[2] == iConfig['instance_passphrase']) {
                                            var L_gamesPlayedResultArray = []
                                            var L_gamesPlayedArray = incMsg[1].split(',')
                                            if (L_gamesPlayedArray == "") {
                                                logger_logCommandSuccess(steamID, message, 'Request processed!')
                                                iConfig['instance_clientgamesplayed'] = L_gamesPlayedResultArray
                                                JSONsaveFile(gConfig, iConfig, iConfigAlias)
                                                client.gamesPlayed(L_gamesPlayedResultArray)
                                            } else {
                                                if (steamUser_appOwnershipIsCached) {
                                                    if (L_gamesPlayedArray == "all") {
                                                        logger_logCommandSuccess(steamID, message, 'Request processed!', function() {
                                                            L_gamesPlayedResultArray = client.getOwnedApps()
                                                        })
                                                    } else {
                                                        logger_logCommandSuccess(steamID, message, 'Request processed!', function() {
                                                            for (var key in L_gamesPlayedArray) {
                                                                if (/\d{1,6}/.test(L_gamesPlayedArray[key])) {
                                                                    L_gamesPlayedResultArray.push(parseInt(L_gamesPlayedArray[key]))
                                                                }
                                                            }
                                                        })
                                                    }
                                                    iConfig['instance_clientgamesplayed'] = L_gamesPlayedResultArray
                                                    JSONsaveFile(gConfig, iConfig, iConfigAlias)
                                                    client.gamesPlayed(L_gamesPlayedResultArray)
                                                } else {
                                                    logger_logCommandFail(steamID, message, 'Client apps are not cached yet!')
                                                }
                                            }
                                        } else {
                                            logger_logCommandFail(steamID, message, 'Incorrect passphrase!')
                                        }
                                    } catch (io) {
                                        return
                                    }
                                    break;

                                default:
                                    logger_logCommandUnknown(steamID, message, 'Unknown command!')
                                    break;
                            }
                        } else if (incMsg[0].match(/^[\.]/) && ((iConfig['instance_usereplymessage'] >> instance_usereplymessage_enums.mode_mirror - 1) & 1)) {
                            client.chatMessage(steamID, message.slice(1))
                        } else {
                            logger_logIncomingMessage(steamID, message)
                            if (((iConfig['instance_usereplymessage'] >> instance_usereplymessage_enums.mode_gameidle - 1) & 1) && iConfig['instance_clientgamesplayed'].length > 0) {
                                client.chatMessage(steamID, iConfig['instance_replymessage_gameidle'])
                            } else if (((iConfig['instance_usereplymessage'] >> instance_usereplymessage_enums.mode_idle - 1) & 1) && iConfig['instance_clientgamesplayed'].length == 0) {
                                client.chatMessage(steamID, iConfig['instance_replymessage_idle'])
                            }

                            if (steamUser_messageUrlRegex.test(message) && iConfig['instance_friendmessages_url'] > 0) {
                                if ((iConfig['instance_friendmessages_url'] >> instance_friendmessages_url_enums.unfriend - 1) & 1) {
                                    client.removeFriend(steamID);
                                }
                                if ((iConfig['instance_friendmessages_url'] >> instance_friendmessages_url_enums.block - 1) & 1) {
                                    client.blockUser(steamID);
                                }
                                if (((iConfig['instance_friendmessages_url'] >> instance_friendmessages_url_enums.unfriend - 1) & 1) && (((iConfig['instance_friendmessages_url'] >> instance_friendmessages_url_enums.block - 1) & 1))) {
                                    client.blockUser(steamID);
                                    client.removeFriend(steamID);
                                }
                            }
                        }
                    })

                    client.on('friendRelationship', function(steamID, relationship) {
                        if (relationship == steamuser.Steam.EFriendRelationship.RequestRecipient) {
                            logger_logIncomingEvent(steamID, 'RequestRecipient')
                            if (iConfig['instance_friendrequests'] > 0) {
                                switch (iConfig['instance_friendrequests']) {
                                    case 1:
                                        logger_logEventSuccess(steamID, "Accepting any friend requests.")
                                        client.addFriend(steamID)
                                        break;
                                    case 2:
                                        logger_logEventFail(steamID, "Rejecting any friend requests.")
                                        client.addFriend(steamID)
                                        client.removeFriend(steamID)
                                        break;
                                    case 3:
                                        if (iConfig['instance_friendrequests_auto'] > 0) {
                                            if ((iConfig['instance_friendrequests_auto'] >> instance_friendrequests_auto_enums.accept_rank - 1) & 1) {
                                                client.getSteamLevels([steamID], function(results) {
                                                    if (results[steamID.getSteamID64()] > instance_autoaccept_rank) {
                                                        logger_logEventSuccess(steamID, "Accepting friend requests with Steam profile level > " + instance_autoaccept_rank)
                                                        client.addFriend(steamID)
                                                    }
                                                })
                                            }
                                            if ((iConfig['instance_friendrequests_auto'] >> instance_friendrequests_auto_enums.reject_rank - 1) & 1) {
                                                client.getSteamLevels([steamID], function(results) {
                                                    if (results[steamID.getSteamID64()] < instance_autoreject_rank) {
                                                        logger_logEventSuccess(steamID, "Rejecting friend requests with Steam profile level < " + instance_autoreject_rank)
                                                        client.addFriend(steamID)
                                                        client.removeFriend(steamID)
                                                    }
                                                })
                                            }
                                            if ((iConfig['instance_friendrequests_auto'] >> instance_friendrequests_auto_enums.reject_name - 1) & 1) {
                                                steamUser_getSenderName(steamID, function(senderName) {
                                                    if (steamUser_messageUrlRegex.test(senderName)) {
                                                        logger_logEventSuccess(steamID, "Rejecting friend requests if Steam profile name contains an URL")
                                                        client.addFriend(steamID)
                                                        client.removeFriend(steamID)
                                                    }
                                                })
                                            }
                                        }
                                        break;
                                
                                    default:
                                        break;
                                }
                            }
                        }
                        if (relationship == steamuser.Steam.EFriendRelationship.Blocked) {
                            logger_logIncomingEvent(steamID, 'Blocked')
                        }
                        if (relationship == steamuser.Steam.EFriendRelationship.None) {
                            logger_logIncomingEvent(steamID, 'None')
                        }
                    })

                    client.on('error', function(err, eresult) {
                        logger.error(err.message)
                    })
                })
            })
        })
    })
}

function JSONsaveFile(L_gConfig, L_iConfig, L_iConfigAlias, callback) {
    L_gConfig[L_iConfigAlias] = L_iConfig
    var file = __dirname + '/instances.json'
    jsonfile.writeFile(file, L_gConfig, {
        spaces: 4,
        EOL: '\r\n'
    }, function(err) {
        if (err) console.error(err)
        if (callback) callback()
    })
}

function JSONreadFile(callback) {
    var file = __dirname + '/instances.json'
    jsonfile.readFile(file, function(err, obj) {
        if (err) console.error(err)
        callback(obj)
    })
}

function encrypt(text, key, iv, callback) {
    let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(key), iv)
    let encrypted = cipher.update(text)
    encrypted = Buffer.concat([encrypted, cipher.final()])
    callback({
        iv: iv.toString('hex'),
        encryptedData: encrypted.toString('hex')
    })
}

function decrypt(text, key, callback) {
    let iv = Buffer.from(text.iv, 'hex')
    let encryptedText = Buffer.from(text.encryptedData, 'hex')
    let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key), iv)
    let decrypted = decipher.update(encryptedText)
    decrypted = Buffer.concat([decrypted, decipher.final()])
    callback(decrypted.toString())
}

main()