#!/bin/bash

# Script de lancement rapide pour YouTube to TikTok Compiler
# Ce script démarre automatiquement le backend et le frontend

set -e

echo "=================================="
echo "YouTube to TikTok Compiler"
echo "Lancement automatique"
echo "=================================="
echo ""

# Couleurs pour le terminal
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour vérifier si une commande existe
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Vérifier Python
echo -n "Vérification de Python... "
if command_exists python3; then
    PYTHON_VERSION=$(python3 --version 2>&1 | awk '{print $2}')
    echo -e "${GREEN}✓${NC} Python $PYTHON_VERSION installé"
else
    echo -e "${RED}✗${NC} Python 3 non trouvé"
    echo "Installez Python 3.8+ depuis https://www.python.org/"
    exit 1
fi

# Vérifier Node.js
echo -n "Vérification de Node.js... "
if command_exists node; then
    NODE_VERSION=$(node --version)
    echo -e "${GREEN}✓${NC} Node.js $NODE_VERSION installé"
else
    echo -e "${RED}✗${NC} Node.js non trouvé"
    echo "Installez Node.js depuis https://nodejs.org/"
    exit 1
fi

# Vérifier FFmpeg
echo -n "Vérification de FFmpeg... "
if command_exists ffmpeg; then
    echo -e "${GREEN}✓${NC} FFmpeg installé"
else
    echo -e "${RED}✗${NC} FFmpeg non trouvé"
    echo "Installez FFmpeg:"
    echo "  Ubuntu/Debian: sudo apt-get install ffmpeg"
    echo "  MacOS: brew install ffmpeg"
    exit 1
fi

echo ""
echo "=================================="
echo "Installation des dépendances"
echo "=================================="

# Installer les dépendances backend
echo ""
echo "📦 Installation des dépendances Python..."
cd backend
if [ -f "requirements.txt" ]; then
    pip3 install -r requirements.txt --quiet
    echo -e "${GREEN}✓${NC} Dépendances Python installées"
else
    echo -e "${RED}✗${NC} requirements.txt non trouvé"
    exit 1
fi
cd ..

# Installer les dépendances frontend
echo ""
echo "📦 Installation des dépendances Node.js..."
if [ -f "package.json" ]; then
    if command_exists pnpm; then
        pnpm install --silent
    elif command_exists npm; then
        npm install --silent
    else
        echo -e "${RED}✗${NC} npm ou pnpm requis"
        exit 1
    fi
    echo -e "${GREEN}✓${NC} Dépendances Node.js installées"
else
    echo -e "${RED}✗${NC} package.json non trouvé"
    exit 1
fi

echo ""
echo "=================================="
echo "Démarrage des serveurs"
echo "=================================="

# Créer un fichier PID pour suivre les processus
BACKEND_PID_FILE="/tmp/ytttc_backend.pid"
FRONTEND_PID_FILE="/tmp/ytttc_frontend.pid"

# Fonction de nettoyage
cleanup() {
    echo ""
    echo "Arrêt des serveurs..."
    
    if [ -f "$BACKEND_PID_FILE" ]; then
        BACKEND_PID=$(cat "$BACKEND_PID_FILE")
        if kill -0 "$BACKEND_PID" 2>/dev/null; then
            kill "$BACKEND_PID"
            echo "Backend arrêté"
        fi
        rm -f "$BACKEND_PID_FILE"
    fi
    
    if [ -f "$FRONTEND_PID_FILE" ]; then
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE")
        if kill -0 "$FRONTEND_PID" 2>/dev/null; then
            kill "$FRONTEND_PID"
            echo "Frontend arrêté"
        fi
        rm -f "$FRONTEND_PID_FILE"
    fi
    
    echo "Au revoir !"
    exit 0
}

# Capturer CTRL+C pour nettoyer
trap cleanup INT TERM

# Démarrer le backend
echo ""
echo "🚀 Démarrage du backend (port 5000)..."
cd backend
python3 server.py > /tmp/ytttc_backend.log 2>&1 &
BACKEND_PID=$!
echo $BACKEND_PID > "$BACKEND_PID_FILE"
cd ..

# Attendre que le backend démarre
echo -n "Attente du backend"
for i in {1..10}; do
    if curl -s http://localhost:5000/health > /dev/null 2>&1; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 10 ]; then
        echo -e " ${RED}✗${NC}"
        echo "Le backend n'a pas démarré. Consultez /tmp/ytttc_backend.log"
        cleanup
    fi
done

# Démarrer le frontend
echo ""
echo "🚀 Démarrage du frontend (port 3000)..."
if command_exists pnpm; then
    pnpm dev > /tmp/ytttc_frontend.log 2>&1 &
elif command_exists npm; then
    npm run dev > /tmp/ytttc_frontend.log 2>&1 &
fi
FRONTEND_PID=$!
echo $FRONTEND_PID > "$FRONTEND_PID_FILE"

# Attendre que le frontend démarre
echo -n "Attente du frontend"
for i in {1..15}; do
    if curl -s http://localhost:3000 > /dev/null 2>&1; then
        echo -e " ${GREEN}✓${NC}"
        break
    fi
    echo -n "."
    sleep 1
    if [ $i -eq 15 ]; then
        echo -e " ${RED}✗${NC}"
        echo "Le frontend n'a pas démarré. Consultez /tmp/ytttc_frontend.log"
        cleanup
    fi
done

echo ""
echo "=================================="
echo -e "${GREEN}✨ Application démarrée avec succès !${NC}"
echo "=================================="
echo ""
echo "🌐 Frontend: http://localhost:3000"
echo "🔧 Backend:  http://localhost:5000"
echo ""
echo "📋 Logs:"
echo "   Backend:  tail -f /tmp/ytttc_backend.log"
echo "   Frontend: tail -f /tmp/ytttc_frontend.log"
echo ""
echo "Pour arrêter l'application, appuyez sur CTRL+C"
echo ""

# Ouvrir le navigateur (optionnel)
if command_exists xdg-open; then
    sleep 2
    xdg-open http://localhost:3000 2>/dev/null &
elif command_exists open; then
    sleep 2
    open http://localhost:3000 2>/dev/null &
fi

# Garder le script actif
while true; do
    # Vérifier si les processus sont toujours actifs
    if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
        echo -e "${RED}Le backend s'est arrêté !${NC}"
        echo "Consultez les logs: cat /tmp/ytttc_backend.log"
        cleanup
    fi
    
    if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
        echo -e "${RED}Le frontend s'est arrêté !${NC}"
        echo "Consultez les logs: cat /tmp/ytttc_frontend.log"
        cleanup
    fi
    
    sleep 5
done
