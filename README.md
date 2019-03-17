# nodejs_steambot
A simple node-steam-user bot
## Features
* Set games for gameplay time idle (up to 32 at once)
* Send commands with passphrase to bot using Steam chat
* Automatic replies, command validation, mirror messages
* Use shared secret key to generate Steam Guard codes
## Features (Planned)
* Manage friend/group invite requests
* Accept friend requests if user's rank is higher than set in config
* Reject friend requests if user's rank is less than set in config
* Reject friend requests if user has URL in name
* Unfriend/Block friends which send URLs in Steam chat

## Getting Started
### Installing
```
git clone https://git.pngamers.org/w7rus/nodejs_steambot.git
```
Now that you downloaded/cloned this project, run installation of required dependencies
```
cd nodejs_steambot
npm install
```
### Configure
There are 3 ways to set options for bot:
1. Append config keys as arguments while executing script
2. Append ``--configure`` argument while executing script
3. Manually edit config file

First one commonly used for automatic bots for deploy (e.g. another script runs this bots script with given launch options).

Second and third, for good handy setup. Config file is: ``instances.json``

#### Config structure
```json
{
    "instance_alias": {
        "key": value[, ...]
    }[, ...]
}
```

#### Config variables
| Variable | Type | Values | Description |
|:-|:-:|:-:|:-|
| instance_username | string | any | Steam account username |
| instance_password | string | any | Steam account password |
| instance_useloginkey | int | 0, 1 | Save login key |
| instance_2fasecret | string | any | Steam account shared secret 2FA key |
| instance_passphrase | string | any | A codeword used for authenticating commands sent through Steam chat |
| instance_usepassphrase | string | any | Disables usage of codeword and commands |
| instance_clientgamesplayed | array type of int | 0 - 999999 | Array of games IDs to idle gameplay time (ex. 730,540,...) |
| instance_replymessage_idle | string | any | Message to send back when receiving message from friend |
| instance_replymessage_gameidle | string | any | Message to send back when receiving message from friend while idling gameplay time |
| instance_usereplymessage | int | bit combinations | 1st - command validation, 2nd - instance_replymessage_idle, 3rd - instance_replymessage_gameidle, 4th - message mirroring |
| instance_friendrequests | int | 0, 1, 2, 3 | 0 - No action, 1 - Accept All, 2 - Reject All, 3 - Auto (using instance_friendrequests_auto) |
| instance_grouprequests | int | 0, 1, 2 | 0 - No action, 1 - Accept All, 2 - Reject All |
| instance_friendrequests_auto | int | bit combinations | 1st - Accept if user's rank is higher than in config, 2nd - Reject if user's rank is less than set in config, 3rd - Reject if user has URL in name |
| instance_friendmessages_url | int | bit combinations| 1st - unfriend, 2nd - Block |


## Usage
Create new instance and configure it
```
node index.js --configure
```
```
node index.js --instance="instance_alias" --configure
```
```
node index.js <SET CONFIG KEYS AS ARGUMENTS HERE (ex. --instance_password="your_password")>
```
```
node index.js --instance="instance_alias" <SET CONFIG KEYS AS ARGUMENTS HERE (ex. --instance_password="your_password")>
```

Use existing instance
```
node index.js
```
```
node index.js --instance="instance_alias"
```