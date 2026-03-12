#!/usr/bin/env bash
set -euo pipefail

if systemctl list-unit-files | grep -q '^map-api\.service'; then
  systemctl stop map-api.service || true
fi
