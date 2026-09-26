import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { GUI } from "three/addons/libs/lil-gui.module.min.js";

import * as ParsoBinarie from "../../../src/index.js";
import modelBin from "../../../binaries/model/03C9.model.bin?url";

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

const pointLight = new THREE.PointLight(0xffffff, 50);
scene.add(pointLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 1);
scene.add(ambientLight);

// light helper
const pointLightHelper = new THREE.PointLightHelper(pointLight);
scene.add(pointLightHelper);

const controls = new OrbitControls(camera, renderer.domElement);

function animate() {
    // move light in circle
    pointLight.position.x = Math.sin(Date.now() * 0.001) * 5;
    pointLight.position.z = Math.cos(Date.now() * 0.001) * 5;
    pointLight.position.y = Math.sin(Date.now() * 0.001) * 5;

    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
}
animate();

function addBinToScene(filename: string, bin: Uint8Array) {
    const parsedData = ParsoBinarie.parseDataFromArray(bin, ParsoBinarie.methodModel);
    console.log(`Parsed Data for file: ${filename}`, parsedData.data);

    const group = new THREE.Group();
    scene.add(group);

    const folderDisplay = gui.addFolder(filename);
    folderDisplay.add(group, "visible").name("Visible");

    const groupRaw = folderDisplay.addFolder("Visibility");

    {
        // model vertices visualization
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

    {
        // all display list visualization
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

    {
        // geo command emulation visualization
    }
}

addBinToScene("example.bin", originalBytes);
