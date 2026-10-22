#!/bin/sh
set -eu

select_image() {
  label="$1"
  shift
  for image in "$@"; do
    attempt=1
    while [ "$attempt" -le 3 ]; do
      echo "Checking $label base image $image (attempt $attempt of 3)..." >&2
      if docker pull "$image" >&2; then
        printf '%s\n' "$image"
        return 0
      fi
      attempt=$((attempt + 1))
      [ "$attempt" -le 3 ] && sleep 5
    done
    echo "$label base image $image is unavailable; trying the fallback registry." >&2
  done
  echo "No reachable $label base image registry was found." >&2
  return 1
}

node_image="$(select_image Node node:24-alpine public.ecr.aws/docker/library/node:24-alpine)"
printf 'node_base_image=%s\n' "$node_image"

if [ "${1:-}" != "--node-only" ]; then
  alpine_image="$(select_image Alpine alpine:3.22 public.ecr.aws/docker/library/alpine:3.22)"
  printf 'alpine_base_image=%s\n' "$alpine_image"
fi
