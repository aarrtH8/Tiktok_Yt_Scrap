# 🚀 Démarrage Ultra-Rapide

## Installation en 3 commandes

```bash
# 1. Installer les dépendances backend
cd backend && pip3 install -r requirements.txt && cd ..

# 2. Installer les dépendances frontend
npm install

# 3. Lancer l'application
./start.sh
```

## Ou lancement manuel

**Terminal 1 (Backend):**
```bash
cd backend
python3 server.py
```

**Terminal 2 (Frontend):**
```bash
npm run dev
```

**Accéder à l'application:**
```
http://localhost:3000
```

## ✅ Vérifier l'installation

- Python 3.8+ : `python3 --version`
- Node.js 18+ : `node --version`
- FFmpeg : `ffmpeg -version`

## 📖 Documentation

- **LISEZ-MOI.md** - Informations essentielles
- **README.md** - Documentation complète
- **DEMARRAGE.md** - Guide détaillé

## 🎯 Première utilisation

1. Collez un lien YouTube
2. Cliquez "Add Videos"
3. Configurez la durée (ex: 30 secondes)
4. Cliquez "Generate TikTok Video"
5. Attendez le traitement
6. Téléchargez votre vidéo !

## 🐛 En cas de problème

**Backend ne démarre pas:**
```bash
cd backend
pip3 install -r requirements.txt
```

**Frontend ne démarre pas:**
```bash
npm install
```

**FFmpeg manquant:**
- Ubuntu: `sudo apt-get install ffmpeg`
- MacOS: `brew install ffmpeg`

## 💡 Conseil

Testez d'abord avec une courte vidéo YouTube (< 5 minutes) et une compilation de 15-30 secondes.

---

**Tout fonctionne ? Profitez de votre application ! 🎉**
