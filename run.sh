#!/bin/bash

cmd=$1

if [ "$cmd" = "" ]; then
    echo "Using default cmd"
    cmd='bash -c "cd /work && npm i && npm start"'
fi

execution="
docker run --rm \
           -e STEAM_USER=\"$STEAM_USER\" \
           -e STEAM_PASSWORD=\"$STEAM_PASSWORD\" \
           -e STEAM_GUARD=\"$STEAM_GUARD\" \
           -v `pwd`:/work \
           -v `pwd`/gamedata/:/cache/dayzmaps/gamedata/ \
           -v `pwd`/wsdata/:/cache/dayzmaps/wsdata/ \
           -v `pwd`/extraction/:/cache/dayzmaps/extraction/ \
           dayz-map-tools \
           $cmd
"
eval $execution
