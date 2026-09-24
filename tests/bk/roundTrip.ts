import Bun from "bun";

import { parseDataFromArray, writeDataToArray } from "../../src/core/data.ts";
import { methodModel } from "../../src/formats/bk/model.ts";
import { assertBytesEqual } from "../../src/core/compare.ts";

export async function roundTripTest(binaryModel: Uint8Array): Promise<{ success: boolean; message?: string }> {
    try {
        // Parse binary data into structured node
        const structuredNode = parseDataFromArray(binaryModel, methodModel);
        const structuredNodeURL = new URL("../temp/02E6.model.json", import.meta.url);
        await Bun.write(structuredNodeURL, JSON.stringify(structuredNode, null, 2));
        // console.log("Structured node written to JSON file", structuredNodeURL.pathname);

        // Write structured node back to binary
        const writtenBinary = writeDataToArray(structuredNode.data, methodModel);
        const writtenBinaryURL = new URL("../temp/02E6.model.written.bin", import.meta.url);
        await Bun.write(writtenBinaryURL, writtenBinary);
        // console.log("Binary bytes written", writtenBinary.byteLength);

        // Compare original and written binary
        return assertBytesEqual(binaryModel, writtenBinary);
    } catch (error) {
        return { success: false, message: (error as Error).message };
    }
}
