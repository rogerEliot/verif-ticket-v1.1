require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const app = express();

// const mongoose = require('mongoose'); // Commenté car MongoDB est temporairement ignoré

// const mongoURI = process.env.MONGODB_URI;
// mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('Connecté à MongoDB'))
//   .catch(err => console.error('Erreur de connexion MongoDB:', err));

const port = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

app.post('/submit', (req, res) => {
  const formData = req.body;
  console.log('📥 Données reçues depuis le formulaire :', JSON.stringify(formData, null, 2));
  res.status(200).send('Données reçues avec succès (via log Render)');
});

app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur le port ${port}`);
});
