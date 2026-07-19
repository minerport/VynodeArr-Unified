#!/usr/bin/env bash
set -euo pipefail

if [[ ${EUID} -ne 0 ]]; then
  echo "Run this uninstaller with sudo: sudo ./uninstall.sh [--purge]" >&2
  exit 1
fi

purge=false
if [[ ${1:-} == "--purge" ]]; then
  purge=true
elif [[ $# -gt 0 ]]; then
  echo "Usage: sudo ./uninstall.sh [--purge]" >&2
  exit 1
fi

systemctl disable --now vynodearr.service 2>/dev/null || true
rm -f -- /etc/systemd/system/vynodearr.service
systemctl daemon-reload
systemctl reset-failed vynodearr.service 2>/dev/null || true
rm -rf -- /opt/vynodearr /opt/vynodearr.new /opt/vynodearr.previous

if ${purge}; then
  rm -rf -- /etc/vynodearr /var/lib/vynodearr
  if id --user vynodearr >/dev/null 2>&1; then
    userdel vynodearr
  fi
  if getent group vynodearr >/dev/null; then
    groupdel vynodearr
  fi
  echo "VynodeArr and its configuration and databases were removed permanently."
else
  echo "VynodeArr was removed. Configuration and databases remain in /etc/vynodearr and /var/lib/vynodearr."
  echo "Run sudo ./uninstall.sh --purge only if you also want those files deleted permanently."
fi
