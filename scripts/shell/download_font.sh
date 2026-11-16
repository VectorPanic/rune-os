#!/bin/bash
set -euo pipefail

URL="https://www.joelcarrouche.com/media/pages/fonts/norse/5df431c716-1675783618/norse.zip"
SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
FONT_DIRECTORY="$SCRIPT_DIRECTORY/../../asset/otf"
mkdir -p "$FONT_DIRECTORY"
DEST="$FONT_DIRECTORY/runeos_font_header.otf"

TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

curl -fsSL "$URL" -o "$TMP_DIR/norse.zip"
unzip -q "$TMP_DIR/norse.zip" -d "$TMP_DIR/extracted"

FONT="$(find "$TMP_DIR/extracted" -type f -iname '*norse*bold*.otf' -print -quit)"

if [[ -z "$FONT" ]]; then
    echo "Error: Norse Bold font was not found in the archive." >&2
    exit 1
fi

cp "$FONT" "$DEST"
echo "Font saved to: $DEST"
