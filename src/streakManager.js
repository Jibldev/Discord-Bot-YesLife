const { getDatabase } = require("./database"); // Import de MongoDB

// Définir ici ta plage horaire valide
const validStart = "15:00";
const validEnd = "15:30";

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
  const reactionStreaksCollection = db.collection("streaks");

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  let userData = await reactionStreaksCollection.findOne({ userId, messageId });

  if (!userData) {
    // Si l'utilisateur n'a pas encore réagi, on crée un nouvel enregistrement
    userData = {
      userId,
      messageId,
      count: 1,
      streak: 1,
      lastReaction: today,
    };

    await reactionStreaksCollection.insertOne(userData);
    console.log(`🔥 Nouvelle réaction pour ${userId}: Streak de 1 jour`);
  } else {
    // Si l'utilisateur a déjà réagi aujourd'hui, ne rien faire
    if (userData.lastReaction === today) {
      console.log(`✅ ${userId} a déjà réagi aujourd'hui`);
      return;
    }

    // Vérifie si l'utilisateur a réagi hier
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (userData.lastReaction === yesterdayStr) {
      // Continue le streak
      userData.streak += 1;
    } else {
      // Réinitialise le streak
      userData.streak = 1;
    }

    // Met à jour le nombre de réactions et la date de la dernière réaction
    userData.count += 1;
    userData.lastReaction = today;

    // Mise à jour dans la base de données MongoDB
    await reactionStreaksCollection.updateOne(
      { userId, messageId },
      { $set: userData }
    );
    console.log(
      `🔥 Streak mis à jour pour ${userId}: ${userData.streak} jours`
    );
  }

  // Envoie un message dans le canal de Discord pour confirmer
  channel.send(
    `✅ Merci <@${userId}> ! Ton streak est maintenant de **${userData.streak}** jour(s) (${userData.count} réactions au total).`
  );
}

module.exports = { updateStreak };
