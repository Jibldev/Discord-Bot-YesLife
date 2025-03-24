require("dotenv").config({ path: "./.env" });

const { Client, IntentsBitField } = require("discord.js");
const cron = require("node-cron");

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
    "56 12 * * *",
    () => {
      const channel = client.channels.cache.get("1353690374526472212");
      if (channel) {
        channel.send("Bonjour ! Voici ton message quotidien à 10h30 ! 🚀");
      } else {
        console.error("Le canal spécifié n'a pas été trouvé !");
      }
    },
    {
      timezone: "Europe/Paris",
    }
  );
});

client.login(process.env.DISCORD_TOKEN);
