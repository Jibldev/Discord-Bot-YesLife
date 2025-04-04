require("dotenv").config({ path: "./.env" });

const { Client, IntentsBitField, Partials } = require("discord.js");
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
  partials: [Partials.Message, Partials.Channel, Partials.Reaction],
});

let isJobRunning = false;

cron.schedule("*/5 * * * *", async () => {
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
    console.log("➡️ Réaction détectée");
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

    const guildId = message.guild.id;

    try {
      const db = getDatabase();
      const channelsCollection = db.collection("channels");

      const existing = await channelsCollection.findOne({ guildId });

      if (!existing) {
        return message.reply(
          `❌ Aucun canal défini pour les messages quotidiens sur ce serveur.`
        );
      }

      await channelsCollection.deleteOne({ guildId });

      message.reply(
        `✅ Le canal (${message.channel}) a été retiré de la liste des messages quotidiens.`
      );
    } catch (error) {
      console.error("❌ Erreur lors de la suppression du canal :", error);
      message.reply(
        "❌ Une erreur s'est produite lors de la suppression du canal."
      );
    }
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
      const db = await getDatabase();
      const settingsCollection = db.collection("settings");

      const existingSetting = await settingsCollection.findOne({ guildId });

      if (existingSetting) {
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

    try {
      const db = await getDatabase();
      const channelsCollection = db.collection("channels");
      const settingsCollection = db.collection("settings");

      const channels = await channelsCollection.find({}).toArray();
      const settings = await settingsCollection.find({}).toArray();

      console.log("Channels récupérés:", channels);
      console.log("Settings récupérés:", settings);

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

      const streaksData = await streaksCollection.find({}).toArray();

      if (streaksData.length === 0) {
        return message.reply("Aucune donnée de streak disponible.");
      }

      let reply = "🔥 **Streaks actuels :**\n";

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
  } else if (content === "!ladder") {
    try {
      const db = getDatabase();
      const streaksCollection = db.collection("streaks");

      const allStreaks = await streaksCollection.find({}).toArray();

      if (allStreaks.length === 0) {
        return message.reply("❌ Aucune donnée de classement disponible.");
      }

      // Classement par streak
      const streakRanking = [...allStreaks].sort((a, b) => b.streak - a.streak);

      // Classement par total de réactions
      const reactionRanking = [...allStreaks].sort((a, b) => b.count - a.count);

      // Classement par meilleur streak historique
      const bestStreakRanking = [...allStreaks].sort(
        (a, b) => (b.bestStreak || b.streak) - (a.bestStreak || a.streak)
      );

      let streakText = "🏆 **Top Streaks** :\n";
      streakRanking.slice(0, 5).forEach((user, index) => {
        streakText += `${index + 1}. <@${user.userId}> → **${
          user.streak
        }** jour(s)\n`;
      });

      let bestStreakText = "🏅 **Top Meilleurs Streaks Historiques** :\n";
      bestStreakRanking.slice(0, 5).forEach((user, index) => {
        const best = user.bestStreak || user.streak;
        bestStreakText += `${index + 1}. <@${
          user.userId
        }> → **${best}** jour(s)\n`;
      });

      let reactionText = "🔥 **Top Réactions** :\n";
      reactionRanking.slice(0, 5).forEach((user, index) => {
        reactionText += `${index + 1}. <@${user.userId}> → **${
          user.count
        }** réaction(s)\n`;
      });

      message.reply(`${streakText}\n${reactionText}`);
    } catch (error) {
      console.error("Erreur lors du classement !ladder :", error);
      message.reply("❌ Une erreur s'est produite lors du classement.");
    }
  } else if (content.startsWith("!streakuser")) {
    const args = message.mentions.users;
    const targetUser = args.first() || message.author; // soit l'utilisateur mentionné, soit l'auteur
    const userId = targetUser.id;

    try {
      const { getUserStreakInfo } = require("./streakManager");
      const userData = await getUserStreakInfo(userId);

      if (!userData) {
        return message.reply(
          `❌ ${
            targetUser.id === message.author.id ? "Tu n'as" : `<@${userId}> n'a`
          } pas encore commencé de streak.`
        );
      }

      message.reply(
        `📊 Streak de **<@${userId}>** :\n` +
          `🔥 Actuel : **${userData.streak} jour(s)**\n` +
          `🏆 Meilleur : **${
            userData.bestStreak || userData.streak
          } jour(s)**\n` +
          `📈 Total de réactions : **${userData.count}**`
      );
    } catch (error) {
      console.error("Erreur lors de la récupération du streak :", error);
      message.reply(
        "❌ Une erreur est survenue lors de la récupération du streak."
      );
    }
  }
});

client.once("ready", async () => {
  await connectToDatabase();
  console.log("✅ Bot prêt !");
});

client.login(process.env.DISCORD_TOKEN);
