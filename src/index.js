require("dotenv").config({ path: "./.env" });

const { Client, IntentsBitField, EmbedBuilder } = require("discord.js");
const cron = require("node-cron");
const express = require("express");
const fs = require("fs");
const app = express();

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

cron.schedule(
  "* * * * *",
  async () => {
    if (!fs.existsSync("channels.json")) return;
    if (!fs.existsSync("settings.json")) return;

    const channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));
    const settings = JSON.parse(fs.readFileSync("settings.json", "utf8"));
    const now = new Date();
    const currentHour = now.getHours().toString().padStart(2, "0");
    const currentMinute = now.getMinutes().toString().padStart(2, "0");
    const currentTime = `${currentHour}:${currentMinute}`;

    for (const guildId in channels) {
      const channelId = channels[guildId];
      const setting = settings[guildId];

      if (!setting || setting.hour !== currentTime) continue;

      try {
        const channel = await client.channels.fetch(channelId);
        if (channel) {
          channel
            .send(setting.message)
            .then((sentMessage) => sentMessage.react("✅"))
            .catch(console.error);
        }
      } catch (error) {
        console.error(`Erreur canal pour ${guildId}:`, error);
      }
    }
  },
  {
    timezone: "Europe/Paris",
  }
);

client.on("messageReactionAdd", (reaction, user) => {
  try {
    // Ignore les réactions des bots ou si ce n'est pas ✅
    if (user.bot || reaction.emoji.name !== "✅") return;

    // Charge le fichier JSON actuel
    let reactionsData = {};
    const reactionsFile = "reactions.json";

    if (fs.existsSync(reactionsFile)) {
      reactionsData = JSON.parse(fs.readFileSync(reactionsFile, "utf8"));
    }

    const messageId = reaction.message.id;

    // Initialisation si le message n'existe pas encore
    if (!reactionsData[messageId]) {
      reactionsData[messageId] = [];
    }

    // Vérifie si l'utilisateur a déjà réagi
    if (!reactionsData[messageId].includes(user.id)) {
      reactionsData[messageId].push(user.id);
    }

    // Sauvegarde immédiatement les données mises à jour
    fs.writeFileSync(reactionsFile, JSON.stringify(reactionsData, null, 2));

    console.log(`Réaction enregistrée pour ${user.username}`);

    // Envoie un message de confirmation
    reaction.message.channel.send(`Merci ${user.username} pour ta réaction`);
  } catch (error) {
    console.error("Erreur lors de l'enregistrement de la réaction :", error);
  }
});

// Commande pour définir un canal
client.on("messageCreate", (message) => {
  if (message.author.bot) return;

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
    if (fs.existsSync("channels.json")) {
      const channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));
      channelsList =
        Object.keys(channels).length > 0
          ? `Liste des canaux définis :\n${Object.values(channels)
              .map((id) => `<#${id}>`)
              .join("\n")}`
          : "Aucun canal défini.";
    }

    embed.addFields({
      name: "Canaux définis pour les messages quotidiens",
      value: channelsList,
    });

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

    const args = message.content.split(" ");
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
  }
});

client.login(process.env.DISCORD_TOKEN);
