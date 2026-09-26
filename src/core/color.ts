export const getBits = (input: number, highBit: number, lowBit: number): number => {
    const width = highBit - lowBit + 1;
    const mask = width === 32 ? 0xffffffff : (1 << width) - 1;

    return (input >>> lowBit) & mask;
};

export const R5G5B5A1toR8G8B8A8 = (color: number): number => {
    const r5 = getBits(color, 15, 11);
    const g5 = getBits(color, 10, 6);
    const b5 = getBits(color, 5, 1);
    const a1 = getBits(color, 0, 0);

    const r8 = (r5 << 3) | (r5 >> 2);
    const g8 = (g5 << 3) | (g5 >> 2);
    const b8 = (b5 << 3) | (b5 >> 2);
    const a8 = a1 * 0xff;

    return ((r8 << 24) | (g8 << 16) | (b8 << 8) | a8) >>> 0;
};

export const R8G8B8A8toR5G5B5A1 = (color: number): number => {
    const r5 = getBits(color, 31, 27);
    const g5 = getBits(color, 23, 19);
    const b5 = getBits(color, 15, 11);
    const a1 = getBits(color, 7, 7);

    return (r5 << 11) | (g5 << 6) | (b5 << 1) | a1;
};

export const I4A4toR8G8B8A8 = (color: number): number => {
    const i4 = getBits(color, 7, 4);
    const a4 = getBits(color, 3, 0);

    const i8 = (i4 << 4) | i4;
    const a8 = (a4 << 4) | a4;

    return ((i8 << 24) | (i8 << 16) | (i8 << 8) | a8) >>> 0;
};
