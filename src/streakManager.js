const { getDatabase } = require("./database"); // Import de MongoDB

// Définir ici ta plage horaire valide
const validStart = "07:00";
const validEnd = "19:00";

// Fonction pour vérifier si l'heure actuelle est dans la plage valide
function isWithinValidHours() {
  const now = new Date().toLocaleTimeString("fr-FR", {
    hour12: false,
    timeZone: "Europe/Paris",
  });
  return now >= validStart && now <= validEnd;
}

// Fonction pour mettre à jour le streak dans MongoDB
async function updateStreak(userId, channel) {
  if (!isWithinValidHours()) {
    console.log(`⏰ Réaction hors plage horaire pour ${userId}`);
    return;
  }

  const db = getDatabase();
  const reactionStreaksCollection = db.collection("streaks");

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  let userData = await reactionStreaksCollection.findOne({ userId });

  if (!userData) {
    // Si l'utilisateur n'a pas encore réagi, on crée un nouvel enregistrement
    userData = {
      userId,
      count: 1,
      streak: 1,
      lastReaction: today,
    };

    await reactionStreaksCollection.insertOne(userData);
    console.log(`🔥 Nouvelle réaction pour ${userId}: Streak de 1 jour`);
    channel.send(
      `✅ Merci <@${userId}> ! Ton streak est maintenant de **1** jour (${userData.count} réaction au total).`
    );
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

    let newStreak = 1;
    if (userData.lastReaction === yesterdayStr) {
      newStreak = userData.streak + 1;
    }

    const updatedData = {
      lastReaction: today,
      streak: newStreak,
      count: userData.count + 1,
    };

    await reactionStreaksCollection.updateOne(
      { userId },
      { $set: updatedData }
    );
    console.log(`🔥 Streak mis à jour pour ${userId}: ${newStreak} jours`);

    channel.send(
      `✅ Merci <@${userId}> ! Ton streak est maintenant de **${newStreak}** jour(s) (${updatedData.count} réactions au total).`
    );
  }
}

module.exports = { updateStreak };
