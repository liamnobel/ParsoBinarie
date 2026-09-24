import { ByteReader } from "../../src/core/byteReader";

const fileURL = new URL("../binaries/model/02E6.model.bin", import.meta.url);
const binaryModel: Uint8Array = new Uint8Array(await Bun.file(fileURL).arrayBuffer());
console.log("Binary bytes loaded", binaryModel.byteLength);

const byteReader = new ByteReader(binaryModel, "big");
byteReader.offset = 0x50;
console.log("Offset", "0x" + byteReader.offset.toString(16));
const readValue = byteReader.u32();

const expectedValue = 2080;

if (readValue === expectedValue) {
    console.log(`Test passed: Read value ${readValue} matches expected value ${expectedValue}`);
} else {
    console.error(`Test failed: Read value ${readValue} does not match expected value ${expectedValue}`);
}
