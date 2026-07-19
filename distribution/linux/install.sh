#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this installer with sudo: sudo ./install.sh" >&2
  exit 1
fi

if [[ $(uname -s) != "Linux" ]]; then
  echo "This package can only be installed on Linux." >&2
  exit 1
fi

case $(uname -m) in
  x86_64) expected_runtime="linux-x64" ;;
  aarch64|arm64) expected_runtime="linux-arm64" ;;
  *) echo "Unsupported CPU architecture: $(uname -m)" >&2; exit 1 ;;
esac

package_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)
manifest_path="${package_root}/package-manifest.json"
if [[ ! -f ${manifest_path} ]]; then
  echo "package-manifest.json is missing. Extract the complete VynodeArr archive before installing." >&2
  exit 1
fi

package_runtime=$(sed -n 's/.*"runtimeIdentifier"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' "${manifest_path}" | head -n 1)
if [[ ${package_runtime} != "${expected_runtime}" ]]; then
  echo "This ${package_runtime:-unknown} package cannot run on $(uname -m)." >&2
  exit 1
fi

for required in \
  gateway/VynodeArr.Gateway \
  engines/movie/Radarr \
  engines/television/Sonarr \
  source-lock.json \
  vynodearr.service \
  vynodearr.env.example \
  install.sh \
  uninstall.sh; do
  if [[ ! -e ${package_root}/${required} ]]; then
    echo "Required package file is missing: ${required}" >&2
    exit 1
  fi
done

service_user="vynodearr"
install_root="/opt/vynodearr"
state_root="/var/lib/vynodearr"
config_root="/etc/vynodearr"
unit_path="/etc/systemd/system/vynodearr.service"
staging_root="${install_root}.new"
backup_root="${install_root}.previous"

if ! getent group "${service_user}" >/dev/null; then
  groupadd --system "${service_user}"
fi
if ! id --user "${service_user}" >/dev/null 2>&1; then
  useradd --system --gid "${service_user}" --home-dir "${state_root}" --no-create-home --shell /usr/sbin/nologin "${service_user}"
fi

install -d -m 0755 "${config_root}"
install -d -o "${service_user}" -g "${service_user}" -m 0750 \
  "${state_root}" "${state_root}/movie" "${state_root}/television" "${state_root}/unified"

if systemctl is-active --quiet vynodearr.service; then
  systemctl stop vynodearr.service
fi

rm -rf -- "${staging_root}"
install -d -m 0755 "${staging_root}"
cp -a -- "${package_root}/gateway" "${package_root}/engines" "${staging_root}/"
cp -a -- "${manifest_path}" "${package_root}/source-lock.json" "${staging_root}/"
install -m 0755 "${package_root}/install.sh" "${staging_root}/install.sh"
install -m 0755 "${package_root}/uninstall.sh" "${staging_root}/uninstall.sh"
chmod 0755 \
  "${staging_root}/gateway/VynodeArr.Gateway" \
  "${staging_root}/engines/movie/Radarr" \
  "${staging_root}/engines/television/Sonarr"

rm -rf -- "${backup_root}"
if [[ -d ${install_root} ]]; then
  mv -- "${install_root}" "${backup_root}"
fi
mv -- "${staging_root}" "${install_root}"

environment_path="${config_root}/vynodearr.env"
if [[ ! -f ${environment_path} ]]; then
  if command -v openssl >/dev/null 2>&1; then
    lifecycle_key=$(openssl rand -hex 32)
  else
    lifecycle_key=$(tr -d '-' </proc/sys/kernel/random/uuid)$(tr -d '-' </proc/sys/kernel/random/uuid)
  fi
  sed "s/replace-with-a-long-random-secret/${lifecycle_key}/" \
    "${package_root}/vynodearr.env.example" >"${environment_path}"
  chmod 0600 "${environment_path}"
fi

install -m 0644 "${package_root}/vynodearr.service" "${unit_path}"
systemctl daemon-reload
systemctl enable --now vynodearr.service

echo
echo "VynodeArr is installed and running."
echo "Open http://$(hostname -I | awk '{print $1}'):8686"
echo "Persistent data: ${state_root}"
echo "Configuration: ${environment_path}"
echo "Service status: sudo systemctl status vynodearr"
