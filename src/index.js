require("dotenv").config({ path: "./.env" });

const { Client, IntentsBitField } = require("discord.js");
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const app = express();

app.get("/", (req, res) => {
  res.send("Bot actif!");
});

app.listen(process.env.PORT || 3000, () => {
  console.log("Serveur HTTP actif.");
});

const client = new Client({
  intents: [
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildMembers,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.MessageContent,
  ],
});

// Lancer cron APRÈS que le bot soit prêt
client.once("ready", () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  cron.schedule(
    "30 10 * * *",
    () => {
      if (!fs.existsSync("channels.json")) return;
      const channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));

      for (const guildId in channels) {
        const channel = client.channels.cache.get(channels[guildId]);
        if (channel) {
          channel.send("Bonjour ! Voici ton message quotidien à 10h30 ! 🚀");
        } else {
          console.error(`Canal introuvable pour le serveur ${guildId}`);
        }
      }
    },
    {
      timezone: "Europe/Paris",
    }
  );
});

client.on("messageCreate", (message) => {
  if (!message.content.startsWith("!setchannel")) return;
  if (!message.member.permissions.has("ADMINISTRATOR")) {
    return message.reply(
      "🚫 Tu dois être administrateur pour utiliser cette commande !"
    );
  }

  const channelId = message.channel.id;
  const guildId = message.guild.id;

  let channels = {};
  if (fs.existsSync("channels.json")) {
    channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));
  }

  channels[guildId] = channelId;
  fs.writeFileSync("channels.json", JSON.stringify(channels, null, 2));

  message.reply(
    `✅ Ce canal (${message.channel}) est maintenant défini pour les messages quotidiens !`
  );

  // 🔹 Envoie un message immédiatement dans le canal défini
  message.channel.send("🚀 Ce sera ici que je posterai le message quotidien !");
});

client.login(process.env.DISCORD_TOKEN);
