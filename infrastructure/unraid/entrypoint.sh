#!/bin/sh
set -eu

movie_config=/config/movies
tv_config=/config/television
app_config=/config/vynodearr
mkdir -p "$movie_config" "$tv_config" "$app_config" /movies /tv /downloads

random_key() {
  od -An -N16 -tx1 /dev/urandom | tr -d ' \n'
}

if [ ! -f "$movie_config/config.xml" ]; then
  movie_key="$(random_key)"
  printf '%s\n' "<Config><BindAddress>*</BindAddress><Port>7878</Port><EnableSsl>False</EnableSsl><LaunchBrowser>False</LaunchBrowser><ApiKey>${movie_key}</ApiKey><AuthenticationMethod>External</AuthenticationMethod><AuthenticationRequired>DisabledForLocalAddresses</AuthenticationRequired><LogLevel>info</LogLevel><UrlBase></UrlBase><InstanceName>VynodeArr Movies</InstanceName><UpdateMechanism>Docker</UpdateMechanism></Config>" > "$movie_config/config.xml"
fi
if [ ! -f "$tv_config/config.xml" ]; then
  tv_key="$(random_key)"
  printf '%s\n' "<Config><BindAddress>*</BindAddress><Port>8989</Port><EnableSsl>False</EnableSsl><LaunchBrowser>False</LaunchBrowser><ApiKey>${tv_key}</ApiKey><AuthenticationMethod>External</AuthenticationMethod><AuthenticationRequired>DisabledForLocalAddresses</AuthenticationRequired><LogLevel>info</LogLevel><UrlBase></UrlBase><InstanceName>VynodeArr Television</InstanceName><UpdateMechanism>Docker</UpdateMechanism></Config>" > "$tv_config/config.xml"
fi

export MOVIE_ENGINE_API_CREDENTIAL="$(sed -n 's:.*<ApiKey>\([^<]*\)</ApiKey>.*:\1:p' "$movie_config/config.xml")"
export TV_ENGINE_API_CREDENTIAL="$(sed -n 's:.*<ApiKey>\([^<]*\)</ApiKey>.*:\1:p' "$tv_config/config.xml")"

env -u PORT /opt/vynodearr/movies/Radarr -nobrowser -data="$movie_config" &
movie_pid=$!
env -u PORT /opt/vynodearr/television/Sonarr -nobrowser -data="$tv_config" &
tv_pid=$!
node apps/api/src/server.js &
app_pid=$!

shutdown() {
  kill -TERM "$app_pid" "$movie_pid" "$tv_pid" 2>/dev/null || true
  wait "$app_pid" "$movie_pid" "$tv_pid" 2>/dev/null || true
}
trap shutdown INT TERM EXIT

while kill -0 "$app_pid" 2>/dev/null && kill -0 "$movie_pid" 2>/dev/null && kill -0 "$tv_pid" 2>/dev/null; do
  sleep 2
done
exit 1
