#!/bin/bash

export MSYS_NO_PATHCONV=1;

if [ -f ".env" ]; then
    . .env
fi;

cmd=$1

if [ "$cmd" = "" ]; then
    echo "Using default cmd chernarusplus"
    cmd="chernarusplus"
fi

cmd="cd /cache/work && npm i && npm start $cmd"

docker run -it --rm \
    -e STEAM_USER="$STEAM_USER" \
    -e STEAM_PASSWORD="$STEAM_PASSWORD" \
    -e STEAM_GUARD="$STEAM_GUARD" \
    -e FORCE_EXPORT="$FORCE_EXPORT" \
    -e EXTRACTION_PATH="/p/extraction" \
    -v "$(pwd):/cache/work" \
    -v "$(pwd)/extraction:/p/extraction" \
    -v "$(pwd)/gamedata/:/cache/dayzmaps/gamedata/" \
    -v "$(pwd)/wsdata/:/cache/dayzmaps/wsdata/" \
    dayz-map-tools \
    bash -c "$cmd"
