import { ByteReader } from "../../core/byteReader.js";
import { ByteWriter } from "../../core/byteWriter.js";
import { ParseContext, WriteContext } from "../../core/data.js";
import { StructuredNode, Method, PrimitiveType } from "../../core/types.js";

// TODO: this file reuses a lot of the same code as the core data.ts file, should be consolidated

type GeoCommandData = Record<string, number | number[]>;

type GeoLayoutNode = {
    commandId: number;
    commandData: GeoCommandData;

    /**
     * Flattened child view kept for compatibility/readability.
     *
     * For commands with one branch this is the branch's command list.
     * For commands with multiple branches this is branches.flat().
     * The writer uses `branches` when branch boundaries matter.
     */
    children: GeoLayoutNode[];

    /**
     * One command list per branch-offset field.
     *
     * Examples:
     * - BONE / LOD / CALL: one entry
     * - SORT: two entries
     * - SELECTOR: one entry per selector branch offset
     *
     * An empty entry can mean either an offset of zero or a reference to a
     * sublist that was already encountered elsewhere and therefore was not
     * expanded again into this tree.
     */
    branches?: GeoLayoutNode[][];
};

/*
 * The command Methods intentionally describe only the bytes that are fixed for
 * each command. Variable-length arrays for SKINNING, SELECTOR, and CAMERA are
 * handled directly below.
 *
 * The second u32 is named `nextOffset` to match the newer decomp header. It is
 * a relative offset from the start of this command to the next command in the
 * same command list. Zero terminates the current list.
 */

const methodCommandUnk0: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        branchOffset: "s16",
        doPitchRotate: "s16",
        positionX: "f32",
        positionY: "f32",
        positionZ: "f32",
    },
};

const methodCommandSort: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        point1X: "f32",
        point1Y: "f32",
        point1Z: "f32",
        point2X: "f32",
        point2Y: "f32",
        point2Z: "f32",
        flags: "s16",
        branchOffset1: "s16",
        branchOffset2: "s32",
    },
};

const methodCommandBone: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        branchOffset: "u8",
        animMatrixId: "s8",

        // The decomp struct stops after animMatrixId, but the binary command is
        // naturally padded here. Keep the bytes so parse -> write is lossless.
        padA: "u16",
    },
};

const methodCommandLoadDl: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        gfxIndex: "s16",

        // The current decomp header exposes only gfxIndex. Preserve the next
        // two bytes instead of assigning the older wiki's triangle-count name.
        padA: "u16",
    },
};

const methodCommandNop: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
    },
};

const methodCommandSkinning: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
    },
};

const methodCommandCall: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        branchOffset: "s32",
    },
};

const methodCommandLoadDl2: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        pad8: "s16",
        gfxIndex: "s16",
    },
};

const methodCommandLod: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        maxDistance: "f32",
        minDistance: "f32",
        positionX: "f32",
        positionY: "f32",
        positionZ: "f32",
        branchOffset: "s32",
    },
};

const methodCommandReferencePoint: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        index: "s16",
        animMatrixId: "s16",
        pointX: "f32",
        pointY: "f32",
        pointZ: "f32",
    },
};

const methodCommandSelector: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        branchOffsetCount: "s16",
        index: "s16",
    },
};

const methodCommandDrawDistance: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        minX: "s16",
        minY: "s16",
        minZ: "s16",
        maxX: "s16",
        maxY: "s16",
        maxZ: "s16",
        branchOffset: "s16",

        // C struct alignment leaves two bytes after branchOffset.
        pad16: "u16",
    },
};

const methodCommandE: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        positionX: "s16",
        positionY: "s16",
        positionZ: "s16",
        distance: "s16",
        branchOffset: "s16",
        animMatrixId: "s16",
    },
};

const methodCommandCamera: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        branchOffset: "s16",
        count: "u8",
        flags: "u8",
    },
};

const methodCommandTextureWrap: Method = {
    type: "struct",
    fields: {
        nextOffset: "s32",
        mode: "s32",
    },
};

export const geoLayoutCommandMethods: Readonly<Record<number, Method>> = {
    0x00: methodCommandUnk0,
    0x01: methodCommandSort,
    0x02: methodCommandBone,
    0x03: methodCommandLoadDl,
    0x04: methodCommandNop,
    0x05: methodCommandSkinning,
    0x06: methodCommandCall,
    0x07: methodCommandLoadDl2,
    0x08: methodCommandLod,
    0x09: methodCommandNop,
    0x0a: methodCommandReferencePoint,
    0x0b: methodCommandNop,
    0x0c: methodCommandSelector,
    0x0d: methodCommandDrawDistance,
    0x0e: methodCommandE,
    0x0f: methodCommandCamera,
    0x10: methodCommandTextureWrap,
};

function isPrimitiveMethod(method: Method): method is PrimitiveType {
    return typeof method === "string";
}

function readPrimitive(reader: ByteReader, method: PrimitiveType): number {
    switch (method) {
        case "u8":
            return reader.u8();
        case "s8":
            return reader.s8();
        case "u16":
            return reader.u16();
        case "s16":
            return reader.s16();
        case "u32":
            return reader.u32();
        case "s32":
            return reader.s32();
        case "f32":
            return reader.f32();
        case "f64":
            return reader.f64();
        default: {
            const exhaustive: never = method;
            throw new Error(`Unsupported primitive method: ${exhaustive}`);
        }
    }
}

function writePrimitive(writer: ByteWriter, method: PrimitiveType, value: number): void {
    switch (method) {
        case "u8":
            writer.u8(value);
            break;
        case "s8":
            writer.s8(value);
            break;
        case "u16":
            writer.u16(value);
            break;
        case "s16":
            writer.s16(value);
            break;
        case "u32":
            writer.u32(value);
            break;
        case "s32":
            writer.s32(value);
            break;
        case "f32":
            writer.f32(value);
            break;
        case "f64":
            writer.f64(value);
            break;
        default: {
            const exhaustive: never = method;
            throw new Error(`Unsupported primitive method: ${exhaustive}`);
        }
    }
}

function simpleStructRead(reader: ByteReader, method: Method): GeoCommandData {
    if (typeof method === "string" || method.type !== "struct") {
        throw new Error("simpleStructRead requires a struct Method");
    }

    const node: GeoCommandData = {};

    for (const [key, fieldMethod] of Object.entries(method.fields)) {
        if (!isPrimitiveMethod(fieldMethod)) {
            throw new Error(`Geo layout field ${key} must use a primitive Method`);
        }

        node[key] = readPrimitive(reader, fieldMethod);
    }

    return node;
}

type FieldWriteCallback = (key: string, method: PrimitiveType, position: number) => void;

function simpleStructWrite(writer: ByteWriter, node: GeoCommandData, method: Method, onFieldWrite?: FieldWriteCallback): void {
    if (typeof method === "string" || method.type !== "struct") {
        throw new Error("simpleStructWrite requires a struct Method");
    }

    for (const [key, fieldMethod] of Object.entries(method.fields)) {
        if (!isPrimitiveMethod(fieldMethod)) {
            throw new Error(`Geo layout field ${key} must use a primitive Method`);
        }

        const value = node[key];
        if (typeof value !== "number") {
            throw new Error(`Missing numeric geo layout field ${key}`);
        }

        onFieldWrite?.(key, fieldMethod, writer.offset);
        writePrimitive(writer, fieldMethod, value);
    }
}

function getNumber(data: GeoCommandData, key: string, fallback = 0): number {
    const value = data[key];
    return typeof value === "number" ? value : fallback;
}

function getNumberArray(data: GeoCommandData, key: string): number[] {
    const value = data[key];
    return Array.isArray(value) ? value : [];
}

function getCommandBranchOffsets(commandId: number, data: GeoCommandData): number[] {
    switch (commandId) {
        case 0x00:
        case 0x02:
        case 0x06:
        case 0x08:
        case 0x0d:
        case 0x0e:
        case 0x0f:
            return [getNumber(data, "branchOffset")];

        case 0x01:
            return [getNumber(data, "branchOffset1"), getNumber(data, "branchOffset2")];

        case 0x0c:
            return getNumberArray(data, "branchOffsets");

        default:
            return [];
    }
}

function getFixedBranchCount(commandId: number): number | undefined {
    switch (commandId) {
        case 0x00:
        case 0x02:
        case 0x06:
        case 0x08:
        case 0x0d:
        case 0x0e:
        case 0x0f:
            return 1;

        case 0x01:
            return 2;

        case 0x0c:
            return undefined;

        default:
            return 0;
    }
}

function readVariableCommandData(reader: ByteReader, commandId: number, commandPosition: number, data: GeoCommandData): void {
    switch (commandId) {
        case 0x05: {
            const gfxIndices: number[] = [];
            const nextOffset = getNumber(data, "nextOffset");
            const commandLimit = nextOffset > 0 ? Math.min(commandPosition + nextOffset, reader.bytesInBuffer) : reader.bytesInBuffer;

            while (reader.offset + 2 <= commandLimit) {
                const gfxIndex = reader.s16();
                if (gfxIndex === 0) {
                    break;
                }

                gfxIndices.push(gfxIndex);
            }

            data.gfxIndices = gfxIndices;
            break;
        }

        case 0x0c: {
            const count = getNumber(data, "branchOffsetCount");
            if (count < 0) {
                throw new Error(`Negative selector branch count ${count} at 0x${commandPosition.toString(16)}`);
            }

            const branchOffsets: number[] = [];
            for (let i = 0; i < count; i++) {
                branchOffsets.push(reader.s32());
            }

            data.branchOffsets = branchOffsets;
            break;
        }

        case 0x0f: {
            const count = getNumber(data, "count");
            const ids: number[] = [];

            for (let i = 0; i < count; i++) {
                ids.push(reader.u8());
            }

            data.ids = ids;
            break;
        }
    }
}

/**
 * Preserve bytes between the understood command body and the first forward
 * structural target. This captures the common command padding without making
 * assumptions about what those bytes mean.
 */
function readInlinePadding(reader: ByteReader, commandPosition: number, bodyEnd: number, data: GeoCommandData, branchOffsets: number[]): void {
    const forwardOffsets = [getNumber(data, "nextOffset"), ...branchOffsets].filter((offset) => offset > 0);

    if (forwardOffsets.length === 0) {
        return;
    }

    const firstTarget = commandPosition + Math.min(...forwardOffsets);
    if (firstTarget <= bodyEnd || firstTarget > reader.bytesInBuffer) {
        return;
    }

    reader.jump(bodyEnd);
    reader.tagOffset("orange", "Inline padding start");

    const inlinePadding: number[] = [];
    while (reader.offset < firstTarget) {
        inlinePadding.push(reader.u8());
    }

    if (inlinePadding.length > 0) {
        data.inlinePadding = inlinePadding;
    }
}

export function parseGeoLayout(reader: ByteReader, _parseContext: ParseContext): StructuredNode {
    return readGeoLayouts(reader) as unknown as StructuredNode;
}

function readGeoLayouts(reader: ByteReader): GeoLayoutNode {
    const geometryOffset = reader.offset;
    const parsedPositions = new Set<number>();

    const root: GeoLayoutNode = {
        commandId: -1,
        commandData: {},
        children: [],
    };

    function readGeoLayoutList(startPosition: number): GeoLayoutNode[] {
        const nodes: GeoLayoutNode[] = [];
        let position = startPosition;

        while (position >= 0 && position < reader.bytesInBuffer) {
            if (parsedPositions.has(position)) {
                // A branch/call has already claimed this command list. Keep the
                // original relative offset in commandData rather than expanding
                // a shared/backward reference twice.
                break;
            }

            const node = readGeoLayoutNode(position);
            nodes.push(node);

            const nextOffset = getNumber(node.commandData, "nextOffset");
            if (nextOffset === 0) {
                break;
            }

            const nextPosition = position + nextOffset;
            if (nextPosition === position) {
                throw new Error(`Geo layout command at 0x${position.toString(16)} points to itself as next command`);
            }

            position = nextPosition;
        }

        return nodes;
    }

    function readGeoLayoutNode(position: number): GeoLayoutNode {
        if (position < 0 || position + 8 > reader.bytesInBuffer) {
            throw new Error(`Geo layout command position 0x${position.toString(16)} is outside the buffer`);
        }

        parsedPositions.add(position);
        reader.jump(position);

        reader.tagOffset("aqua", "Geo layout command start");

        const commandId = reader.u32();
        const method = geoLayoutCommandMethods[commandId];

        if (!method) {
            throw new Error(`Unsupported geometry layout command ID 0x${commandId.toString(16).padStart(8, "0")} ` + `at 0x${position.toString(16).padStart(8, "0")}`);
        }

        reader.tagOffset("darkblue", "Geo layout command method");

        const commandData = simpleStructRead(reader, method);
        readVariableCommandData(reader, commandId, position, commandData);

        const branchOffsets = getCommandBranchOffsets(commandId, commandData);
        const bodyEnd = reader.offset;
        readInlinePadding(reader, position, bodyEnd, commandData, branchOffsets);

        const branches: GeoLayoutNode[][] = branchOffsets.map((branchOffset) => {
            if (branchOffset === 0) {
                return [];
            }

            const branchPosition = position + branchOffset;
            if (branchPosition < 0 || branchPosition >= reader.bytesInBuffer) {
                console.warn(`Geo layout command 0x${commandId.toString(16)} at 0x${position.toString(16)} ` + `has out-of-range branch offset ${branchOffset}`);
                return [];
            }

            if (parsedPositions.has(branchPosition)) {
                // Shared/backward branch. Preserve the offset but do not duplicate
                // the target list in the tree.
                return [];
            }

            return readGeoLayoutList(branchPosition);
        });

        return {
            commandId,
            commandData,
            children: branches.flat(),
            branches: branchOffsets.length > 0 ? branches : undefined,
        };
    }

    root.children = readGeoLayoutList(geometryOffset);
    return root;
}

type OffsetPatch = {
    position: number;
    method: PrimitiveType;
};

function patchPrimitive(writer: ByteWriter, patch: OffsetPatch, value: number): void {
    if (patch.method === "u8" && (value < 0 || value > 0xff)) {
        throw new Error(`Offset ${value} does not fit in u8`);
    }

    if (patch.method === "s16" && (value < -0x8000 || value > 0x7fff)) {
        throw new Error(`Offset ${value} does not fit in s16`);
    }

    if (patch.method === "u16" && (value < 0 || value > 0xffff)) {
        throw new Error(`Offset ${value} does not fit in u16`);
    }

    const restoreOffset = writer.offset;
    writer.offset = patch.position;
    writePrimitive(writer, patch.method, value);
    writer.offset = restoreOffset;
}

function writePaddingBytes(writer: ByteWriter, bytes: number[]): void {
    // console.log(`Writing padding bytes at offset 0x${writer.offset.toString(16)}: ${bytes.map(b => b.toString(16)).join(", ")}`);
    for (const byte of bytes) {
        writer.u8(byte);
    }
}

function padWriterTo(writer: ByteWriter, targetOffset: number): void {
    if (targetOffset < writer.offset) {
        return;
    }

    while (writer.offset < targetOffset) {
        writer.u8(0);
    }
}

function alignWriter(writer: ByteWriter, alignment: number): void {
    const remainder = writer.offset % alignment;
    if (remainder !== 0) {
        padWriterTo(writer, writer.offset + alignment - remainder);
    }
}

function getBranchGroupsForWrite(node: GeoLayoutNode): GeoLayoutNode[][] {
    if (node.branches) {
        return node.branches;
    }

    const fixedBranchCount = getFixedBranchCount(node.commandId);

    if (fixedBranchCount === 0) {
        if (node.children.length > 0) {
            throw new Error(`Geo layout command 0x${node.commandId.toString(16)} does not have branches but has children`);
        }
        return [];
    }

    if (fixedBranchCount === 1) {
        return node.children.length > 0 ? [node.children] : [];
    }

    if (node.commandId === 0x0c) {
        const count = getNumber(node.commandData, "branchOffsetCount");
        if (count === 1) {
            return node.children.length > 0 ? [node.children] : [[]];
        }
    }

    if (node.children.length === 0) {
        return [];
    }

    throw new Error(`Geo layout command 0x${node.commandId.toString(16)} has multiple branch offsets; ` + `use node.branches so the writer knows where each child list begins`);
}

function prepareCommandDataForWrite(node: GeoLayoutNode, branchGroups: GeoLayoutNode[][]): GeoCommandData {
    const data: GeoCommandData = { ...node.commandData };

    if (node.commandId === 0x0c && node.branches) {
        data.branchOffsetCount = branchGroups.length;
    }

    if (node.commandId === 0x0f) {
        const ids = getNumberArray(data, "ids");
        if (Array.isArray(data.ids)) {
            data.count = ids.length;
        }
    }

    return data;
}

function writeVariableCommandData(writer: ByteWriter, commandId: number, data: GeoCommandData): OffsetPatch[] {
    const variableBranchPatches: OffsetPatch[] = [];
    const commandPosition = writer.offset - 2;

    switch (commandId) {
        case 0x05: {
            const array = getNumberArray(data, "gfxIndices");
            // console.log("GFX indices array length:", array.length);

            for (const gfxIndex of array) {
                writer.s16(gfxIndex);
            }

            writer.u16(0x00);

            break;
        }

        case 0x0c: {
            const count = getNumber(data, "branchOffsetCount");
            // console.log("Branch offset count:", count);

            const originalOffsets = getNumberArray(data, "branchOffsets");

            for (let i = 0; i < count; i++) {
                variableBranchPatches.push({
                    position: writer.offset,
                    method: "s32",
                });
                writer.s32(originalOffsets[i] ?? 0);
            }
            break;
        }

        case 0x0f: {
            const ids = getNumberArray(data, "ids");
            const count = getNumber(data, "count");

            if (ids.length !== count) {
                throw new Error(`CAMERA count is ${count} but ids.length is ${ids.length}`);
            }

            for (const id of ids) {
                writer.u8(id);
            }
            break;
        }
    }

    return variableBranchPatches;
}

function getFixedBranchPatches(commandId: number, fieldPatches: ReadonlyMap<string, OffsetPatch>): OffsetPatch[] {
    const required = (key: string): OffsetPatch => {
        const patch = fieldPatches.get(key);
        if (!patch) {
            throw new Error(`Missing patch position for geo layout field ${key}`);
        }
        return patch;
    };

    switch (commandId) {
        case 0x00:
        case 0x02:
        case 0x06:
        case 0x08:
        case 0x0d:
        case 0x0e:
        case 0x0f:
            return [required("branchOffset")];

        case 0x01:
            return [required("branchOffset1"), required("branchOffset2")];

        default:
            return [];
    }
}

export function writeGeoLayout(writer: ByteWriter, node: StructuredNode, parentContext: WriteContext): void {
    recurseWriteGeoLayout(writer, node as unknown as GeoLayoutNode, parentContext, false);
}

/**
 * Writes one geo-layout node in depth-first file order.
 *
 * The important distinction is:
 * - branch offsets point into child command lists written inside this node's span
 * - nextOffset points to the next sibling command after those child lists
 *
 * That means the next sibling cannot be written until all owned branches of the
 * current node have been written. The function patches both kinds of offsets
 * after their actual output positions are known.
 */
function recurseWriteGeoLayout(writer: ByteWriter, node: GeoLayoutNode, parentContext: WriteContext, hasNextSibling: boolean): void {
    void parentContext;

    if (node.commandId === -1) {
        writeGeoLayoutList(writer, node.children, parentContext);
        return;
    }

    const method = geoLayoutCommandMethods[node.commandId];
    if (!method) {
        throw new Error(`Unsupported geometry layout command ID 0x${node.commandId.toString(16)}`);
    }

    const commandStart = writer.offset;
    const branchGroups = getBranchGroupsForWrite(node);
    const originalBranchOffsets = getCommandBranchOffsets(node.commandId, node.commandData);
    const commandData = prepareCommandDataForWrite(node, branchGroups);

    writer.u32(node.commandId);

    const fieldPatches = new Map<string, OffsetPatch>();
    simpleStructWrite(writer, commandData, method, (key, fieldMethod, position) => {
        fieldPatches.set(key, {
            position,
            method: fieldMethod,
        });
    });

    const dataStart = writer.offset;
    const variableBranchPatches = writeVariableCommandData(writer, node.commandId, commandData);

    const inlinePadding = getNumberArray(commandData, "inlinePadding");
    writePaddingBytes(writer, inlinePadding);

    const fixedBranchPatches = getFixedBranchPatches(node.commandId, fieldPatches);
    const branchPatches = node.commandId === 0x0c ? variableBranchPatches : fixedBranchPatches;

    if (branchGroups.length > branchPatches.length) {
        throw new Error(`Geo layout command 0x${node.commandId.toString(16)} has ${branchGroups.length} branch groups ` + `but only ${branchPatches.length} branch offset fields`);
    }

    for (let i = 0; i < branchGroups.length; i++) {
        const branch = branchGroups[i];
        if (branch.length === 0) {
            // Preserve the original offset. This matters for shared/backward
            // references that the parser deliberately did not expand.
            continue;
        }

        const preferredRelativeOffset = originalBranchOffsets[i] ?? 0;
        const preferredAbsoluteOffset = commandStart + preferredRelativeOffset;

        if (preferredRelativeOffset > 0 && preferredAbsoluteOffset >= writer.offset) {
            padWriterTo(writer, preferredAbsoluteOffset);
        } else {
            alignWriter(writer, 4);
        }

        const actualRelativeOffset = writer.offset - commandStart;
        patchPrimitive(writer, branchPatches[i], actualRelativeOffset);
        writeGeoLayoutList(writer, branch, parentContext);
    }

    const nextOffsetPatch = fieldPatches.get("nextOffset");
    if (!nextOffsetPatch) {
        throw new Error(`Command 0x${node.commandId.toString(16)} has no nextOffset field`);
    }

    if (!hasNextSibling) {
        patchPrimitive(writer, nextOffsetPatch, 0);
        return;
    }

    const originalNextOffset = getNumber(node.commandData, "nextOffset");
    const preferredNextPosition = commandStart + originalNextOffset;
    // console.log("Preferred next position:", preferredNextPosition);

    if (originalNextOffset > 0 && preferredNextPosition >= writer.offset) {
        padWriterTo(writer, preferredNextPosition);
    } else {
        alignWriter(writer, 4);
    }

    patchPrimitive(writer, nextOffsetPatch, writer.offset - commandStart);
}

function writeGeoLayoutList(writer: ByteWriter, nodes: GeoLayoutNode[], parentContext: WriteContext): void {
    for (let i = 0; i < nodes.length; i++) {
        recurseWriteGeoLayout(writer, nodes[i], parentContext, i < nodes.length - 1);
    }

    // was last command skinning, if so add 6 bytes
    const lastNode = nodes[nodes.length - 1];
    if (lastNode && lastNode.commandId === 0x05) {
        padWriterTo(writer, writer.offset + 6);
    }
}
