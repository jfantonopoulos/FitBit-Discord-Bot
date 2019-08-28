const Discord = require("discord.js");

var commands = {
    "cached-activity": (args, msg, discordClient, fitbitClient, cachedData) => {
        var embed = new Discord.RichEmbed()
            .setTitle("Jons's Activity")
            .setDescription("The current cached activities.")
            .setThumbnail("https://irishtechnews.ie/wp-content/uploads/2016/08/fitbit-logo.png")
            .addField(":heart: Heart Rate", cachedData["heart-rate"] + "bpm", true)
            .addField(":athletic_shoe: Distance", cachedData["miles"] + "mi", true)
            .addField(":fire: Calories", cachedData["calories"].toLocaleString(), true)
            .addField(":triangular_ruler: Floors", cachedData["floors"], true)
            .addField(":zzz: Sleep Duration", cachedData["sleep"], true)

        msg.channel.send(embed);
        return true;
    }
};

module.exports = {
    parseCmd: (cmd, args, msg, discordClient, fitbitClient, cachedData) => {
        if (commands.hasOwnProperty(cmd)) {
            return commands[cmd](args, msg, discordClient, fitbitClient, cachedData);
        }
        else
            return false;
    }
};