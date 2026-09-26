import { parseDataFromArray, writeDataToArray } from "../../src/core/data.ts";
import { methodModel } from "../../src/formats/bk/model.ts";

export function transformField(obj: Object, field: string, callback: (value: any) => any) {
    function recurse(obj: any) {
        if (obj && typeof obj === "object") {
            for (const key in obj) {
                if (key === field) {
                    obj[key] = callback(obj[key]);
                } else {
                    recurse(obj[key]);
                }
            }
        }
    }

    recurse(obj);
}

export function callbackField(obj: Object, field: string, callback: (value: any) => void) {
    function recurse(obj: any) {
        if (obj && typeof obj === "object") {
            for (const key in obj) {
                if (key === field) {
                    obj[key] = callback(obj[key]);
                } else {
                    recurse(obj[key]);
                }
            }
        }
    }

    recurse(obj);
}

export async function redVertexColors(binaryModel: Uint8Array): Promise<Uint8Array> {
    // Parse binary data into structured node
    const structuredNode = parseDataFromArray(binaryModel, methodModel);

    // Modify JSON
    transformField(structuredNode.data, "cg_or_ny", () => 0);
    transformField(structuredNode.data, "cb_or_nz", () => 0);

    // Write structured node back to binary
    return writeDataToArray(structuredNode.data, methodModel);
}

export async function halfSizeXZ(binaryModel: Uint8Array): Promise<Uint8Array> {
    // Parse binary data into structured node
    const structuredNode = parseDataFromArray(binaryModel, methodModel);

    // Modify JSON
    callbackField(structuredNode.data, "x", (value) => value / 2);
    callbackField(structuredNode.data, "z", (value) => value / 2);

    // Write structured node back to binary
    return writeDataToArray(structuredNode.data, methodModel);
}

export async function halfSizeY(binaryModel: Uint8Array): Promise<Uint8Array> {
    // Parse binary data into structured node
    const structuredNode = parseDataFromArray(binaryModel, methodModel);

    // Modify JSON
    callbackField(structuredNode.data, "y", (value) => value / 2);

    // Write structured node back to binary
    return writeDataToArray(structuredNode.data, methodModel);
}

export async function rotateVertexColors(binaryModel: Uint8Array): Promise<Uint8Array> {
    // Parse binary data into structured node
    const structuredNode = parseDataFromArray(binaryModel, methodModel);

    // Modify JSON
    callbackField(structuredNode.data, "verticies", (value) => {
        const verts = value.data;

        verts.forEach((vertex: any) => {
            const r = vertex.cr_or_nx;
            const g = vertex.cg_or_ny;
            const b = vertex.cb_or_nz;

            vertex.cr_or_nx = b;
            vertex.cg_or_ny = r;
            vertex.cb_or_nz = g;
        });
    });

    // Write structured node back to binary
    return writeDataToArray(structuredNode.data, methodModel);
}
