# 📅 YesLifeBot — Bot Discord de Streaks quotidiens ✅

YesLifeBot est un bot Discord conçu pour encourager les habitudes quotidiennes grâce à un système de streaks.  
Chaque jour, un message est posté à une heure définie, et les utilisateurs peuvent réagir avec ✅ pour maintenir leur streak 🔥

---

## ✨ Fonctionnalités principales

- 🕒 Envoi automatique d’un message quotidien dans un canal défini
- ✅ Réaction enregistrée uniquement pendant une **plage horaire** personnalisable
- 🔥 Streaks individuels avec compteur automatique
- 🏆 Classements :
  - `!ladder` → Top streaks actuels, historiques, et nombre total de réactions
  - `!streakuser` → Statistiques d’un utilisateur (mentionné ou soi-même)
- 🔧 Commandes d’administration :
  - `!setchannel` → Définit le canal pour les messages quotidiens
  - `!removechannel` → Supprime le canal configuré
  - `!setdaily HH:MM Message` → Programme l’heure et le message du jour
- 🛠️ Utilise MongoDB pour une persistance des données fiable

---

## 🚀 Commandes disponibles

| Commande                  | Description                                      |
| ------------------------- | ------------------------------------------------ |
| `!setchannel`             | Définit le canal de messages quotidiens          |
| `!removechannel`          | Supprime le canal défini                         |
| `!setdaily HH:MM Message` | Programme l’heure et le contenu du message       |
| `!testreact`              | Envoie un message avec réaction ✅ pour test     |
| `!debugcron`              | Affiche l’heure actuelle et la configuration     |
| `!ladder`                 | Affiche le classement des streaks et réactions   |
| `!streaks`                | Afficher les streaks                             |
| `!streakuser [@user]`     | Affiche les stats d’un utilisateur (ou soi-même) |

---

## 🛠️ Technologies utilisées

- [Node.js](https://nodejs.org/)
- [Discord.js v14](https://discord.js.org/)
- [MongoDB (Atlas)](https://www.mongodb.com/)
- [Render](https://render.com/) pour l’hébergement

---

## 📦 Installation

1. Clone ce repo :

git clone https://github.com/ton-pseudo/yeslifebot.git

2. Installe les dépendances :

npm install

3. Crée un fichier .env :

DISCORD_TOKEN=ton_token
MONGODB_URI=ton_uri_mongodb
PORT=3000

4. Lance le bot :

node src/index.js

## 📄 Licence

Ce projet est sous licence MIT.  
Voir le fichier [LICENSE](./LICENSE) pour plus d’informations.
