import type { BitField, BitFieldData, Endian } from "./types.js";

export class ByteReader {
    readonly buffer: Uint8Array;

    private readonly littleEndian: boolean;
    private readonly view: DataView;

    offset: number = 0;
    bytesInBuffer: number = 0;
    debugTaggedOffsets: Record<number, { color: string; text: string }>;

    constructor(buffer: Uint8Array, endian: Endian) {
        this.buffer = buffer;
        this.view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
        this.littleEndian = endian === "little";
        this.bytesInBuffer = buffer.byteLength;

        this.debugTaggedOffsets = {};
    }

    public u8(): number {
        const value = this.view.getUint8(this.offset);
        this.offset += 1;
        return value;
    }

    public u16(): number {
        const value = this.view.getUint16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }

    public u32(): number {
        const value = this.view.getUint32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }

    public s8(): number {
        const value = this.view.getInt8(this.offset);
        this.offset += 1;
        return value;
    }

    public s16(): number {
        const value = this.view.getInt16(this.offset, this.littleEndian);
        this.offset += 2;
        return value;
    }

    public s32(): number {
        const value = this.view.getInt32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }

    public f32(): number {
        const value = this.view.getFloat32(this.offset, this.littleEndian);
        this.offset += 4;
        return value;
    }

    public f64(): number {
        const value = this.view.getFloat64(this.offset, this.littleEndian);
        this.offset += 8;
        return value;
    }

    public bitField<T extends BitField>(fields: T): BitFieldData<T> {
        const entries = {} as BitFieldData<T>;

        let buffer = 0;
        let bitsAvailable = 0;

        for (const [field, width] of Object.entries(fields)) {
            if (width < 1 || width > 32) {
                throw new RangeError(`Bit field "${field}" has invalid width: ${width}`);
            }

            let value = 0;
            let bitsRemaining = width;

            while (bitsRemaining > 0) {
                if (bitsAvailable === 0) {
                    buffer = this.u8();
                    bitsAvailable = 8;
                }

                const take = Math.min(bitsRemaining, bitsAvailable);
                const shift = bitsAvailable - take;
                const mask = (1 << take) - 1;

                value = value * 2 ** take + ((buffer >>> shift) & mask);

                bitsAvailable -= take;
                bitsRemaining -= take;

                buffer &= (1 << bitsAvailable) - 1;
            }

            entries[field as keyof T] = value;
        }

        return entries;
    }

    tagOffset(color: string, text: string): void {
        this.debugTaggedOffsets[this.offset] = {
            color: color,
            text: text,
        };
    }

    jump(offset: number): void {
        this.offset = offset;
    }
}
