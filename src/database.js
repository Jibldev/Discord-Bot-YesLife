require("dotenv").config();
const { MongoClient } = require("mongodb");

const client = new MongoClient(process.env.MONGODB_URI);

let db;

async function connectToDatabase() {
  try {
    await client.connect();
    db = client.db("YesLifeBot");
    console.log("✅ Connexion à MongoDB réussie");
  } catch (error) {
    console.error("❌ Erreur de connexion à MongoDB :", error);
  }
}

function getDatabase() {
  return db;
}

module.exports = { connectToDatabase, getDatabase };
