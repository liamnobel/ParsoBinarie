import Bun from "bun";

import { parseDataFromArray, writeDataToArray } from "../../src/core/data.ts";
import { methodModel } from "../../src/formats/bk/model.ts";

// @ts-expect-error
import modelBin from "../../binaries/model/03A6.model.bin?url";

// Load file
const binaryModel: Uint8Array = new Uint8Array(await Bun.file(modelBin).arrayBuffer());
console.log("Binary bytes loaded", binaryModel.byteLength);

const modelJSON = parseDataFromArray(binaryModel, methodModel);

function setFieldNameRecursively(obj: Object, field: string, value: any) {
    function recurse(obj: any) {
        if (obj && typeof obj === "object") {
            for (const key in obj) {
                if (key === field) {
                    obj[key] = value;
                } else {
                    recurse(obj[key]);
                }
            }
        }
    }

    recurse(obj);
}

setFieldNameRecursively(modelJSON.data, "cg_or_ny", 0);
setFieldNameRecursively(modelJSON.data, "cb_or_nz", 0);

const modifiedBinaryModel = writeDataToArray(modelJSON.data, methodModel);

// write to temp folder
await Bun.write(`./temp/03A6.model.bin`, modifiedBinaryModel);
