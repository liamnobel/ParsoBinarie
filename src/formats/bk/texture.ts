import type { Method, StructuredNode } from "../../core/types.js";
import { ModelTextureTypeEnum } from "../../core/types.js";

import type { ParseContext, WriteContext } from "../../core/data.js";
import { parseDataInternal, writeDataInternal, WriteState, getNodeAtPath } from "../../core/data.js";

import { ByteReader } from "../../core/byteReader.js";
import { ByteWriter } from "../../core/byteWriter.js";

import { R5G5B5A1toR8G8B8A8, R8G8B8A8toR5G5B5A1, I4A4toR8G8B8A8 } from "../../core/color.js";
import { MethodCustom } from "../../core/types.js";

// export const  methodTextureData: Method = {
//     type: "texture",
//     textureTypeField: "textureType",
//     textureWidthField: "pixelGridX",
//     textureHeightField: "pixelGridY",
// };

export const methodTextureHeader: Method = {
    type: "struct",
    fields: {
        // textureData: {
        //     type: "offset",
        //     offsetType: "u32",
        //     targetMethod: methodTextureDataBlob,
        //     offsetAlignment: "endOf",
        //     offsetFrom: "../textureHeaders",
        // },
        offset: "u32",
        textureType: "u16",
        unknown6: "u8",
        unknown7: "u8",
        pixelGridX: "u8",
        pixelGridY: "u8",
        unknownA: "u8",
        unknownB: "u8",
        unknownC: "u8",
        unknownD: "u8",
        unknownE: "u8",
        unknownF: "u8",
    },
};

/*
        case "texture": {
            // to be moved out of core and into a format-specific parser
            reader.tagOffset("orange", "texture");

            const textureTypeNode = getNodeAtPath(method.textureTypeField, parseContext) as number;
            const textureWidthNode = getNodeAtPath(method.textureWidthField, parseContext) as number;
            const textureHeightNode = getNodeAtPath(method.textureHeightField, parseContext) as number;

            const textureMipMapTrilinearNode = getNodeAtPath("../../geo_type", parseContext) as number;
            const byteMultiple = textureMipMapTrilinearNode & GeoTypeFlags.BK_GEO_TYPE_MIPMAP_TRILINEAR_BIT ? 1.5 : 1;
            // const byteMultiple = 1;

            // console.log("TextureType", textureTypeNode);

            let textureType: TextureTypeEnum;
            let bytesPalette: number;
            let bytesImage: number;
            switch (textureTypeNode) {
                case 0x01:
                    textureType = TextureTypeEnum.CI4;
                    bytesPalette = 16 * 2;
                    bytesImage = (textureWidthNode * textureHeightNode) / 2;
                    break;
                case 0x02:
                    textureType = TextureTypeEnum.CI8;
                    bytesPalette = 256 * 2;
                    bytesImage = textureWidthNode * textureHeightNode;
                    break;
                case 0x04:
                    textureType = TextureTypeEnum.RGBA16;
                    bytesPalette = 0;
                    bytesImage = textureWidthNode * textureHeightNode * 2 * byteMultiple;
                    break;
                case 0x08:
                    textureType = TextureTypeEnum.RGBA32;
                    bytesPalette = 0;
                    bytesImage = textureWidthNode * textureHeightNode * 4;
                    break;
                case 0x10:
                    textureType = TextureTypeEnum.IA8;
                    bytesPalette = 0;
                    bytesImage = textureWidthNode * textureHeightNode;
                    break;
                default:
                    throw new Error(`Unknown texture type: ${textureTypeNode}`);
            }
            const texturePalette = source.subarray(reader.offset, reader.offset + bytesPalette);
            reader.offset += bytesPalette;
            const image = source.subarray(reader.offset, reader.offset + bytesImage);
            reader.offset += bytesImage;

            // 64 bytes of padding(?) if y dimension is 96
            let padBytesLength = 0;
            if (textureHeightNode === 96) {
                padBytesLength = 64;
            }

            const padBytes = source.subarray(reader.offset, reader.offset + padBytesLength);
            reader.offset += padBytesLength;

            return {
                type: "texture",
                textureType: textureType,
                textureWidth: textureWidthNode,
                textureHeight: textureHeightNode,
                texturePalette: texturePalette,
                textureData: image,
                padBytes: padBytes,
            };
        }
*/

const headerDataMethod: Method = {
    type: "arrayFieldLength",
    element: methodTextureHeader,
    lengthField: "textureCount",
};

export const methodTextureDataBlob: MethodCustom = {
    type: "custom",
    read: (reader: ByteReader, parseContext: ParseContext): StructuredNode => {
        // console.log("Reading texture data at offset: 0x", reader.offset.toString(16));

        const offsetBefore = reader.offset;
        const byteLength = getNodeAtPath("byteLength", parseContext) as number;
        const textureCount = getNodeAtPath("textureCount", parseContext) as number;

        const headerData = parseDataInternal(reader, headerDataMethod, parseContext, { deferred: [] });
        // console.log("Parsed header data:", headerData);

        const headerDataByteLength = textureCount * 16 + 8;
        const texturesByteLength = byteLength - headerDataByteLength;

        const textureDataMethod: Method = {
            type: "custom",
            read: (reader: ByteReader, parseContext: ParseContext): StructuredNode => {
                reader.tagOffset("yellow", "texture data");

                const offsetBefore = reader.offset;

                const textures: any[] = [];

                for (let i = 0; i < headerData.data.length; i++) {
                    const thisTextureHeader = headerData.data[i];
                    // console.log(`Texture ${i}: header =`, thisTextureHeader);

                    const w = thisTextureHeader.data.pixelGridX;
                    const h = thisTextureHeader.data.pixelGridY;
                    // console.log(`Texture ${i}: width = ${w}, height = ${h}`);

                    const byteLower = headerDataByteLength + thisTextureHeader.data.offset;
                    let byteUpper: number;
                    if (i < headerData.data.length - 1) {
                        byteUpper = headerDataByteLength + headerData.data[i + 1].data.offset;
                    } else {
                        byteUpper = headerDataByteLength + texturesByteLength;
                    }

                    const foundByteLength = byteUpper - byteLower;

                    //

                    let paletteColorCount: number = 0;

                    let textureType: ModelTextureTypeEnum;
                    let bytesPalette: number;
                    let bytesImage: number;
                    switch (thisTextureHeader.data.textureType) {
                        case 0x01:
                            textureType = ModelTextureTypeEnum.CI4;
                            paletteColorCount = 16;
                            bytesPalette = paletteColorCount * 2;
                            bytesImage = (w * h) / 2;
                            break;
                        case 0x02:
                            textureType = ModelTextureTypeEnum.CI8;
                            paletteColorCount = 256;
                            bytesPalette = paletteColorCount * 2;
                            bytesImage = w * h;
                            break;
                        case 0x04:
                            textureType = ModelTextureTypeEnum.RGBA16;
                            bytesPalette = 0;
                            bytesImage = w * h * 2;
                            break;
                        case 0x08:
                            textureType = ModelTextureTypeEnum.RGBA32;
                            bytesPalette = 0;
                            bytesImage = w * h * 4;
                            break;
                        case 0x10:
                            textureType = ModelTextureTypeEnum.IA8;
                            bytesPalette = 0;
                            bytesImage = w * h;
                            break;
                        default:
                            throw new Error(`Unknown texture type: ${thisTextureHeader.data.textureType}`);
                    }

                    const methodTexturePalette: Method = {
                        type: "arrayFixedLength",
                        element: "u16", // R5G5B5A1
                        length: paletteColorCount,
                    };

                    reader.tagOffset("purple", "texture palette");
                    const texturePalette = parseDataInternal(reader, methodTexturePalette, parseContext, { deferred: [] });

                    reader.tagOffset("orange", "texture data");
                    const image: Uint8Array = reader.buffer.slice(reader.offset, reader.offset + bytesImage);
                    reader.offset += bytesImage;

                    //

                    const headerByteLength = bytesPalette + bytesImage;
                    // console.log(`Texture ${i}: foundByteLength = ${foundByteLength}, headerByteLength = ${headerByteLength}`);

                    const mipMapLength = foundByteLength - headerByteLength;
                    const mipMap = reader.buffer.slice(reader.offset, reader.offset + mipMapLength);
                    reader.offset += mipMapLength;

                    debugAttachTextureToDocument(textureType, texturePalette.data, w, h, image);
                    if (mipMap.length > 0) {
                        debugAttachTextureToDocument(textureType, texturePalette.data, w, h, mipMap);
                    }

                    textures.push({
                        textureType: ModelTextureTypeEnum[textureType],
                        texturePalette: texturePalette,
                        textureData: image,
                        mipMap: mipMap,
                        methodTexturePalette: methodTexturePalette,
                    });
                }

                reader.offset += texturesByteLength;
                return {
                    type: "custom",
                    data: {
                        textures,
                    },
                    _byteLower: offsetBefore,
                    _byteUpper: reader.offset,
                };
            },
            write: (writer: ByteWriter, node: StructuredNode, writeContext: WriteContext, writeState: WriteState): void => {
                for (let i = 0; i < node.data.textures.length; i++) {
                    const texture: {
                        textureType: ModelTextureTypeEnum;
                        texturePalette: StructuredNode;
                        textureData: Uint8Array;
                        mipMap: Uint8Array;
                        methodTexturePalette: Method;
                    } = node.data.textures[i];
                    // writer.writeBytes(texture.texturePalette);
                    writeDataInternal(texture.texturePalette, writer, texture.methodTexturePalette, writeContext, writeState);
                    writer.writeBytes(texture.textureData);
                    writer.writeBytes(texture.mipMap); // I would love to derive how these mip maps were made so we aren't simply dumping them in here
                }
            },
        };

        const textureData = parseDataInternal(reader, textureDataMethod, parseContext, { deferred: [] });

        return {
            type: "custom",
            data: {
                headerData,
                textureData,
                textureDataMethod,
            },
            _byteLower: offsetBefore,
            _byteUpper: reader.offset,
        };
    },
    write: (writer: ByteWriter, node: StructuredNode, writeContext: WriteContext, writeState: WriteState): void => {
        if (isNaN(writer.offset)) {
            console.trace();
            throw new Error(`Invalid writer offset before first writing: ${writer.offset}`);
        }
        writeDataInternal(node.data.headerData, writer, headerDataMethod, writeContext, writeState);
        if (isNaN(writer.offset)) {
            console.trace();
            throw new Error(`Invalid writer offset before second writing: ${writer.offset}`);
        }
        writeDataInternal(node.data.textureData, writer, node.data.textureDataMethod, writeContext, writeState);
    },
};

export const methodTextureHeaderCount: Method = {
    type: "struct",
    fields: {
        byteLength: "u32", // note this includes the headers as well
        textureCount: "u16",
        unknown0: "u16",
        textureData: methodTextureDataBlob,
    },
};

function numberColorToCSSColor(color: number) {
    return `rgba(${(color & 0xff000000) >>> 24}, ${(color & 0x00ff0000) >>> 16}, ${(color & 0x0000ff00) >>> 8}, ${((color & 0x000000ff) >>> 0) / 255})`;
}

function debugAttachTextureToDocument(texType: ModelTextureTypeEnum, palette: number[], w: number, h: number, textureData: Uint8Array): void {
    // skip if running in bun and not browser
    if (typeof document === "undefined") {
        return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.title = `Texture: ${ModelTextureTypeEnum[texType]} (${w}x${h})`;
    canvas.style.padding = "4px";
    canvas.style.border = "4px solid " + (texType === ModelTextureTypeEnum.CI4 || texType === ModelTextureTypeEnum.CI8 ? "blue" : "black");

    let ctx = canvas.getContext("2d");
    if (ctx === null) {
        throw new Error("Could not get canvas context");
    }

    switch (texType) {
        case ModelTextureTypeEnum.CI4: {
            let lut = [];
            for (let i = 0; i < 16; i++) {
                lut.push(R5G5B5A1toR8G8B8A8(palette[i]));
            }

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let this_and_next = textureData[(y * w + x) >> 1];

                    ctx.fillStyle = numberColorToCSSColor(lut[(this_and_next & 0xf0) >> 4]);
                    ctx.fillRect(x, h - 1 - y, 1, 1);

                    x++;

                    ctx.fillStyle = numberColorToCSSColor(lut[this_and_next & 0x0f]);
                    ctx.fillRect(x, h - 1 - y, 1, 1);
                }
            }
            break;
        }
        case ModelTextureTypeEnum.CI8: {
            let lut = [];
            for (let i = 0; i < 256; i++) {
                lut.push(R5G5B5A1toR8G8B8A8(palette[i]));
            }

            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let color = textureData[y * w + x];
                    let lut_color = lut[color];
                    ctx.fillStyle = numberColorToCSSColor(lut_color);
                    ctx.fillRect(x, h - 1 - y, 1, 1);
                }
            }
            break;
        }
        case ModelTextureTypeEnum.RGBA16: {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let color = R5G5B5A1toR8G8B8A8((textureData[(y * w + x) << 1] << 8) | (textureData[((y * w + x) << 1) | 1] << 0));
                    ctx.fillStyle = numberColorToCSSColor(color);
                    ctx.fillRect(x, h - 1 - y, 1, 1);
                }
            }
            break;
        }
        case ModelTextureTypeEnum.RGBA32: {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let color = Number(textureData[(y * w + x) << 2] | (textureData[((y * w + x) << 2) | 1] << 8) | (textureData[((y * w + x) << 2) | 2] << 16) | (textureData[((y * w + x) << 2) | 3] << 24));
                    ctx.fillStyle = numberColorToCSSColor(color);
                    ctx.fillRect(x, h - 1 - y, 1, 1);
                }
            }
            break;
        }
        case ModelTextureTypeEnum.IA8: {
            for (let y = 0; y < h; y++) {
                for (let x = 0; x < w; x++) {
                    let color = I4A4toR8G8B8A8(textureData[y * w + x]);
                    ctx.fillStyle = numberColorToCSSColor(color);
                    ctx.fillRect(x, h - 1 - y, 1, 1);
                }
            }
            break;
        }
        default: {
            console.error("Unsupported texture type " + texType);
            break;
        }
    }

    document.body.appendChild(canvas);
}
