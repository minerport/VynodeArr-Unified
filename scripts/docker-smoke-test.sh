#!/bin/sh
set -eu

image="vynodearr:smoke"
container="vynodearr-smoke-${GITHUB_RUN_ID:-local}-$$"
data_volume="${container}-data"
movie_volume="${container}-movies"
tv_volume="${container}-tv"
download_volume="${container}-downloads"

cleanup() {
  docker rm -f "$container" >/dev/null 2>&1 || true
  docker volume rm "$data_volume" "$movie_volume" "$tv_volume" "$download_volume" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker build -f Dockerfile -t "$image" .
docker volume create "$data_volume" >/dev/null
docker volume create "$movie_volume" >/dev/null
docker volume create "$tv_volume" >/dev/null
docker volume create "$download_volume" >/dev/null
docker run --rm -v "$data_volume:/data" alpine:3.22 chown -R 10001:1000 /data
docker run -d --name "$container" \
  -e VYNODEARR_DATA_MODE=fixture \
  -e VYNODEARR_SECURE_COOKIES=false \
  -p 127.0.0.1::4310 \
  -v "$data_volume:/data" \
  -v "$movie_volume:/movies" \
  -v "$tv_volume:/tv" \
  -v "$download_volume:/downloads" \
  "$image" >/dev/null

port=$(docker port "$container" 4310/tcp | sed 's/.*://')
attempt=0
until wget -q -O /dev/null "http://127.0.0.1:$port/healthz"; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    docker logs "$container"
    echo "Docker smoke test failed: health endpoint did not become ready." >&2
    exit 1
  fi
  sleep 2
done

attempt=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$container")" = healthy ]; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    docker logs "$container"
    echo "Docker smoke test failed: container health check is not healthy." >&2
    exit 1
  fi
  sleep 2
done
for path in /data /movies /tv /downloads; do
  docker exec "$container" test -d "$path"
done
echo "Generic Docker image smoke test passed."
