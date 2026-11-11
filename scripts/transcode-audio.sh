#!/usr/bin/env bash
# Regenerate the MP3 fallbacks in audio/ from the committed, mastered FLACs
# (one audio/<id>.mp3 per audio/<id>.flac, LAME VBR -q:a 2, ~190 kbps).
# The FLACs are the source of truth; the WAVs in songs/ are un-mastered and
# must not be used. Requires ffmpeg. Run from anywhere:
#   bash scripts/transcode-audio.sh
set -euo pipefail
cd "$(dirname "$0")/.."
shopt -s nullglob
flacs=(audio/*.flac)
if [ ${#flacs[@]} -eq 0 ]; then echo "no audio/*.flac found" >&2; exit 1; fi
for flac in "${flacs[@]}"; do
  mp3="${flac%.flac}.mp3"
  ffmpeg -y -loglevel error -i "$flac" -map 0:a -codec:a libmp3lame -q:a 2 "$mp3"
  echo "  ok  $mp3"
done
