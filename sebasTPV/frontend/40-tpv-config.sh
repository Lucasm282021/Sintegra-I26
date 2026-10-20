#!/bin/sh
set -eu

: "${API_BASE_URL:?Configura API_BASE_URL con el origen público del backend}"
case "$API_BASE_URL" in
  https://*|http://*) ;;
  *) echo "API_BASE_URL debe comenzar con http:// o https://" >&2; exit 1 ;;
esac
case "$API_BASE_URL" in
  *[!A-Za-z0-9./:_-]*) echo "API_BASE_URL contiene caracteres no permitidos" >&2; exit 1 ;;
esac

printf 'window.__TPV_CONFIG__ = { apiBaseUrl: "%s" };\n' "$API_BASE_URL" \
  > /usr/share/nginx/html/config.js
