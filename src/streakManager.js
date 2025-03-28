const { getDatabase } = require("./database"); // Import de MongoDB

// Définir ici ta plage horaire valide
const validStart = "15:20";
const validEnd = "16:00";

// Fonction pour vérifier si l'heure actuelle est dans la plage valide
function isWithinValidHours() {
  const now = new Date().toLocaleTimeString("fr-FR", {
    hour12: false,
    timeZone: "Europe/Paris",
  });
  return now >= validStart && now <= validEnd;
}

// Fonction pour mettre à jour le streak dans MongoDB
async function updateStreak(userId, messageId, channel) {
  if (!isWithinValidHours()) {
    console.log(`⏰ Réaction hors plage horaire pour ${userId}`);
    return;
  }

  const db = getDatabase();
  const streaksCollection = db.collection("streaks");

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

  // Vérifier si l'utilisateur a déjà un enregistrement pour aujourd'hui
  const userData = await streaksCollection.findOne({
    userId,
    lastReaction: today,
  });

  if (userData) {
    console.log(`✅ ${userId} a déjà réagi aujourd'hui`);
    return; // Ne rien faire si l'utilisateur a déjà réagi aujourd'hui
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  // Chercher un précédent enregistrement pour cet utilisateur
  const previousData = await streaksCollection.findOne({ userId });

  let streak = 1; // Nouveau streak par défaut
  if (previousData && previousData.lastReaction === yesterdayStr) {
    streak = previousData.streak + 1; // Continue le streak
  }

  // Insertion ou mise à jour de l'entrée de l'utilisateur
  await streaksCollection.updateOne(
    { userId },
    {
      $set: {
        userId,
        messageId,
        count: (previousData?.count || 0) + 1, // Incrémentation du nombre de réactions
        streak,
        lastReaction: today,
      },
    },
    { upsert: true } // Crée une nouvelle entrée si l'utilisateur n'existe pas
  );

  console.log(`🔥 Streak mis à jour pour ${userId} : ${streak} jours`);

  channel.send(
    `✅ Merci <@${userId}> ! Ton streak est maintenant de **${streak}** jour(s) (${
      (previousData?.count || 0) + 1
    } réactions au total).`
  );
}

module.exports = { updateStreak };
