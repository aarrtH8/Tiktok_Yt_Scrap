#!/bin/bash
# Télécharge et installe localement Node.js LTS pour l'application
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")" && pwd)"
NODE_DIR="$ROOT_DIR/.node"
ARCHIVE="$NODE_DIR/node.tar.xz"
VERSION=${NODE_VERSION:-"v20.17.0"}
URL=${NODE_URL:-"https://nodejs.org/dist/$VERSION/node-$VERSION-linux-x64.tar.xz"}
RUNTIME_DIR="$NODE_DIR/runtime"

mkdir -p "$NODE_DIR"

if [[ -d "$RUNTIME_DIR" && ! -w "$RUNTIME_DIR" ]]; then
    echo "Impossible d'écrire dans $RUNTIME_DIR (droits insuffisants)." >&2
    echo "Exécute: sudo chown -R $(whoami) \"$NODE_DIR\" puis relance ce script." >&2
    exit 1
fi

echo "Téléchargement de Node.js $VERSION ..."
curl -L "$URL" -o "$ARCHIVE"

echo "Extraction..."
rm -rf "$RUNTIME_DIR"
tar -xf "$ARCHIVE" -C "$NODE_DIR"
EXTRACTED_DIR="$NODE_DIR/node-$VERSION-linux-x64"

if [[ ! -d "$EXTRACTED_DIR" ]]; then
    echo "Impossible de trouver l'archive extraite" >&2
    exit 1
fi

mkdir -p "$RUNTIME_DIR"
cp -a "$EXTRACTED_DIR"/. "$RUNTIME_DIR"/
rm -rf "$EXTRACTED_DIR"

cat > "$NODE_DIR/env.sh" <<EOT
export PATH="$RUNTIME_DIR/bin:\$PATH"
EOT

chmod +x "$RUNTIME_DIR"/bin/node "$RUNTIME_DIR"/bin/npm "$RUNTIME_DIR"/bin/npx

echo "Node.js installé localement dans $RUNTIME_DIR/bin"
echo "Ajoute ce dossier à ton PATH ou exporte PATH=\"$RUNTIME_DIR/bin:\$PATH\""
echo "run_app.sh utilisera automatiquement cette version si aucune version récente n'est détectée."
