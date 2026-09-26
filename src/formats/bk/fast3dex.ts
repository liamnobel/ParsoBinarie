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

type displayListTri2Data = {
    command: "G_TRI2";
    padding: [number];
    triA: [number, number, number];
    triB: [number, number, number];
};

type displayListTri1Data = {
    command: "G_TRI1";
    padding: [number, number, number, number];
    triA: [number, number, number];
};

type displayListDefaultData = {
    command: Exclude<keyof typeof DisplayCommand, "G_MOVEMEM" | "G_VTX" | "G_TRI1" | "G_TRI2">;
    bytes: [number, number, number, number, number, number, number];
};

type DisplayListData = displayListMoveMemData | displayListVtxData | displayListTri1Data | displayListTri2Data | displayListDefaultData;

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
