#!/bin/sh
set -eu

compose_files="-f compose.yaml"
if [ "${1:-}" = "--media" ]; then
  compose_files="$compose_files -f compose.media.yaml"
  if [ -z "${VYNODEARR_MEDIA_PATH:-}" ] && [ -f .env ]; then
    VYNODEARR_MEDIA_PATH=$(sed -n 's/^VYNODEARR_MEDIA_PATH=//p' .env | tail -n 1)
    export VYNODEARR_MEDIA_PATH
  fi
  if [ -z "${VYNODEARR_MEDIA_PATH:-}" ]; then
    echo "Error: set VYNODEARR_MEDIA_PATH in .env before using --media." >&2
    exit 1
  fi
  if [ ! -d "$VYNODEARR_MEDIA_PATH" ]; then
    echo "Error: main media folder does not exist: $VYNODEARR_MEDIA_PATH" >&2
    exit 1
  fi
fi

command -v docker >/dev/null 2>&1 || { echo "Error: Docker is not installed or not on PATH." >&2; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Error: Docker Compose v2 is unavailable." >&2; exit 1; }
docker info >/dev/null 2>&1 || { echo "Error: the Docker service is not running or is not accessible." >&2; exit 1; }

# shellcheck disable=SC2086
docker compose $compose_files config --quiet
echo "Docker preflight passed."
if [ "${1:-}" = "--media" ]; then
  echo "Main media folder: $VYNODEARR_MEDIA_PATH -> /media"
fi
echo "Web interface: http://localhost:${VYNODEARR_PORT:-8686}"
