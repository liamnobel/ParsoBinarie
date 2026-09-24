import Bun from "bun";

import { roundTripTest } from "./roundTrip.ts";

// @ts-expect-error
import modelBin from "../../binaries/model/034D.model.bin?url";
import { consoleColorCommands } from "../console.ts";

// Load file
const binaryModel: Uint8Array = new Uint8Array(await Bun.file(modelBin).arrayBuffer());
console.log("Binary bytes loaded", binaryModel.byteLength);

const result = await roundTripTest(binaryModel);

if (result.success) {
    console.log(`${consoleColorCommands.green}Binary comparison result for ${modelBin}: Equal${consoleColorCommands.reset}`);
} else {
    console.log(`${consoleColorCommands.red}Binary comparison result for ${modelBin}: Not Equal (${result.message})${consoleColorCommands.reset}`);
}
