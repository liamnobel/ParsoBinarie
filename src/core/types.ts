import type { ByteReader } from "./byteReader.js";
import type { ByteWriter } from "./byteWriter.js";
import type { ParseContext, WriteContext, WriteState } from "./data.js";

// Primitives
export type Endian = "little" | "big";
export type IntegerType = "u8" | "u16" | "u32" | "s8" | "s16" | "s32";
export type PrimitiveType = IntegerType | "f32" | "f64";

// Enums
export enum ModelTextureTypeEnum {
    CI4 = 0x01,
    CI8 = 0x02,
    RGBA16 = 0x04,
    RGBA32 = 0x08,
    IA8 = 0x10,
}

export enum ColorFormat {
    RGBA = 0,
    YUV = 1,
    CI = 2,
    IA = 3,
    I = 4,
}

export enum BitDepth {
    B4 = 0,
    B8 = 1,
    B16 = 2,
    B32 = 3,
}

export enum GeoTypeFlags {
    BK_GEO_TYPE_MIPMAP_TRILINEAR_BIT = 0x02,
    BK_GEO_TYPE_ENV_MAP_BIT = 0x04,
}

// Method definitions

export interface MethodOffset {
    type: "offset";
    offsetType: IntegerType;
    targetMethod: Method;
    offsetAlignment: "startOf" | "endOf";
    offsetFrom: string;
    nullValue?: number;
    writeAfter?: string;
    writePriority?: number;
    align?: {
        modulo: number;
        padValue: number;
    };
}

export interface MethodArrayFixedLength {
    type: "arrayFixedLength";
    element: Method;
    length: number;
}

export interface MethodBytes {
    type: "bytes";
    bytes: number;
}

export interface MethodStruct {
    type: "struct";
    fields: Record<string, Method>;
}

export interface MethodArrayFieldLength {
    type: "arrayFieldLength";
    element: Method;
    lengthField: string;
}

export interface MethodCustom<T extends StructuredNode = StructuredNode> {
    type: "custom";
    read: (reader: ByteReader, parseContext: ParseContext) => T;
    write: (writer: ByteWriter, node: T, writeContext: WriteContext, state: WriteState) => void;
}

export type ComplexMethod = MethodBytes | MethodStruct | MethodOffset | MethodArrayFixedLength | MethodArrayFieldLength | MethodCustom;

export type Method = PrimitiveType | ComplexMethod;

export type ComplexType = ComplexMethod["type"];

export type FieldType = PrimitiveType | ComplexType;

// Structured nodes

export interface NodeMetadata {
    _byteLower: number;
    _byteUpper: number;
}

export interface BytesNode extends NodeMetadata {
    type: "bytes";
    data: Uint8Array;
}

export interface StructNode extends NodeMetadata {
    type: "struct";
    data: Record<string, StructuredNode>;
}

export interface OffsetNode extends NodeMetadata {
    type: "offset";
    data: StructuredNode | null;
}

export interface ArrayFixedLengthNode extends NodeMetadata {
    type: "arrayFixedLength";
    data: StructuredNode[];
}

export interface ArrayFieldLengthNode extends NodeMetadata {
    type: "arrayFieldLength";
    data: StructuredNode[];
}

export interface CustomNode extends NodeMetadata {
    type: "custom";
    data: StructuredNode;
}

export type ComplexStructuredNode = BytesNode | StructNode | OffsetNode | ArrayFixedLengthNode | ArrayFieldLengthNode | CustomNode;

export type StructuredNode = number | Uint8Array | ComplexStructuredNode;

// Bit fields

export type BitField = Record<string, number>;

export type BitFieldData<T extends BitField> = {
    [K in keyof T]: number;
};

export function isComplexNode(node: StructuredNode): node is ComplexStructuredNode {
    return typeof node === "object" && node !== null && !(node instanceof Uint8Array);
}
