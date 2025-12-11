# 🎬 YouTube → TikTok AI Compiler

[![Python](https://img.shields.io/badge/Python-3.12-blue.svg)](https://www.python.org/)
[![Next.js](https://img.shields.io/badge/Next.js-16-black.svg)](https://nextjs.org/)
[![CI](https://github.com/arthh/Tiktok_Yt_Scrap/actions/workflows/ci.yml/badge.svg)](https://github.com/arthh/Tiktok_Yt_Scrap/actions/workflows/ci.yml)

Application full-stack (Flask + Next.js) qui transforme automatiquement vos URLs YouTube/TikTok en compilations verticales optimisées pour TikTok, Reels et Shorts. L’IA détecte les moments forts, recadre les vidéos en 9:16, ajoute les sous-titres et exporte un MP4 prêt à publier.

---

## ✨ Fonctionnalités principales

- 🎥 **Détection automatique des clips** : scènes + énergie audio + scoring pondéré (avec fallback intelligent).
- 📱 **Conversion verticale** : recadrage adaptatif, smart focus, sous-titres incrustés et transitions lissées.
- ⚙️ **Paramètres avancés** : durée cible, qualité (480p → 1080p), sous-titres activables, multiples clips.
- 🎛️ **UI temps réel** : pipeline détaillé (analyse → download → highlights → rendu → export) avec journal live.
- ⏲️ **Durée respectée** : clamp dynamique pour rester proche de la durée demandée, même en cas de clips longs.
- 🧠 **Résilience** : retry sans sous-titres lors des erreurs 429/Too Many Requests, fallback par clip complet si besoin.

---

## 🏗️ Architecture

| Couche | Tech | Rôle |
| --- | --- | --- |
| Front | Next.js 16 / Tailwind / shadcn/ui | Interface, gestion d’état, pipeline visuel, téléchargement |
| API | Flask 3 / Python 3.12 | Endpoints `/detect-video`, `/process-video`, `/download-video`, session management |
| Traitement | yt-dlp, FFmpeg, NumPy, OpenCV | Téléchargement, détection de scènes/audio, rendu vertical, concat |

---

## 🚀 Lancement rapide

### 1. Prérequis
- Node.js 20.9+ (ou `./install_node.sh`)
- Python 3.12 + pip
- FFmpeg (ou `./install_ffmpeg.sh`)

### 2. Installation
```bash
git clone https://github.com/arthh/Tiktok_Yt_Scrap.git
cd Tiktok_Yt_Scrap
./run_app.sh
```
`run_app.sh` détecte automatiquement les versions locales (Node/FFmpeg), lance Flask (http://localhost:5000) + Next (http://localhost:3000) et surveille les logs (`.devlogs`).

Pour les installations manuelles, voir [DEMARRAGE.md](DEMARRAGE.md).

---

## 📁 Structure

```
.
├── app/                      # Frontend Next.js (page.tsx, layout, styles)
├── backend/
│   ├── server.py             # API Flask + orchestration sessions
│   ├── youtube_downloader.py # yt-dlp + retries sous-titres
│   ├── moment_detector.py    # scènes/audio scoring
│   └── video_processor.py    # extraction FFmpeg, rendu 9:16, concat
├── components/               # UI React (Input, Preview, Settings, Processing)
├── .github/workflows/ci.yml  # CI (build Next + compile backend)
├── install_ffmpeg.sh         # FFmpeg local
├── install_node.sh           # Node.js local
├── run_app.sh                # Lance backend + frontend + health checks
├── DEMARRAGE.md              # Guide complet
└── README.md                 # (ce fichier)
```

---

## ⚙️ API rapide

| Endpoint | Description |
| --- | --- |
| `GET /health` | Vérifie FFmpeg + yt-dlp |
| `POST /api/detect-video` | `{ "urls": ["..."] }` → métadonnées |
| `POST /api/process-video` | Télécharge, détecte les moments, retourne `{ sessionId, moments }` |
| `POST /api/download-video` | `{ sessionId, quality }` → MP4 généré |

---

## 🧪 Tests & CI

### Tests locaux
```bash
cd backend
python test_backend.py   # Health + detect + workflow (optionnel)
```

### CI/CD
- GitHub Actions `ci.yml` (Node 20.17 + Python 3.12) : `npm ci && npm run lint && npm run build` puis `compileall backend`.
- TODO: ajouter tests e2e (playwright) et tests backend automatisés.

---

## 🧭 Roadmap / Améliorations prévues

| Type | Idée |
| --- | --- |
| 🔧 AI | ✅ Détection hybride scènes/audio<br>☑️ Ajuster pondération selon type de contenu<br>🔜 Fine-tuning via feedback utilisateur |
| 📈 Rendu | ☑️ Estimation temps restant + ETA basée sur FFmpeg<br>☑️ Choix template transitions/callouts<br>🔜 Générer overlays dynamiques (typographie, emojis) |
| 🌐 Plateformes | 🔜 Import TikTok/Reels direct<br>🔜 Export vers TikTok API / Buffer |
| 💾 Infrastructure | ☑️ Clamp durée stricte (terminé)<br>☑️ Retry subtitle 429 (terminé)<br>🔜 File d’attente + workers<br>🔜 Stockage cloud (S3) + CDN |
| 🧑‍💻 DevEx | ☑️ CI de base (build & syntax)<br>🔜 Tests e2e + coverage backend<br>🔜 Dockerisation complète |

*Les éléments cochés sont livrés, ceux avec 🔜 sont prioritaires à court terme.*

---

## 🐛 Dépannage rapide

| Problème | Solution |
| --- | --- |
| `Failed to process videos` | Voir `.devlogs/backend.log` ; souvent un throttling sous-titre → la relance sans sous-titres est automatique mais attendre quelques minutes peut aider. |
| Durée export > demandée | Depuis 2025-12-07, un clamp stricte limite la compilation au temps cible + ~10 %. Vérifiez vos sources si ça dépasse encore. |
| FFmpeg introuvable | `./install_ffmpeg.sh` puis relancer `./run_app.sh`. |
| Port 5000 occupé | Arreter les vieux serveurs : `pkill -f server.py`. |

Plus d’informations dans [DEMARRAGE.md](DEMARRAGE.md).

---

## 📜 Licence & Contribution

- Licence MIT (voir `LICENSE`).
- Issues & PRs bienvenues : merci de documenter les changements, de lancer `npm run lint` et `python -m compileall backend` avant la PR.

---

**Créé avec ❤️ pour accélérer la repurposition de contenu.**  
Transformez vos longues interviews ou podcasts en shorts viraux en quelques clics ! 🚀
