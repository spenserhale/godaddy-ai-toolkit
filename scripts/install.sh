#!/usr/bin/env sh
# Usage: curl -fsSL https://raw.githubusercontent.com/spenserhale/godaddy-ai-toolkit/main/scripts/install.sh | sh
set -eu
REPO="spenserhale/godaddy-ai-toolkit"
VERSION="${GODADDY_TOOLKIT_VERSION:-latest}"
INSTALL_DIR="${GODADDY_TOOLKIT_INSTALL:-$HOME/.local/bin}"
os=$(uname -s | tr '[:upper:]' '[:lower:]'); arch=$(uname -m)
case "$os" in darwin|linux) ;; *) echo "Unsupported OS: $os"; exit 1 ;; esac
case "$arch" in x86_64|amd64) arch=x64 ;; arm64|aarch64) arch=arm64 ;; *) echo "Unsupported arch: $arch"; exit 1 ;; esac
asset="godaddy-${os}-${arch}"
if [ "$VERSION" = latest ]; then base="https://github.com/${REPO}/releases/latest/download"; else base="https://github.com/${REPO}/releases/download/${VERSION}"; fi
tmp=$(mktemp -d); trap 'rm -rf "$tmp"' EXIT
curl -fsSL -o "$tmp/$asset" "$base/$asset"; curl -fsSL -o "$tmp/$asset.sha256" "$base/$asset.sha256"
(cd "$tmp" && shasum -a 256 -c "$asset.sha256")
mkdir -p "$INSTALL_DIR"; mv "$tmp/$asset" "$INSTALL_DIR/godaddy"; chmod +x "$INSTALL_DIR/godaddy"
echo "Installed godaddy to $INSTALL_DIR/godaddy"
case ":$PATH:" in *":$INSTALL_DIR:"*) ;; *) echo "Add to PATH: export PATH=\"$INSTALL_DIR:\$PATH\"" ;; esac
