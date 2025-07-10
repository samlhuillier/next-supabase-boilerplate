#!/bin/bash
set -e

# Get the directory where the script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Change to the root directory of the project (where the script should be located)
cd "$SCRIPT_DIR"

# Find the latest .raw file
LATEST_RAW=$(ls -t recorded-audio/*.raw 2>/dev/null | head -n1)

if [ -z "$LATEST_RAW" ]; then
    echo "No .raw files found in recorded-audio directory"
    exit 1
fi

# Generate WAV filename
WAV_FILE="${LATEST_RAW%.raw}.wav"

echo "Converting $LATEST_RAW to $WAV_FILE..."
ffmpeg -y -f s16le -ar 48000 -ac 2 -channel_layout "stereo" -i "$LATEST_RAW" "$WAV_FILE"

echo "Playing $WAV_FILE..."
ffplay "$WAV_FILE"