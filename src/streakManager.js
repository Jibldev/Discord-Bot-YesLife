const { getDatabase } = require("./database");

const validStart = "07:00";
const validEnd = "19:00";

// Vérifie si l'heure actuelle est dans la plage valide
function isWithinValidHours() {
  const now = new Date().toLocaleTimeString("fr-FR", {
    hour12: false,
    timeZone: "Europe/Paris",
  });
  return now >= validStart && now <= validEnd;
}

async function updateStreak(userId, messageId, channel) {
  if (!isWithinValidHours()) {
    console.log(`⏰ Réaction hors plage horaire pour ${userId}`);
    return;
  }

  const db = getDatabase();
  const reactionStreaksCollection = db.collection("streaks");

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  let userData = await reactionStreaksCollection.findOne({ userId });

  if (!userData) {
    // L'utilisateur n'a jamais réagi => nouvelle entrée
    userData = {
      userId,
      count: 1,
      streak: 1,
      lastReaction: today,
    };
    await reactionStreaksCollection.insertOne(userData);
    console.log(`🔥 Nouvelle réaction pour ${userId}: Streak de 1 jour`);
  } else {
    // Si l'utilisateur a déjà réagi aujourd'hui => on ne fait rien
    if (userData.lastReaction === today) {
      console.log(`✅ ${userId} a déjà réagi aujourd'hui`);
      return;
    }

    // Vérifie si la dernière réaction était hier
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    if (userData.lastReaction === yesterdayStr) {
      userData.streak += 1;
    } else {
      userData.streak = 1;
    }

    userData.count += 1;
    userData.lastReaction = today;

    await reactionStreaksCollection.updateOne(
      { userId },
      {
        $set: {
          streak: userData.streak,
          count: userData.count,
          lastReaction: today,
        },
      }
    );

    console.log(
      `🔥 Streak mis à jour pour ${userId}: ${userData.streak} jours`
    );
  }

  // Message dans le channel Discord
  channel.send(
    `✅ Merci <@${userId}> ! Ton streak est maintenant de **${userData.streak}** jour(s) (${userData.count} réactions au total).`
  );
}

module.exports = { updateStreak };
