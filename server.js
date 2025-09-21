require('dotenv').config();
const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const path = require('path');

// Initialisation de l'application Express
const app = express();

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Services
const emailService = require('./services/emailService');

// Configuration du transporteur d'emails
console.log('🔑 Configuration de Nodemailer avec les identifiants :');
console.log('Email:', process.env.EMAIL_USER);
console.log('Mot de passe défini:', !!process.env.EMAIL_PASS);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  // Désactiver la vérification du certificat
  tls: {
    rejectUnauthorized: false
  },
  // Utiliser le port 587 avec TLS
  port: 587,
  secure: false, // true pour 465, false pour les autres ports
  requireTLS: true
});

// Charger les modèles d'emails au démarrage
emailService.loadTemplates('fr').catch(console.error);

// Vérification de la configuration du transporteur
transporter.verify(function(error, success) {
  if (error) {
    console.error('❌ Erreur de configuration du transporteur:', error);
  } else {
    console.log('✅ Configuration du transporteur OK - Prêt à envoyer des emails');
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
    // Formater la date et l'heure
    const now = new Date();
    const formattedDate = now.toLocaleString('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    // Générer une référence unique pour cette soumission
    const reference = `TKT-${Date.now().toString().slice(-6)}`;
    const montantTotal = formData.tickets.reduce((sum, ticket) => sum + parseFloat(ticket.montant), 0);
    
    // Préparer les données pour les templates
    const templateData = {
      reference,
      date: formattedDate,
      email: formData.email,
      devise: formData.devise,
      ticketsCount: formData.tickets.length,
      montantTotal: montantTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      currentYear: new Date().getFullYear(),
      
      // Données pour le template admin
      ticketsRows: formData.tickets.map((ticket, index) => `
        <tr>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${index + 1}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0;">${ticket.type}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; font-family: monospace;">${ticket.code}</td>
          <td style="padding: 10px; border: 1px solid #e2e8f0; text-align: right; font-weight: bold;">
            ${parseFloat(ticket.montant).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${formData.devise}
          </td>
        </tr>
      `).join(''),
      
      ticketsDetails: formData.tickets.map((ticket, index) => 
        `- Ticket ${index + 1}: ${ticket.type} (${ticket.code}) - ${parseFloat(ticket.montant).toLocaleString('fr-FR')} ${formData.devise}`
      ).join('\n')
    };
    
    // Récupérer les templates
    const adminEmail = emailService.renderTemplate('notification-admin', templateData);
    const userEmail = emailService.renderTemplate('confirmation-client', templateData);
    
    // Ajouter les expéditeurs et destinataires
    const adminOptions = {
      ...adminEmail,
      from: `"VerifTicket" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: formData.email
    };
    
    const userOptions = {
      ...userEmail,
      from: `"VerifTicket" <${process.env.EMAIL_USER}>`,
      to: formData.email
    };

    try {
      // Envoyer l'email à l'administrateur
      await transporter.sendMail(adminOptions);
      console.log('📧 Email admin envoyé avec succès');
      
      // Envoyer l'email de confirmation à l'utilisateur
      await transporter.sendMail(userOptions);
      console.log('📧 Email de confirmation envoyé à l\'utilisateur');
      
      res.status(200).json({ 
        success: true, 
        message: `Votre demande #${reference} a bien été enregistrée. Un email de confirmation vous a été envoyé.`,
        reference
      });
    } catch (emailError) {
      console.error('❌ Erreur lors de l\'envoi des emails :', emailError);
      throw new Error(`Votre demande #${reference} a été enregistrée, mais une erreur est survenue lors de l'envoi des emails de confirmation.`);
    }
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email :', error);
    res.status(500).json({ 
      success: false, 
      message: 'Erreur lors du traitement de votre demande' 
    });
  }
});

// Route de test pour l'envoi d'email
app.get('/test-email', async (req, res) => {
  try {
    console.log('Tentative d\'envoi d\'email de test...');
    
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: process.env.EMAIL_USER,
      subject: 'Test d\'envoi d\'email',
      text: 'Ceci est un email de test depuis votre application de vérification de tickets.'
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email de test envoyé avec succès:', info.messageId);
    res.send('Email de test envoyé avec succès!');
  } catch (error) {
    console.error('❌ Erreur lors de l\'envoi de l\'email de test:', error);
    res.status(500).send('Erreur lors de l\'envoi de l\'email de test: ' + error.message);
  }
});

app.listen(port, () => {
  console.log(`🚀 Serveur démarré sur le port ${port}`);
  console.log(`🌐 Testez l'envoi d'email en visitant: http://localhost:${port}/test-email`);
});

