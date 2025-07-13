const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const bodyParser = require('body-parser');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('.'));

const blockchainFile = 'blockchain.json';

// 🔹 Stockage local de la blockchain et des signatures
let blockchain = [];
const knownSignatures = {};

// 🔹 Chargement de la blockchain existante
if (fs.existsSync(blockchainFile)) {
  console.log("📦 Fichier blockchain.json trouvé. Lecture en cours...");
  const data = fs.readFileSync(blockchainFile);
  try {
    console.log("📂 Contenu brut :", data.toString());
    blockchain = JSON.parse(data);

    if (blockchain.length === 0) {
      console.log("⚠️ Blockchain vide. Création du bloc Genesis...");
      const genesisBlock = createGenesisBlock();
      blockchain.push(genesisBlock);
      saveBlockchain();
    } else {
      console.log(`✅ ${blockchain.length} blocs chargés.`);
    }

    // Remplir les signatures connues à partir de la chaîne
    blockchain.forEach(block => {
      if (block.pseudo && block.signature) {
        knownSignatures[block.pseudo] = block.signature;
      }
    });

  } catch (e) {
    console.log("❌ Erreur de lecture du JSON, création du bloc Genesis...");
    blockchain = [];
    const genesisBlock = createGenesisBlock();
    blockchain.push(genesisBlock);
    saveBlockchain();
  }
} else {
  console.log("📄 Fichier blockchain.json non trouvé. Création du bloc Genesis.");
  const genesisBlock = createGenesisBlock();
  blockchain.push(genesisBlock);
  saveBlockchain();
}

// 🔐 Fonction de hash
function hashBlock(block) {
  const data = block.index + block.timestamp + block.truth + block.pseudo + (block.signature || '') + block.previousHash;
  return crypto.createHash('sha256').update(data).digest('hex');
}

// 🔐 Création du bloc Genesis
function createGenesisBlock() {
  const genesisBlock = {
    index: 0,
    timestamp: new Date().toISOString(),
    truth: "This is the beginning of Truthchain.",
    pseudo: "genesis",
    signature: "genesis_signature",
    verified: true,
    previousHash: "0",
    hash: ""
  };
  genesisBlock.hash = hashBlock(genesisBlock);
  return genesisBlock;
}

// 💾 Sauvegarde dans blockchain.json
function saveBlockchain() {
  console.log("💾 Sauvegarde de la blockchain dans blockchain.json...");
  fs.writeFileSync(blockchainFile, JSON.stringify(blockchain, null, 2));
  console.log("✅ Fichier blockchain.json mis à jour.");
}

// 🔸 API pour ajouter une vérité
app.post('/api/commit', (req, res) => {
  const { truth, pseudo, signature } = req.body;
  console.log(`📥 Nouvelle vérité reçue de [${pseudo}]: "${truth}"`);

  if (!pseudo || !signature) {
    return res.status(400).json({ error: "Pseudo et signature sont requis." });
  }

  // Vérifier si le pseudo est déjà pris avec une signature différente
  if (knownSignatures[pseudo] && knownSignatures[pseudo] !== signature) {
    console.log(`❌ Signature invalide pour le pseudo "${pseudo}"`);
    return res.status(400).json({ error: "Ce pseudo est déjà utilisé par quelqu’un d’autre." });
  }

  // Stocker la signature si première apparition
  if (!knownSignatures[pseudo]) {
    knownSignatures[pseudo] = signature;
    console.log(`🔐 Nouveau pseudo vérifié: ${pseudo}`);
  }

  const previousBlock = blockchain[blockchain.length - 1];
  const newBlock = {
    index: previousBlock.index + 1,
    timestamp: new Date().toISOString(),
    truth,
    pseudo,
    signature,
    verified: true,
    previousHash: previousBlock.hash
  };
  newBlock.hash = hashBlock(newBlock);

  console.log("🧱 Nouveau bloc généré :", newBlock);

  blockchain.push(newBlock);
  saveBlockchain();

  res.status(201).json(newBlock);
});

// 🔸 API pour voir toute la chaîne (pagination)
app.get('/api/chain', (req, res) => {
  const offset = parseInt(req.query.offset || '0');
  const limit = parseInt(req.query.limit || '50');
  const slice = blockchain.slice().reverse().slice(offset, offset + limit);
  res.json(slice);
});

// 🔍 API pour valider un pseudo AVANT engagement
app.get('/api/validate-pseudo', (req, res) => {
  const requested = req.query.pseudo?.trim().toLowerCase();
  const exists = blockchain.some(block =>
    block.pseudo.toLowerCase() === requested && block.index > 0
  );
  res.json({ valid: !exists });
});

// 🚀 Lancement du serveur
app.listen(port, () => {
  console.log(`🚀 Truthchain running at http://localhost:${port}`);
});
