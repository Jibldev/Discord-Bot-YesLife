require("dotenv").config();
const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;
const clientMongo = new MongoClient(uri);

async function connectToDatabase() {
  try {
    await clientMongo.connect();
    console.log("✅ Connexion à MongoDB réussie");
    return clientMongo.db();
  } catch (error) {
    console.error("❌ Erreur de connexion à MongoDB :", error);
  }
}

module.exports = connectToDatabase;
