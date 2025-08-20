require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const nodemailer = require('nodemailer');
const app = express();

// Configuration du transporteur d'emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER, // Votre adresse Gmail
    pass: process.env.EMAIL_PASS  // Votre mot de passe d'application Gmail
  }
});

// const mongoose = require('mongoose'); // Commenté car MongoDB est temporairement ignoré

// const mongoURI = process.env.MONGODB_URI;
// mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
//   .then(() => console.log('Connecté à MongoDB'))
//   .catch(err => console.error('Erreur de connexion MongoDB:', err));

const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Fonction de validation d'email côté serveur
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

app.post('/submit', async (req, res) => {
  const formData = req.body;
  console.log('📥 Données reçues depuis le formulaire :', JSON.stringify(formData, null, 2));
  
  // Validation côté serveur
  if (!formData.email || !isValidEmail(formData.email)) {
    console.error('❌ Email invalide reçu :', formData.email);
    return res.status(400).json({ success: false, message: 'Adresse email invalide' });
  }

  // Vérification des tickets
  if (!Array.isArray(formData.tickets) || formData.tickets.length === 0) {
    console.error('❌ Aucun ticket valide reçu');
    return res.status(400).json({ success: false, message: 'Aucun ticket valide fourni' });
  }
  
  try {
    // Configuration de l'email
    const mailOptions = {
from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER, // Toujours envoyer à l'administrateur
      replyTo: formData.email, // Permet de répondre à l'utilisateur si nécessaire
      subject: 'Nouvelle soumission de ticket',
      text: `Nouvelle soumission de ticket :\n\n${JSON.stringify(formData, null, 2)}`,
      html: `
        <h1>Nouvelle soumission de ticket</h1>
        <h3>Détails :</h3>
        <p>Email: ${formData.email}</p>
        <p>Devise: ${formData.devise}</p>
        <h4>Tickets :</h4>
        <ul>
          ${formData.tickets.map((ticket, index) => 
            `<li>Ticket ${index + 1}: ${ticket.type} - ${ticket.code}</li>`
          ).join('')}
        </ul>
      `
    };

    // Envoi de l'email
    await transporter.sendMail(mailOptions);
    console.log('📧 Email envoyé avec succès');
    res.status(200).json({ 
      success: true, 
      message: 'Données reçues avec succès. Un email de confirmation a été envoyé.' 
    });
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email :', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du traitement de votre demande' 
    });
  }
});

app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur le port ${port}`);
});

