require("dotenv").config({ path: "./.env" });

const { Client, IntentsBitField } = require("discord.js");
const cron = require("node-cron");
const express = require("express");
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
cron.schedule(
  "50 11 * * *",
  async () => {
    const channel = client.channels.cache.get("1354030838832168970");
    if (channel) {
      channel.send(
        "Bonjour ! Voici ton message quotidien à 10h30 ! 🚀\n\nRéagissez avec : ✅ "
      );

      // Ajoute automatiquement les réactions au message
      await message.react("✅");
    } else {
      console.error("Le canal spécifié n'a pas été trouvé !");
    }
  },
  {
    timezone: "Europe/Paris",
  }
);

client.login(process.env.DISCORD_TOKEN);
