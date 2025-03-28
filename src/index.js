require("dotenv").config({ path: "./.env" });

const { Client, IntentsBitField, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const app = express();

const { updateStreak } = require("./streakManager");

app.get("/", (req, res) => {
  res.send("Bot actif!");
});

// Route de DEBUG : affiche les réactions enregistrées
app.get("/reactions", (req, res) => {
  const fs = require("fs");

  if (fs.existsSync("reactions.json")) {
    const data = JSON.parse(fs.readFileSync("reactions.json", "utf8"));
    res.json(data);
  } else {
    res.status(404).send("Aucune réaction enregistrée pour l'instant.");
  }
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
    IntentsBitField.Flags.GuildMessageReactions,
  ],
});

let isJobRunning = false;

let lastSent = {}; // mémoire temporaire pour éviter les doublons

cron.schedule("* * * * *", async () => {
  if (isJobRunning) {
    console.log("⏳ Cron ignoré : tâche déjà en cours");
    return;
  }

  isJobRunning = true;
  console.log("✅ Cron lancé");

  try {
    if (!fs.existsSync("channels.json") || !fs.existsSync("settings.json"))
      return;

    const channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));
    const settings = JSON.parse(fs.readFileSync("settings.json", "utf8"));
    const now = new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });
    const timeParts = now.match(/(\d{2}):(\d{2})/);
    const currentHour = timeParts?.[1] || "00";
    const currentMinute = timeParts?.[2] || "00";
    const currentTime = `${currentHour}:${currentMinute}`;

    for (const guildId in channels) {
      const channelId = channels[guildId];
      const setting = settings[guildId];

      if (!setting) continue;

      if (setting.hour !== currentTime) continue;

      try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
          channel
            .send(setting.message)
            .then((sentMessage) => sentMessage.react("✅"))
            .catch(console.error);

          lastSent[guildId] = currentTime; // Marque l'envoi

          console.log(
            `📨 Message envoyé à ${currentTime} dans le serveur ${guildId}`
          );
        }
      } catch (error) {
        console.error(
          `❌ Erreur lors de l'envoi dans le canal de ${guildId}:`,
          error
        );
      }
    }
  } catch (error) {
    console.error("❌ Erreur globale dans le cron :", error);
  } finally {
    isJobRunning = false;
  }
});

client.on("messageReactionAdd", (reaction, user) => {
  try {
    if (user.bot || reaction.emoji.name !== "✅") return;

    updateStreak(user.id, reaction.message.id, reaction.message.channel);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la réaction :", error);
  }
});

// Commande pour définir un canal
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

  const rawContent = message.content;
  const content = message.content.toLowerCase();

  if (content.startsWith("!setchannel")) {
    if (!message.member.permissions.has("ADMINISTRATOR")) {
      return message.reply(
        "🚫 Tu dois être administrateur pour utiliser cette commande !"
      );
    }

    const channelId = message.channel.id;
    const guildId = message.guild.id;
    // Commande !setchannel !removechannel
    let channels = {};
    if (fs.existsSync("channels.json")) {
      channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));
    }

    if (channels[guildId] === channelId) {
      return message.reply(
        `❌ Ce canal est déjà défini pour les messages quotidiens !`
      );
    }

    channels[guildId] = channelId;
    fs.writeFileSync("channels.json", JSON.stringify(channels, null, 2));

    message.reply(
      `✅ Ce canal (${message.channel}) est maintenant défini pour les messages quotidiens !`
    );
    message.channel.send(
      "🚀 Ce sera ici que je posterai le message quotidien !"
    );
  } else if (content.startsWith("!removechannel")) {
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

    if (channels[guildId] !== channelId) {
      return message.reply(
        `❌ Ce canal n'est pas défini pour les messages quotidiens.`
      );
    }

    delete channels[guildId];
    fs.writeFileSync("channels.json", JSON.stringify(channels, null, 2));

    message.reply(
      `✅ Le canal (${message.channel}) a été retiré de la liste des messages quotidiens.`
    );
    // Commande !test
  } else if (content === "!test") {
    const embed = new EmbedBuilder()
      .setColor("#00ff00")
      .setTitle("Test réussi ! ✅")
      .setDescription("Le bot fonctionne correctement.")
      .setFooter({
        text: "Commande test",
        iconURL: client.user.displayAvatarURL(),
      });

    let channelsList = "Aucun canal défini.";
    const guildId = message.guild.id;
    let channelId = null;

    if (fs.existsSync("channels.json")) {
      const channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));
      if (channels[guildId]) {
        channelId = channels[guildId];
        channelsList = `Liste des canaux définis :\n<#${channelId}>`;
      }
    }

    embed.addFields({
      name: "Canaux définis pour les messages quotidiens",
      value: channelsList,
    });

    // Ajout des infos de settings.json
    if (fs.existsSync("settings.json")) {
      const settings = JSON.parse(fs.readFileSync("settings.json", "utf8"));
      const setting = settings[guildId];

      if (setting) {
        embed.addFields({
          name: "Message quotidien programmé",
          value: `🕒 Heure : **${setting.hour}**\n💬 Message : **${setting.message}**`,
        });
      } else {
        embed.addFields({
          name: "Message quotidien programmé",
          value: "Aucun message programmé pour ce serveur.",
        });
      }
    } else {
      embed.addFields({
        name: "Message quotidien programmé",
        value: "Fichier settings.json introuvable.",
      });
    }

    message.reply({ embeds: [embed] });
    // Commande !testreact
  } else if (content === "!testreact") {
    message.channel
      .send("Ceci est un test de message avec une réaction automatique. 🚀")
      .then((sentMessage) => {
        sentMessage.react("✅");
      })
      .catch((error) => {
        console.error("Erreur lors de l'envoi ou de la réaction :", error);
        message.reply("❌ Une erreur est survenue.");
      });
    // Commande !setdaily
  } else if (content.startsWith("!setdaily")) {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("🚫 Tu dois être administrateur pour faire cela.");
    }

    const args = rawContent.split(" ");
    if (args.length < 3) {
      return message.reply(
        "❌ Syntaxe : `!setdaily HH:MM Ton message personnalisé`"
      );
    }

    const time = args[1];
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;

    if (!timeRegex.test(time)) {
      return message.reply("❌ L'heure doit être au format HH:MM (ex: 14:30)");
    }

    const customMessage = args.slice(2).join(" ");
    const guildId = message.guild.id;

    let settings = {};
    if (fs.existsSync("settings.json")) {
      settings = JSON.parse(fs.readFileSync("settings.json", "utf8"));
    }

    settings[guildId] = {
      hour: time,
      message: customMessage,
    };

    fs.writeFileSync("settings.json", JSON.stringify(settings, null, 2));

    message.reply(
      `✅ Message quotidien mis à jour : **${customMessage}** à **${time}**.`
    );
    // Commande !debugcron
  } else if (content === "!debugcron") {
    const now = new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });

    // Correction du split qui causait un bug sur Render
    const timeParts = now.match(/(\d{2}):(\d{2})/);
    const currentHour = timeParts?.[1] || "00";
    const currentMinute = timeParts?.[2] || "00";
    const currentTime = `${currentHour}:${currentMinute}`;

    let settingHour = "Inconnu";
    let settingMessage = "Aucun message programmé.";
    const guildId = message.guild.id;

    if (fs.existsSync("settings.json")) {
      const settings = JSON.parse(fs.readFileSync("settings.json", "utf8"));
      const setting = settings[guildId];
      if (setting) {
        settingHour = setting.hour;
        settingMessage = setting.message;
      }
    }

    message.reply(
      `🕒 **Heure actuelle perçue par le bot** : \`${currentTime}\`\n` +
        `📅 **Heure programmée** : \`${settingHour}\`\n` +
        `💬 **Message programmé** : ${settingMessage}`
    );
  } else if (content === "!streaks") {
    const file = "reactionStreaks.json";

    if (!fs.existsSync(file)) {
      return message.reply("Aucune donnée de streak disponible.");
    }

    const data = JSON.parse(fs.readFileSync(file, "utf8"));

    if (Object.keys(data).length === 0) {
      return message.reply("Aucune donnée de streak disponible.");
    }

    let reply = "🔥 **Streaks actuels :**\n";

    for (const userId in data) {
      const userData = data[userId];
      reply += `- <@${userId}> → **${userData.streak} jours** (total : ${userData.count} réactions)\n`;
    }

    message.reply(reply);
  }
});

const connectToDatabase = require("./database");

// Connexion à MongoDB
connectToDatabase();

client.login(process.env.DISCORD_TOKEN);
