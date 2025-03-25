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
  ],
});

// Lancer cron APRÈS que le bot soit prêt
client.once("ready", () => {
  console.log(`🤖 Connecté en tant que ${client.user.tag}`);

  cron.schedule(
    "30 10 * * *",
    async () => {
      if (!fs.existsSync("channels.json")) return;
      const channels = JSON.parse(fs.readFileSync("channels.json", "utf8"));

      for (const guildId in channels) {
        const channel = client.channels.cache.get(channels[guildId]);
        if (channel) {
          try {
            const message = await channel.send(
              "Bonjour ! Voici ton message quotidien à 10h30 ! 🚀"
            );

            // 👇 Ajout automatique des réactions ici :
            await message.react("✅");
          } catch (error) {
            console.error(`Erreur pour le serveur ${guildId}:`, error);
          }
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

client.on("messageReactionAdd", (reaction, user) => {
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

  message.channel.send(`Merci ${user.username} pour ta réaction`);
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

// Message de test (ajouter data si besoin)
client.on("messageCreate", (message) => {
  // Ignorer les messages des bots
  if (message.author.bot) return;

  // Vérifier si le message est la commande "!test"
  if (message.content.toLowerCase() === "!test") {
    // Créer un embed stylé
    const embed = new EmbedBuilder()
      .setColor("#00ff00") // Couleur verte
      .setTitle("Test réussi ! ✅")
      .setDescription("Le bot fonctionne correctement.")
      .setFooter({
        text: "Commande test",
        iconURL: client.user.displayAvatarURL(),
      });

    // Répondre avec l'embed
    message.reply({ embeds: [embed] });
  }
});

client.login(process.env.DISCORD_TOKEN);
