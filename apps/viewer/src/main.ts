import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";
import * as ParsoBinarie from "../../../src/index.js";

// import modelBin from "../../../binaries/model/02DF.model.bin?url";
import modelBin from "../../../binaries/model/02E6.model.bin?url";

import type { DisplayListData } from "../../../src/formats/bk/fast3dex.js";
import { R5G5B5A1toR8G8B8A8 } from "../../../src/core/color";

const originalResponse = await fetch(modelBin);
const originalBuffer = await originalResponse.arrayBuffer();
const originalBytes = new Uint8Array(originalBuffer);

const importScale = 1 / 20;

const gui = new GUI();

// add file input via gui
gui.add(
    {
        loadFile: () => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".bin";
            input.onchange = async (event) => {
                const file = (event.target as HTMLInputElement).files?.[0];
                if (file) {
                    const arrayBuffer = await file.arrayBuffer();
                    const bytes = new Uint8Array(arrayBuffer);
                    addBinToScene(file.name, bytes);
                }
            };
            input.click();
        },
    },
    "loadFile",
).name("Load Model File");

export function callbackField(obj: Object, field: string, callback: (value: any) => void) {
    function recurse(obj: any) {
        if (obj && typeof obj === "object") {
            for (const key in obj) {
                if (key === field) {
                    // obj[key] = callback(obj[key]);
                    callback(obj[key]);
                } else {
                    recurse(obj[key]);
                }
            }
        }
    }

    recurse(obj);
}

//

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);
const startZoom = 10;
camera.position.z = startZoom;
camera.position.x = startZoom;
camera.position.y = startZoom;

// const pointLight = new THREE.PointLight(0xffffff, 50);
// scene.add(pointLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// light helper
// const pointLightHelper = new THREE.PointLightHelper(pointLight);
// scene.add(pointLightHelper);

const controls = new OrbitControls(camera, renderer.domElement);

function animate() {
    // move light in circle
    // pointLight.position.x = Math.sin(Date.now() * 0.001) * 5;
    // pointLight.position.z = Math.cos(Date.now() * 0.001) * 5;
    // pointLight.position.y = Math.sin(Date.now() * 0.001) * 5;

    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

type DisplayState = {
    tmem: Uint8Array;

    textureImage: {
        address: number;
        format: number;
        size: number;
        width: number;
    };

    tiles: {
        format: number;
        size: number;
        line: number;

        tmem: number;
        palette: number;

        clampT: boolean;
        mirrorT: boolean;
        maskT: number;
        shiftT: number;

        clampS: boolean;
        mirrorS: boolean;
        maskS: number;
        shiftS: number;

        uls: number;
        ult: number;
        lrs: number;
        lrt: number;
    }[];

    activeTile: number;

    textureScaleS: number;
    textureScaleT: number;
};

function addBinToScene(filename: string, bin: Uint8Array) {
    const parsedData = ParsoBinarie.parseDataFromArray(bin, ParsoBinarie.methodModel);
    console.log(`Parsed Data for file: ${filename}`, parsedData.data);

    const group = new THREE.Group();
    scene.add(group);

    const folderDisplay = gui.addFolder(filename);
    folderDisplay.add(group, "visible").name("Visible");

    const groupRaw = folderDisplay.addFolder("Visibility");

    // model vertices visualization
    if (true) {
        callbackField(parsedData.data, "vertices", (value) => {
            console.log("Vertices:", value);

            const geometry = new THREE.BufferGeometry();

            geometry.setAttribute(
                "position",
                new THREE.Float32BufferAttribute(
                    value.data.flatMap((vert: any) => [vert.data.x * importScale, vert.data.y * importScale, vert.data.z * importScale]),
                    3,
                ),
            );

            geometry.setAttribute(
                "color",
                new THREE.Float32BufferAttribute(
                    value.data.flatMap((vert: any) => [vert.data.cr_or_nx / 255, vert.data.cg_or_ny / 255, vert.data.cb_or_nz / 255]),
                    3,
                ),
            );

            const material = new THREE.PointsMaterial({
                size: 10,
                vertexColors: true,
                sizeAttenuation: false,
            });

            const points = new THREE.Points(geometry, material);

            group.add(points);

            points.visible = false;
            groupRaw.add(points, "visible").name("Points");
        });
    }

    // all display list visualization (no texture emulation)
    if (false) {
        const geometry = new THREE.BufferGeometry();

        const positionArray: number[] = [];
        const colorArray: number[] = [];
        const indexArray: number[] = [];

        const vertexIndexOffsetBuffer = new Array(256).fill(-1);

        callbackField(parsedData.data, "vertices", (value) => {
            console.log("Vertex Data:", value);

            value.data.forEach((vert: any) => {
                positionArray.push(vert.data.x * importScale, vert.data.y * importScale, vert.data.z * importScale);
                colorArray.push(vert.data.cr_or_nx / 255, vert.data.cg_or_ny / 255, vert.data.cb_or_nz / 255);
            });
        });

        callbackField(parsedData.data, "gfxCommands", (value) => {
            console.log("Command Data:", value);

            // emulate all draw commands in order (naive)
            value.data.forEach((command: any) => {
                switch (command.command) {
                    case "G_VTX": {
                        for (let i = 0; i < command.numberOfVertices; i++) {
                            vertexIndexOffsetBuffer[command.whereToWrite + i] = Number(command.segmentOffset >> 4) + i;
                        }
                        break;
                    }
                    case "G_TRI1": {
                        const vertex0 = vertexIndexOffsetBuffer[command.triA[0]];
                        const vertex1 = vertexIndexOffsetBuffer[command.triA[1]];
                        const vertex2 = vertexIndexOffsetBuffer[command.triA[2]];

                        indexArray.push(vertex0, vertex1, vertex2);

                        break;
                    }
                    case "G_TRI2": {
                        const vertex0 = vertexIndexOffsetBuffer[command.triA[0]];
                        const vertex1 = vertexIndexOffsetBuffer[command.triA[1]];
                        const vertex2 = vertexIndexOffsetBuffer[command.triA[2]];

                        indexArray.push(vertex0, vertex1, vertex2);

                        const vertex3 = vertexIndexOffsetBuffer[command.triB[0]];
                        const vertex4 = vertexIndexOffsetBuffer[command.triB[1]];
                        const vertex5 = vertexIndexOffsetBuffer[command.triB[2]];

                        indexArray.push(vertex3, vertex4, vertex5);

                        break;
                    }
                    default: {
                        break;
                    }
                }
            });
        });

        geometry.setAttribute("position", new THREE.Float32BufferAttribute(positionArray, 3));
        geometry.setAttribute("color", new THREE.Float32BufferAttribute(colorArray, 3));
        geometry.setIndex(indexArray);

        geometry.computeVertexNormals();

        const material = new THREE.MeshStandardMaterial({
            vertexColors: true,
            side: THREE.FrontSide,
            roughness: 0.8,
            metalness: 0.0,
        });
        const mesh = new THREE.Mesh(geometry, material);
        group.add(mesh);

        groupRaw.add(mesh, "visible").name("Mesh");
    }

    // all display list visualization (with texture emulation)
    if (true) {
        const geometry = new THREE.BufferGeometry();

        const renderVertices: {
            position: THREE.Vector3;
            color: THREE.Color;
            uv: THREE.Vector2;
        }[] = [];

        const renderTriangles: {
            renderVertIndices: number[];
            materialIndex: number;
        }[] = [];

        const vertexIndexOffsetBuffer = new Array(256).fill(-1);

        const materials: THREE.Material[] = [];

        const displayState: DisplayState = {
            tmem: new Uint8Array(4096),

            textureImage: {
                address: 0,
                format: 0,
                size: 0,
                width: 0,
            },

            tiles: Array.from({ length: 8 }, () => ({
                format: 0,
                size: 0,
                line: 0,
                tmem: 0,
                palette: 0,

                clampT: false,
                mirrorT: false,
                maskT: 0,
                shiftT: 0,

                clampS: false,
                mirrorS: false,
                maskS: 0,
                shiftS: 0,

                uls: 0,
                ult: 0,
                lrs: 0,
                lrt: 0,
            })),

            activeTile: 0,

            textureScaleS: 1.0,
            textureScaleT: 1.0,
        };

        const materialCache = new Map<number, number>();
        const getOrCreateMaterial = (hash: number): number => {
            const existingIndex = materialCache.get(hash);

            if (existingIndex !== undefined) {
                return existingIndex;
            }

            const texture = getTextureFromTMEM(displayState);
            const material = new THREE.MeshStandardMaterial({
                vertexColors: true,
                map: texture,
            });

            const materialIndex = materials.length;

            materials.push(material);
            materialCache.set(hash, materialIndex);

            return materialIndex;
        };

        let cachedVertexData: {
            x: number;
            y: number;
            z: number;
            r: number;
            g: number;
            b: number;
            s: number;
            t: number;
        }[] = [];

        callbackField(parsedData.data, "vertices", (value) => {
            cachedVertexData = value.data.map((vert: any) => ({
                x: vert.data.x,
                y: vert.data.y,
                z: vert.data.z,

                r: vert.data.cr_or_nx,
                g: vert.data.cg_or_ny,
                b: vert.data.cb_or_nz,
                a: vert.data.ca,

                s: vert.data.s,
                t: vert.data.t,
            }));
        });

        const emitVertex = (cacheIndex: number) => {
            const sourceIndex = vertexIndexOffsetBuffer[cacheIndex];
            const vert = cachedVertexData[sourceIndex];

            if (!vert) {
                throw new Error(`Invalid vertex cache index ${cacheIndex}`);
            }

            const tile = displayState.tiles[displayState.activeTile];

            const uv = new THREE.Vector2((vert.s * 8) / displayState.textureScaleS, (vert.t * 8) / displayState.textureScaleT);

            // console.log("UV:", uv);

            const vertex = {
                position: new THREE.Vector3(vert.x * importScale, vert.y * importScale, vert.z * importScale),
                color: new THREE.Color(vert.r / 255, vert.g / 255, vert.b / 255),
                uv,
            };

            renderVertices.push(vertex);

            return vertex;
        };

        const emitTriangle = (tri: number[]) => {
            const fakeHash = Math.random();
            const materialIndex = getOrCreateMaterial(fakeHash);

            const renderVertStart = renderVertices.length;

            const [a, b, c] = tri;
            emitVertex(a);
            emitVertex(b);
            emitVertex(c);

            renderTriangles.push({
                renderVertIndices: [renderVertStart, renderVertStart + 1, renderVertStart + 2],
                materialIndex: materialIndex,
            });
        };

        const createMaterialGroups = (geometry: THREE.BufferGeometry, triangles: { materialIndex: number }[]) => {
            geometry.clearGroups();

            if (triangles.length === 0) {
                return;
            }

            let groupStartTriangle = 0;
            let materialIndex = triangles[0].materialIndex;

            for (let i = 1; i <= triangles.length; i++) {
                const nextMaterialIndex = triangles[i]?.materialIndex;

                if (nextMaterialIndex !== materialIndex) {
                    const triangleCount = i - groupStartTriangle;

                    geometry.addGroup(groupStartTriangle * 3, triangleCount * 3, materialIndex);

                    groupStartTriangle = i;
                    materialIndex = nextMaterialIndex;
                }
            }
        };

        let textureDataOffset = 0;
        callbackField(parsedData.data, "textureCount", (value) => {
            textureDataOffset = 0x40 + 0x10 * value;
            console.log("Texture Data Offset: 0x", textureDataOffset.toString(16));
        });

        callbackField(parsedData.data, "gfxCommands", (value) => {
            console.log("gfxCommands value:", value.data);

            const gfxCommands = value.data as DisplayListData[];

            console.log("EMULATING");

            gfxCommands.forEach((command: DisplayListData) => {
                switch (command.command) {
                    case "G_CLEARGEOMETRYMODE":
                    case "G_SETGEOMETRYMODE":
                        // ignore
                        break;
                    case "G_VTX":
                    case "G_TRI1":
                    case "G_TRI2":
                        console.log("TRIS");
                        break;
                    case "G_TEXTURE":
                    case "G_SETTILESIZE":
                    case "G_SETTIMG":
                    case "G_SETTILE":
                    default:
                        console.log("DisplayList command:", command);
                        break;
                }

                switch (command.command) {
                    case "G_CLEARGEOMETRYMODE": {
                        // console.log("G_CLEARGEOMETRYMODE command:", command);
                        break;
                    }

                    case "G_SETGEOMETRYMODE": {
                        // console.log("G_SETGEOMETRYMODE command:", command);
                        break;
                    }

                    case "G_VTX": {
                        for (let i = 0; i < command.numberOfVertices; i++) {
                            vertexIndexOffsetBuffer[command.whereToWrite + i] = Number(command.segmentOffset >> 4) + i;
                        }

                        break;
                    }

                    case "G_TRI1": {
                        emitTriangle(command.triA);
                        break;
                    }

                    case "G_TRI2": {
                        emitTriangle(command.triA);
                        emitTriangle(command.triB);
                        break;
                    }

                    case "G_TEXTURE": {
                        displayState.textureScaleS = command.scaleS;
                        displayState.textureScaleT = command.scaleT;
                        displayState.activeTile = command.tile;
                        break;
                    }

                    case "G_SETTILESIZE": {
                        const tile = displayState.tiles[command.tile];

                        tile.uls = command.sLower;
                        tile.ult = command.tLower;
                        tile.lrs = command.sWidth;
                        tile.lrt = command.tWidth;
                        break;
                    }

                    case "G_SETTIMG": {
                        // set where will we now pull data from in RDRAM and how much
                        // console.log("Local address in RDRAM:", command.segment - 0x02000000);
                        displayState.textureImage.address = command.segment - 0x02000000;
                        break;
                    }

                    case "G_SETTILE": {
                        // console.log("G_SETTILE command:", command);

                        // describe how the bytes in this tile are laid out
                        const tile = displayState.tiles[command.tile];

                        tile.format = command.colorFormat;
                        tile.size = command.bitsPerPixel;
                        tile.line = command.numberOf64BitValuesPerRow;
                        tile.tmem = command.tmemOffset;
                        tile.palette = command.palette;

                        tile.clampS = command.sClampAndMirror & 0b01 ? true : false;
                        tile.mirrorS = command.sClampAndMirror & 0b10 ? true : false;
                        tile.maskS = command.sWrapBits;
                        tile.shiftS = command.sShiftBits;

                        tile.clampT = command.tClampAndMirror & 0b01 ? true : false;
                        tile.mirrorT = command.tClampAndMirror & 0b10 ? true : false;
                        tile.maskT = command.tWrapBits;
                        tile.shiftT = command.tShiftBits;
                        break;
                    }

                    case "G_LOADBLOCK": {
                        const srcOffset = displayState.textureImage.address;

                        const tile = displayState.tiles[command.tile];
                        const calcW = Math.pow(2, tile.maskS);
                        const calcH = Math.pow(2, tile.maskT);
                        // console.log("Calculated width and height:", command.tile, { calcW, calcH });

                        const whereInTMEM = 0;
                        tile.tmem = whereInTMEM;

                        const size = (calcW * calcH) / 2;
                        const data = bin.buffer.slice(srcOffset + textureDataOffset, srcOffset + textureDataOffset + size);
                        // console.log("G_LOADBLOCK data:", Array.from(new Uint8Array(data)).map(byte => byte.toString(16)));
                        displayState.tmem.set(new Uint8Array(data), whereInTMEM);
                        break;
                    }

                    case "G_LOADTLUT": {
                        const srcOffset = displayState.textureImage.address;

                        const tile = displayState.tiles[command.tile];

                        // TLUT entries are 16-bit.
                        const byteCount = command.colorCount * 2;

                        // G_SETTILE's TMEM address is in units of 64-bit words.
                        const dstOffset = tile.tmem * 8;

                        const palleteDataBinOffset = srcOffset + textureDataOffset;
                        // console.log("G_LOADTLUT palette data offset: 0x", palleteDataBinOffset.toString(16));
                        const paletteData = new Uint8Array(bin.buffer, palleteDataBinOffset, byteCount);

                        displayState.tmem.set(paletteData, dstOffset);

                        break;
                    }

                    /*
                     * Texture-state commands will go here:
                     * G_LOADTILE
                     * etc.
                     */

                    default:
                        // throw new Error(`Unknown display command: ${command.command}`);
                        break;
                }
            });
        });

        createMaterialGroups(geometry, renderTriangles);

        geometry.setAttribute(
            "position",
            new THREE.Float32BufferAttribute(
                renderVertices.flatMap((v) => [v.position.x, v.position.y, v.position.z]),
                3,
            ),
        );
        geometry.setAttribute(
            "color",
            new THREE.Float32BufferAttribute(
                renderVertices.flatMap((v) => [v.color.r, v.color.g, v.color.b]),
                3,
            ),
        );
        geometry.setAttribute(
            "uv",
            new THREE.Float32BufferAttribute(
                renderVertices.flatMap((v) => [v.uv.x, v.uv.y]),
                2,
            ),
        );

        geometry.computeVertexNormals();

        const mesh = new THREE.Mesh(geometry, materials);
        group.add(mesh);
    }

    // geo command emulation visualization
    if (false) {
    }
}

addBinToScene("example.bin", originalBytes);

function getTextureFromTMEM(state: DisplayState): THREE.DataTexture {
    const tile = state.tiles[state.activeTile];

    const width = tile.lrs - tile.uls;
    const height = tile.lrt - tile.ult;

    const byteReader = new DataView(state.tmem.buffer);

    // CI4 palette:
    // TLUT starts at byte 0x800 in TMEM.
    // Each CI4 palette contains 16 * 16-bit colors = 0x20 bytes.
    let paletteOffset = 0x800 + tile.palette * 0x80;

    const lut: number[] = [];

    for (let i = 0; i < 16; i++) {
        const colorData = byteReader.getUint16(paletteOffset, false);
        paletteOffset += 2;

        lut.push(R5G5B5A1toR8G8B8A8(colorData));
    }

    // tile.tmem is measured in 64-bit words.
    let texelOffset = tile.tmem * 8;

    const rgba = new Uint8Array(width * height * 4);
    const byteWriter = new DataView(rgba.buffer);

    let writerOffset = 0;

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width / 2; x++) {
            const texels = byteReader.getUint8(texelOffset);
            texelOffset++;

            const indexA = (texels >> 4) & 0x0f;
            const indexB = texels & 0x0f;

            byteWriter.setUint32(writerOffset, lut[indexA], false);
            writerOffset += 4;

            byteWriter.setUint32(writerOffset, lut[indexB], false);
            writerOffset += 4;
        }
    }

    const texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat, THREE.UnsignedByteType);

    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.needsUpdate = true;

    return texture;
}
