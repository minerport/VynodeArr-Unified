#!/bin/sh
set -eu

movie_config=/config/movies
tv_config=/config/television
app_config=/config/vynodearr
mkdir -p "$movie_config" "$tv_config" "$app_config" /movies /tv /downloads

movie_engine_mode=bundled
tv_engine_mode=bundled
settings_file="$app_config/engine-settings.json"
if [ -f "$settings_file" ]; then
  engine_modes="$(node -e "const fs=require('fs');try{const v=JSON.parse(fs.readFileSync(process.argv[1],'utf8')),legacy=['bundled','external'].includes(v.pendingMode)?v.pendingMode:['bundled','external'].includes(v.mode)?v.mode:'bundled',mode=d=>v.pendingModes?.[d]||v.modes?.[d]||legacy;process.stdout.write(mode('movie')+' '+mode('tv'))}catch{process.stdout.write('bundled bundled')}" "$settings_file")"
  movie_engine_mode="${engine_modes%% *}"
  tv_engine_mode="${engine_modes#* }"
fi
if [ "$movie_engine_mode" = "$tv_engine_mode" ]; then export VYNODEARR_ENGINE_MODE="$movie_engine_mode"; else export VYNODEARR_ENGINE_MODE=mixed; fi
export VYNODEARR_MOVIE_ENGINE_MODE="$movie_engine_mode"
export VYNODEARR_TV_ENGINE_MODE="$tv_engine_mode"

random_key() {
  od -An -N16 -tx1 /dev/urandom | tr -d ' \n'
}

if [ ! -f "$movie_config/config.xml" ]; then
  movie_key="$(random_key)"
  printf '%s\n' "<Config><BindAddress>*</BindAddress><Port>7878</Port><EnableSsl>False</EnableSsl><LaunchBrowser>False</LaunchBrowser><ApiKey>${movie_key}</ApiKey><AuthenticationMethod>External</AuthenticationMethod><AuthenticationRequired>Enabled</AuthenticationRequired><LogLevel>info</LogLevel><UrlBase></UrlBase><InstanceName>VynodeArr Movies</InstanceName><UpdateMechanism>Docker</UpdateMechanism></Config>" > "$movie_config/config.xml"
fi
if [ ! -f "$tv_config/config.xml" ]; then
  tv_key="$(random_key)"
  printf '%s\n' "<Config><BindAddress>*</BindAddress><Port>8989</Port><EnableSsl>False</EnableSsl><LaunchBrowser>False</LaunchBrowser><ApiKey>${tv_key}</ApiKey><AuthenticationMethod>External</AuthenticationMethod><AuthenticationRequired>Enabled</AuthenticationRequired><LogLevel>info</LogLevel><UrlBase></UrlBase><InstanceName>VynodeArr Television</InstanceName><UpdateMechanism>Docker</UpdateMechanism></Config>" > "$tv_config/config.xml"
fi

if [ "$movie_engine_mode" = bundled ]; then
  export MOVIE_ENGINE_API_CREDENTIAL="$(sed -n 's:.*<ApiKey>\([^<]*\)</ApiKey>.*:\1:p' "$movie_config/config.xml")"
  env -u PORT /opt/vynodearr/movies/Radarr -nobrowser -data="$movie_config" &
  movie_pid=$!
fi
if [ "$tv_engine_mode" = bundled ]; then
  export TV_ENGINE_API_CREDENTIAL="$(sed -n 's:.*<ApiKey>\([^<]*\)</ApiKey>.*:\1:p' "$tv_config/config.xml")"
  env -u PORT /opt/vynodearr/television/Sonarr -nobrowser -data="$tv_config" &
  tv_pid=$!
fi
node apps/api/src/server.js &
app_pid=$!

shutdown() {
  kill -TERM "$app_pid" ${movie_pid:-} ${tv_pid:-} 2>/dev/null || true
  wait "$app_pid" ${movie_pid:-} ${tv_pid:-} 2>/dev/null || true
}
trap shutdown INT TERM EXIT

while kill -0 "$app_pid" 2>/dev/null; do
  if { [ "$movie_engine_mode" = bundled ] && ! kill -0 "$movie_pid" 2>/dev/null; } || { [ "$tv_engine_mode" = bundled ] && ! kill -0 "$tv_pid" 2>/dev/null; }; then
    exit 1
  fi
  sleep 2
done
exit 1
