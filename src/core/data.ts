import { StructuredNode, Method, IntegerType, MethodOffset, isComplexNode } from "./types.js";
import { ByteReader } from "./byteReader.js";
import { ByteWriter } from "./byteWriter.js";

export type ParseContext = {
    parent: ParseContext | null;
    node?: StructuredNode;
};

export type WriteContext = {
    parent: WriteContext | null;
    node: StructuredNode;
    byteLower: number;
    byteUpper?: number;
    fields?: Record<string, WriteContext>;
    targetByteLower?: number;
    targetByteUpper?: number;
    targetResolved?: boolean;
};

type DeferredParse = {
    method: MethodOffset;
    parseContext: ParseContext;
    offsetAmount: number;
    destination: StructuredNode;
};

type DeferredWrite = {
    node: StructuredNode;
    method: MethodOffset;
    placeholderOffset: number;
    pathContext: WriteContext;
    offsetContext: WriteContext;
};

type ParseState = {
    deferred: DeferredParse[];
};

export type WriteState = {
    deferred: DeferredWrite[];
};

export function getNodeAtPath(path: string, context: ParseContext): StructuredNode {
    const parts = path.split("/");
    let targetContext = context;

    while (parts[0] === "..") {
        if (!targetContext.parent) {
            throw new Error(`Cannot resolve field path "${path}": no parent context exists.`);
        }

        targetContext = targetContext.parent;
        parts.shift();
    }

    let value = targetContext.node;

    if (value === undefined || value === null) {
        throw new Error(`Cannot resolve field path "${path}": current context has no node.`);
    }

    for (const part of parts) {
        if (part === "" || part === ".") {
            continue;
        }

        // Follow offsets to their target node.
        while (isComplexNode(value) && value.type === "offset") {
            if (value.data === null) {
                throw new Error(`Cannot resolve field path "${path}": encountered null offset.`);
            }

            value = value.data;
        }

        if (!isComplexNode(value) || value.type !== "struct") {
            throw new Error(`Cannot resolve field path "${path}": expected a struct at "${part}".`);
        }

        const next: StructuredNode | undefined = value.data[part];

        if (next === undefined) {
            throw new Error(`Cannot resolve field path "${path}": field "${part}" does not exist. ` + `Available fields: ${Object.keys(value.data).join(", ")}`);
        }

        value = next;
    }

    return value;
}

function getWriteContextAtPath(path: string, context: WriteContext): WriteContext {
    const parts = path.split("/");
    let targetContext = context;
    while (parts[0] === "..") {
        if (!targetContext.parent) {
            throw new Error(`Cannot resolve write field path "${path}": ` + `no parent context exists.`);
        }
        targetContext = targetContext.parent;
        parts.shift();
    }
    for (const part of parts) {
        if (part === "" || part === ".") {
            continue;
        }
        const next = targetContext.fields?.[part];
        if (!next) {
            throw new Error(`Cannot resolve write field path "${path}": ` + `field "${part}" has not been written.`);
        }
        targetContext = next;
    }
    return targetContext;
}

function canResolveDeferredWrite(item: DeferredWrite): boolean {
    const writeAfter = item.method.writeAfter;

    if (writeAfter === undefined) {
        return true;
    }

    try {
        const dependencyContext = getWriteContextAtPath(writeAfter, item.pathContext);

        if (isComplexNode(dependencyContext.node) && dependencyContext.node.type === "offset") {
            return dependencyContext.targetResolved === true;
        }

        return dependencyContext.byteUpper !== undefined;
    } catch {
        return false;
    }
}

function getParsedNodeBounds(
    node: StructuredNode,
    path: string,
): {
    byteLower: number;
    byteUpper: number;
} {
    if (!isComplexNode(node) || !("_byteLower" in node) || !("_byteUpper" in node)) {
        throw new Error(`Cannot use field path "${path}" as an offset origin ` + `because it has no byte bounds.`);
    }
    return { byteLower: node._byteLower, byteUpper: node._byteUpper };
}

function assertNever(value: never): never {
    console.trace();
    throw new Error(`Unexpected assertNever function call with value: ${JSON.stringify(value)}`);
}

export function parseDataInternal(reader: ByteReader, method: Method, parseContext: ParseContext, state: ParseState): StructuredNode {
    if (typeof method === "string") {
        switch (method) {
            case "u8":
                return reader.u8();
            case "u16":
                return reader.u16();
            case "u32":
                return reader.u32();
            case "s8":
                return reader.s8();
            case "s16":
                return reader.s16();
            case "s32":
                return reader.s32();
            case "f32":
                return reader.f32();
            case "f64":
                return reader.f64();
            default:
                return assertNever(method);
        }
    }
    const offsetBefore = reader.offset;
    switch (method.type) {
        case "bytes": {
            reader.tagOffset("yellow", "bytes until 0x" + (reader.offset + method.bytes).toString(16));

            const blobData = reader.buffer.slice(reader.offset, reader.offset + method.bytes);
            reader.offset += method.bytes;
            return {
                type: "bytes",
                data: blobData,
                _byteLower: offsetBefore,
                _byteUpper: reader.offset,
            };
        }
        case "struct": {
            reader.tagOffset("blue", "struct");
            const fields: Record<string, StructuredNode> = {};
            const nodeCurrent: StructuredNode = {
                type: "struct",
                data: fields,
                _byteLower: offsetBefore,
                _byteUpper: offsetBefore,
            };
            const structContext: ParseContext = {
                parent: parseContext,
                node: nodeCurrent,
            };
            for (const [fieldName, fieldMethod] of Object.entries(method.fields)) {
                fields[fieldName] = parseDataInternal(reader, fieldMethod, structContext, state);
            }
            nodeCurrent._byteUpper = reader.offset;
            return nodeCurrent;
        }
        case "offset": {
            let color = "#488867";
            if (method.offsetType === "u16") {
                color = "#0e550e";
            }
            reader.tagOffset(color, `offset from ${method.offsetType}`);
            const offsetAmount = parseDataInternal(reader, method.offsetType, parseContext, state);
            if (typeof offsetAmount !== "number") {
                throw new Error(`Offset did not parse to a numeric value.`);
            }
            if (method.nullValue !== undefined && offsetAmount === method.nullValue) {
                return {
                    type: "offset",
                    data: null,
                    _byteLower: offsetBefore,
                    _byteUpper: reader.offset,
                };
            }
            const nodeCurrent: StructuredNode = {
                type: "offset",
                data: offsetAmount,
                _byteLower: offsetBefore,
                _byteUpper: reader.offset,
            };
            state.deferred.push({
                method,
                parseContext,
                offsetAmount,
                destination: nodeCurrent,
            });
            return nodeCurrent;
        }
        case "arrayFixedLength": {
            const elements: StructuredNode[] = [];
            for (let i = 0; i < method.length; i++) {
                elements.push(parseDataInternal(reader, method.element, parseContext, state));
            }
            return {
                type: "arrayFixedLength",
                data: elements,
                _byteLower: offsetBefore,
                _byteUpper: reader.offset,
            };
        }
        case "arrayFieldLength": {
            const length = getNodeAtPath(method.lengthField, parseContext) as number;
            const elements: StructuredNode[] = [];
            for (let i = 0; i < length; i++) {
                elements.push(parseDataInternal(reader, method.element, parseContext, state));
            }
            return {
                type: "arrayFieldLength",
                data: elements,
                _byteLower: offsetBefore,
                _byteUpper: reader.offset,
            };
        }
        case "custom": {
            return method.read(reader, parseContext);
        }
        default:
            return assertNever(method);
    }
}

function parseDataLaterResolve(reader: ByteReader, state: ParseState): void {
    while (state.deferred.length > 0) {
        const { method, parseContext, offsetAmount, destination } = state.deferred.shift()!;
        const offsetFromNode = getNodeAtPath(method.offsetFrom, parseContext);
        const bounds = getParsedNodeBounds(offsetFromNode, method.offsetFrom);
        const offsetFromValue = method.offsetAlignment === "startOf" ? bounds.byteLower : bounds.byteUpper;
        const targetOffset = offsetFromValue + offsetAmount;
        if (!Number.isInteger(targetOffset) || targetOffset < 0 || targetOffset > reader.buffer.length) {
            throw new Error(`Resolved offset target ` + `0x${targetOffset.toString(16)} ` + `is outside the source buffer.`);
        }
        reader.offset = targetOffset;
        reader.tagOffset("purple", "resolved offset");
        const targetData = parseDataInternal(reader, method.targetMethod, parseContext, state);
        (
            destination as Extract<
                StructuredNode,
                {
                    type: "offset";
                }
            >
        ).data = targetData;
    }
}

export function parseData(reader: ByteReader, method: Method, parseContext: ParseContext): StructuredNode {
    const state: ParseState = {
        deferred: [],
    };
    const data = parseDataInternal(reader, method, parseContext, state);
    parseDataLaterResolve(reader, state);
    return data;
}

export function parseDataFromArray(
    source: Uint8Array,
    method: Method,
): {
    data: StructuredNode;
    debugTaggedOffsets: Record<number, { color: string; text: string }>;
} {
    const reader = new ByteReader(source, "big");
    const data = parseData(reader, method, {
        parent: null,
    });
    return {
        data,
        debugTaggedOffsets: reader.debugTaggedOffsets,
    };
}

function writeOffsetPlaceholder(writer: ByteWriter, offsetType: IntegerType): void {
    switch (offsetType) {
        case "u8":
            writer.u8(0xff);
            break;
        case "u16":
            writer.u16(0xffff);
            break;
        case "u32":
            writer.u32(0xffffffff);
            break;
        case "s8":
            writer.s8(0xff);
            break;
        case "s16":
            writer.s16(0xffff);
            break;
        case "s32":
            writer.s32(0xffffffff);
            break;
        default:
            return assertNever(offsetType);
    }
}

function writeOffsetValue(writer: ByteWriter, offsetType: IntegerType, value: number): void {
    // console.log("Patching offset value: 0x" + value.toString(16) + " at offset: 0x" + writer.offset.toString(16));
    if (!Number.isInteger(value) || value < 0) {
        console.trace();
        throw new Error(`Invalid offset value: ${value}`);
    }
    switch (offsetType) {
        case "u8": {
            if (value > 0xff) {
                // throw new Error(`Offset ${value} does not fit in u8.`);
                console.warn(`Offset ${value} does not fit in u8.`);
                writer.u8(0xff);
            } else {
                writer.u8(value);
            }
            break;
        }
        case "u16": {
            if (value > 0xffff) {
                // throw new Error(`Offset ${value} does not fit in u16.`);
                console.warn(`Offset ${value} does not fit in u16.`);
                writer.u16(0xffff);
            } else {
                writer.u16(value);
            }
            break;
        }
        case "u32": {
            if (value > 0xffffffff) {
                // throw new Error(`Offset ${value} does not fit in u32.`);
                console.warn(`Offset ${value} does not fit in u32.`);
                writer.u32(0xffffffff);
            } else {
                writer.u32(value);
            }
            break;
        }
        case "s8": {
            if (value > 0x7f) {
                // throw new Error(`Offset ${value} does not fit in s8.`);
                console.warn(`Offset ${value} does not fit in s8.`);
                writer.s8(0x7f);
            } else {
                writer.s8(value);
            }
            break;
        }
        case "s16": {
            if (value > 0x7fff) {
                // throw new Error(`Offset ${value} does not fit in s16.`);
                console.warn(`Offset ${value} does not fit in s16.`);
                writer.s16(0x7fff);
            } else {
                writer.s16(value);
            }
            break;
        }
        case "s32": {
            if (value > 0x7fffffff) {
                // throw new Error(`Offset ${value} does not fit in s32.`);
                console.warn(`Offset ${value} does not fit in s32.`);
                writer.s32(0x7fffffff);
            } else {
                writer.s32(value);
            }
            break;
        }
        default:
            return assertNever(offsetType);
    }
}

export function writeDataInternal(node: StructuredNode, writer: ByteWriter, method: Method, parentContext: WriteContext | null, state: WriteState): WriteContext {
    const context: WriteContext = {
        parent: parentContext,
        node,
        byteLower: writer.offset,
    };

    if (typeof method === "string") {
        if (typeof node !== "number") {
            throw new Error(`Expected numeric node for ${method}.`);
        }

        switch (method) {
            case "u8":
                writer.u8(node);
                break;
            case "u16":
                writer.u16(node);
                break;
            case "u32":
                writer.u32(node);
                break;
            case "s8":
                writer.s8(node);
                break;
            case "s16":
                writer.s16(node);
                break;
            case "s32":
                writer.s32(node);
                break;
            case "f32":
                writer.f32(node);
                break;
            case "f64":
                writer.f64(node);
                break;
            default:
                return assertNever(method);
        }

        context.byteUpper = writer.offset;
        return context;
    }

    switch (method.type) {
        case "bytes": {
            if (!isComplexNode(node) || node.type !== "bytes") {
                throw new Error(`Expected bytes node.`);
            }
            writer.writeBytes(node.data);
            break;
        }
        case "struct": {
            if (!isComplexNode(node) || node.type !== "struct") {
                throw new Error(`Expected struct node.`);
            }
            context.fields = {};
            for (const [fieldName, fieldMethod] of Object.entries(method.fields)) {
                const fieldNode = node.data[fieldName];
                if (fieldNode === undefined || fieldNode === null) {
                    throw new Error(`Missing struct field ` + `"${fieldName}" while writing.`);
                }
                context.fields[fieldName] = writeDataInternal(fieldNode, writer, fieldMethod, context, state);
            }
            break;
        }
        case "offset": {
            if (!isComplexNode(node) || node.type !== "offset") {
                throw new Error("Expected offset node.");
            }

            if (node.data === null) {
                if (method.nullValue === undefined) {
                    throw new Error("Cannot write null offset without nullValue.");
                }
                writeOffsetValue(writer, method.offsetType, method.nullValue);
                context.byteUpper = writer.offset;
                context.targetResolved = true;

                return context;
            }

            const placeholderOffset = writer.offset;
            writeOffsetPlaceholder(writer, method.offsetType);
            context.byteUpper = writer.offset;
            const pathContext = parentContext ?? context;
            state.deferred.push({
                node: node.data,
                method,
                placeholderOffset,
                pathContext,
                offsetContext: context,
            });

            return context;
        }
        case "arrayFixedLength": {
            if (!isComplexNode(node) || node.type !== "arrayFixedLength") {
                throw new Error(`Expected arrayFixedLength node.`);
            }
            if (node.data.length !== method.length) {
                throw new Error(`arrayFixedLength expected ` + `${method.length} elements, ` + `received ${node.data.length}.`);
            }
            for (const element of node.data) {
                writeDataInternal(element, writer, method.element, context, state);
            }
            break;
        }
        case "arrayFieldLength": {
            if (!isComplexNode(node) || node.type !== "arrayFieldLength") {
                throw new Error(`Expected arrayFieldLength node.`);
            }
            for (const element of node.data) {
                writeDataInternal(element, writer, method.element, context, state);
            }
            break;
        }
        case "custom": {
            if (!isComplexNode(node)) {
                throw new Error(`Expected custom node.`);
            }
            method.write(writer, node, parentContext ?? context, state);
            break;
        }
        default:
            return assertNever(method);
    }

    context.byteUpper = writer.offset;
    return context;
}

function alignWriter(writer: ByteWriter, modulo: number, padValue = 0): void {
    if (!Number.isInteger(modulo) || modulo <= 0) {
        throw new Error(`Invalid alignment modulo: ${modulo}`);
    }

    const remainder = writer.offset % modulo;

    if (remainder === 0) {
        return;
    }

    const paddingBytes = modulo - remainder;

    writer.writeBytes(new Uint8Array(paddingBytes).fill(padValue));
}

function resolveDeferredWrite(item: DeferredWrite, writer: ByteWriter, state: WriteState): void {
    const { node, method, placeholderOffset, pathContext, offsetContext } = item;

    const offsetFromContext = getWriteContextAtPath(method.offsetFrom, pathContext);

    if (offsetFromContext.byteUpper === undefined) {
        throw new Error(`Offset origin "${method.offsetFrom}" ` + `has not finished writing.`);
    }

    const offsetFromValue = method.offsetAlignment === "startOf" ? offsetFromContext.byteLower : offsetFromContext.byteUpper;

    if (method.align !== undefined) {
        alignWriter(writer, method.align.modulo, method.align.padValue);
    }

    const targetStart = writer.offset;

    const deferredBefore = state.deferred.length;

    writeDataInternal(node, writer, method.targetMethod, pathContext, state);

    const targetEnd = writer.offset;

    offsetContext.targetByteLower = targetStart;

    offsetContext.targetByteUpper = targetEnd;

    // Extract deferred offsets created specifically while writing this target.
    const children = state.deferred.splice(deferredBefore);

    // Patch our pointer
    const offsetValue = targetStart - offsetFromValue;

    writer.offset = placeholderOffset;

    writeOffsetValue(writer, method.offsetType, offsetValue);

    writer.offset = targetEnd;

    // Finish our entire deferred subtree.
    resolveDeferredList(children, writer, state);

    // NOW we're actually done.
    offsetContext.targetResolved = true;
}

function resolveDeferredList(deferred: DeferredWrite[], writer: ByteWriter, state: WriteState): void {
    const sortedDeffered = deferred.sort((a, b) => {
        const aPriority = a.method.writePriority ?? 0;
        const bPriority = b.method.writePriority ?? 0;
        return aPriority - bPriority;
    });

    while (sortedDeffered.length > 0) {
        const index = sortedDeffered.findIndex(canResolveDeferredWrite);
        if (index === -1) {
            const unresolved = sortedDeffered.map((item) => item.method.writeAfter ?? "<none>").join(", ");
            throw new Error(`Unable to resolve deferred writes. Unresolved writeAfter dependencies: ${unresolved}`);
        }
        const [item] = sortedDeffered.splice(index, 1);
        resolveDeferredWrite(item, writer, state);
    }
}

function writeDataLaterResolve(writer: ByteWriter, state: WriteState): void {
    resolveDeferredList(state.deferred, writer, state);
}

export function writeDataToArray(node: StructuredNode, method: Method): Uint8Array {
    const writer = new ByteWriter("big");
    const state: WriteState = {
        deferred: [],
    };
    writeDataInternal(node, writer, method, null, state);
    writeDataLaterResolve(writer, state);
    return writer.finish();
}
