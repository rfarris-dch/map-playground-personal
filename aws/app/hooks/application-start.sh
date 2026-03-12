#!/usr/bin/env bash
set -euo pipefail

systemctl restart map-api.service
systemctl restart nginx
