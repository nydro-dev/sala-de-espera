#!/bin/sh
# Publica a app na Cloudflare Pages (saladeespera.pages.dev).
# Copia só os ficheiros da app para .publicar/ (o README, os scripts e o código do servidor não vão
# como ficheiros do site); as funções do servidor saem de functions/. Precisa de CLOUDFLARE_API_TOKEN
# e CLOUDFLARE_ACCOUNT_ID no ambiente.
set -e
cd "$(dirname "$0")/.."
rm -rf .publicar && mkdir .publicar
cp -r index.html privacidade.html manifest.webmanifest sw.js css js fonts licencas ./*.png .publicar/
npx --yes wrangler@4 pages deploy .publicar --project-name saladeespera --branch main --commit-dirty=true
