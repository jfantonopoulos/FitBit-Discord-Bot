'use strict';

// initialize the express application
const express = require("express");
const https = require('https');
const fs = require('fs');
var cmdHandler = require("./commandhandler.js");
var helpers = require("./helpers.js");
var key = fs.readFileSync(__dirname + '/certs/selfsigned.key');
var cert = fs.readFileSync(__dirname + '/certs/selfsigned.crt');
var options = {
    key: key,
    cert: cert
};

const app = express();

// initialize the Fitbit API client
const FitbitApiClient = require("fitbit-node");
const client = new FitbitApiClient({
    clientId: "fitbitclientid",
    clientSecret: "fitbitclientsecret",
    apiVersion: '1.2' // 1.2 is the default
});

const { Builder, By, Key, until } = require('selenium-webdriver');
const chrome = require('selenium-webdriver/chrome');
const Discord = require("discord.js");
const dClient = new Discord.Client();
const clientToken = "discordbottoken";
dClient.login(clientToken)
.then(() => { console.log("FitBit Discord.js bot has booted!") })
.catch((err) => {
     console.log("Failed to connect to Bot API: " + err);
});

var clientAccessToken = null;
var clientRefreshToken = null;
var updateInterval = null;
var updateDelay = 30 * 1000; //Presence Update RateLimit: 5/60s
var tokenExpireTime = 3600; //An hour
var tokenRefreshDelay = (tokenExpireTime - 100) * 1000; //A little less than an hour
var states = ["heart-rate", "miles", "calories", "floors", "sleep"];
var state = "heart-rate";
var stateIndex = 0;
var prefix = "?";

var statsCache = {
    "heart-rate": 0,
    "miles": 0,
    "calories": 0,
    "floors": 0,
    "sleep": "0hr 0min"
}

dClient.once("ready", () => {
    console.log("Discord.JS is ready.");
});

dClient.on("message", (msg) => {
    if (!msg.content.startsWith(prefix) || msg.author.bot) return;

    const args = msg.content.slice(prefix.length).split(/ +/);
    const cmd = args.shift().toLowerCase();

    cmdHandler.parseCmd(cmd, args, msg, dClient, client, statsCache);
});

function getLastHeartRate(cb) {
    var timeRanges = helpers.getTimeRange();
    client.get("/activities/heart/date/today/1d/1sec/time/" + timeRanges.minTime + "/" + timeRanges.maxTime + ".json", clientAccessToken).then(results => {
        console.log("Payload Size: " + helpers.jsonMemSize(results));
        var resultDataset = results[0]["activities-heart-intraday"]["dataset"];
        var result = resultDataset[resultDataset.length - 1];
        console.log(result);
        cb(parseInt(result["value"]));
    }).catch(err => {
        console.log("Failed to fetch dataset: " + err);
        cb("Unsynced");
    });
}

function getTotalMiles(cb) {
    client.get("/activities/distance/date/today/1d.json", clientAccessToken).then(results => {
        console.log("Payload Size: " + helpers.jsonMemSize(results));
        var result = results[0]['activities-distance'][0];
        console.log(result);
        var kilometers = parseFloat(result["value"]);
        var miles = kilometers * 0.62137; //Conversion rate to miles.
        cb(miles.toFixed(2));
    }).catch(err => {
        console.log("Failed to fetch dataset: " + err);
        cb("Null");
    });
}

function getCaloriesBurned(cb) {
    client.get("/activities/calories/date/today/1d.json", clientAccessToken).then(results => {
        console.log("Payload Size: " + helpers.jsonMemSize(results));
        var result = results[0]['activities-calories'][0];
        console.log(result);
        var calories = parseInt(result["value"]);
        cb(calories);
    }).catch(err => {
        console.log("Failed to fetch dataset: " + err);
        cb("Null");
    });
}

function getTotalFloors(cb) {
    client.get("/activities/floors/date/today/1d.json", clientAccessToken).then(results => {
        console.log("Payload Size: " + helpers.jsonMemSize(results));
        var result = results[0]['activities-floors'][0];
        console.log(result);
        var floors = parseInt(result["value"]);
        cb(floors);
    }).catch(err => {
        console.log("Failed to fetch dataset: " + err);
        cb("Null");
    });
}

function getSleepTime(cb) {
    var todayDateObj = new Date();
    var todaysDate = todayDateObj.getFullYear() + "-" + (todayDateObj.getMonth() + 1 < 10 ? "0" + (todayDateObj.getMonth() + 1) : todayDateObj.getMonth() + 1) + "-" + (todayDateObj.getDate() < 10 ? "0" + todayDateObj.getDate() : todayDateObj.getDate());
    var yestDateObj = new Date();
    yestDateObj.setDate(yestDateObj.getDate() - 1);
    var yestsDate = yestDateObj.getFullYear() + "-" + (yestDateObj.getMonth() + 1 < 10 ? "0" + (yestDateObj.getMonth() + 1) : yestDateObj.getMonth() + 1) + "-" + (yestDateObj.getDate() < 10 ? "0" + yestDateObj.getDate() : yestDateObj.getDate());
    client.get("/sleep/date/" + yestsDate + "/" + todaysDate + ".json", clientAccessToken).then(results => {
        console.log("Payload Size: " + helpers.jsonMemSize(results));
        var result = results[0]["sleep"];
        if (result == null || result == "undefined") {
            cb("0 minutes");
            return;
        }
        var sleepData = {};
        for (var i = 0; i < result.length; i++) {
            sleepData[result[i].dateOfSleep] = sleepData[result[i].dateOfSleep] || 0;
            sleepData[result[i].dateOfSleep] += parseInt(result[i]["minutesAsleep"]);
        }
        var yestMinAsleep = 0;
        var todayMinAsleep = 0;
        for (var sleepDate in sleepData) {
            if (sleepDate == todaysDate)
                todayMinAsleep = sleepData[sleepDate];
            else
                yestMinAsleep = sleepData[sleepDate];
        }
        var yestMinAsleepDiff = todayMinAsleep - yestMinAsleep;
        var timeStr = "";
            var hoursSlept = Math.floor(todayMinAsleep / 60);
            var remainingMinutes = todayMinAsleep % 60;
            if (todayMinAsleep > 60)
                timeStr += hoursSlept + "hr " + remainingMinutes + "min";
            else
                timeStr += todayMinAsleep + "min";
            var hoursSleptYest = Math.floor(yestMinAsleepDiff / 60);
            var remainingMinutesYest = yestMinAsleepDiff % 60;
            var sign = (yestMinAsleepDiff > 0 ? "\u2795" : "\u2796");
            if (yestMinAsleep > 60)
                timeStr += " (" + sign + hoursSleptYest.toString().replace("-", "") + "hr " + remainingMinutesYest.toString().replace("-", "") + "min" + ")";
            else
                timeStr += " (" + sign + yestMinAsleep + "min" + ")";

        cb(timeStr);
    }).catch(err => {
        console.log("Failed to fetch dataset: " + err.stack);
        cb("Null");
    });
}

function setStatusText(text) {
    dClient.user.setPresence({ game: { name: text, type: "STREAMING", url: "https://twitch.tv/test" } })
    .catch((err) => {
        console.log(err);
    });
}


// redirect the user to the Fitbit authorization page
app.get("/authorize", (req, res) => {
    // request access to the user's activity, heartrate, location, nutrion, profile, settings, sleep, social, and weight scopes
    res.redirect(client.getAuthorizeUrl('activity profile heartrate sleep', 'https://localhost:8080/callback'));
});

// handle the callback from the Fitbit authorization flow
app.get("/callback", (req, res) => {
    // exchange the authorization code we just received for an access token
    client.getAccessToken(req.query.code, 'https://localhost:8080/callback').then(result => {
        // use the access token to fetch the user's profile information
        clientAccessToken = result.access_token;
        clientRefreshToken = result.refresh_token;
        
        updateInterval = setInterval(() => {
            state = states[stateIndex];
            console.log("Getting Data For State: " + state);
            switch (state) {
                case "heart-rate":
                    getLastHeartRate((hr) => {
                        var lastHeartRate = statsCache["heart-rate"];
                        var hrDiff = hr - lastHeartRate;
                        var sign = (hrDiff > 0 ? "\u2795" : "\u2796");
                        if (statsCache["heart-rate"] != hr)
                            statsCache["heart-rate"] = hr;
                        setStatusText("\ud83d\udc99 HR: " + hr + "bpm (" + sign + hrDiff.toString().replace("-", "") +"bpm)");
                    });
                break;
                case "miles":
                    getTotalMiles((miles) => {
                        var lastMiles = statsCache["miles"];
                        var milesDiff = miles - lastMiles;
                        var sign = (milesDiff > 0 ? "\u2795" : "\u2796"); 
                        if (statsCache["miles"] != miles)
                            statsCache["miles"] = miles;
                        setStatusText("\ud83d\udc5f Distance: " + miles + "mi (" + sign + milesDiff.toString().replace("-", "") + "mi)");
                    });
                break;
                case "calories":
                    getCaloriesBurned((calories) => {
                        var lastCalories = statsCache["calories"];
                        var caloriesDiff = calories - lastCalories;
                        var sign = (caloriesDiff > 0 ? "\u2795" : "\u2796"); 
                        if (statsCache["calories"] != calories)
                            statsCache["calories"] = calories;
                        setStatusText("\ud83d\udd25 Calories: " + calories.toLocaleString() + " (" + sign + caloriesDiff.toLocaleString().replace("-", "") + ")");
                    });
                break;
                case "floors":
                    getTotalFloors((floors) => {
                        var lastFloors = statsCache["floors"];
                        var floorsDiff = floors - lastFloors;
                        var sign = (floorsDiff > 0 ? "\u2795" : "\u2796");
                        if (statsCache["floors"] != floors)
                            statsCache["floors"] = floors;
                        setStatusText("\ud83d\udcd0 Floors: " + floors + " (" + sign + floorsDiff.toString().replace("-", "") + ")");
                    });
                break;
                case "sleep":
                    getSleepTime((sleepTime) => {
                        statsCache["sleep"] = sleepTime;
                        setStatusText("\ud83d\udca4 Slept: " + sleepTime);
                    });
                break;
                default:
                    console.log("Unknown state in switch (" + state + "), defaulting to heart-rate.");
                    getLastHeartRate((hr) => {
                        statsCache["heart-rate"] = hr;
                        setStatusText("\u2764 HR: " + hr + "bpm");
                    });
            }

            stateIndex++;
            if (stateIndex > states.length - 1)
                stateIndex = 0;
        }, updateDelay);

        console.log("Getting Data For State: " + state);

        getLastHeartRate((hr) => {
            setStatusText("\ud83d\udc99 HR: " + hr + "bpm");
            statsCache["heart-rate"] = hr;
            stateIndex++;
        });

        setInterval(() => {
            client.refreshAccessToken(clientAccessToken, clientRefreshToken, tokenExpireTime)
                .then((token) => {
                    clientAccessToken = token.access_token;
                    clientRefreshToken = token.refresh_token;
                    console.log("Refreshed the FitBit client's access and refresh tokens.");
                })
                .catch((err) => {
                    console.log(err);
                })
        }, tokenRefreshDelay); 

        res.send("Client has been successfully linked! Beginning activity tracking.");
    }).catch(err => {
        res.status(err.status).send(err);
    });
});

var port = 8080;
var username = "username";
var pass = "password";
var server = https.createServer(options, app);
server.listen(port, () => {
    console.log("FitBit authorization server started on : " + port);
    (async function authorize() {
        let driver = await new Builder().forBrowser("chrome").setChromeOptions(new chrome.Options().headless().addArguments("--no-sandbox", "--disable-dev-shm-usage")).build();
        try {
            console.log("Authorizing FitBit user...");
            await driver.get("https://localhost:8080/authorize");
            await driver.sleep(3000);
            await driver.findElement(By.xpath("//*[contains(@class, 'email')]")).sendKeys(username);
            await driver.findElement(By.xpath("//*[contains(@class, 'password')]")).sendKeys(pass);
            await driver.findElement(By.id('ember685')).click();
            await driver.wait(until.urlContains("callback?code="));
        }
        finally {
            console.log("Authorization complete. Closing brower.");
            await driver.quit();
            server.close();
            console.log("Closing authorization server.");
        }
    })();
});