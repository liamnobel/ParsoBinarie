import type { Endian } from "./types.js";

export class ByteWriter {
    private readonly littleEndian: boolean;

    constructor(endian: Endian) {
        this.littleEndian = endian === "little";
    }

    private buffer = new Uint8Array(1024);
    offset = 0;

    private ensureCapacity(additionalBytes: number) {
        const required = this.offset + additionalBytes;

        if (required <= this.buffer.length) return;

        let capacity = this.buffer.length;

        while (capacity < required) {
            capacity *= 2;
        }

        const next = new Uint8Array(capacity);
        next.set(this.buffer);

        this.buffer = next;
    }

    u8(value: number) {
        this.ensureCapacity(1);

        this.buffer[this.offset] = value;
        this.offset += 1;
    }

    u16(value: number) {
        this.ensureCapacity(2);

        const view = new DataView(this.buffer.buffer, this.offset, 2);
        view.setUint16(0, value, this.littleEndian);
        this.offset += 2;
    }

    u32(value: number) {
        this.ensureCapacity(4);

        const view = new DataView(this.buffer.buffer, this.offset, 4);
        view.setUint32(0, value, this.littleEndian);
        this.offset += 4;
    }

    s8(value: number) {
        this.ensureCapacity(1);

        const view = new DataView(this.buffer.buffer, this.offset, 1);
        view.setInt8(0, value);
        this.offset += 1;
    }

    s16(value: number) {
        this.ensureCapacity(2);

        const view = new DataView(this.buffer.buffer, this.offset, 2);
        view.setInt16(0, value, this.littleEndian);
        this.offset += 2;
    }

    s32(value: number) {
        this.ensureCapacity(4);

        const view = new DataView(this.buffer.buffer, this.offset, 4);
        view.setInt32(0, value, this.littleEndian);
        this.offset += 4;
    }

    f32(value: number) {
        this.ensureCapacity(4);

        const view = new DataView(this.buffer.buffer, this.offset, 4);
        view.setFloat32(0, value, this.littleEndian);
        this.offset += 4;
    }

    f64(value: number) {
        this.ensureCapacity(8);

        const view = new DataView(this.buffer.buffer, this.offset, 8);
        view.setFloat64(0, value, this.littleEndian);
        this.offset += 8;
    }

    writeBytes(bytes: Uint8Array) {
        this.ensureCapacity(bytes.length);

        this.buffer.set(bytes, this.offset);
        this.offset += bytes.length;
    }

    finish(): Uint8Array {
        return this.buffer.slice(0, this.offset);
    }
}
