import Bun from "bun";
import { readdir } from "fs/promises";
import { roundTripTest } from "./roundTrip";
import { consoleColorCommands } from "../console";

const directoryPath = "../../binaries/modelSubset/";

const modelBinDirectory = new URL(directoryPath, import.meta.url);

// list files in the directory
const files = await readdir(modelBinDirectory);

const comparePromises = files.map(async (file) => {
    // load as uint8array
    const fileURL = new URL(file, modelBinDirectory);
    const binaryModel: Uint8Array = new Uint8Array(await Bun.file(fileURL).arrayBuffer());
    // console.log("Binary bytes loaded", file, binaryModel.byteLength);

    return {
        fileName: file,
        result: await roundTripTest(binaryModel),
    };
});

const results = await Promise.all(comparePromises);

results.forEach(({ fileName, result }) => {
    if (result.success) {
        console.log(`${consoleColorCommands.green}${fileName}: Equal${consoleColorCommands.reset}`);
    } else {
        console.log(`${consoleColorCommands.red}${fileName}: Not Equal (${result.message})${consoleColorCommands.reset}`);
    }

    return result.success;
});

const successCount = results.filter(({ result }) => result.success).length;
console.log(`${successCount} out of ${results.length} files passed the round-trip test. ${((successCount / results.length) * 100).toFixed(2)}% success rate.`);
