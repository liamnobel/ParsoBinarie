export function assertBytesEqual(expected: Uint8Array, actual: Uint8Array): { success: boolean; message?: string } {
    if (expected.length !== actual.length) {
        return {
            success: false,
            message: `Byte arrays differ in length: ${expected.length} !== ${actual.length}`,
        };
    }

    for (let i = 0; i < expected.length; i++) {
        if (expected[i] !== actual[i]) {
            return {
                success: false,
                message: `Byte arrays differ at 0x${i.toString(16)}: ` + `0x${expected[i]?.toString(16).padStart(2, "0")} !== ` + `0x${actual[i]?.toString(16).padStart(2, "0")}`,
            };
        }
    }

    return { success: true };
}
