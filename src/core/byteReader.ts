import type { Endian } from "./types.js";

export class ByteReader {
    private readonly littleEndian: boolean;
    readonly view: DataView;
    offset: number = 0;
    bytesInBuffer: number = 0;
    debugTaggedOffsets: Record<number, { color: string; text: string }>;

    constructor(buffer: Uint8Array, endian: Endian) {
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

    public bitField(fields: Record<string, number>): Record<string, number> {
        const entries: Record<string, number> = {};

        let bits = 0;
        let bitsLoaded = 0;

        for (const [field, bitsRequired] of Object.entries(fields)) {
            while (bitsLoaded < bitsRequired) {
                bits = (bits << 8) | this.u8();
                bitsLoaded += 8;
            }

            bitsLoaded -= bitsRequired;

            entries[field] = (bits >>> bitsLoaded) & ((1 << bitsRequired) - 1);

            // Retain only unread bits.
            bits &= (1 << bitsLoaded) - 1;
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
