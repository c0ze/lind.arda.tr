#!/usr/bin/env bash
# Transcode the WAV masters in songs/ to web MP3 in audio/ (VBR ~190 kbps).
# Requires ffmpeg. Run from the project root:  bash scripts/transcode-audio.sh
set -euo pipefail
cd "$(dirname "$0")/.."
mkdir -p audio
transcode() { ffmpeg -y -loglevel error -i "$1" -codec:a libmp3lame -q:a 2 "$2" && echo "  ok  $2"; }
transcode "songs/Gwannad i-Lû (The Fading of Time).wav" "audio/gwannad-i-lu.mp3"
transcode "songs/I Dhae Odog.wav"                        "audio/i-dhae-odog.mp3"
transcode "songs/I Dann Haer.wav"                        "audio/i-dann-haer.mp3"
