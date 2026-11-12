#!/bin/bash
set -euo pipefail

#
# Project paths and original 1024 x 1024 PNG
#
SCRIPT_DIRECTORY="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIRECTORY="$(cd -- "$SCRIPT_DIRECTORY/../.." && pwd)"
SOURCE_FILE="$PROJECT_DIRECTORY/asset/png/runeos_image_icon.png"
OUTPUT_FILE="$PROJECT_DIRECTORY/dist/build/runeos.icns"

#
# Temporary iconset
#
TEMPORARY_DIRECTORY="$(mktemp -d "${TMPDIR:-/tmp}/runeos-icon.XXXXXX")"
trap 'rm -rf "$TEMPORARY_DIRECTORY"' EXIT
ICONSET_DIRECTORY="$TEMPORARY_DIRECTORY/runeos.iconset"
mkdir -p "$ICONSET_DIRECTORY" "$PROJECT_DIRECTORY/dist/build"

#
# Standard and Retina representations
#
for SIZE in 16 32 128 256 512;
do
    sips -z "$SIZE" "$SIZE" "$SOURCE_FILE" \
        --out "$ICONSET_DIRECTORY/icon_${SIZE}x${SIZE}.png" > /dev/null

    RETINA_SIZE=$((SIZE * 2))
    if [ "$RETINA_SIZE" = 1024 ];
    then
        cp "$SOURCE_FILE" "$ICONSET_DIRECTORY/icon_${SIZE}x${SIZE}@2x.png"
    else
        sips -z "$RETINA_SIZE" "$RETINA_SIZE" "$SOURCE_FILE" \
            --out "$ICONSET_DIRECTORY/icon_${SIZE}x${SIZE}@2x.png" > /dev/null
    fi
done

#
# macOS application icon
#
iconutil --convert icns "$ICONSET_DIRECTORY" --output "$OUTPUT_FILE"
