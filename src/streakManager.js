const fs = require("fs");

// Définir ici ta plage horaire valide (peut être déplacée dans un settings.json plus tard)
const validStart = "12:30";
const validEnd = "13:00";

// Fonction pour vérifier si l'heure actuelle est dans la plage valide
function isWithinValidHours() {
  const now = new Date().toLocaleTimeString("fr-FR", {
    hour12: false,
    timeZone: "Europe/Paris",
  });
  return now >= validStart && now <= validEnd;
}

// Fonction pour mettre à jour le streak
function updateStreak(userId, messageId, channel) {
  if (!isWithinValidHours()) {
    console.log(`⏰ Réaction hors plage horaire pour ${userId}`);
    return;
  }

  const file = "reactionStreaks.json";
  let data = {};

  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, "utf8"));
  }

  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  const userData = data[userId] || { count: 0, streak: 0, lastReaction: null };

  // Vérifie si l'utilisateur a déjà réagi aujourd'hui
  if (userData.lastReaction === today) {
    console.log(`✅ ${userId} a déjà réagi aujourd'hui`);
    return;
  }

  // Vérifie si la dernière réaction était hier
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split("T")[0];

  if (userData.lastReaction === yesterdayStr) {
    userData.streak += 1; // Continue le streak
  } else {
    userData.streak = 1; // Reset le streak
  }

  userData.count += 1;
  userData.lastReaction = today;
  data[userId] = userData;

  fs.writeFileSync(file, JSON.stringify(data, null, 2));
  console.log(`🔥 Streak mis à jour pour ${userId} : ${userData.streak} jours`);

  channel.send(
    `✅ Merci <@${userId}> ! Ton streak est maintenant de **${userData.streak}** jour(s) (${userData.count} réactions au total).`
  );
}

module.exports = { updateStreak };
