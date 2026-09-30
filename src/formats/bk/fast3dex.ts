import { ByteReader } from "../../core/byteReader.js";
import { ByteWriter } from "../../core/byteWriter.js";
import { ParseContext, WriteContext } from "../../core/data.js";
import type { StructuredNode, Method } from "../../core/types.js";

export enum DisplayCommand {
    G_SPNOOP = 0x00,
    G_MTX = 0x01,
    G_MOVEMEM = 0x03,
    G_VTX = 0x04,
    G_DL = 0x06,

    G_LOAD_UCODE = 0xaf,
    G_BRANCH_Z = 0xb0,
    G_TRI2 = 0xb1,
    G_MODIFYVTX = 0xb2,
    G_RDPHALF_2 = 0xb3,
    G_RDPHALF_1 = 0xb4,
    G_LINE3D = 0xb5,
    G_CLEARGEOMETRYMODE = 0xb6,
    G_SETGEOMETRYMODE = 0xb7,
    G_ENDDL = 0xb8,
    G_SETOTHERMODE_H = 0xb9,
    G_SETOTHERMODE_L = 0xba,
    G_TEXTURE = 0xbb,
    G_MOVEWORD = 0xbc,
    G_POPMTX = 0xbd,
    G_CULLDL = 0xbe,
    G_TRI1 = 0xbf,

    G_NOOP = 0xc0,

    G_TEXRECT = 0xe4,
    G_TEXRECTFLIP = 0xe5,
    G_RDPLOADSYNC = 0xe6,
    G_RDPPIPESYNC = 0xe7,
    G_RDPTILESYNC = 0xe8,
    G_RDPFULLSYNC = 0xe9,
    G_SETKEYGB = 0xea,
    G_SETKEYR = 0xeb,
    G_SETCONVERT = 0xec,
    G_SETSCISSOR = 0xed,
    G_SETPRIMDEPTH = 0xee,
    G_RDPSETOTHERMODE = 0xef,
    G_LOADTLUT = 0xf0,
    G_SETTILESIZE = 0xf2,
    G_LOADBLOCK = 0xf3,
    G_LOADTILE = 0xf4,
    G_SETTILE = 0xf5,
    G_FILLRECT = 0xf6,
    G_SETFILLCOLOR = 0xf7,
    G_SETFOGCOLOR = 0xf8,
    G_SETBLENDCOLOR = 0xf9,
    G_SETPRIMCOLOR = 0xfa,
    G_SETENVCOLOR = 0xfb,
    G_SETCOMBINE = 0xfc,
    G_SETTIMG = 0xfd,
    G_SETZIMG = 0xfe,
    G_SETCIMG = 0xff,
}

type displayListMoveMemData = {
    command: "G_MOVEMEM";
    padding: [number, number, number];
    value: number;
};

type displayListVtxData = {
    command: "G_VTX";
    whereToWrite: number;
    unknownBit: number;
    numberOfVertices: number;
    numberOfBytes: number;
    unknownBits: number;
    segment: number;
    segmentOffset: number;
};

type displayListTri1Data = {
    command: "G_TRI1";
    padding: [number, number, number, number];
    triA: [number, number, number];
};

type displayListTri2Data = {
    command: "G_TRI2";
    padding: [number];
    triA: [number, number, number];
    triB: [number, number, number];
};

type displayListTextureData = {
    command: "G_TEXTURE";
    unknownByte: number;
    unknownBits: number;
    mipmaps: number;
    tile: number;
    tileEnable: number;
    scaleS: number;
    scaleT: number;
};

type displayListSetTimgData = {
    command: "G_SETTIMG";
    textureFormat: number;
    textureBitSize: number;
    unknownBits: number;
    unknown: number;
    segment: number;
};

type BitField = Record<string, number>;

const bitFieldsSetTile: BitField = {
    colorFormat: 3,
    bitCalcPower: 2, // bits per pixel = 4*2^(bitCalcPower)
    padBit: 1,
    numberOf64BitValuesPerRow: 9,
    tmemOffset: 9,
    padBits: 5,
    tile: 3,
    palette: 4,
    tClampAndMirror: 2,
    tWrapBits: 4,
    tShiftBits: 4,
    sClampAndMirror: 2,
    sWrapBits: 4,
    sShiftBits: 4,
};

const bitFieldsSetTileSize: BitField = {
    sLower: 12,
    tLower: 12,
    pad: 4,
    tile: 4,
    sWidth: 12,
    tWidth: 12,
};

const bitFieldsLoadBlock: BitField = {
    sLower: 12,
    tLower: 12,
    pad: 4,
    tile: 4,
    texelCount: 12,
    dxt: 12,
};

type displayListSetTileData = {
    command: "G_SETTILE";
    colorFormat: number;
    bitsPerPixel: number;
    padBit: number;
    numberOf64BitValuesPerRow: number;
    tmemOffset: number;
    padBits: number;
    tile: number;
    palette: number;
    tClampAndMirror: number;
    tWrapBits: number;
    tShiftBits: number;
    sClampAndMirror: number;
    sWrapBits: number;
    sShiftBits: number;
};

type displayListSetTileSizeData = {
    command: "G_SETTILESIZE";
    sLower: number;
    tLower: number;
    pad: number;
    tile: number;
    sWidth: number;
    tWidth: number;
};

type displayListLoadBlockData = {
    command: "G_LOADBLOCK";
    sLower: number;
    tLower: number;
    pad: number;
    tile: number;
    texelCount: number;
    dxt: number;
};

type displayListLoadTLUTData = {
    command: "G_LOADTLUT";
    byte0: number;
    byte1: number;
    byte2: number;
    u8: number;
    tile: number;
    u16: number;
    colorCount: number;
    byte3: number;
};

const bitFieldsLoadTLUT: BitField = {
    padding0: 29,
    tile: 3,
    colorCount: 12,
    padding1: 12,
}

type displayListDefaultData = {
    command: Exclude<keyof typeof DisplayCommand, "G_MOVEMEM" | "G_VTX" | "G_TRI1" | "G_TRI2" | "G_TEXTURE" | "G_SETTIMG" | "G_SETTILE" | "G_SETTILESIZE" | "G_LOADBLOCK" | "G_LOADTLUT">;
    bytes: [number, number, number, number, number, number, number];
};

export type DisplayListData =
    | displayListMoveMemData
    | displayListVtxData
    | displayListTri1Data
    | displayListTri2Data
    | displayListTextureData
    | displayListSetTimgData
    | displayListSetTileData
    | displayListSetTileSizeData
    | displayListLoadBlockData
    | displayListLoadTLUTData
    | displayListDefaultData;

const displayCommandRead = (reader: ByteReader, parentContext: ParseContext): DisplayListData => {
    const commandByte = reader.u8();
    const commandName = DisplayCommand[commandByte];

    if (commandName === undefined) {
        throw new Error(`Unknown display command: 0x${commandByte.toString(16)}`);
    }

    const command = commandName as DisplayListData["command"];

    switch (command) {
        case "G_MOVEMEM": {
            const unk0 = reader.u8();
            const unk1 = reader.u8();
            const unk2 = reader.u8();
            const value = reader.u32();

            return {
                command,
                padding: [unk0, unk1, unk2],
                value,
            };
        }

        case "G_VTX": {
            reader.tagOffset("blue", "G_VTX command start");

            const maskedData0 = reader.s8();
            const whereToWrite = (maskedData0 & 0b1111_1110) >> 1;
            const unknownBit = maskedData0 & 0b0000_0001;

            const maskedData1 = reader.u16();
            const numberOfVertices = (maskedData1 & 0b1111_1000_0000_0000) >> 9;
            const numberOfBytes = (maskedData1 & 0b0000_0111_1111_1111) >> 0;
            const unknownBits = maskedData1 & 0b0000_0000_0000_0011;

            const segment = reader.u8();

            const segmentOffset = (reader.u8() << 16) | (reader.u8() << 8) | (reader.u8() << 0);

            return {
                command,
                whereToWrite,
                unknownBit,
                numberOfVertices: numberOfVertices, // hack64.net seems to have missed this 2x + 1 part
                numberOfBytes: numberOfBytes,
                unknownBits: unknownBits,
                segment: segment,
                segmentOffset: segmentOffset,
            };
        }

        case "G_TRI1": {
            const pad0 = reader.u8();
            const pad1 = reader.u8();
            const pad2 = reader.u8();
            const pad3 = reader.u8();

            const index0 = reader.u8() >> 1;
            const index1 = reader.u8() >> 1;
            const index2 = reader.u8() >> 1;

            return {
                command,
                padding: [pad0, pad1, pad2, pad3],
                triA: [index0, index1, index2],
            };
        }

        case "G_TRI2": {
            const triA0 = reader.u8() >> 1;
            const triA1 = reader.u8() >> 1;
            const triA2 = reader.u8() >> 1;

            const pad = reader.u8();

            const triB0 = reader.u8() >> 1;
            const triB1 = reader.u8() >> 1;
            const triB2 = reader.u8() >> 1;

            return {
                command,
                triA: [triA0, triA1, triA2],
                padding: [pad],
                triB: [triB0, triB1, triB2],
            };
        }

        case "G_SETTIMG": {
            const u8 = reader.u8();
            const textureFormat = (u8 & 0b1110_0000) >> 5;
            const textureBitSize = (u8 & 0b0001_1000) >> 3;
            const unknownBits = (u8 & 0b0000_0111) >> 0;

            const unknown = reader.u16();

            const segment = reader.u32();

            return {
                command,
                textureFormat,
                textureBitSize,
                unknownBits,
                unknown,
                segment,
            };
        }

        case "G_TEXTURE": {
            const unknownByte = reader.u8();

            const u8 = reader.u8();
            const unknownBits = (u8 & 0b1100_0000) >> 6;
            const mipmaps = (u8 & 0b0011_1000) >> 3;
            const tile = u8 & 0b0000_0111;

            const tileEnable = reader.u8();

            const scaleS = reader.u16();
            const scaleT = reader.u16();

            return {
                command,
                unknownByte,
                unknownBits,
                mipmaps,
                tile,
                tileEnable,
                scaleS,
                scaleT,
            };
        }

        case "G_SETTILE": {
            const entries = reader.bitField(bitFieldsSetTile);
            // @ts-expect-error
            return {
                command,
                ...entries,
            };
        }

        case "G_SETTILESIZE": {
            const entries = reader.bitField(bitFieldsSetTileSize);

            entries.sWidth = (entries.sWidth >> 2) + 1;
            entries.tWidth = (entries.tWidth >> 2) + 1;

            // @ts-expect-error
            return {
                command,
                ...entries,
            };
        }

        case "G_LOADBLOCK": {
            const entries = reader.bitField(bitFieldsLoadBlock);
            entries.texelCount += 1;
            // @ts-expect-error
            return {
                command,
                ...entries,
            };
        }

        case "G_LOADTLUT": {
            const entries = reader.bitField(bitFieldsLoadTLUT);

            entries.colorCount /= 4;
            entries.colorCount += 1;

            // @ts-expect-error
            return {
                command,
                ...entries,
            };
        }

        default: {
            const byte0 = reader.u8();
            const byte1 = reader.u8();
            const byte2 = reader.u8();
            const byte3 = reader.u8();
            const byte4 = reader.u8();
            const byte5 = reader.u8();
            const byte6 = reader.u8();

            return {
                command,
                bytes: [byte0, byte1, byte2, byte3, byte4, byte5, byte6],
            };
        }
    }
};

const displayCommandWrite = (writer: ByteWriter, node: StructuredNode, parentContext: WriteContext) => {
    // @ts-expect-error
    const command = node as DisplayListData;

    writer.u8(DisplayCommand[command.command]);

    switch (command.command) {
        case "G_MOVEMEM": {
            for (let i = 0; i < 3; i++) {
                writer.u8(command.padding[i]);
            }
            writer.u32(command.value);
            break;
        }

        case "G_VTX": {
            const u8 = (command.whereToWrite << 1) | command.unknownBit;
            writer.u8(u8);

            const u16 = (command.numberOfVertices << 9) | (command.numberOfBytes << 0);
            writer.u16(u16);

            writer.u8(command.segment);

            writer.u8((command.segmentOffset >> 16) & 0xff);
            writer.u8((command.segmentOffset >> 8) & 0xff);
            writer.u8(command.segmentOffset & 0xff);
            break;
        }

        case "G_TRI1": {
            for (let i = 0; i < 4; i++) {
                writer.u8(command.padding[i]);
            }
            for (let i = 0; i < 3; i++) {
                writer.u8(command.triA[i] << 1);
            }
            break;
        }

        case "G_TRI2": {
            for (let i = 0; i < 3; i++) {
                writer.u8(command.triA[i] << 1);
            }
            for (let i = 0; i < 1; i++) {
                writer.u8(command.padding[i]);
            }
            for (let i = 0; i < 3; i++) {
                writer.u8(command.triB[i] << 1);
            }
            break;
        }

        case "G_TEXTURE": {
            writer.u8(command.unknownByte);

            const u8 = (command.unknownBits << 6) | (command.mipmaps << 3) | (command.tile << 0);
            writer.u8(u8);

            writer.u8(command.tileEnable);

            writer.u16(command.scaleS);
            writer.u16(command.scaleT);
            break;
        }

        case "G_SETTIMG": {
            writer.u8((command.textureFormat << 5) | (command.textureBitSize << 3) | (command.unknownBits << 0));
            writer.u16(command.unknown);
            writer.u32(command.segment);
            break;
        }

        case "G_SETTILE": {
            // @ts-expect-error
            writer.bitField(bitFieldsSetTile, command);
            break;
        }

        case "G_SETTILESIZE": {
            command.sWidth = (command.sWidth - 1) << 2;
            command.tWidth = (command.tWidth - 1) << 2;
            // @ts-expect-error
            writer.bitField(bitFieldsSetTileSize, command);
            break;
        }

        case "G_LOADBLOCK": {
            command.texelCount -= 1;
            // @ts-expect-error
            writer.bitField(bitFieldsLoadBlock, command);
            break;
        }

        case "G_LOADTLUT": {
            command.colorCount -= 1;
            command.colorCount *= 4;

            // @ts-expect-error
            writer.bitField(bitFieldsLoadTLUT, command);
            break;
        }

        default: {
            for (let i = 0; i < 7; i++) {
                writer.u8(command.bytes[i]);
            }
            break;
        }
    }
};

export const methodDisplayCommand: Method = {
    type: "custom",
    // @ts-expect-error
    read: displayCommandRead,
    write: displayCommandWrite,
};

export const methodDisplayListContainer: Method = {
    type: "struct",
    fields: {
        commandCount: "u32",
        padding: "u32",
        gfxCommands: {
            type: "arrayFieldLength",
            element: methodDisplayCommand,
            // element: {
            //     type: "bytes",
            //     bytes: 8,
            // },
            lengthField: "commandCount",
        },
    },
};
