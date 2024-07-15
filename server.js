var spawn = require('child_process').spawn
var path = require('path')
const fs = require('fs')
const multer = require('multer')

const CONFIG_FILE = "mc-console-config.json"

var config

var allowed

var minecraftServerProcess
var cache = ["no lines yet"]
var keys = []
var oldKeys = []

function readJson(filePath) {
    const jsonData = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(jsonData)
}

function writeJson(data, filePath) {
    var jsonData = JSON.stringify(data, null, 2)
    fs.writeFileSync(filePath, jsonData, 'utf-8')
}

function loadSettings(){
    config = readJson(CONFIG_FILE)
    allowed = config.allowed
}

loadSettings()

if (!fs.existsSync(config.command_log_path)) {
    fs.writeFileSync(config.command_log_path, JSON.stringify([], null, 2), 'utf-8')
    console.log(`File '${config.command_log_path}' created.`)
}

function checkKeyMatch(target) {
    if (typeof target === 'string') {
        target = target.trim()
        for (var i = 0; i < keys.length; i++) {
            if (keys[i].value === target) {
                return true
            }
        }
    }
    return false
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
    return inputString.replace(/(\.\.\/)/g, '')
}

function writeOldKeys() {
    let output = "Expired Keys:\n----------------\n"
    for (let i = 0; i < oldKeys.length; i++) {
        output += "Value: " + oldKeys[i].value + "\n"
        output += "Creator: " + oldKeys[i].owner + "\n"
        output += "Created: " + new Date(oldKeys[i].epoch) + "\n"
        output += '----------------\n'
    }
    fs.writeFile(`${__dirname}/webfiles/oldkeys.txt`, output, err => {
        if (err) {
            console.error(err)
        }
    })
}

function genKey(creator, atem) {
    var result = ""
    for (let i = 0; i < config.key_length; i++) {
        result += config.chars_in_keys.charAt(Math.floor(Math.random() * config.chars_in_keys.length))
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
        }, config.key_duration * 1000)
    }
    return key
}

function log(data) {
    cache.push(data.toString())
}

function startMinecraftServer() {
    minecraftServerProcess = spawn('bash', ['run.sh'], {
        detached: true,
        stdio: ['pipe', 'pipe', 'pipe']
    })
    minecraftServerProcess.unref()
    minecraftServerProcess.on('error', function (err) {
        console.error('Failed to start Minecraft server:', err)
    })
    minecraftServerProcess.stdout.on('data', log)
}

function whitelist(username, message) {
    try {
        minecraftServerProcess.stdin.write("whitelist add " + username + "\n")
        message.reply("Player " + username + " has been added to the whitelist")
        return
    } catch {
        message.reply("Error adding " + username + " to whitelist. Message the admin.")
        return
    }
}

function attemptStart(res) {
    minecraftServerProcess.stdin.write('say i\n')
    setTimeout(function () {
        try {
            var lastLine = cache[cache.length - 1]
            lastLine = lastLine.split("[Server]")[1].trim()
            if (lastLine == "i") {
                res.json({
                    "status": "server already on"
                })
                return
            }
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
        } catch {
            startMinecraftServer()
            res.json({
                "status": "success"
            })
        }

    }, 100)
}


var app = require('express')()
app.use(require('body-parser').json())


app.get("/", (req, res) => {
    res.sendFile(`${__dirname}/webfiles/index.html`)
})

app.get("/style.css", (req, res) => {
    res.sendFile(`${__dirname}/webfiles/style.css`)
})

app.get("/script.js", (req, res) => {
    res.sendFile(`${__dirname}/webfiles/script.js`)
})

app.get("/reload.svg", (req, res) => {
    res.sendFile(`${__dirname}/webfiles/reload.svg`)
})

app.get("/menu.svg", (req, res) => {
    res.sendFile(`${__dirname}/webfiles/menu.svg`)
})

app.get("/oldkeys", (req, res) => {
    res.sendFile(`oldkeys.txt`)
})

app.post('/api', function (req, res) {
    if (!checkKeyMatch(req.body.key)) {
        res.json({
            "status": "Invalid key!"
        })
        return
    }
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
            return
        }
        res.json({
            "status": "success",
            "data": cache.slice(-100)
        })
        return
    }
    if (req.body.command == 'start') {
        if (minecraftServerProcess == undefined) {
            startMinecraftServer()
            res.json({
                "status": "success"
            })
            return
        }
        try {
            attemptStart(res)

        } catch {
            res.json({
                "status": "error starting"
            })
        }
        return
    }

    minecraftServerProcess.stdin.write(req.body.command + '\n')
    cache.push[("Console command: " + req.body.command).toString()]
    res.json({
        "status": "success"
    })
    var commandToLog = {
        "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
        "creator": keys[getKeyN(req.body.key)].owner,
        "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
        "command": req.body.command.replace(/</g, '&lt;').replace(/>/g, '&gt;'),
        "time": new Date()
    }
    var commands = readJson(config.command_log_path)
    commands.push(commandToLog)
    writeJson(commands, config.command_log_path)
})

app.post('/cl', function (req, res) {
    if (!checkKeyMatch(req.body.key)) {
        res.json({
            "status": "Invalid key!"
        })
        return
    }
    res.json({
        "status": "success",
        "data": readJson(config.command_log_path)
    })
})

app.post('/down', function (req, res) {
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
        if (req.body.path.split("/")[req.body.path.split("/").length - 1] == CONFIG_FILE) {
            return res.json({
                "status": "You cant download the config file"
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
        var commands = readJson(config.command_log_path)
        commands.push(commandToLog)
        writeJson(commands, config.command_log_path)
    } else {
        res.sendFile(`${__dirname}/webfiles/invalidKey.html`)
    }
})

const storage = multer.memoryStorage()
const upload = multer({
    storage: storage
})

app.post("/up", (req, res, next) => {
    next()
}, upload.single("file"), (req, res) => {
    const fileBuffer = req.file.buffer
    const fileName = req.file.originalname
    const filePath = "./" + removeDoubleDotSegments(req.body.path) + fileName
    const key = req.body.key

    if (checkKeyMatch(key)) {
        if (fileName == "server.js") {
            return res.json({
                "status": "You cant overwrite the server.js file"
            })
        }
        fs.writeFile(filePath, fileBuffer, (writeErr) => {
            if (writeErr) {
                return res.json({
                    "status": "File upload failed"
                })
            }
            res.json({
                "status": "success"
            })
            var commandToLog = {
                "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
                "creator": keys[getKeyN(req.body.key)].owner,
                "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
                "command": "Uploaded: " + filePath,
                "time": new Date()
            }
            var commands = readJson(config.command_log_path)
            commands.push(commandToLog)
            writeJson(commands, config.command_log_path)
        })
    } else {
        return res.json({
            "status": "Invalid key!"
        })
    }
})

app.post('/rm', function (req, res) {
    if (!checkKeyMatch(req.body.key)) {
        return res.json({
            "status": "Invalid key!"
        })
    }
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
    if (!fs.existsSync("./" + removeDoubleDotSegments(req.body.path))) {
        return res.json({
            "status": "File doesnt exist"
        })
    }
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
    var commands = readJson(config.command_log_path)
    commands.push(commandToLog)
    writeJson(commands, config.command_log_path)
})

app.post('/ls', function (req, res) {
    if (!checkKeyMatch(req.body.key)) {
        return res.json({
            "status": "Invalid key!"
        })
    }
    if (!fs.existsSync("./" + removeDoubleDotSegments(req.body.path))) {
        return res.json({
            "status": "File doesnt exist"
        })
    }
    fs.readdir(("./" + removeDoubleDotSegments(req.body.path)), (err, files) => {
        res.json({
            "status": "success",
            "data": files
        })
    })
    var commandToLog = {
        "keyTime": new Date(keys[getKeyN(req.body.key)].epoch),
        "creator": keys[getKeyN(req.body.key)].owner,
        "key": req.body.key.split("").splice(0, 2).join("") + ("*".repeat(req.body.key.split("").length - 4)) + req.body.key.split("").splice(req.body.key.split("").length - 2, req.body.key.split("").length - 1).join(""),
        "command": "Saw: " + removeDoubleDotSegments(req.body.path),
        "time": new Date()
    }
    var commands = readJson(config.command_log_path)
    commands.push(commandToLog)
    writeJson(commands, config.command_log_path)
})



app.listen(3001, () => {})

const {
    Client,
    Events,
    GatewayIntentBits
} = require('discord.js')

const discord = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMessages]
})

discord.on('ready', () => {
    console.log('Discord bot connected!');
})

discord.on("messageCreate", message => {
    if (message.author.bot) return
    if (message.content.toLowerCase().split(" ")[0] == "]add") {
        try {
            if (message.author.id != config.highest_admin) {
                message.reply("Youre not allowed to do that")
                return
            }
            var allow = message.content.split(" ")[1].split("@")[1].split(">")[0]
            allow.split("&")[1] == "" ? allow = allow.split("&")[1] : true
            allowed.push(allow)
        } catch (err) {
            console.log(err)
        }
    }
    if (message.content.toLowerCase().split(" ")[0] == "]remove") {
        try {
            if (message.author.id != config.highest_admin) {
                message.reply("Youre not allowed to do that")
                return
            }
            allowed.pop(message.content.split(" ")[1].split("@")[1].split(">")[0])
        } catch (err) {
            console.log(err)
        }
    }
    if (message.content.toLowerCase().split(" ")[0] == "]request") {
        if (!allowed.includes(message.author.id)) {
            message.reply("You're not allowed to do that")
            return
        }
        if (message.content.toLowerCase().split(" ")[1] == "atem") {
            if (message.author.id != config.highest_admin) {
                message.reply("You're not allowed to do that")
                return
            }
            message.author.send("Your key is: ")
            message.author.send(genKey(message.author.username, true).value)
            message.author.send("it'll last you forever.")
            return
        }
        message.author.send("Your key is: ")
        message.author.send(genKey(message.author.username, false).value)
        message.author.send("it'll last for " + (config.key_duration > 60 ? config.key_duration / 60 + " minutes." : config.key_duration + " seconds.").toString())
        return
    }
    

    if (message.content.toLowerCase() == "]allowed") {
        if (!allowed.includes(message.author.id)) {
            message.reply("You're not allowed to do that")
            return
        }
        message.author.send("Allowed users: " + allowed)
    }
    if (message.content.toLowerCase() == "]keys") {
        if (message.author.id != config.highest_admin) {
            message.reply("You're not allowed to do that")
            return
        }
        let output = "Keys:\n----------------\n"
        for (let i = 0; i < keys.length; i++) {
            output += "Value: " + keys[i].value + "\n"
            output += "Creator: " + keys[i].owner + "\n"
            output += "Created: " + new Date(keys[i].epoch) + "\n"
            output += '----------------\n'
        }
        message.author.send(output)
        return
    }
    if (message.content.toLowerCase() == "]oldkeys") {
        if (message.author.id != config.highest_admin) {
            message.reply("You're not allowed to do that")
            return
        }
        message.author.send("https://" + config.domain + "/oldkeys")
        return
    }
    if (message.content.toLowerCase() == "]startserver") {
        if (message.author.id != config.highest_admin) {
            message.reply("You're not allowed to do that")
            return
        }
        startMinecraftServer()
        return
    }
    if (message.content.toLowerCase() == "]clearconsole") {
        if (!allowed.includes(message.author.id)) {
            message.reply("You're not allowed to do that")
            return
        }
        var cacheEnd = cache[cache.length - 1]
        cache = [cacheEnd]
        return
    }
    if (message.content.toLowerCase() == "]nuke") {
        if (!allowed.includes(message.author.id)) {
            message.reply("You're not allowed to do that")
            return
        }
        for (let i = 0; i < keys.length; i++) {
            oldKeys.push(keys[i])
        }
        keys = []
        writeOldKeys()
        return
    }
    if (message.content.toLowerCase().split(" ")[0] == "]whitelist") {
        if (message.channel.id != config.whitelist_channel) {
            message.reply("Send in the correct channel please")
            return
        }
        if (message.content.split(" ").length == 1) {
            message.reply("Please provide a username")
            return
        }
        whitelist(message.content.split(" ")[1], message)
        return
    }
})

discord.login(config.discord_bot_token)