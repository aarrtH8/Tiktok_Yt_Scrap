#!/usr/bin/env bash
# Vérifie l'environnement (Python, yt-dlp, FFmpeg, Node, dépendances)
# puis lance automatiquement le backend Flask et le frontend Next.js.

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
LOG_DIR="$ROOT_DIR/.devlogs"
mkdir -p "$LOG_DIR"

BACKEND_LOG="$LOG_DIR/backend.log"
FRONTEND_LOG="$LOG_DIR/frontend.log"

GREEN="\033[0;32m"
RED="\033[0;31m"
YELLOW="\033[1;33m"
NC="\033[0m"

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

print_check() {
  local label="$1"
  printf "%-50s" "$label"
}

ok() {
  echo -e "${GREEN}OK${NC}"
}

warn() {
  echo -e "${YELLOW}$1${NC}"
}

fail() {
  echo -e "${RED}$1${NC}"
  exit 1
}

PYTHON_BIN="${PYTHON_BIN:-python3}"
if [[ -x "$ROOT_DIR/venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/venv/bin/python"
elif [[ -x "$ROOT_DIR/.venv/bin/python" ]]; then
  PYTHON_BIN="$ROOT_DIR/.venv/bin/python"
fi

print_check "Vérification de Python 3"
if command_exists "$PYTHON_BIN"; then
  PYTHON_VER="$($PYTHON_BIN -c 'import platform; print(platform.python_version())')"
  ok && echo "  -> Version $PYTHON_VER ($PYTHON_BIN)"
else
  fail "Python 3 est requis. Installe-le ou configure un venv."
fi

print_check "Vérification de pip"
if "$PYTHON_BIN" -m pip --version >/dev/null 2>&1; then
  ok
else
  fail "pip n'est pas disponible pour $PYTHON_BIN"
fi

print_check "Présence de yt-dlp"
if command_exists yt-dlp; then
  ok
else
  warn "yt-dlp introuvable. Installation via pip..."
  if "$PYTHON_BIN" -m pip install yt-dlp >/dev/null 2>&1; then
    ok
  else
    fail "Impossible d'installer yt-dlp. Vérifie ta connexion."
  fi
fi

print_check "Vérification de FFmpeg"
if command_exists ffmpeg; then
  ok
else
  LOCAL_FFMPEG="$ROOT_DIR/.ffmpeg/bin/ffmpeg"
  if [[ -x "$LOCAL_FFMPEG" ]]; then
    export PATH="$ROOT_DIR/.ffmpeg/bin:$PATH"
    ok && echo "  -> Utilisation de la version locale située dans .ffmpeg/bin"
  else
    fail "FFmpeg est requis. Exécute ./install_ffmpeg.sh ou installe-le globalement."
  fi
fi

print_check "Vérification de curl"
command_exists curl && ok || fail "curl est requis."

print_check "Vérification de Node.js"
NODE_BIN="${NODE_BIN:-}"
if command_exists node; then
  NODE_BIN="$(command -v node)"
  NODE_VERSION="$($NODE_BIN --version | sed 's/v//')"
  NODE_MAJOR="${NODE_VERSION%%.*}"
  if (( NODE_MAJOR < 18 )); then
    warn "Node $NODE_VERSION trop ancien. Utilise ./install_node.sh"
    exit 1
  fi
  ok && echo "  -> Version $NODE_VERSION"
else
  fail "Node.js est requis. Exécute ./install_node.sh."
fi

PNPM_BIN="$(command -v pnpm || true)"
NPM_BIN="$(command -v npm || true)"
if [[ -z "$PNPM_BIN" && -z "$NPM_BIN" ]]; then
  fail "npm ou pnpm est requis."
fi

echo ""
echo "Installation des dépendances backend..."
if [[ -f "$BACKEND_DIR/requirements.txt" ]]; then
  "$PYTHON_BIN" -m pip install -r "$BACKEND_DIR/requirements.txt"
else
  warn "requirements.txt introuvable dans backend/"
fi

echo ""
echo "Installation des dépendances frontend..."
if [[ -f "$ROOT_DIR/package.json" ]]; then
  install_frontend_deps() {
    if [[ -n "$PNPM_BIN" ]]; then
      "$PNPM_BIN" install "$@"
    else
      "$NPM_BIN" install "$@"
    fi
  }
  if ! install_frontend_deps; then
    warn "Installation échouée, tentative avec --legacy-peer-deps..."
    install_frontend_deps --legacy-peer-deps || fail "Impossible d'installer les dépendances frontend."
  fi
else
  fail "package.json introuvable à la racine."
fi

cleanup() {
  echo -e "\nArrêt des processus..."
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" && echo "Backend arrêté"
  fi
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" && echo "Frontend arrêté"
  fi
  exit 0
}
trap cleanup INT TERM

echo ""
echo "Démarrage du backend (logs: $BACKEND_LOG)"
pushd "$BACKEND_DIR" >/dev/null
"$PYTHON_BIN" server.py >> "$BACKEND_LOG" 2>&1 &
BACKEND_PID=$!
popd >/dev/null

echo -n "Attente du backend http://localhost:5000/health ..."
for _ in {1..30}; do
  if curl -fsS http://localhost:5000/health >/dev/null 2>&1; then
    echo " OK"
    break
  fi
  if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo " échec (backend stoppé). Consulte $BACKEND_LOG"
    cleanup
  fi
  sleep 1
done

echo ""
echo "Démarrage du frontend (logs: $FRONTEND_LOG)"
pushd "$ROOT_DIR" >/dev/null
if [[ -n "$PNPM_BIN" ]]; then
  "$PNPM_BIN" dev >> "$FRONTEND_LOG" 2>&1 &
else
  "$NPM_BIN" run dev >> "$FRONTEND_LOG" 2>&1 &
fi
FRONTEND_PID=$!
popd >/dev/null

echo -n "Attente du frontend http://localhost:3000 ..."
for _ in {1..40}; do
  if curl -fsS http://localhost:3000 >/dev/null 2>&1; then
    echo " OK"
    break
  fi
  if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo " échec (frontend stoppé). Consulte $FRONTEND_LOG"
    cleanup
  fi
  sleep 1
done

echo ""
echo -e "${GREEN}Application prête !${NC}"
echo "Backend  : http://localhost:5000"
echo "Frontend : http://localhost:3000"
echo "Logs     : tail -f $BACKEND_LOG | tail -f $FRONTEND_LOG"
echo "Appuie sur CTRL+C pour tout arrêter."

wait
