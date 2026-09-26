import type { ByteReader } from "./byteReader.js";
import type { ByteWriter } from "./byteWriter.js";
import type { ParseContext, WriteContext, WriteState } from "./data.js";

export type Endian = "little" | "big";

export type IntegerType = "u8" | "u16" | "u32" | "s8" | "s16" | "s32";

export type PrimitiveType = IntegerType | "f32" | "f64";

export enum TextureTypeEnum {
    CI4 = 0x01,
    CI8 = 0x02,
    RGBA16 = 0x04,
    RGBA32 = 0x08,
    IA8 = 0x10,
}

export enum GeoTypeFlags {
    BK_GEO_TYPE_MIPMAP_TRILINEAR_BIT = 0x02,
    BK_GEO_TYPE_ENV_MAP_BIT = 0x04,
}

// export type TextureType = "CI4" | "CI8" | "IA4" | "IA8" | "I4" | "I8" | "RGBA16" | "RGBA32";

export type MethodOffset = {
    type: "offset";
    offsetType: IntegerType;
    targetMethod: Method;
    offsetAlignment: "startOf" | "endOf";
    offsetFrom: string;
    nullValue?: number;
    writeAfter?: string; // may not be needed if we implement writePriority
    writePriority?: number;
    align?: {
        modulo: number;
        padValue: number;
    };
};

export type MethodArrayFixedLength = {
    type: "arrayFixedLength";
    element: Method;
    length: number;
};

export type Method =
    | PrimitiveType
    | {
          type: "bytes";
          bytes: number;
      }
    | {
          type: "struct";
          fields: { [key: string]: Method };
      }
    | MethodOffset
    | MethodArrayFixedLength
    | {
          type: "arrayFieldLength";
          element: Method;
          lengthField: string;
      }
    | {
          type: "texture";
          textureTypeField: string;
          textureWidthField: string;
          textureHeightField: string;
      }
    | {
          type: "custom";
          read: (reader: ByteReader, parseContext: ParseContext) => StructuredNode;
          write: (writer: ByteWriter, node: StructuredNode, writeContext: WriteContext, state: WriteState) => void;
      };

export type ComplexMethod = Exclude<Method, PrimitiveType>;

export type ComplexType = ComplexMethod["type"];

export type FieldType = PrimitiveType | ComplexType;

export type StructuredNode =
    | number
    | Uint8Array
    | { [key: string]: StructuredNode }
    | StructuredNode[]
    | {
          type: ComplexType;
          data: StructuredNode | StructuredNode[] | { [key: string]: StructuredNode } | null;
          _byteLower: number;
          _byteUpper: number;
      }
    | {
          type: "texture";
          textureType: TextureTypeEnum;
          textureWidth: number;
          textureHeight: number;
          texturePalette?: Uint8Array;
          textureData: Uint8Array;
          textureMipMapTrilinear?: boolean;
          padBytes?: Uint8Array;
      }
    | {
          type: "custom";
          data: StructuredNode;
      };
