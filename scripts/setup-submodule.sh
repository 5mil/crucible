#!/usr/bin/env bash
# One-time helper to add the Empire & Kin submodule cleanly.
set -euo pipefail

if [ -d vendor/empire-and-kin/.git ] || [ -f vendor/empire-and-kin/.git ]; then
  echo "Submodule already present."
  git submodule update --init --recursive
  exit 0
fi

mkdir -p vendor
git submodule add -b main https://github.com/5mil/empire-and-kin.git vendor/empire-and-kin
git submodule update --init --recursive
echo "Empire & Kin submodule ready at vendor/empire-and-kin"
