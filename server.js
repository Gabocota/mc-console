var spawn = require('child_process').spawn;

var path = require('path');

const fs = require('fs');

const multer = require('multer');


var lastResponse = new Date().getTime()
var minecraftServerProcess;

var cache = []

var allowed = ['PASTE_YOUR_DISCORD_USER_ID_HERE']

var highestAdmin = 'PASTE_YOUR_DISCORD_USER_ID_HERE'

const webServerDir = "/var/www/main/" //paste where the website is stored from /

var keys = []

var oldKeys = []

const keyLen = 30

const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$^%&()-+=;"\',.?[]{}';

const keyDuration = 300

const commandLogFile = "./command-log.json"

const disToken = "PASTE_YOUR_DISCORD_BOT_TOKEN_HERE"

const website = "https://gabocota.net/" //put where the site is stored here (include / at the end)

if (!fs.existsSync(commandLogFile)) {
    fs.writeFileSync(commandLogFile, "[]", 'utf-8');
    console.log(`File '${commandLogFile}' created.`);
}

function readJson(filePath) {
    const jsonData = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(jsonData);
}

function writeJson(data, filePath) {
    var jsonData = JSON.stringify(data, null, 2);
    fs.writeFileSync(filePath, jsonData, 'utf-8');
}

function checkKeyMatch(target) {
    if (typeof target === 'string') {
        target = target.trim();
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].value === target) {
                return true;
            }
        }
    }
    return false;
}

function getKeyN(target) {
    target = target.trim()
    for (var i = 0; i < keys.length; i++) {
        if (keys[i].value === target) {
            return i
        }
    }
    return -1
}

function removeDoubleDotSegments(inputString) {
    return inputString.replace(/(\.\.\/)/g, '');
}

function writeOldKeys() {
    let output = "Expired Keys:\n----------------\n"
    for (let i = 0; i < oldKeys.length; i++) {
        output += "Value: " + oldKeys[i].value + "\n"
        output += "Creator: " + oldKeys[i].owner + "\n"
        output += "Created: " + new Date(oldKeys[i].epoch) + "\n"
        output += '----------------\n'
    }
    fs.writeFile(webServerDir + 'mc-console/oldkeys/oldkeys.txt', output, err => {
        if (err) {
            console.error(err);
        }
    });
}

function genKey(creator, atem) {
    var result = ""
    for (let i = 0; i < keyLen; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    var key = {
        'owner': creator,
        'epoch': new Date().getTime(),
        'value': result
    }
    console.log(key)
    keys.push(key)
    if (!atem) {
        setTimeout(function () {
            let value = key.value
            for (let i = 0; i < keys.length; i++) {
                if (keys[i].value == value) {
                    oldKeys.push(keys[i])
                    keys.splice(i, 1)
                    writeOldKeys()
                }
            }
        }, keyDuration * 1000)
    }
    return key
}

function log(data) {
    cache.push(data.toString())
}

function startMinecraftServer() {
    minecraftServerProcess = spawn('java', [
        '-Xmx10G',
        '-Xms10G',
        '-jar',
        'server.jar',
        'nogui'
    ], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe']
    });

    minecraftServerProcess.unref();

    minecraftServerProcess.on('error', function (err) {
        console.error('Failed to start Minecraft server:', err);
    });

    minecraftServerProcess.stdout.on('data', log);
}


var app = require('express')();
app.use(require('body-parser').json());
app.use(require('body-parser').urlencoded({
    extended: false
}));

app.get('/mc-console/', (req, res) => {
    if (new Date().getTime() > lastResponse + 50) {
        lastResponse = new Date().getTime()
        res.sendFile(path.join(webServerDir + 'mc-console', 'index.html'));
    }
});

app.get('/mc-console/oldkeys', (req, res) => {
    if (new Date().getTime() > lastResponse + 50) {
        lastResponse = new Date().getTime()
        res.sendFile(path.join(webServerDir + 'mc-console/oldkeys/', 'oldkeys.txt'));
    }
});

app.post('/mc-console/api', function (req, res) {
    if (new Date().getTime() > lastResponse + 50) {
        lastResponse = new Date().getTime()
        if (checkKeyMatch(req.body.key)) {
            if (cache.length > 10000) {
                cache = cache.slice(-6000)
                cache[0] = "Trimmed for performance reasons. Check the logs."
            }
            if (req.body.log) {
                if (req.body.command == "loadUp") {
                    res.json({
                        "status": "success",
                        "data": cache
                    })
                } else {
                    res.json({
                        "status": "success",
                        "data": cache.slice(-100)
                    })
                }
            } else {
                if (req.body.command == 'start') {
                    if (minecraftServerProcess != undefined) {
                        try {
                            minecraftServerProcess.stdin.write('say i\n')
                            setTimeout(function () {
                                try {
                                    var lastLine = cache[cache.length - 1]
                                    lastLine = lastLine.split("[Server]")[1].trim()
                                    if (lastLine != "i") {
                                        try {
                                            startMinecraftServer()
                                            res.json({
                                                "status": "success"
                                            })
                                        } catch {
                                            res.json({
                                                "status": "error starting"
                                            })
                                        }
                                    } else {
                                        res.json({
                                            "status": "server already on"
                                        })
                                    }
                                } catch {
                                    startMinecraftServer()
                                    res.json({
                                        "status": "success"
                                    })
                                }

                            }, 100)

                        } catch {
                            res.json({
                                "status": "error starting"
                            })
                        }
                    } else {
                        startMinecraftServer()
                        res.json({
                            "status": "success"
                        })
                    }
                } else {
                    minecraftServerProcess.stdin.write(req.body.command + '\n')
                    cache.push[("Console command: " + req.body.command).toString()]
                    res.json({
                        "status": "success"
                    })
                }
                var commandToLog = {
                    "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
                    "creator": keys[getKeyN(req.body.key)].owner,
                    "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
                    "command": req.body.command.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
                    "time": new Date()
                }
                var commands = readJson(commandLogFile)
                commands.push(commandToLog)
                writeJson(commands, commandLogFile)
            }
        } else {
            res.json({
                "status": "Invalid key!"
            })
        }
    }
});

app.post('/mc-console/cl', function (req, res) {
    if (new Date().getTime() > lastResponse + 50) {
        lastResponse = new Date().getTime()
        if (checkKeyMatch(req.body.key)) {
            res.json({
                "status": "success",
                "data": readJson(commandLogFile)
            })
        } else {
            res.json({
                "status": "Invalid key!"
            })
        }
    }
})

app.post('/mc-console/down', function (req, res) {
    if (new Date().getTime() > lastResponse + 50) {
        lastResponse = new Date().getTime()
        if (checkKeyMatch(req.body.key)) {
            if (req.body.path == "") {
                return res.json({
                    "status": "Please provide a filename"
                })
            }
            if (req.body.path.split("/")[req.body.path.split("/").length - 1] == "server.js") {
                return res.json({
                    "status": "You cant download the server.js file"
                })
            }
            res.sendFile(path.join(__dirname, removeDoubleDotSegments(req.body.path)))
            var commandToLog = {
                "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
                "creator": keys[getKeyN(req.body.key)].owner,
                "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
                "command": "Downloaded: " + (req.body.path),
                "time": new Date()
            }
            var commands = readJson(commandLogFile)
            commands.push(commandToLog)
            writeJson(commands, commandLogFile)
        } else {
            res.sendFile(webServerDir + "mc-console-files/invalidKey.html")
        }
    }
})

const storage = multer.memoryStorage();
const upload = multer({
    storage: storage
});

app.post("/mc-console/up", (req, res, next) => {
    next();
}, upload.single("file"), (req, res) => {
    const fileBuffer = req.file.buffer;
    const fileName = req.file.originalname;
    const filePath = "./" + removeDoubleDotSegments(req.body.path) + fileName;
    const key = req.body.key;

    if (checkKeyMatch(key)) {
        if (fileName == "server.js") {
            return res.json({
                "status": "You cant overwrite the server.js file"
            });
        }
        fs.writeFile(filePath, fileBuffer, (writeErr) => {
            if (writeErr) {
                return res.json({
                    "status": "File upload failed"
                });
            }
            res.json({
                "status": "success"
            });
            var commandToLog = {
                "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
                "creator": keys[getKeyN(req.body.key)].owner,
                "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
                "command": "Uploaded: " + filePath,
                "time": new Date()
            }
            var commands = readJson(commandLogFile)
            commands.push(commandToLog)
            writeJson(commands, commandLogFile)
        });
    } else {
        return res.json({
            "status": "Invalid key!"
        });
    }
});

app.post('/mc-console/rm', function (req, res) {
    if (new Date().getTime() > lastResponse + 50) {
        lastResponse = new Date().getTime()
        if (checkKeyMatch(req.body.key)) {
            if (req.body.path == "") {
                return res.json({
                    "status": "Please provide a filename"
                })
            }
            if (req.body.path.split("/")[req.body.path.split("/").length - 1] == "server.js") {
                return res.json({
                    "status": "You cant delete the server.js file"
                })
            }
            if (fs.existsSync("./" + removeDoubleDotSegments(req.body.path))) {
                spawn("rm", [removeDoubleDotSegments(req.body.path)]).on("error", (err) => {
                    console.log(err)
                    return res.json({
                        "status": "Error deleting!"
                    })
                })
                res.json({
                    "status": "success"
                })
                var commandToLog = {
                    "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
                    "creator": keys[getKeyN(req.body.key)].owner,
                    "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
                    "command": "Deleted: " + removeDoubleDotSegments(req.body.path),
                    "time": new Date()
                }
                var commands = readJson(commandLogFile)
                commands.push(commandToLog)
                writeJson(commands, commandLogFile)
            } else {
                res.json({
                    "status": "File doesnt exist"
                })
            }
        } else {
            res.json({
                "status": "Invalid key!"
            })
        }
    }
})

app.post('/mc-console/ls', function (req, res) {
    if (new Date().getTime() > lastResponse + 50) {
        lastResponse = new Date().getTime()
        if (checkKeyMatch(req.body.key)) {
            if (fs.existsSync("./" + removeDoubleDotSegments(req.body.path))) {
                fs.readdir(("./" + req.body.path), (err, files) => {
                    res.json({
                        "status": "success",
                        "data": files
                    })
                });
                var commandToLog = {
                    "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
                    "creator": keys[getKeyN(req.body.key)].owner,
                    "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
                    "command": "Saw: " + removeDoubleDotSegments(req.body.path),
                    "time": new Date()
                }
                var commands = readJson(commandLogFile)
                commands.push(commandToLog)
                writeJson(commands, commandLogFile)
            } else {
                res.json({
                    "status": "File doesnt exist"
                })
            }
        } else {
            res.json({
                "status": "Invalid key!"
            })
        }
    }
})



app.listen(3001, () => {});

const {
    Client,
    Events,
    GatewayIntentBits
} = require('discord.js');

const discord = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages]
});

discord.on('ready', () => {
    console.log('Discord bot connected!');
});

discord.on("messageCreate", message => {
    if (message.author.bot) return
    if (message.content.toLowerCase().split(" ")[0] == "]add") {
        try {
            if (message.author.id == highestAdmin) {
                var allow = message.content.split(" ")[1].split("@")[1].split(">")[0]
                allow.split("&")[1] == "" ? allow = allow.split("&")[1] : true
                allowed.push(allow)
            } else {
                message.reply("Youre not allowed to do that")
            }
        } catch (err) {
            console.log(err)
        }
    }
    if (message.content.toLowerCase().split(" ")[0] == "]remove") {
        try {
            if (message.author.id == highestAdmin) {
                allowed.pop(message.content.split(" ")[1].split("@")[1].split(">")[0])
            } else {
                message.reply("Youre not allowed to do that")
            }
        } catch (err) {
            console.log(err)
        }
    }
    if (message.content.toLowerCase().split(" ")[0] == "]request") {
        if (allowed.includes(message.author.id)) {
            let request = message.content.toLowerCase().trim() + " lol" //dont want an exception 
            if (message.content.toLowerCase().split(" ")[1] == "atem") {
                if (message.author.id == highestAdmin) {
                    message.author.send("Your key is: ")
                    message.author.send(genKey(message.author.username, true).value)
                    message.author.send("it'll last you forever.")
                } else {
                    message.reply("You're not allowed to do that")
                }
            } else {
                message.author.send("Your key is: ")
                message.author.send(genKey(message.author.username, false).value)
                message.author.send("it'll last for " + (keyDuration > 60 ? keyDuration / 60 + " minutes." : keyDuration + " seconds.").toString())
            }
        } else {
            message.reply("You're not allowed to do that")
        }
    }
    if (message.content.toLowerCase() == "]allowed") {
        if (allowed.includes(message.author.id)) {
            message.author.send("Allowed users: " + allowed)
        } else {
            message.reply("You're not allowed to do that")
        }
    }
    if (message.content.toLowerCase() == "]keys") {
        if (message.author.id == highestAdmin) {
            let output = "Keys:\n----------------\n"
            for (let i = 0; i < keys.length; i++) {
                output += "Value: " + keys[i].value + "\n"
                output += "Creator: " + keys[i].owner + "\n"
                output += "Created: " + new Date(keys[i].epoch) + "\n"
                output += '----------------\n'
            }
            message.author.send(output)
        } else {
            message.reply("You're not allowed to do that")
        }
    }
    if (message.content.toLowerCase() == "]oldkeys") {
        if (message.author.id == highestAdmin) {
            message.author.send(website + "mc-console/oldkeys")
        } else {
            message.reply("You're not allowed to do that")
        }
    }
    if (message.content.toLowerCase() == "]startserver") {
        if (message.author.id == highestAdmin) {
            startMinecraftServer()
        } else {
            message.reply("You're not allowed to do that")
        }
    }
    if (message.content.toLowerCase() == "]clearconsole") {
        if (allowed.includes(message.author.id)) {
            var cacheEnd = cache[cache.length - 1]
            cache = [cacheEnd]
        } else {
            message.reply("You're not allowed to do that")
        }
    }
    if (message.content.toLowerCase() == "]nuke") {
        if (allowed.includes(message.author.id)) {
            for (let i = 0; i < keys.length; i++) {
                oldKeys.push(keys[i])
            }
            keys = []
            writeOldKeys()
        } else {
            message.reply("You're not allowed to do that")
        }
    }
});

discord.login(disToken);