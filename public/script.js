// Fonction de validation d'email
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(String(email).toLowerCase());
}

// Fonction pour activer/désactiver le bouton de soumission
function toggleSubmitButton(disabled, buttonText = 'Soumettre') {
    const submitButton = document.querySelector('button[type="submit"]');
    if (!submitButton) return;
    
    if (disabled) {
        submitButton.disabled = true;
        submitButton.innerHTML = `
            <span class="loading"></span>
            <span>${buttonText}...</span>
        `;
    } else {
        submitButton.disabled = false;
        submitButton.textContent = buttonText;
    }
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
        
        // Ajout d'un icône en fonction du type de message
        const icon = isError ? '❌' : '✅';
        messageText.innerHTML = `${icon} ${message}`;
        
        // Ajout d'une classe d'erreur pour l'animation
        if (isError) {
            messageText.classList.add('error');
            // Supprimer la classe après l'animation
            setTimeout(() => messageText.classList.remove('error'), 1000);
        }
        
        confirmationMessage.style.display = 'flex';
        
        // Fermeture automatique après 10 secondes pour les messages de succès
        if (!isError) {
            setTimeout(() => {
                confirmationMessage.style.display = 'none';
                form.reset();
            }, 10000);
        }
    }

    // Fermer le message
    closeMessage.addEventListener('click', () => {
        confirmationMessage.style.display = 'none';
    });

    // Nouvelle soumission
    newSubmissionBtn.addEventListener('click', (e) => {
        e.preventDefault();
        confirmationMessage.style.display = 'none';
        form.reset();
        // Faire défiler vers le haut du formulaire
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
    
    // Validation en temps réel
    emailInput.addEventListener('input', () => {
        if (emailInput.value.trim() === '') {
            emailInput.setCustomValidity('');
            return;
        }
        
        if (!isValidEmail(emailInput.value)) {
            emailInput.setCustomValidity('Veuillez entrer une adresse email valide');
            emailInput.reportValidity();
            emailInput.parentElement.classList.add('error');
        } else {
            emailInput.setCustomValidity('');
            emailInput.parentElement.classList.remove('error');
        }
    });

    form.addEventListener('submit', async (event) => {
        event.preventDefault();
        
        // Désactiver le bouton de soumission
        toggleSubmitButton(true, 'Envoi en cours');
        
        const email = emailInput.value.trim();
        const devise = document.getElementById('devise').value;
        
        // Validation côté client
        if (!isValidEmail(email)) {
            showMessage('Veuillez entrer une adresse email valide', true);
            emailInput.focus();
            toggleSubmitButton(false, 'Soumettre');
            return;
        }

        const tickets = [];
        let hasEmptyTicket = false;

        // Vérifier les tickets
        for (let i = 1; i <= 3; i++) {
            const type = document.getElementById(`type${i}`).value;
            const code = document.getElementById(`code${i}`).value.trim();
            
            // Si un des champs est rempli mais pas l'autre
            if ((type && !code) || (!type && code)) {
                showMessage(`Veuillez remplir tous les champs du ticket ${i}`, true);
                toggleSubmitButton(false, 'Soumettre');
                return;
            }
            
            if (type && code) {
                tickets.push({ type, code });
            } else {
                hasEmptyTicket = true;
            }
        }
        
        // Vérifier qu'au moins un ticket est saisi
        if (tickets.length === 0) {
            showMessage('Veuillez saisir au moins un ticket', true);
            toggleSubmitButton(false, 'Soumettre');
            return;
        }

        const data = {
            email,
            devise,
            tickets,
            timestamp: new Date().toISOString()
        };

        try {
            // Afficher un message de chargement
            showMessage('Traitement de votre demande en cours...');
            
            // Simuler un délai pour le démonstration (à supprimer en production)
            await new Promise(resolve => setTimeout(resolve, 1500));
            
            const response = await fetch(`${window.location.origin}/submit`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-Requested-With': 'XMLHttpRequest'
                },
                body: JSON.stringify(data)
            });

            const result = await response.json();
            
            if (response.ok) {
                showMessage("Votre demande a bien été enregistrée.\nUn email de confirmation vous a été envoyé.");
                form.reset();
                
                // Faire défiler vers le haut pour voir le message
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } else {
                const errorMessage = result.message || "Une erreur est survenue lors de l'envoi du formulaire";
                throw new Error(errorMessage);
            }
        } catch (error) {
            console.error('Erreur lors de la soumission :', error);
            const errorMessage = error.message.includes('Failed to fetch') 
                ? 'Impossible de se connecter au serveur. Veuillez vérifier votre connexion.' 
                : error.message;
            showMessage(`Erreur : ${errorMessage}`, true);
            
            // Faire défiler vers le haut pour voir le message d'erreur
            window.scrollTo({ top: 0, behavior: 'smooth' });
        } finally {
            // Réactiver le bouton de soumission dans tous les cas
            toggleSubmitButton(false, 'Soumettre');
        }
    });
});
