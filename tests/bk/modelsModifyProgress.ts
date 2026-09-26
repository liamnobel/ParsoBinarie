import Bun from "bun";

import { readdir } from "fs/promises";

import * as Mods from "./mods";

const pathIn = "../../binaries/model/";
const pathOut = "../../binaries/modelModified/";

const modelBinDirectory = new URL(pathIn, import.meta.url);
const modelBinModifiedDirectory = new URL(pathOut, import.meta.url);

const concurrency = 16;

const files = await readdir(modelBinDirectory);

let nextFileIndex = 0;
let completed = 0;

function printProgress(): void {
    const width = 40;

    const progress = files.length === 0 ? 1 : completed / files.length;

    const filled = Math.round(progress * width);

    const bar = "█".repeat(filled) + "░".repeat(width - filled);

    const percent = (progress * 100).toFixed(1);

    process.stdout.write(`\rProcessing models[${bar}] ${completed}/${files.length} ${percent}%`);
}

async function processFile(file: string): Promise<void> {
    const fileURL = new URL(file, modelBinDirectory);

    const binaryModel = new Uint8Array(await Bun.file(fileURL).arrayBuffer());

    // const outputBuffer = await Mods.redVertexColors(binaryModel);
    // const outputBuffer = await Mods.halfSizeXZ(binaryModel);
    const outputBuffer = await Mods.halfSizeY(binaryModel);

    // write file
    const outputFileURL = new URL(file, modelBinModifiedDirectory);
    await Bun.write(outputFileURL, outputBuffer);
}

async function worker(): Promise<void> {
    while (true) {
        const fileIndex = nextFileIndex++;

        if (fileIndex >= files.length) {
            return;
        }

        const file = files[fileIndex];

        try {
            await processFile(file);
        } catch (error) {
            console.error(`Error processing file ${file}:`, error);
        }

        completed++;

        printProgress();
    }
}

printProgress();

const workerCount = Math.min(concurrency, files.length);

await Promise.all(Array.from({ length: workerCount }, () => worker()));

console.log("\nProcessing complete.");
