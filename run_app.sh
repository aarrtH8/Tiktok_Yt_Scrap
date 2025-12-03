#!/bin/bash
# Lance automatiquement le backend Flask et le frontend Next.js
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR"
LOG_DIR="$ROOT_DIR/.devlogs"
mkdir -p "$LOG_DIR"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

wait_for_url() {
    local url=$1
    local pid="${2:-}"
    local retries=${3:-30}
    local delay=${4:-1}

    for ((i=0; i<retries; i++)); do
        if curl -Is "$url" >/dev/null 2>&1; then
            return 0
        fi
        if [[ -n "$pid" ]] && ! kill -0 "$pid" 2>/dev/null; then
            return 2
        fi
        sleep "$delay"
    done

    return 1
}

cleanup() {
    echo "\nArrêt des processus..."
    if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" && echo "Backend arrêté"
    fi
    if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" && echo "Frontend arrêté"
    fi
    exit 0
}

trap cleanup INT TERM

command_exists python3 || { echo "Python 3 est requis" >&2; exit 1; }

if command_exists ffmpeg; then
    FFMPEG_BIN="$(command -v ffmpeg)"
else
    LOCAL_FFMPEG="$ROOT_DIR/.ffmpeg/bin/ffmpeg"
    if [[ -x "$LOCAL_FFMPEG" ]]; then
        export PATH="$ROOT_DIR/.ffmpeg/bin:$PATH"
        FFMPEG_BIN="$LOCAL_FFMPEG"
    else
        echo "FFmpeg est requis pour le traitement vidéo." >&2
        echo "Exécute ./install_ffmpeg.sh pour installer une version locale ou installe FFmpeg via ton gestionnaire de paquets." >&2
        exit 1
    fi
fi
command_exists curl || { echo "curl est requis pour vérifier les serveurs" >&2; exit 1; }

LOCAL_NODE_RUNTIME_BIN="$ROOT_DIR/.node/runtime/bin"
LEGACY_NODE_BIN_DIR="$ROOT_DIR/.node/bin"
LOCAL_NODE_DIR_RESOLVED=""

use_local_node() {
    if [[ -x "$LOCAL_NODE_RUNTIME_BIN/node" ]]; then
        LOCAL_NODE_DIR_RESOLVED="$LOCAL_NODE_RUNTIME_BIN"
    elif [[ -x "$LEGACY_NODE_BIN_DIR/node" ]]; then
        LOCAL_NODE_DIR_RESOLVED="$LEGACY_NODE_BIN_DIR"
    else
        echo "Node.js 18+ est requis." >&2
        echo "Exécute ./install_node.sh pour installer une version locale ou installe Node 18 globalement." >&2
        exit 1
    fi

    export PATH="$LOCAL_NODE_DIR_RESOLVED:$PATH"
    NODE_VERSION="$("$LOCAL_NODE_DIR_RESOLVED/node" --version | sed 's/v//')"
    NODE_MAJOR="${NODE_VERSION%%.*}"
    if (( NODE_MAJOR < 18 )); then
        echo "La version locale de Node.js est trop ancienne. Réinstalle-la via ./install_node.sh" >&2
        exit 1
    fi
}

USE_LOCAL_NODE=0
if command_exists node; then
    NODE_BIN="$(command -v node)"
    NODE_VERSION="$($NODE_BIN --version | sed 's/v//')"
    NODE_MAJOR="${NODE_VERSION%%.*}"
    if (( NODE_MAJOR < 18 )); then
        echo "Node.js global trop ancien ($NODE_VERSION). Recherche d'une version locale..." >&2
        use_local_node
        USE_LOCAL_NODE=1
    fi
else
    use_local_node
    USE_LOCAL_NODE=1
fi

NPM_BIN=""
PNPM_BIN=""

if (( USE_LOCAL_NODE == 1 )) && [[ -n "$LOCAL_NODE_DIR_RESOLVED" ]]; then
    if [[ -x "$LOCAL_NODE_DIR_RESOLVED/npm" ]]; then
        NPM_BIN="$LOCAL_NODE_DIR_RESOLVED/npm"
    fi
    if [[ -x "$LOCAL_NODE_DIR_RESOLVED/pnpm" ]]; then
        PNPM_BIN="$LOCAL_NODE_DIR_RESOLVED/pnpm"
    fi
fi

if [[ -z "$PNPM_BIN" ]]; then
    PNPM_BIN="$(command -v pnpm || true)"
fi

if [[ -z "$NPM_BIN" ]]; then
    NPM_BIN="$(command -v npm || true)"
fi

if [[ -z "$NPM_BIN" && -z "$PNPM_BIN" ]]; then
    echo "npm ou pnpm est requis. Installe-les ou réinstalle Node via ./install_node.sh" >&2
    exit 1
fi

pushd "$BACKEND_DIR" >/dev/null
python3 server.py >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
popd >/dev/null

BACKEND_URL="http://localhost:5000/health"
echo "Backend lancé (PID $BACKEND_PID). Logs: $BACKEND_LOG"
echo -n "Attente de $BACKEND_URL ..."
if wait_for_url "$BACKEND_URL" "$BACKEND_PID"; then
    echo " OK"
elif [[ $? -eq 2 ]]; then
    echo " échec: le backend s'est arrêté. Consulte $BACKEND_LOG"
    cleanup
else
    echo " impossible de joindre le backend. Consulte $BACKEND_LOG"
    cleanup
fi

pushd "$FRONTEND_DIR" >/dev/null
if [[ -n "$PNPM_BIN" ]]; then
    "$PNPM_BIN" dev >> "$FRONTEND_LOG" 2>&1 &
else
    "$NPM_BIN" run dev >> "$FRONTEND_LOG" 2>&1 &
fi
FRONTEND_PID=$!
popd >/dev/null

FRONTEND_URL="http://localhost:3000"
echo "Frontend lancé (PID $FRONTEND_PID). Logs: $FRONTEND_LOG"
echo -n "Attente de $FRONTEND_URL ..."
if wait_for_url "$FRONTEND_URL" "$FRONTEND_PID"; then
    echo " OK"
elif [[ $? -eq 2 ]]; then
    echo " échec: le frontend s'est arrêté. Consulte $FRONTEND_LOG"
    cleanup
else
    echo " impossible de joindre le frontend. Consulte $FRONTEND_LOG"
    cleanup
fi

echo ""
echo "Application prête ✅"
echo "Backend disponible sur : $BACKEND_URL"
echo "Frontend prêt sur : $FRONTEND_URL"
echo ""
echo "Clique simplement sur le lien du frontend pour ouvrir l'app dans ton navigateur."
echo "CTRL+C pour arrêter."
wait
