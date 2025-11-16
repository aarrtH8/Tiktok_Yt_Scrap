# 🎬 YouTube to TikTok Video Compiler

[![Python](https://img.shields.io/badge/Python-3.8+-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-14-black.svg)](https://nextjs.org/)
[![Flask](https://img.shields.io/badge/Flask-3.0-green.svg)](https://flask.palletsprojects.com/)

Application web complète pour créer des compilations vidéo au format TikTok (9:16) à partir de vidéos YouTube.

## ✨ Fonctionnalités principales

- 🎥 **Téléchargement YouTube** : Télécharge automatiquement les vidéos depuis n'importe quel lien YouTube
- 🤖 **Détection intelligente** : Analyse automatique des vidéos pour identifier les meilleurs moments
  - Détection de changements de scène avec FFmpeg
  - Analyse de l'énergie audio pour trouver les moments dynamiques
  - Système de scoring pour sélectionner les clips les plus engageants
- 📱 **Format TikTok** : Conversion automatique en format vertical 9:16
- ⚙️ **Qualité ajustable** : Support de plusieurs résolutions (480p, 720p, 1080p)
- ⏱️ **Durée personnalisable** : Choisissez la durée finale de votre compilation (15-180 secondes)
- 💾 **Compilation automatique** : Assemble les clips avec des transitions fluides
- 🎨 **Interface moderne** : UI élégante avec mode sombre/clair

## 🏗️ Architecture

Le projet est divisé en deux parties :

### Backend (Python + Flask)
- **Serveur API REST** pour le traitement vidéo
- **yt-dlp** pour le téléchargement YouTube
- **FFmpeg** pour l'analyse et le traitement vidéo
- **Détection intelligente** des meilleurs moments

### Frontend (Next.js + React)
- **Interface utilisateur moderne** avec Tailwind CSS
- **Composants réactifs** pour une expérience fluide
- **Communication API** avec le backend Flask

## 🚀 Démarrage rapide

### Prérequis

- Node.js 18+
- Python 3.8+
- FFmpeg

### Installation

1. **Cloner le projet**
```bash
git clone <votre-repo>
cd youtube-tiktok-compiler
```

2. **Lancer le backend**
```bash
cd backend
pip install -r requirements.txt
python server.py
```

Le backend démarre sur `http://localhost:5000`

3. **Lancer le frontend** (nouveau terminal)
```bash
npm install
npm run dev
```

Le frontend démarre sur `http://localhost:3000`

4. **Accéder à l'application**
```
http://localhost:3000
```

📖 **Pour un guide détaillé**, consultez [DEMARRAGE.md](DEMARRAGE.md)

## 📁 Structure du projet

```
.
├── backend/                    # Backend Python Flask
│   ├── server.py              # API REST principale
│   ├── youtube_downloader.py  # Téléchargement YouTube
│   ├── moment_detector.py     # Détection des meilleurs moments
│   ├── video_processor.py     # Traitement et compilation vidéo
│   ├── test_backend.py        # Tests du backend
│   ├── requirements.txt       # Dépendances Python
│   └── README.md             # Documentation backend
│
├── app/                       # Frontend Next.js
│   ├── page.tsx              # Page principale
│   ├── layout.tsx            # Layout de l'app
│   └── globals.css           # Styles globaux
│
├── components/               # Composants React
│   ├── header.tsx           # En-tête
│   ├── url-input.tsx        # Input pour URLs YouTube
│   ├── video-preview.tsx    # Prévisualisation des vidéos
│   ├── compilation-settings.tsx  # Paramètres de compilation
│   ├── processing-interface.tsx  # Interface de traitement
│   └── ui/                  # Composants UI shadcn
│
├── lib/                     # Utilitaires
│   ├── config.ts           # Configuration API
│   └── utils.ts            # Fonctions utilitaires
│
├── .env.local              # Variables d'environnement
├── DEMARRAGE.md            # Guide de démarrage détaillé
└── README.md               # Ce fichier
```

## 🎯 Comment ça marche ?

1. **Ajout de vidéos** : L'utilisateur colle des liens YouTube
2. **Détection** : Le backend télécharge et analyse les vidéos
3. **Sélection** : L'algorithme identifie les meilleurs moments
4. **Compilation** : Les clips sont assemblés en format vertical TikTok
5. **Téléchargement** : L'utilisateur récupère la vidéo finale

### Algorithme de détection

Le système utilise plusieurs techniques :

- **Détection de scènes** : FFmpeg identifie les changements de plans
- **Analyse audio** : Détection des moments à haute énergie
- **Scoring combiné** : Les deux méthodes sont combinées pour un score
- **Sélection intelligente** : Les meilleurs clips sont choisis selon le score

### Format TikTok

Les vidéos sont automatiquement :
- Converties en ratio 9:16 (vertical)
- Croppées intelligemment sur le centre de l'action
- Encodées en H.264 pour une compatibilité maximale
- Optimisées pour la taille et la qualité

## 🔧 API Endpoints

### `GET /health`
Vérification de l'état du serveur

### `POST /api/detect-video`
Détection des vidéos YouTube
```json
{
  "urls": ["https://youtube.com/watch?v=..."]
}
```

### `POST /api/process-video`
Traitement et détection des moments
```json
{
  "videos": [...],
  "settings": {
    "duration": 30,
    "quality": "720p",
    "autoDetect": true
  }
}
```

### `POST /api/download-video`
Téléchargement de la compilation finale
```json
{
  "sessionId": "uuid",
  "quality": "720p"
}
```

## 🧪 Tests

Pour tester le backend :

```bash
cd backend
python test_backend.py
```

Le script teste :
- ✅ Health check
- ✅ Détection de vidéo
- ✅ Workflow complet (optionnel)

## 🐛 Dépannage

### Le backend ne démarre pas
- Vérifiez que Python 3.8+ est installé
- Installez les dépendances : `pip install -r requirements.txt`
- Vérifiez que FFmpeg est installé : `ffmpeg -version`

### Erreur de téléchargement YouTube
- Mettez à jour yt-dlp : `pip install yt-dlp --upgrade`
- Utilisez des vidéos publiques sans restrictions

### Le frontend ne se connecte pas
- Vérifiez que le backend tourne sur le port 5000
- Vérifiez le fichier `.env.local`
- Consultez la console du navigateur (F12)

Pour plus de détails, consultez [DEMARRAGE.md](DEMARRAGE.md)

## 📊 Technologies utilisées

### Backend
- **Flask** - Framework web Python
- **yt-dlp** - Téléchargement YouTube
- **FFmpeg** - Traitement vidéo
- **NumPy** - Calculs numériques

### Frontend
- **Next.js 14** - Framework React
- **React** - Bibliothèque UI
- **Tailwind CSS** - Framework CSS
- **shadcn/ui** - Composants UI

## ⚖️ Mentions légales

⚠️ **Important** : Cette application est fournie à des fins éducatives uniquement.

- Respectez les conditions d'utilisation de YouTube
- N'utilisez que du contenu dont vous avez les droits
- Vérifiez les droits d'auteur avant toute monétisation
- Cette application ne doit pas être utilisée pour violer les droits d'auteur

## 🔮 Améliorations futures

- [ ] Support de plus de plateformes (Vimeo, Dailymotion)
- [ ] Ajout automatique de sous-titres
- [ ] Effets et filtres vidéo personnalisés
- [ ] File d'attente pour traiter plusieurs compilations
- [ ] Système d'authentification utilisateur
- [ ] Stockage cloud des vidéos
- [ ] Preview vidéo en temps réel
- [ ] Export direct vers TikTok/Instagram
- [ ] Analyse des tendances pour suggestions
- [ ] API publique pour développeurs

## 📝 Licence

Ce projet est sous licence MIT - voir le fichier LICENSE pour plus de détails.

## 🤝 Contribution

Les contributions sont les bienvenues ! N'hésitez pas à :
- Ouvrir une issue pour signaler un bug
- Proposer de nouvelles fonctionnalités
- Soumettre une pull request

## 📧 Contact

Pour toute question ou suggestion, n'hésitez pas à ouvrir une issue.

---

**Créé avec ❤️ pour les créateurs de contenu**

🎬 Transformez vos vidéos YouTube en contenu TikTok viral ! 🚀
