import type { Method } from "../../core/types.js";

export const methodDisplayListContainer: Method = {
    type: "struct",
    fields: {
        commandCount: "u32",
        padding: "u32",
        data: {
            type: "arrayFieldLength",
            element: {
                type: "struct",
                fields: {
                    command: "u8",
                    bytes: {
                        type: "bytes",
                        bytes: 7,
                    },
                },
            },
            lengthField: "commandCount",
        },
    },
};

// to be expanded to actually have info on the commands