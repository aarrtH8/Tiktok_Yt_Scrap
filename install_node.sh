#!/bin/bash
# Télécharge et installe localement Node.js LTS pour l'application
set -euo pipefail

command_exists() {
    command -v "$1" >/dev/null 2>&1
}

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_DIR="$ROOT_DIR/.node"
VERSION=${NODE_VERSION:-"v20.17.0"}
URL=${NODE_URL:-"https://nodejs.org/dist/$VERSION/node-$VERSION-linux-x64.tar.xz"}
RUNTIME_DIR="$NODE_DIR/runtime"

mkdir -p "$NODE_DIR"

if [[ -d "$RUNTIME_DIR" && ! -w "$RUNTIME_DIR" ]]; then
    echo "Impossible d'écrire dans $RUNTIME_DIR (droits insuffisants)." >&2
    echo "Exécute: sudo chown -R $(whoami) \"$NODE_DIR\" puis relance ce script." >&2
    exit 1
fi

command_exists curl || { echo "curl est requis pour télécharger Node.js." >&2; exit 1; }
command_exists tar || { echo "tar est requis pour extraire Node.js." >&2; exit 1; }

TMP_DIR="$(mktemp -d "${NODE_DIR}/tmp.XXXXXX")"
ARCHIVE="$TMP_DIR/node.tar.xz"

cleanup() {
    rm -f "$ARCHIVE" >/dev/null 2>&1 || true
    rm -rf "$TMP_DIR" >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "Téléchargement de Node.js $VERSION ..."
curl -L "$URL" -o "$ARCHIVE"

echo "Extraction..."
tar -xf "$ARCHIVE" -C "$TMP_DIR"
EXTRACTED_DIR=$(find "$TMP_DIR" -maxdepth 1 -type d -name "node-v*-linux-x64" | head -n 1)

if [[ -z "$EXTRACTED_DIR" || ! -d "$EXTRACTED_DIR" ]]; then
    echo "Impossible de trouver l'archive extraite" >&2
    exit 1
fi

rm -rf "$RUNTIME_DIR"
mkdir -p "$RUNTIME_DIR"
cp -a "$EXTRACTED_DIR"/. "$RUNTIME_DIR"/

cat > "$NODE_DIR/env.sh" <<'EOT'
export PATH="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/runtime/bin:$PATH"
EOT

chmod +x "$RUNTIME_DIR"/bin/node "$RUNTIME_DIR"/bin/npm "$RUNTIME_DIR"/bin/npx

echo "Node.js installé localement dans $RUNTIME_DIR/bin"
echo "Ajoute ce dossier à ton PATH (source .node/env.sh) ou exporte PATH=\"$RUNTIME_DIR/bin:\$PATH\""
echo "run_app.sh utilisera automatiquement cette version si aucune version récente n'est détectée."
