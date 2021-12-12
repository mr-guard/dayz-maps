const path = require('path');
const fs = require('fs');
const fse = require('fs-extra');
const child_process = require('child_process');
const data = JSON.parse(fs.readFileSync('src/data.json'));
const rawData = process.env.GAME_DATA_PATH || '/cache/dayzmaps/gamedata';
const rawDataWs = process.env.WS_DATA_PATH || '/cache/dayzmaps/wsdata';
const extractionBase = process.env.EXTRACTION_PATH || 'extraction';
const debug = false;

const createBaseDirectories = () => {
    fse.ensureDirSync(extractionBase);
    fse.ensureDirSync(rawDataWs);
    fse.ensureDirSync(rawData);
};

const createOverviewPage = () => {
    // write and overview page
    const mapNames = Object.keys(data);
    const overviewTemplate = `<html lang="en-US">
    <head>
      <meta charset="UTF-8">
      <title>DayZ Maps</title>
    </head>
    <body>
        <h1>Maps:</h1>
        <table>
        <tbody>
            ${
                mapNames.map((mapName) => `
                <tr>
                <td><a href="./${mapName}/index.html">${mapName}</a></td>
                <td><a href="./${mapName}/index.html"><img src="./${mapName}/preview.png" width="200" height="200"></a></td>
                </tr>
                `).join('\n')
            }
        </tbody>
        </table>
    </body>
    </html>`;
    fse.writeFileSync(path.join(extractionBase, 'index.html'), overviewTemplate);
};

const spawn = (cmd, args, cwd) => {
    return new Promise((res, rej) => {
        const spawnedProcess = child_process.spawn(
            cmd,
            args,
            {
                cwd: cwd ? cwd : undefined
            }
        );
        let out = '';
        spawnedProcess.stdout.on('data', (data) => {
            console.log('' + data);
            out += data;
        });
        spawnedProcess.stderr.on('data', (data) => {
            console.log('' + data);
            out += data;
        });
        spawnedProcess.on('error', (err) => {
            console.error('Error', err);
            process.exit(1);
        });
        spawnedProcess.on('close', (code) => {
            if (code) {
                console.error(out);
                rej(out);
            } else {
                res(out); 
            }
        });
    });
}

const spawnSteam = (args, cwd) => {
    return new Promise((res, rej) => {
        const spawnedProcess = child_process.spawn(
            'steamcmd',
            args,
            {
                cwd: cwd ? cwd : undefined,
                stdio: [
                    'inherit', // inherit stdin to enable input of password / steam guard code
                    'inherit',
                    'inherit',
                ],
            },
        );
        spawnedProcess.on('close', (code) => {
            if (![0, 6, 7].includes(code)) {
                rej(code);
            } else {
                res(code); 
            }
        });
    });
}

const find = (input, ptr, search) => {
    const idx = input.indexOf(search, ptr);
    if (idx !== -1) {
        return (idx - ptr) + search.length;
    }
    return -1;
};

const cfg2json = (input, level) => {
    level = (level || 0) + 1;

    input = input
        .replace(/\r\n/g, '\n')
        .replace(/\n\n/g, '\n');

    let ptr = 0;
    const output = {};

    let classMatch = null;
    let arrMatch = null;
    let stringMatch = null;
    let boolMatch = null;
    let numberMatch = null;

    while (ptr < input.length) {
        let eol = find(input, ptr, '\n');
        if (eol === -1) break;
        const line = input.slice(ptr, ptr + eol).trim();
        // eslint-disable-next-line no-cond-assign
        if (classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)((\s*:\s*([a-zA-Z0-9_]+)){0,1})/i)) {
            const nextBracket = find(input, ptr, '{');
            const nextSemi = find(input, ptr, ';');
            if (debug) {
                console.log('classMatch', classMatch[1], level, nextBracket, nextSemi);
            }
            if (nextBracket !== -1 && nextBracket < nextSemi) {
                ptr += find(input, ptr, '{');
                const innerStart = ptr;
                let parenthesisCount = 1;
                while (parenthesisCount > 0) {
                    const c = input[ptr];
                    if (typeof c === 'undefined' || c == null || c.length === 0) {
                        throw new Error(`Unexpected end of file - prob a bug when parsing the cfg ${ptr} ${input.slice(Math.max(ptr - 100, 0), ptr)}`);
                    }
                    if (c === '"' || c === '\'') {
                        do {
                            ptr += 1;
                            ptr += find(input, ptr, c);
                        } while (input[ptr] === c);
                        continue;
                    } else if (c === '{') {
                        parenthesisCount += 1;
                    } else if (c === '}') {
                        parenthesisCount -= 1;
                    }
                    ptr += 1;
                }
                const body = input.slice(innerStart, ptr - 1).trim();
                if (body) {
                    output[classMatch[1]] = cfg2json(
                        `${body}\n`,
                        level,
                    );

                    if (classMatch[4]) {
                        output[classMatch[1]].__inherited = classMatch[4];
                    }
                }
            }
            eol = find(input, ptr, '\n');
        // eslint-disable-next-line no-cond-assign
        } else if (stringMatch = line.match(/^([a-zA-Z0-9]+)\s*=\s*"(.*)";/i)) {
            if (debug) {
                console.log('stringMatch', stringMatch[1], level);
            }
            // eslint-disable-next-line prefer-destructuring
            output[stringMatch[1]] = stringMatch[2] ? stringMatch[2] : '';
        // eslint-disable-next-line no-cond-assign
        } else if (boolMatch = line.match(/^([a-zA-Z0-9]+)\s*=\s*(true|false);/i)) {
            if (debug) {
                console.log('boolMatch', boolMatch[1], level);
            }
            // eslint-disable-next-line prefer-destructuring
            output[boolMatch[1]] = boolMatch[2] === 'true';
        // eslint-disable-next-line no-cond-assign
        } else if (numberMatch = line.match(/^([a-zA-Z0-9]+)\s*=\s*([0-9\.\-e]+);/i)) {
            if (debug) {
                console.log('numberMatch', numberMatch[1], level);
            }
            output[numberMatch[1]] = parseFloat(numberMatch[2]);
        // eslint-disable-next-line no-cond-assign
        } else if (arrMatch = line.match(/^([a-zA-Z0-9]+)\s*\[\]\s*=\s*/i)) {
            if (debug) {
                console.log('arrMatch', arrMatch[1], level);
            }
            ptr = input.indexOf('{', ptr) + 1;
            const innerStart = ptr;
            let parenthesisCount = 1;
            while (parenthesisCount > 0) {
                const c = input[ptr];
                if (c === '"' || c === '\'') {
                    ptr = input.indexOf(c, ptr + 1);
                } else if (c === '{') {
                    parenthesisCount += 1;
                } else if (c === '}') {
                    parenthesisCount -= 1;
                }
                ptr += 1;
            }
            const inner = `[${input.slice(innerStart, ptr - 1).replace(/\{/g, '[').replace(/\}/g, ']').trim()}]`;
            output[arrMatch[1]] = JSON.parse(inner);
            eol = find(input, ptr, '\n');
        }
        ptr += eol;
    }
    return output;
};

const downloadMap = async (worldName) => {
    
    if (!data[worldName].workshopId) {
        // update server
        await spawnSteam(
            [
                '+@sSteamCmdForcePlatformType windows',
                ...(process.env.STEAM_GUARD ? ['+set_steam_guard_code', process.env.STEAM_GUARD] : []),
                '+login', process.env.STEAM_USER, process.env.STEAM_PASSWORD,
                '+force_install_dir', rawData,
                '+app_update', 221100, // 'validate',
                '+quit',
            ]
        );
    } else {
        await spawnSteam(
            [
                '+@sSteamCmdForcePlatformType windows',
                ...(process.env.STEAM_GUARD ? ['+set_steam_guard_code', process.env.STEAM_GUARD] : []),
                '+login', process.env.STEAM_USER, process.env.STEAM_PASSWORD,
                '+force_install_dir', rawDataWs,
                '+workshop_download_item', 221100, data[worldName].workshopId, // 'validate',
                '+quit',
            ]
        ).catch((err) => {
            console.error(`Steam mod exit: ${err}`);
            process.exit(1);
        });
    }
    
};

const exportMap = async (worldName) => {
    console.log(`Running export for ${worldName}`);
    
    if (!worldName || !data[worldName]) {
        console.error(`Unknown world name ${worldName}`);
        process.exit(1);
    }

    const config = data[worldName];
    const maxZoom = config.maxZoom && config.maxZoom > 0 ? config.maxZoom : 8;
    const extraction = path.join(extractionBase, worldName);
    
    if (fs.existsSync(extraction)) {
        if (process.env.FORCE_EXPORT || process.env.EXPORT_HOST) {
            fse.removeSync(extraction);
        } else {
            console.log(`Skipping ${worldName} because extraction already exists and FORCE_EXPORT env var was not set`);
            return;
        }
        
    }
    fse.ensureDirSync(extraction);

    await downloadMap(worldName);

    for (const pbo of config.extractPbos) {
        if (config.workshopId) {
            const startPath = path.join(
                rawDataWs,
                'steamapps',
                'workshop',
                'content',
                '221100',
                config.workshopId,
            );
            const pboPath = path.join(
                startPath,
                'addons',
                pbo
            );
            fse.copyFileSync(
                fse.existsSync(pboPath) ? pboPath : path.join(startPath, 'Addons', pbo),
                path.join(extraction, pbo),
            );
        } else {
            const pboPath = path.join(
                rawData,
                'Addons',
                pbo
            );
            fse.copyFileSync(
                pboPath,
                path.join(extraction, pbo),
            );
        }
        console.log(`Extracting ${pbo}`);
        await spawn(
            'extractpbo',
            [
                pbo,
                extraction,
            ],
            extraction,
        );
        fse.unlinkSync(path.join(extraction, pbo));
    }

    const toCleanup = fse.readdirSync(extraction);

    const cppContent = cfg2json(
        '' + fse.readFileSync(path.join(
            extraction,
            config.cfgWorlds
        )),
    );
    const cfgWorldKey = Object.keys(cppContent).find((x) => x.toLowerCase() === 'cfgworlds');
    const worldConfigName = Object.keys(cppContent[cfgWorldKey]).find((x) => x.toLowerCase() === worldName.toLowerCase());
    const cfgWorlds = cppContent[cfgWorldKey][worldConfigName];
    const cfgCenter = cfgWorlds.centerPosition;
    const locations = [];
    if (cfgWorlds.Names && Object.keys(cfgWorlds.Names).length) {
        locations.push(...Object.keys(cfgWorlds.Names).map((x) => {
            const entry = cfgWorlds.Names[x];
            entry.cfgName = x;
            return entry;
        }));
    }
    if (config.locations) {
        locations.push(...config.locations);
    }
    // console.log(cppContent);
    const mapInfo = {
        title: cppContent.description,
        worldName: worldName,
        tilePattern: config.tilePattern ? config.tilePattern : `tiles/{z}/{x}/{y}.png`,
        maxZoom: maxZoom,
        minZoom: 0,
        defaultZoom: config.defaultZoom && config.defaultZoom > 0 ? config.defaultZoom : 0,
        attribution: config.attribution ? config.attribution : null,
        tileSize: config.tileSize ? config.tileSize : null,
        center: config.center ? config.center : [cfgCenter[0], cfgCenter[1]],
        worldSize: config.worldSize ? config.worldSize : Math.max(cfgCenter[0], cfgCenter[1]) * 2,
        scale: config.scale ? config.scale : 1,
        preview: 'preview.png',
        fullSize: 'map.png',
        locations: locations,
    };
    console.log('Writing config...');
    fse.writeFileSync(path.join(extraction, 'data.json'), JSON.stringify(mapInfo));
    fse.copySync('src/index.html', path.join(extraction, 'index.html'));
    
    const layersFolder = path.join(extraction, config.layersFolder).replace(/\\/g, '/');
    await Promise.all(
        fse.readdirSync(layersFolder)
            .filter((x) => x.toLowerCase().startsWith('s_') && x.toLowerCase().endsWith('.paa'))
            .map((x) => {
                return fse.copy(
                    path.join(layersFolder, x),
                    path.join(extraction, x.toLowerCase()),
                );
            })
    );
    
    console.log(`Converting ${extraction} PAAs to PNGs...`);
    
    const converts = [];
    for (const x of fse.readdirSync(extraction)) {
        if (x.startsWith('s_') && x.endsWith('.paa')) {
            const filebase = x.substring(0, x.lastIndexOf('.'));
            console.log(filebase);
            converts.push(
                spawn(
                    'armake',
                    [
                        'paa2img',
                        `${filebase}.paa`,
                        `${filebase}.png`,
                    ],
                    extraction,
                ),
            );
        }
    }
    await Promise.all(converts);

    // cleanup
    for (const cleanItem of toCleanup) {
        fse.removeSync(
            path.join(extraction, cleanItem),
        );
    }
    await Promise.all(
        fse.readdirSync(extraction)
            .filter((x) => x.startsWith('s_') && x.endsWith('.paa'))
            .map((x) => {
                return fse.unlink(path.join(extraction, x));
            })
    );
    
    console.log('Size check...');
    await Promise.all(
        fse.readdirSync(extraction)
            .filter((x) => x.startsWith('s_') && x.endsWith('.png'))
            .map((x) => {
                console.log(x);
                return spawn(
                    'convert',
                    [
                        '-scale', '512x512<',
                        x, //s_*.png`
                        x,
                    ],
                    extraction
                );
            })
    );

    console.log('Shaving...');
    await Promise.all(
        fse.readdirSync(extraction)
            .filter((x) => x.startsWith('s_') && x.endsWith('.png'))
            .map((x) => {
                console.log(x);
                return spawn(
                    'mogrify',
                    [
                        '-shave', (config.shave ? config.shave : '16x16'),
                        x, //s_*.png`
                    ],
                    extraction
                );
            })
    );
    
    console.log('Merge stage 1...');
    let maxTile = 0;
    while (true) {
        const i = maxTile + 1;
        const markerFile = `s_0${(i < 10) ? '0' : ''}${i}_000_lco.png`;
        if (!fs.existsSync(path.join(extraction, markerFile))) {
            break;
        }
        maxTile++;
    }
    console.log(`MaxTile = ${maxTile}`);
    
    const merges = [];
    for (let i = 0; i <= maxTile; ++i) {
        merges.push(spawn(
            'convert',
            [
                `-append`,
                `s_0${(i < 10) ? '0' : ''}${i}*.png`,
                `row_${(i + 1) < 10 ? '0' : ''}${i + 1}.png`
            ],
            extraction
        ));
    }
    await Promise.all(merges);

    // cleanup single images
    await Promise.all(
        fse.readdirSync(extraction)
            .filter((x) => x.startsWith('s_') && x.endsWith('.png'))
            .map((x) => {
                return fse.unlink(path.join(extraction, x));
            })
    );

    console.log('Merge stage 2...');
    await spawn(
        'convert',
        [
            `+append`,
            `row_*.png`,
            `map.png`
        ],
        extraction
    );

    await spawn(
        'convert',
        [
            `map.png`,
            `-resize`, `512x512`,
            `preview.png`
        ],
        extraction
    );

    // cleanup rows
    await Promise.all(
        fse.readdirSync(extraction)
            .filter((x) => x.startsWith('row_') && x.endsWith('.png'))
            .map((x) => {
                return fse.unlink(path.join(extraction, x));
            })
    );
    console.log('Merge done');


    console.log('Tiling...');
    await spawn(
        'python3',
        [
            '/usr/local/src/gdal2tiles-leaflet-master/gdal2tiles.py',
            '--leaflet',
            '-p', 'raster',
            '-z', `0-${maxZoom}`,
            '-w', 'none',
            'map.png',
            'tiles',
        ],
        extraction
    );

}

(async () => {

    createBaseDirectories();

    if (process.argv[2]) {

        if (process.argv[2] === 'basefiles') {
            createOverviewPage();
        } else {
            await exportMap(process.argv[2]);
        }

    } else {
        for (const entry of Object.keys(data)) {
            await exportMap(entry);
        }
    }

    console.log('Done');
})()
.catch((err) => {
    console.error('Uncaught:', err);
    process.exit(1);
});
