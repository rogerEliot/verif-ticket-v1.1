document.addEventListener('DOMContentLoaded', () => {
    const ticketForm = document.getElementById('ticketForm');
    const confirmationMessageDiv = document.getElementById('confirmation-message');
    const messageText = document.getElementById('message-text');
    const closeMessageBtn = document.querySelector('.close-message');
    const newSubmissionBtn = document.getElementById('new-submission');
    const submitButton = ticketForm.querySelector('button[type="submit"]');

    // Fonction pour afficher/masquer la modale
    function toggleConfirmationMessage(show, text = "") {
        if (show) {
            messageText.textContent = text;
            confirmationMessageDiv.style.display = 'flex';
        } else {
            confirmationMessageDiv.style.display = 'none';
        }
    }

    // Gestion de la soumission du formulaire
    ticketForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Empêche le rechargement de la page

        // Désactiver le bouton de soumission et afficher un indicateur de chargement
        submitButton.disabled = true;
        submitButton.innerHTML = '<span class="loading"></span> Envoi en cours...';

        // Récupérer les données du formulaire
        const formData = new FormData(ticketForm);
        const data = {};
        for (let [key, value] of formData.entries()) {
            data[key] = value;
        }
        // Ajouter la devise qui n'a pas d'attribut 'name'
        data.devise = document.getElementById('devise').value;

        try {
            const response = await fetch('/submit-ticket', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(data),
            });

            const result = await response.json();

            if (result.success) {
                toggleConfirmationMessage(true, result.message);
                ticketForm.reset(); // Réinitialise le formulaire
            } else {
                toggleConfirmationMessage(true, `Erreur: ${result.message}`);
            }
        } catch (error) {
            console.error('Erreur lors de la soumission du formulaire:', error);
            toggleConfirmationMessage(true, "Une erreur inattendue est survenue. Veuillez réessayer plus tard.");
        } finally {
            // Réactiver le bouton de soumission
            submitButton.disabled = false;
            submitButton.innerHTML = 'Valider';
        }
    });

    // Bouton pour fermer la modale
    closeMessageBtn.addEventListener('click', () => {
        toggleConfirmationMessage(false);
    });

    // Bouton pour une nouvelle soumission (ferme la modale)
    newSubmissionBtn.addEventListener('click', () => {
        toggleConfirmationMessage(false);
    });

    // Ajoute les classes d'erreur pour la validation côté client (HTML5)
    ticketForm.querySelectorAll('input, select').forEach(element => {
        element.addEventListener('invalid', () => {
            element.classList.add('error');
        });
        element.addEventListener('input', () => {
            if (element.validity.valid) {
                element.classList.remove('error');
            }
        });
    });
});