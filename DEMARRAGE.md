# 🎬 YouTube to TikTok Compiler - Guide de démarrage

Application complète pour créer des compilations TikTok à partir de vidéos YouTube.

## ✨ Fonctionnalités

✅ **Téléchargement YouTube** - Télécharge automatiquement les vidéos depuis YouTube
✅ **Détection intelligente** - Analyse les vidéos pour trouver les meilleurs moments
✅ **Format TikTok** - Conversion automatique en format vertical (9:16)
✅ **Qualité ajustable** - Support 480p, 720p et 1080p
✅ **Compilation automatique** - Crée des vidéos monétisables
✅ **Interface moderne** - UI élégante et facile à utiliser

## 📁 Structure du projet

```
.
├── backend/                 # Backend Python Flask
│   ├── server.py           # Serveur API principal
│   ├── youtube_downloader.py
│   ├── moment_detector.py
│   ├── video_processor.py
│   ├── requirements.txt
│   └── README.md
│
├── app/                    # Frontend Next.js
│   ├── page.tsx           # Page principale
│   └── api/               # Routes API (non utilisées avec le backend Flask)
│
├── components/            # Composants React
│   ├── header.tsx
│   ├── url-input.tsx
│   ├── video-preview.tsx
│   ├── compilation-settings.tsx
│   └── processing-interface.tsx
│
├── lib/                   # Utilitaires
│   └── config.ts         # Configuration API
│
└── .env.local            # Variables d'environnement
```

## 🚀 Installation et démarrage

### Prérequis

- Node.js 18+ et npm/pnpm
- Python 3.8+
- FFmpeg (pour le traitement vidéo)

#### Installation de FFmpeg

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install ffmpeg
```

**MacOS:**
```bash
brew install ffmpeg
```

**Windows:**
Téléchargez depuis https://ffmpeg.org/download.html

### Étape 1 : Configuration du Backend

```bash
# Se déplacer dans le répertoire backend
cd backend

# Installer les dépendances Python
pip install -r requirements.txt

# Lancer le serveur backend
python server.py
```

Le backend démarre sur `http://localhost:5000`

Vous devriez voir :
```
Starting YouTube to TikTok Compiler Backend
Temp directory: /tmp/video-compiler
FFmpeg available: True
yt-dlp available: True
Running on http://0.0.0.0:5000
```

### Étape 2 : Configuration du Frontend

Ouvrez un **nouveau terminal** :

```bash
# Installer les dépendances
npm install
# ou
pnpm install

# Lancer le serveur de développement
npm run dev
# ou
pnpm dev
```

Le frontend démarre sur `http://localhost:3000`

### Étape 3 : Accéder à l'application

Ouvrez votre navigateur et accédez à :
```
http://localhost:3000
```

## 📖 Utilisation

### 1. Ajouter des vidéos YouTube

- Collez un ou plusieurs liens YouTube dans le champ de saisie
- Cliquez sur "Add Videos"
- Les vidéos apparaissent avec leur miniature et durée

### 2. Configurer la compilation

Dans le panneau de droite :
- **Duration** : Choisissez la durée finale (15-180 secondes)
- **Auto-detect best moments** : Active la détection intelligente
- **Number of clips** : Nombre de clips à inclure
- **Quality** : Sélectionnez la qualité (480p, 720p, 1080p)

### 3. Générer la compilation

- Cliquez sur "Generate TikTok Video"
- Le backend télécharge les vidéos et analyse les meilleurs moments
- Une barre de progression indique l'avancement

### 4. Prévisualiser et télécharger

- Les meilleurs moments détectés s'affichent avec timestamps
- Cliquez sur "Download" pour télécharger la vidéo finale
- La vidéo est au format vertical TikTok (9:16)

## 🎯 Comment ça fonctionne ?

### Backend (Python + Flask)

1. **youtube_downloader.py**
   - Utilise yt-dlp pour télécharger les vidéos
   - Extrait les métadonnées (titre, durée, miniature)

2. **moment_detector.py**
   - Détecte les changements de scène avec FFmpeg
   - Analyse l'énergie audio pour trouver les moments dynamiques
   - Score et sélectionne les meilleurs clips

3. **video_processor.py**
   - Extrait les clips sélectionnés
   - Convertit en format vertical (9:16)
   - Compile avec transitions

4. **server.py**
   - API REST pour communiquer avec le frontend
   - Gestion des sessions et fichiers temporaires

### Frontend (Next.js + React)

- Interface utilisateur moderne avec Tailwind CSS
- Composants réutilisables
- Gestion d'état avec React hooks
- Communication avec le backend via fetch API

## 🔧 Configuration avancée

### Variables d'environnement

Créez/éditez `.env.local` :

```env
# URL du backend
NEXT_PUBLIC_API_URL=http://localhost:5000

# Pour le déploiement en production
# NEXT_PUBLIC_API_URL=https://votre-backend.com
```

### Modification de la qualité par défaut

Éditez `lib/config.ts` :

```typescript
export const DEFAULT_SETTINGS = {
  duration: 30,        // Durée par défaut en secondes
  quality: '1080p',    // Qualité par défaut
  autoDetect: true,    // Détection automatique
};
```

### Ajuster la détection des moments

Éditez `backend/moment_detector.py` :

```python
class MomentDetector:
    def __init__(self):
        self.scene_threshold = 0.4      # Sensibilité des scènes
        self.min_clip_duration = 3      # Durée minimale d'un clip
        self.max_clip_duration = 6      # Durée maximale d'un clip
```

## 🐛 Dépannage

### Le backend ne démarre pas

**Erreur : "yt-dlp not found"**
```bash
pip install yt-dlp --upgrade
```

**Erreur : "FFmpeg not found"**
```bash
# Vérifier l'installation
ffmpeg -version
```

### Le frontend ne se connecte pas au backend

1. Vérifiez que le backend est lancé sur le port 5000
2. Vérifiez `.env.local` contient la bonne URL
3. Vérifiez les logs de la console du navigateur (F12)

### Erreur de téléchargement YouTube

- Certaines vidéos peuvent être protégées (âge, région)
- Essayez avec des vidéos publiques sans restrictions
- Mettez à jour yt-dlp : `pip install yt-dlp --upgrade`

### La vidéo compilée ne se télécharge pas

1. Vérifiez les logs du backend pour les erreurs FFmpeg
2. Assurez-vous d'avoir assez d'espace disque dans `/tmp`
3. Vérifiez que FFmpeg est bien installé

### Performance lente

- Réduisez la qualité (480p au lieu de 1080p)
- Limitez le nombre de vidéos (max 3-4)
- Réduisez la durée de la compilation

## 📦 Déploiement en production

### Backend

```bash
# Installer gunicorn pour la production
pip install gunicorn

# Lancer avec gunicorn
gunicorn -w 4 -b 0.0.0.0:5000 server:app
```

### Frontend

```bash
# Build pour production
npm run build

# Lancer en production
npm start
```

### Docker (optionnel)

Créez un `Dockerfile` pour containeriser l'application.

## ⚖️ Notes importantes

- **Respectez les conditions d'utilisation de YouTube**
- **Droits d'auteur** : N'utilisez que du contenu dont vous avez les droits
- **Usage personnel** : Cette application est à des fins éducatives
- **Monétisation** : Assurez-vous d'avoir les droits avant de monétiser

## 🔮 Fonctionnalités futures

- [ ] Support de plus de plateformes (Vimeo, Dailymotion)
- [ ] Ajout de sous-titres automatiques
- [ ] Effets et filtres personnalisés
- [ ] File d'attente pour traiter plusieurs compilations
- [ ] Authentification utilisateur
- [ ] Stockage cloud des vidéos
- [ ] Preview en temps réel
- [ ] Export vers TikTok/Instagram directement

## 📝 Support

Pour toute question ou problème :
1. Vérifiez les logs du backend et frontend
2. Consultez les README dans le dossier backend
3. Vérifiez que toutes les dépendances sont installées

## 🎉 Félicitations !

Vous avez maintenant une application complète et fonctionnelle pour créer des compilations TikTok à partir de vidéos YouTube ! 🚀
