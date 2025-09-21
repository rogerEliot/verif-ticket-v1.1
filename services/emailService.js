const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.templates = {};
    this.templatesDir = path.join(__dirname, '../email-templates');
  }

  async loadTemplates(lang = 'fr') {
    try {
      const langDir = path.join(this.templatesDir, lang);
      const files = await fs.readdir(langDir);
      
      for (const file of files) {
        if (file.endsWith('.json')) {
          const templateName = file.replace('.json', '');
          const content = await fs.readFile(path.join(langDir, file), 'utf8');
          this.templates[templateName] = JSON.parse(content);
        }
      }
      
      console.log('✅ Modèles d\'emails chargés avec succès');
    } catch (error) {
      console.error('❌ Erreur lors du chargement des modèles d\'emails :', error);
      throw error;
    }
  }

  renderTemplate(templateName, variables = {}) {
    const template = this.templates[templateName];
    if (!template) {
      throw new Error(`Modèle d'email non trouvé : ${templateName}`);
    }

    const result = { ...template };
    
    // Remplacer les variables dans le sujet et le texte
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
      result.subject = result.subject.replace(placeholder, value);
      
      if (result.text) {
        result.text = result.text.replace(placeholder, value);
      }
      
      if (result.html) {
        result.html = result.html.replace(placeholder, value);
      }
    }

    return result;
  }
}

// Exporter une instance unique
module.exports = new EmailService();
