# nodejs_steambot
A Simple bot i made to boost up games playtime, manage friends (autoblock spamming bots) and also invite members to groups using special commands.
## Features

* Use shared secret key to generate Steam Guard App code
* Use login key to login without need for Steam Guard App code
* Set default persona state
* Add games for gameplay time boost (up to 32 at once)
* Set/Use passphase as auth code for account managing commands
* Set/Use auto-reply mode and/or auto-reply message when having gameplay time boost active
* Auto-manage friend requests
* Auto-manage group requests
* Auto-Block friend requests with name that contains URL
* Auto-Block friends with messages received that contains URL
* Decline friend requests if account rank less than given
* Enable/Disable usage of **/friend.inv** command

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
There are two ways to set options for bot:
1. Launch options
2. Edit config file

First one commonly used for automatic bots for deploy (e.g. another script runs this bots script with given launch options).

Second, for good handy setup. Config file can be found at **./configs/instances.json**

#### Config structure
```json
{
    "instance_alias": {
        "variable": value[, ...]
    }[, ...]
}
```

#### Config variables
| Variable | Type | Values | Description |
|:-|:-:|:-:|:-|
| s_account_login | string | any | Account login |
| s_account_password | string | any | Account password |
| s_account_base64secret | string | any | Account shared secret key |
| b_use_account_loginkey | int | 0, 1 | Use account login key (after one successful login) |
| i_account_setpersonastate | int | 0 - 7 | Set persona state on login [EPersonaState](https://github.com/DoctorMcKay/node-steam-user/blob/master/enums/EPersonaState.js)|
| i_account_clientgamesplayed | int array | 0 - 999999 | Set games to boost gameplay time |
| b_use_misc_passphrase | int | 0, 1 | Use passphrase from **s_misc_passphrase** in sensetive commands |
| s_misc_passphrase | string | any | Passphrase to use for auth checks on commands |
| i_use_misc_replymessage | int | 0, 1, 2, 3 | 0 - No action, 1 - Command validation, 2 - Command validation + auto-reply on gameplay time boost with **s_misc_replymessage**, 3 - Message mirror |
| s_misc_replymessage | string | any | Used only when **i_use_misc_replymessage == 2** |
| i_account_friendrequests | int | 0, 1, 2 | 0 - No Action, 1 - Auto-Accept, 2 - Auto-Reject |
| i_account_grouprequests | int | 0, 1, 2 | 0 - No Action, 1 - Auto-Accept, 2 - Auto-Reject |
| b_misc_friendrequests_rejecturlname | int | 0, 1 | Auto-Blocks friend requests with name that countains URL |
| i_misc_friendrequests_rejectaccountrank | int | 0 - ? | Decline friend requests if account rank less than given |
| b_misc_friendmessages_rejecturlstring | int | 0, 1 | Auto-Block friends with messages received that contains URL |
| b_cmd_groupinvite | int | 0, 1 | Enable/Disable usage of **/friend.inv** command |

## Running
To run a bot with required instance
```
node index.js --selectinstance="instance_alias"
```
or using screen
```
screen -S screen_alias node index.js --selectinstance="instance_alias"
```

## Knows issues
* When failing to write correct Steam Guard code first time, second time nothing will happen. Restart the bot and type the code again. _Check line 134 and report if you know how to solve this._