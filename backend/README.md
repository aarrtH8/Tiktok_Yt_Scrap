# YouTube to TikTok Video Compiler - Backend

Backend complet et fonctionnel pour l'application de compilation de vidéos YouTube en format TikTok.

## 🚀 Fonctionnalités

- ✅ Téléchargement de vidéos YouTube avec yt-dlp
- ✅ Détection intelligente des meilleurs moments
  - Analyse des changements de scène
  - Analyse de l'énergie audio
  - Scoring et sélection automatique
- ✅ Compilation vidéo avec FFmpeg
- ✅ Conversion au format vertical TikTok (9:16)
- ✅ Support de plusieurs qualités (480p, 720p, 1080p)
- ✅ Gestion des sessions
- ✅ API REST complète

## 📋 Prérequis

- Python 3.8+
- FFmpeg (installé)
- yt-dlp (installé via pip)

## 🔧 Installation

1. Installer les dépendances Python :
```bash
pip install -r requirements.txt
```

2. Vérifier que FFmpeg est installé :
```bash
ffmpeg -version
```

3. Lancer le serveur :
```bash
python server.py
```

Le serveur démarre sur `http://localhost:5000`

## 📡 API Endpoints

### 1. Health Check
```
GET /health
```
Vérifie que tous les services sont disponibles (ffmpeg, yt-dlp)

### 2. Détecter les vidéos YouTube
```
POST /api/detect-video
Content-Type: application/json

{
  "urls": ["https://www.youtube.com/watch?v=VIDEO_ID", ...]
}
```

Retourne les métadonnées des vidéos (titre, durée, miniature, etc.)

### 3. Traiter les vidéos
```
POST /api/process-video
Content-Type: application/json

{
  "videos": [...],
  "settings": {
    "duration": 30,
    "quality": "720p",
    "autoDetect": true
  }
}
```

Télécharge les vidéos, détecte les meilleurs moments et retourne un sessionId.

### 4. Télécharger la compilation
```
POST /api/download-video
Content-Type: application/json

{
  "sessionId": "uuid",
  "quality": "720p"
}
```

Compile les clips sélectionnés en format TikTok et retourne le fichier MP4.

### 5. Supprimer une session
```
DELETE /api/sessions/{sessionId}
```

Nettoie les fichiers temporaires d'une session.

## 🎯 Architecture

### Modules principaux

1. **server.py** - Serveur Flask principal avec les routes API
2. **youtube_downloader.py** - Gestion du téléchargement YouTube avec yt-dlp
3. **moment_detector.py** - Détection intelligente des meilleurs moments
4. **video_processor.py** - Compilation et conversion vidéo avec FFmpeg

### Flux de traitement

```
1. Frontend envoie URLs YouTube
   ↓
2. Backend télécharge les métadonnées
   ↓
3. Frontend demande le traitement
   ↓
4. Backend télécharge les vidéos
   ↓
5. Analyse et détection des meilleurs moments
   ↓
6. Frontend demande la compilation
   ↓
7. Backend compile en format vertical
   ↓
8. Téléchargement du fichier final
```

## 🎨 Détection des meilleurs moments

Le système utilise plusieurs techniques :

1. **Détection de scènes** - Identifie les changements de plans
2. **Analyse audio** - Trouve les moments à haute énergie
3. **Scoring combiné** - Combine les deux méthodes
4. **Sélection intelligente** - Choisit les meilleurs clips

## 🔄 Format TikTok

Les vidéos sont automatiquement converties en :
- Ratio d'aspect : 9:16 (vertical)
- Résolutions : 480p (480×854), 720p (720×1280), 1080p (1080×1920)
- Codec vidéo : H.264
- Codec audio : AAC
- Smart cropping : Centre sur l'action

## ⚙️ Configuration

Variables d'environnement (optionnelles) :

```bash
TEMP_DIR=/tmp/video-compiler  # Répertoire temporaire
PORT=5000                       # Port du serveur
DEBUG=True                      # Mode debug
```

## 🧹 Gestion des fichiers

- Les fichiers temporaires sont stockés dans `/tmp/video-compiler`
- Nettoyage automatique après téléchargement
- Sessions expirées après 1 heure
- Les vidéos téléchargées sont supprimées après compilation

## 🐛 Dépannage

### Erreur : "yt-dlp not found"
```bash
pip install yt-dlp --break-system-packages
```

### Erreur : "FFmpeg not found"
```bash
# Ubuntu/Debian
sudo apt-get install ffmpeg

# MacOS
brew install ffmpeg
```

### Erreur de téléchargement YouTube
Certaines vidéos peuvent être protégées. Essayez avec des vidéos publiques sans restrictions d'âge.

### Mémoire insuffisante
Pour les longues vidéos, augmentez la RAM disponible ou réduisez la qualité.

## 📝 Notes de production

Pour un déploiement en production :

1. Utilisez Gunicorn ou uWSGI au lieu du serveur Flask dev
2. Ajoutez Redis pour la gestion des sessions
3. Configurez un CDN pour les téléchargements
4. Ajoutez une file d'attente (Celery) pour les traitements lourds
5. Implémentez des limites de taux (rate limiting)
6. Ajoutez une authentification API

## 📄 Licence

Ce projet est fourni à des fins éducatives.
Respectez les conditions d'utilisation de YouTube.
