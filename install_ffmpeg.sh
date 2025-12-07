#!/bin/bash
# Télécharge et installe une version locale de FFmpeg pour l'application
set -euo pipefail

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
FFMPEG_DIR="$ROOT_DIR/.ffmpeg"
BIN_DIR="$FFMPEG_DIR/bin"
URL=${FFMPEG_URL:-"https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz"}

mkdir -p "$FFMPEG_DIR"
TMP_DIR="$(mktemp -d "${FFMPEG_DIR}/tmp.XXXXXX")"
ARCHIVE="$TMP_DIR/ffmpeg.tar.xz"

command_exists curl || { echo "curl est requis pour télécharger FFmpeg." >&2; exit 1; }
command_exists tar || { echo "tar est requis pour extraire FFmpeg." >&2; exit 1; }

cleanup() {
    rm -f "$ARCHIVE" >/dev/null 2>&1 || true
    rm -rf "$TMP_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Téléchargement de FFmpeg depuis $URL ..."
curl -L "$URL" -o "$ARCHIVE"

echo "Extraction..."
tar -xf "$ARCHIVE" -C "$TMP_DIR"
LATEST_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d -name 'ffmpeg-*' | sort | tail -n 1)

if [[ -z "$LATEST_DIR" || ! -d "$LATEST_DIR" ]]; then
    echo "Impossible de trouver FFmpeg dans l'archive" >&2
    exit 1
fi

rm -rf "$BIN_DIR"
mkdir -p "$BIN_DIR"
cp "$LATEST_DIR"/ffmpeg "$BIN_DIR/ffmpeg"
cp "$LATEST_DIR"/ffprobe "$BIN_DIR/ffprobe"
chmod +x "$BIN_DIR/ffmpeg" "$BIN_DIR/ffprobe"

cat > "$FFMPEG_DIR/env.sh" <<'EOT'
export PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/bin:$PATH"
EOT

echo "FFmpeg installé localement dans $BIN_DIR"
echo "Ajoute ce dossier à ton PATH (source .ffmpeg/env.sh) ou lance: export PATH=\"$BIN_DIR:\$PATH\""
echo "Le script run_app.sh essaiera automatiquement d'utiliser cette version."
