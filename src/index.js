require("dotenv").config({ path: "./.env" });

const { Client, IntentsBitField, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const app = express();

const { updateStreak } = require("./streakManager");

const { connectToDatabase, getDatabase } = require("./database");

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
    IntentsBitField.Flags.GuildMessageReactions,
  ],
});

let isJobRunning = false;

cron.schedule("* * * * *", async () => {
  if (isJobRunning) {
    console.log("⏳ Cron ignoré : tâche déjà en cours");
    return;
  }

  isJobRunning = true;
  console.log("✅ Cron lancé");

  try {
    const db = await getDatabase();
    const channelsCollection = db.collection("channels");
    const settingsCollection = db.collection("settings");

    const now = new Date().toLocaleString("fr-FR", {
      timeZone: "Europe/Paris",
    });
    const timeParts = now.match(/(\d{2}):(\d{2})/);
    const currentHour = timeParts?.[1] || "00";
    const currentMinute = timeParts?.[2] || "00";
    const currentTime = `${currentHour}:${currentMinute}`;

    const channels = await channelsCollection.find({}).toArray();
    const settings = await settingsCollection.find({}).toArray();

    for (const channel of channels) {
      const { guildId, channelId } = channel;
      const setting = settings.find((s) => s.guildId === guildId);

      if (!setting || setting.hour !== currentTime) continue;

      try {
        const channelToSend = await client.channels.fetch(channelId);
        if (channelToSend) {
          channelToSend
            .send(setting.message)
            .then((sentMessage) => sentMessage.react("✅"))
            .catch(console.error);

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
client.on("messageCreate", async (message) => {
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

    const db = getDatabase();
    const channelsCollection = db.collection("channels");

    const existing = await channelsCollection.findOne({ guildId });

    if (existing) {
      return message.reply(
        `❌ Ce canal est déjà défini pour les messages quotidiens !`
      );
    }

    await channelsCollection.insertOne({
      guildId,
      channelId,
    });

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
    if (!message.member.permissions.has("ADMINISTRATOR")) {
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

    try {
      // Connexion à la base de données MongoDB
      const db = await getDatabase();
      const settingsCollection = db.collection("settings");

      // Vérification si un réglage existe déjà pour ce guildId
      const existingSetting = await settingsCollection.findOne({ guildId });

      if (existingSetting) {
        // Mise à jour du réglage existant
        await settingsCollection.updateOne(
          { guildId },
          {
            $set: {
              hour: time,
              message: customMessage,
            },
          }
        );
        message.reply(
          `✅ Message quotidien mis à jour pour ce serveur : **${customMessage}** à **${time}**.`
        );
      } else {
        // Insertion d'un nouveau réglage
        await settingsCollection.insertOne({
          guildId,
          hour: time,
          message: customMessage,
        });
        message.reply(
          `✅ Nouveau message quotidien défini pour ce serveur : **${customMessage}** à **${time}**.`
        );
      }
    } catch (error) {
      console.error("Erreur lors de la mise à jour de !setdaily :", error);
      message.reply(
        "❌ Une erreur est survenue lors de la mise à jour du message quotidien."
      );
    }
  } else if (content === "!debugcron") {
    // Commande !debugcron
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

    // Récupérer les données de MongoDB
    try {
      const db = await getDatabase();
      const channelsCollection = db.collection("channels");
      const settingsCollection = db.collection("settings");

      const channels = await channelsCollection.find({}).toArray();
      const settings = await settingsCollection.find({}).toArray();

      // Affichage dans la console
      console.log("Channels récupérés:", channels);
      console.log("Settings récupérés:", settings);

      // Chercher le setting pour ce guildId
      const setting = settings.find((s) => s.guildId === guildId);
      if (setting) {
        settingHour = setting.hour;
        settingMessage = setting.message;
      }

      // Envoie un message de confirmation
      message.reply(
        `🕒 **Heure actuelle perçue par le bot** : \`${currentTime}\`\n` +
          `📅 **Heure programmée** : \`${settingHour}\`\n` +
          `💬 **Message programmé** : ${settingMessage}\n\n` +
          `📚 **Channels définis** : ${channels
            .map(
              (channel) =>
                `Guild ID: ${channel.guildId}, Channel ID: ${channel.channelId}`
            )
            .join("\n")}`
      );
    } catch (error) {
      message.reply(
        "❌ Une erreur s'est produite lors de la vérification des données."
      );
      console.error("Erreur de récupération des données MongoDB :", error);
    }
  } else if (content === "!streaks") {
    try {
      const db = getDatabase();
      const streaksCollection = db.collection("streaks");

      // Récupérer tous les documents dans la collection "streaks"
      const streaksData = await streaksCollection.find({}).toArray();

      if (streaksData.length === 0) {
        return message.reply("Aucune donnée de streak disponible.");
      }

      let reply = "🔥 **Streaks actuels :**\n";

      // Parcours de chaque document de streak et préparation du message
      streaksData.forEach((userData) => {
        reply += `- <@${userData.userId}> → **${userData.streak} jours** (total : ${userData.count} réactions)\n`;
      });

      message.reply(reply);
    } catch (error) {
      console.error("Erreur lors de la récupération des streaks :", error);
      message.reply(
        "❌ Une erreur s'est produite lors de la récupération des streaks."
      );
    }
  }
});

client.once("ready", async () => {
  await connectToDatabase();
  console.log("✅ Bot prêt !");
});

client.login(process.env.DISCORD_TOKEN);
