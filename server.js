require('dotenv').config(); // Charge les variables d'environnement du fichier .env

const express = require('express');
const path = require('path');
const SibApiV3Sdk = require('sib-api-v3-sdk'); // SDK Brevo
const mongoose = require('mongoose'); // Pour MongoDB

const app = express();
const PORT = process.env.PORT || 3000; // Utilise le port défini par l'environnement (Render) ou 3000

// --- Configuration de Brevo ---
let defaultClient = SibApiV3Sdk.ApiClient.instance;
let apiKey = defaultClient.authentications['api-key'];
apiKey.apiKey = process.env.BREVO_API_KEY; // Récupère la clé API de Brevo depuis les variables d'environnement
let apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
// --- Fin Configuration Brevo ---

// Middleware pour parser les requêtes POST avec application/x-www-form-urlencoded
app.use(express.urlencoded({ extended: true }));
// Middleware pour parser les requêtes POST avec application/json
app.use(express.json());

// Servir les fichiers statiques du dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// --- Modèle Mongoose pour les tickets ---
// Déplacez la définition du schéma et du modèle ici, avant qu'ils ne soient utilisés
const ticketSchema = new mongoose.Schema({
    clientEmail: { type: String, required: [true, 'L\'adresse e-mail du client est requise.'] },
    devise: { type: String, required: [true, 'La devise est requise.'] },
    ticketsDetails: [{
        type: { type: String, required: [true, 'Le type de ticket est requis.'] },
        code: { type: String, required: [true, 'Le code du ticket est requis.'] },
        montant: { type: Number, required: [true, 'Le montant du ticket est requis.'] }
    }],
    status: {
        type: String,
        enum: ['pending', 'validated', 'rejected', 'error'], // Ajout du statut 'error' pour les tickets avec problèmes d'email
        default: 'pending'
    },
    submissionDate: {
        type: Date,
        default: Date.now
    },
    validationDate: {
        type: Date
    },
    adminNotes: {
        type: String
    }
}, { timestamps: true }); // Ajoute automatiquement createdAt et updatedAt

const Ticket = mongoose.model('Ticket', ticketSchema);

// Connexion à MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Connecté à MongoDB avec succès !'))
    .catch(err => console.error('❌ Erreur de connexion à MongoDB:', err.message, err)); // Plus de détails sur l'erreur

// Route principale pour servir le fichier index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour gérer la soumission du formulaire
app.post('/submit-ticket', async (req, res) => {
    console.log('🔗 Requête POST reçue sur /submit-ticket');
    console.log('➡️ Corps de la requête (req.body):', req.body);

    const { email, devise, type1, code1, montant1, type2, code2, montant2, type3, code3, montant3 } = req.body;

    // --- Validation initiale ---
    if (!email || !devise || (!code1 && !code2 && !code3)) {
        console.warn('⚠️ Validation initiale échouée: champs manquants (email, devise ou au moins un code de ticket).');
        return res.status(400).json({ success: false, message: "Veuillez remplir au moins l'email, la devise et un code de ticket." });
    }

    // Préparation des données du ticket
    const ticketsDetails = [];
    if (type1 && code1 && montant1) ticketsDetails.push({ type: type1, code: code1, montant: parseFloat(montant1) });
    if (type2 && code2 && montant2) ticketsDetails.push({ type: type2, code: code2, montant: parseFloat(montant2) });
    if (type3 && code3 && montant3) ticketsDetails.push({ type: type3, code: code3, montant: parseFloat(montant3) });

    if (ticketsDetails.length === 0) {
        console.warn('⚠️ Validation détaillée échouée: Aucun détail de ticket complet fourni.');
        return res.status(400).json({ success: false, message: "Veuillez fournir les informations complètes d'au moins un ticket." });
    }
    console.log('✅ Détails des tickets collectés:', ticketsDetails);

    // --- Préparation des e-mails ---
    const senderEmail = process.env.SENDER_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;
    const adminUrl = process.env.ADMIN_URL || `http://localhost:${PORT}/admin`;

    if (!senderEmail || !adminEmail || !apiKey.apiKey) {
        console.error("❌ Erreur de configuration: Les variables d'environnement Brevo (SENDER_EMAIL, ADMIN_EMAIL, BREVO_API_KEY) ne sont pas toutes définies.");
        return res.status(500).json({ success: false, message: "Erreur de configuration du serveur d'e-mails. Veuillez vérifier les variables d'environnement." });
    }

    let newTicket = null; // Déclarez ici pour qu'il soit accessible dans les blocs catch

    try {
        // 1. D'abord, enregistrer le ticket en base de données
        newTicket = new Ticket({
            clientEmail: email,
            devise: devise,
            ticketsDetails: ticketsDetails, // Utilisez la variable déjà préparée
            status: 'pending'
        });

        const savedTicket = await newTicket.save();
        console.log('💾 Ticket enregistré avec succès dans la base de données:', savedTicket._id);
        console.log('🔍 Détails du ticket enregistré:', savedTicket); // Log l'objet complet sauvegardé

        // --- Préparation et envoi des e-mails ---
        // 1. E-mail de confirmation au client
        let clientEmailContent = `
            <html>
            <head>
                <style>
                    body {
                        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                        line-height: 1.6;
                        color: #333333;
                        max-width: 600px;
                        margin: 0 auto;
                        padding: 20px;
                        background-color: #f4f7f6;
                        border-radius: 8px;
                        box-shadow: 0 0 10px rgba(0,0,0,0.05);
                    }
                    .header {
                        background-color: #3498db;
                        color: white;
                        padding: 20px;
                        text-align: center;
                        border-radius: 5px 5px 0 0;
                    }
                    .content {
                        padding: 25px;
                        background-color: #ffffff;
                        border: 1px solid #e0e0e0;
                        border-top: none;
                        border-radius: 0 0 5px 5px;
                    }
                    .ticket-info {
                        background-color: #f8f9fa;
                        border-left: 4px solid #3498db;
                        padding: 15px;
                        margin: 20px 0;
                        border-radius: 0 4px 4px 0;
                    }
                    .total-amount {
                        font-size: 1.2em;
                        font-weight: bold;
                        color: #2c3e50;
                        margin: 20px 0;
                        padding: 10px;
                        background-color: #e8f4fc;
                        border-radius: 4px;
                        text-align: center;
                    }
                    .footer {
                        margin-top: 30px;
                        padding-top: 20px;
                        border-top: 1px solid #e0e0e0;
                        font-size: 0.9em;
                        color: #7f8c8d;
                    }
                    ul { list-style: none; padding: 0; }
                    li { margin-bottom: 5px; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1 style="margin: 0; color: white;">Confirmation de votre demande</h1>
                </div>

                <div class="content">
                    <p>Bonjour,</p>

                    <p>Nous accusons bonne réception de votre demande de vérification de ticket(s) avec l'ID: <strong>${savedTicket._id}</strong>. Notre équipe traite actuellement votre requête avec la plus grande attention.</p>

                    <div class="ticket-info">
                        <p><strong>Détails de votre demande :</strong></p>
                        <ul>
                            ${ticketsDetails.map(t => `<li>Type: ${t.type}, Code: ${t.code}, Montant: ${t.montant} ${devise}</li>`).join('')}
                        </ul>
                    </div>

                    <div class="total-amount">
                        Montant total estimé : ${ticketsDetails.reduce((sum, t) => sum + t.montant, 0).toFixed(2)} ${devise}
                    </div>

                    <p>Nous vous tiendrons informé(e) par e-mail dès que la vérification sera terminée. La durée de traitement peut varier en fonction du nombre de demandes en cours.</p>

                    <p>Nous vous remercions pour votre confiance et votre patience.</p>

                    <div class="footer">
                        <p>Cordialement,<br>L'équipe VerifTicket</p>
                    </div>
                </div>
            </body>
            </html>
        `;

        let sendClientEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendClientEmail.subject = "Votre demande de vérification de ticket est en cours !";
        sendClientEmail.htmlContent = clientEmailContent;
        sendClientEmail.sender = { "name": "VerifTicket Support", "email": senderEmail };
        sendClientEmail.to = [{ "email": email }];

        // 2. E-mail de notification à l'administrateur
        let adminEmailContent = `
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f4f7f6; padding: 20px; }
                    .container { max-width: 700px; margin: 0 auto; background-color: #ffffff; border-radius: 8px; box-shadow: 0 0 10px rgba(0,0,0,0.05); overflow: hidden; }
                    .header-admin { background-color: #e67e22; color: white; padding: 20px; text-align: center; }
                    h1 { color: white; margin: 0; }
                    .content-admin { padding: 25px; }
                    .ticket-table {
                        width: 100%;
                        border-collapse: collapse;
                        margin: 20px 0;
                        box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                    }
                    .ticket-table th {
                        background-color: #f39c12;
                        color: white;
                        text-align: left;
                        padding: 12px;
                    }
                    .ticket-table td {
                        padding: 10px 12px;
                        border-bottom: 1px solid #ddd;
                    }
                    .ticket-table tr:nth-child(even) {
                        background-color: #f9f9f9;
                    }
                    .ticket-table tr:hover {
                        background-color: #f1f1f1;
                    }
                    .info-box {
                        background-color: #fff3e0;
                        border-left: 4px solid #f39c12;
                        padding: 10px 15px;
                        margin: 15px 0;
                    }
                    .admin-link a {
                        display: inline-block;
                        background-color: #28a745;
                        color: white;
                        padding: 10px 20px;
                        text-decoration: none;
                        border-radius: 5px;
                        margin-top: 20px;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header-admin">
                        <h1>🚨 Nouvelle soumission de ticket à vérifier ! 🚨</h1>
                    </div>
                    
                    <div class="content-admin">
                        <div class="info-box">
                            <p><strong>ID du Ticket DB:</strong> ${savedTicket._id}</p>
                            <p><strong>Client E-mail:</strong> ${email}</p>
                            <p><strong>Devise:</strong> ${devise}</p>
                            <p><strong>Date de soumission:</strong> ${new Date(savedTicket.submissionDate).toLocaleString()}</p>
                        </div>
                        
                        <h2>Détails des Tickets</h2>
                        <table class="ticket-table">
                            <thead>
                                <tr>
                                    <th>Type de ticket</th>
                                    <th>Code</th>
                                    <th>Montant (${devise})</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${ticketsDetails.map(t => `
                                    <tr>
                                        <td>${t.type}</td>
                                        <td><strong>${t.code}</strong></td>
                                        <td>${t.montant.toFixed(2)}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                            <tfoot>
                                <tr>
                                    <td colspan="2" style="text-align: right;"><strong>Total:</strong></td>
                                    <td><strong>${ticketsDetails.reduce((sum, t) => sum + t.montant, 0).toFixed(2)} ${devise}</strong></td>
                                </tr>
                            </tfoot>
                        </table>
                        
                        <div class="info-box admin-link">
                            <p>Veuillez vous connecter à l'interface d'administration pour effectuer la vérification de ces tickets.</p>
                            <a href="${adminUrl}">Accéder à l'interface Admin</a>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        let sendAdminEmail = new SibApiV3Sdk.SendSmtpEmail();
        sendAdminEmail.subject = `[NOUVEAU TICKET] ${email} - ID: ${savedTicket._id}`;
        sendAdminEmail.htmlContent = adminEmailContent;
        sendAdminEmail.sender = { "name": "VerifTicket Notifications", "email": senderEmail };
        sendAdminEmail.to = [{ "email": adminEmail }]; // Envoie à ton adresse admin


        // Envoi de l'e-mail au client
        try {
            const clientResponse = await apiInstance.sendTransacEmail(sendClientEmail);
            console.log(`✉️ E-mail de confirmation envoyé au client: ${email}`,
                `Message ID: ${clientResponse.messageId}`);
        } catch (clientError) {
            console.error('❌ Erreur lors de l\'envoi de l\'email client:', {
                error: clientError.message,
                response: clientError.response?.data || 'Pas de réponse détaillée',
                status: clientError.status || 'Inconnu'
            });
            throw clientError; // Relancer l'erreur pour la gestion globale
        }

        // Envoi de l'e-mail à l'administrateur
        try {
            const adminResponse = await apiInstance.sendTransacEmail(sendAdminEmail);
            console.log(`✉️ E-mail de notification envoyé à l'admin: ${adminEmail}`,
                `Message ID: ${adminResponse.messageId}`);
        } catch (adminError) {
            console.error('❌ Erreur lors de l\'envoi de l\'email admin:', {
                error: adminError.message,
                response: adminError.response?.data || 'Pas de réponse détaillée',
                status: adminError.status || 'Inconnu'
            });
            // On continue même si l'email admin échoue, on ne veut pas bloquer l'utilisateur pour ça
        }

        res.json({
            success: true,
            message: "Votre demande a été soumise avec succès et un e-mail de confirmation vous a été envoyé !",
            ticketId: savedTicket._id
        });

    } catch (error) { // Ce bloc catch gère les erreurs de DB ET les erreurs d'envoi d'email
        if (error instanceof mongoose.Error.ValidationError) {
            console.error('❌ Erreur de validation Mongoose lors de l\'enregistrement du ticket:', error.message);
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: `Erreur de validation: ${validationErrors.join(', ')}`,
                errors: validationErrors
            });
        } else if (error.code === 11000) {
            console.error('❌ Erreur de doublon (MongoError 11000) lors de l\'enregistrement du ticket:', error.message);
            return res.status(409).json({ success: false, message: "Un ticket avec des informations similaires existe déjà. " + (process.env.NODE_ENV === 'development' ? error.message : '') });
        } else if (error.response && error.response.text && error.statusCode) { // Brevo API Error
            console.error('❌ Erreur Brevo lors de l\'envoi des e-mails:', {
                status: error.statusCode,
                statusText: error.response.statusText,
                headers: error.response.headers,
                data: error.response.text,
                request: {
                    method: error.config?.method,
                    url: error.config?.url,
                    headers: error.config?.headers
                }
            });

            // Tente de mettre à jour le statut du ticket si enregistré
            if (newTicket && newTicket._id) {
                await Ticket.findByIdAndUpdate(newTicket._id, {
                    status: 'error',
                    adminNotes: `Échec d'envoi d'e-mail Brevo (code ${error.statusCode}): ${error.response.text}`
                });
                console.log(`⚠️ Statut du ticket ${newTicket._id} mis à jour en 'error' suite à un échec d'envoi d'e-mail.`);
            }

            let errorMessage = "Votre demande a été enregistrée mais une erreur est survenue lors de l'envoi des e-mails de confirmation.";
            try {
                const errorDetails = JSON.parse(error.response.text);
                errorMessage = errorDetails.message || errorMessage;
            } catch (e) {
                // Si la réponse n'est pas un JSON valide
                errorMessage = error.response.text || errorMessage;
            }
            return res.status(202).json({
                success: true, // Le ticket est enregistré, l'e-mail est le seul souci
                message: errorMessage,
                ticketId: newTicket ? newTicket._id : 'N/A'
            });

        } else {
            console.error('❌ Erreur inattendue lors du traitement du ticket:', error);
            return res.status(500).json({
                success: false,
                message: "Une erreur interne est survenue lors du traitement de votre demande.",
                errorDetails: process.env.NODE_ENV === 'development' ? error.message : undefined
            });
        }
    }
});


// --- Middleware d'Authentification Basic Auth ---
const basicAuth = (req, res, next) => {
    // Récupérer les identifiants depuis l'header Authorization
    const authheader = req.headers.authorization;

    if (!authheader) {
        let err = new Error('You are not authenticated!');
        res.setHeader('WWW-Authenticate', 'Basic');
        err.status = 401;
        return next(err);
    }

    // Décodage de l'header (Basic base64)
    const auth = new Buffer.from(authheader.split(' ')[1], 'base64').toString().split(':');
    const user = auth[0];
    const pass = auth[1];

    // Vérification des identifiants (depuis .env ou en dur si fallback nécessaire)
    const adminUser = process.env.ADMIN_USER || 'admin';
    const adminPass = process.env.ADMIN_PASS || 'admin';

    if (user === adminUser && pass === adminPass) {
        // Authentification réussie
        next();
    } else {
        let err = new Error('You are not authenticated!');
        res.setHeader('WWW-Authenticate', 'Basic');
        err.status = 401;
        return next(err);
    }
}

// Middleware de gestion d'erreur pour l'auth
app.use((err, req, res, next) => {
    if (err.status === 401) {
        res.status(401).send('Authentification requise pour accéder à cette interface.');
    } else {
        next(err);
    }
});

// --- Routes pour l'interface Admin ---

// Servir la page d'administration (Protégée)
app.get('/admin', basicAuth, (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

// API pour récupérer tous les tickets (Protégée)
app.get('/api/tickets', basicA  uth, async (req, res) => {
    console.log('🔗 Requête GET reçue sur /api/tickets');
    try {
        const tickets = await Ticket.find().sort({ submissionDate: -1 }); // Tri par date de soumission descendante
        console.log(`✅ ${tickets.length} tickets récupérés de la base de données.`);
        res.json(tickets);
    } catch (error) {
        console.error('❌ Erreur lors de la récupération des tickets depuis la base de données:', error);
        res.status(500).json({ success: false, message: 'Erreur lors de la récupération des tickets.' });
    }
});

// API pour mettre à jour le statut d'un ticket (Protégée)
app.patch('/api/tickets/:id/status', basicAuth, async (req, res) => {
    const { id } = req.params;
    const { status, adminNotes } = req.body;
    console.log(`🔗 Requête PATCH reçue sur /api/tickets/${id}/status avec statut: ${status}, notes: "${adminNotes}"`);


    if (!['validated', 'rejected'].includes(status)) {
        console.warn('⚠️ Tentative de mise à jour avec un statut invalide:', status);
        return res.status(400).json({ success: false, message: 'Statut invalide. Doit être "validated" ou "rejected".' });
    }

    try {
        const ticket = await Ticket.findById(id);
        if (!ticket) {
            console.warn(`⚠️ Ticket non trouvé avec l'ID: ${id}`);
            return res.status(404).json({ success: false, message: 'Ticket non trouvé.' });
        }

        ticket.status = status;
        ticket.validationDate = Date.now();
        ticket.adminNotes = adminNotes;

        await ticket.save();
        console.log(`💾 Statut du ticket ${id} mis à jour avec succès en: ${status}`);

        // --- Envoi de l'e-mail de statut final au client ---
        let emailSubject = '';
        let messageIntro = '';
        let motifSection = '';

        // Fonction pour masquer une partie du code (ex: 12345678 -> 12****78)
        const maskCode = (code) => {
            if (!code || code.length <= 4) return '****';
            return code.substring(0, 2) + '*'.repeat(code.length - 4) + code.substring(code.length - 2);
        };

        if (status === 'validated') {
            emailSubject = `✅ Votre ticket (ID: ${ticket._id}) a été VALIDÉ`;
            messageIntro = `<p>Cher client, nous avons le plaisir de vous informer que votre ticket <strong>${maskCode(ticket.ticketsDetails[0]?.code)}</strong> (et autres associés) est <strong>valide</strong>.</p>`;
            // Pas de motif spécial affiché en gros pour une validation, sauf si desired par l'utilisateur plus tard.
        } else {
            emailSubject = `❌ Votre ticket (ID: ${ticket._id}) a été REFUSÉ`;
            messageIntro = `<p>Cher client, nous sommes désolés de vous annoncer que votre ticket <strong>${maskCode(ticket.ticketsDetails[0]?.code)}</strong> (et autres associés) est <strong>invalide</strong>.</p>`;
            if (adminNotes) {
                motifSection = `
                    <div style="background-color: #ffebee; border-left: 4px solid #f44336; padding: 15px; margin: 20px 0; border-radius: 4px;">
                        <strong>Motif du refus :</strong><br/>
                        ${adminNotes}
                    </div>
                `;
            }
        }

        let emailContent = `
            <html>
            <head>
                <style>
                    body { font-family: 'Helvetica', 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { text-align: center; padding-bottom: 20px; border-bottom: 1px solid #eee; margin-bottom: 20px; }
                    .footer { text-align: center; color: #999; font-size: 0.8em; margin-top: 30px; border-top: 1px solid #eee; padding-top: 20px; }
                    h1 { color: ${status === 'validated' ? '#2e7d32' : '#c62828'}; font-size: 24px; }
                    ul { background: #f9f9f9; padding: 15px 20px; border-radius: 5px; list-style: none; }
                    li { margin-bottom: 8px; border-bottom: 1px solid #eee; padding-bottom: 8px; }
                    li:last-child { border-bottom: none; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>Statut de votre vérification</h1>
                </div>
                
                ${messageIntro}
                
                ${motifSection}

                <h3>Détails de votre demande :</h3>
                <ul>
                    <li><strong>Devise :</strong> ${ticket.devise}</li>
                    ${ticket.ticketsDetails.map(t => `
                        <li>
                            <strong>${t.type}</strong> : ${maskCode(t.code)} - ${t.montant} ${ticket.devise}
                        </li>
                    `).join('')}
                </ul>

                <p>Si vous avez des questions ou souhaitez effectuer une nouvelle vérification, n'hésitez pas à nous contacter ou à retourner sur notre site.</p>
                
                <div class="footer">
                    <p>Cordialement,<br>L'équipe VerifTicket</p>
                </div>
            </body>
            </html>
        `;

        const tranEmailApi = new SibApiV3Sdk.TransactionalEmailsApi();
        const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

        sendSmtpEmail.sender = { email: process.env.SENDER_EMAIL };
        sendSmtpEmail.to = [{ email: ticket.clientEmail }];
        sendSmtpEmail.subject = emailSubject;
        sendSmtpEmail.htmlContent = emailContent;

        await tranEmailApi.sendTransacEmail(sendSmtpEmail);
        console.log(`✉️ E-mail de statut '${status}' envoyé au client: ${ticket.clientEmail} pour le ticket ${ticket._id}`);

        res.json({ success: true, message: `Ticket mis à jour en "${status}" et e-mail de notification envoyé.`, ticket });

    } catch (error) {
        console.error(`❌ Erreur lors de la mise à jour du statut du ticket ${id} ou de l'envoi de l'e-mail:`, error);
        let errorMessage = "Une erreur est survenue lors de la mise à jour du statut du ticket ou de l'envoi de l'e-mail.";

        if (error.response && error.response.text && error.statusCode) {
            try {
                const errorDetails = JSON.parse(error.response.text);
                errorMessage = errorDetails.message || errorMessage;
            } catch (e) {
                errorMessage = error.response.text;
            }
        }
        res.status(500).json({ success: false, message: errorMessage });
    }
});

// Démarrer le serveur
app.listen(PORT, () => {
    console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    console.log(`🌐 Accès local: http://localhost:${PORT}`);
    console.log(`👨‍💻 Interface admin: http://localhost:${PORT}/admin`);
    console.log('--- Attente des requêtes ---');
});