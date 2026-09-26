import Bun from "bun";

import { readdir } from "fs/promises";

import { roundTripTest } from "./roundTrip";

import { consoleColorCommands } from "../console";

const directoryPath = "../../binaries/model/";

const modelBinDirectory = new URL(directoryPath, import.meta.url);

const concurrency = 16;

const files = await readdir(modelBinDirectory);

type TestResult = {
    fileName: string;
    originalFileSize: number;
    result: Awaited<ReturnType<typeof roundTripTest>>;
};

let nextFileIndex = 0;
let completed = 0;
let passed = 0;
let failed = 0;

const results: TestResult[] = [];

function printProgress(): void {
    const width = 40;

    const progress = files.length === 0 ? 1 : completed / files.length;

    const filled = Math.round(progress * width);

    const bar = "█".repeat(filled) + "░".repeat(width - filled);

    const percent = (progress * 100).toFixed(1);

    process.stdout.write(`\rTesting models[${bar}] ${completed}/${files.length} ${percent}% | Passed: ${passed} | Failed: ${failed}`);
}

async function testFile(file: string): Promise<TestResult> {
    const fileURL = new URL(file, modelBinDirectory);

    const binaryModel = new Uint8Array(await Bun.file(fileURL).arrayBuffer());

    const result = await roundTripTest(binaryModel);

    return {
        fileName: file,
        originalFileSize: binaryModel.length,
        result,
    };
}

async function worker(): Promise<void> {
    while (true) {
        const fileIndex = nextFileIndex++;

        if (fileIndex >= files.length) {
            return;
        }

        const file = files[fileIndex];

        try {
            const testResult = await testFile(file);

            results[fileIndex] = testResult;

            if (testResult.result.success) {
                passed++;
            } else {
                failed++;
            }
        } catch (error) {
            failed++;

            results[fileIndex] = {
                fileName: file,
                originalFileSize: 0,
                result: {
                    success: false,
                    message: error instanceof Error ? error.message : String(error),
                },
            };
        }

        completed++;

        printProgress();
    }
}

printProgress();

const workerCount = Math.min(concurrency, files.length);

await Promise.all(Array.from({ length: workerCount }, () => worker()));

process.stdout.write("\n\n");

for (const { fileName, originalFileSize, result } of results) {
    if (result.success) {
        // console.log(`${consoleColorCommands.green}${fileName}: Equal${consoleColorCommands.reset}`);
    } else {
        console.log(`${consoleColorCommands.red}${fileName}: Not Equal (${result.message})${consoleColorCommands.reset}   size: ${originalFileSize}`);
    }
}

const successRate = files.length === 0 ? 100 : (passed / files.length) * 100;

console.log();

console.log(`${passed} out of ${files.length} files passed the round-trip test. ` + `${successRate.toFixed(2)}% success rate.`);
