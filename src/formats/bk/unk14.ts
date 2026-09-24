// typedef struct {
//     s16 unk0[3];
//     s16 unk6[3];
//     s16 unkC[3];
//     u8 unk12[3];
//     u8 unk15;
//     s8 unk16;
//     u8 pad17[1];
// } BKModelUnk14_0;

import { Method } from "../../core/types.js";

// typedef struct {
//     s16 unk0;
//     s16 unk2;
//     s16 unk4[3];
//     u8 unkA[3];
//     u8 unkD;
//     s8 unkE;
//     u8 padF[1];
// } BKModelUnk14_1;

// typedef struct {
//     s16 unk0;
//     s16 unk2[3];
//     u8 unk8;
//     s8 unk9;
//     u8 padA[2];
// } BKModelUnk14_2;

const methodStructBKModelUnk14_0: Method = {
    type: "struct",
    fields: {
        unk0: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        unk6: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        unkC: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        unk12: {
            type: "arrayFixedLength",
            element: "u8",
            length: 3,
        },
        unk15: "u8",
        unk16: "s8",
        pad17: {
            type: "arrayFixedLength",
            element: "u8",
            length: 1,
        },
    },
};

const methodStructBKModelUnk14_1: Method = {
    type: "struct",
    fields: {
        unk0: "s16",
        unk2: "s16",
        unk4: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        unkA: {
            type: "arrayFixedLength",
            element: "u8",
            length: 3,
        },
        unkD: "u8",
        unkE: "s8",
        padF: {
            type: "arrayFixedLength",
            element: "u8",
            length: 1,
        },
    },
};

const methodStructBKModelUnk14_2: Method = {
    type: "struct",
    fields: {
        unk0: "s16",
        unk2: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        unk8: "u8",
        unk9: "s8",
        padA: {
            type: "arrayFixedLength",
            element: "u8",
            length: 2,
        },
    },
};

export const methodStructBKModelUnk14: Method = {
    type: "struct",
    fields: {
        countA: "u16",
        countB: "u16",
        countC: "u16",
        unk: "s16",
        dataA: {
            type: "arrayFieldLength",
            element: methodStructBKModelUnk14_0,
            lengthField: "countA",
        },
        dataB: {
            type: "arrayFieldLength",
            element: methodStructBKModelUnk14_1,
            lengthField: "countB",
        },
        dataC: {
            type: "arrayFieldLength",
            element: methodStructBKModelUnk14_2,
            lengthField: "countC",
        },
    },
};
