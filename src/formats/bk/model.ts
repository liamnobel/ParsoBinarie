import type { Method, StructuredNode } from "../../core/types.js";
import { ParseContext } from "../../core/data.js";
import { ByteReader } from "../../core/byteReader.js";

import { parseGeoLayout, writeGeoLayout } from "./geoLayout.js";
import { methodDisplayListContainer } from "./fast3dex.js";
import { methodTextureHeaderCount } from "./texture.js";
import * as unk14 from "./unk14.js";

const methodCollisionSetup: Method = {
    type: "struct",
    fields: {
        x_lower: "s16",
        y_lower: "s16",
        z_lower: "s16",

        x_upper: "s16",
        y_upper: "s16",
        z_upper: "s16",

        yStride: "s16",
        zStride: "s16",

        geoCount: "u16",
        scale: "s16",

        triangleCount: "u16",

        pad0: "u8",
        pad1: "u8",

        geoSomething: {
            type: "arrayFieldLength",
            element: {
                type: "struct",
                fields: {
                    triId: "u16",
                    triCount: "u16",
                },
            },
            lengthField: "geoCount",
        },

        triangles: {
            type: "arrayFieldLength",
            element: {
                type: "struct",
                fields: {
                    vertexIndexA: "u16",
                    vertexIndexB: "u16",
                    vertexIndexC: "u16",
                    pad: "u16",
                    flags: "u32",
                },
            },
            lengthField: "triangleCount",
        },
    },
};

const vertexDataElement: Method = {
    type: "arrayFieldLength",
    element: {
        type: "struct",
        fields: {
            x: "s16",
            y: "s16",
            z: "s16",
            flag: "u16",
            u: "s16",
            v: "s16",
            cr_or_nx: "u8",
            cg_or_ny: "u8",
            cb_or_nz: "u8",
            ca: "u8",
        },
    },
    lengthField: "count",
};

const methodVertexList: Method = {
    type: "struct",
    fields: {
        minCoord: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        maxCoord: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        centerCoord: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        local_norm: "s16",
        count: "u16",
        global_norm: "s16",
        vertices: vertexDataElement,
    },
};

function geoLayoutRead(reader: ByteReader, parseContext: ParseContext): StructuredNode {
    return parseGeoLayout(reader, parseContext);
}

const methodUnknown: Method = {
    type: "struct",
    fields: {
        scale: "s16",
        pad: "u16",
        count: "u16",
        pad2: "u16",
        data: {
            type: "arrayFieldLength",
            element: {
                type: "bytes",
                bytes: 16,
            },
            lengthField: "count",
        },
    },
};

const methodMesh: Method = {
    type: "struct",
    fields: {
        uid: "s16",
        vertexCount: "u16",
        verticies: {
            type: "arrayFieldLength",
            element: "s16",
            lengthField: "vertexCount",
        },
    },
};

const methodMeshList: Method = {
    type: "struct",
    fields: {
        meshCount: "u16",
        meshes: {
            type: "arrayFieldLength",
            element: methodMesh,
            lengthField: "meshCount",
        },
    },
};

const methodBKAnimVertices: Method = {
    type: "struct",
    fields: {
        coord: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        anim_index: "s8",
        vtx_count: "u8",
        vtx_list: {
            type: "arrayFieldLength",
            element: "s16",
            lengthField: "vtx_count",
        },
    },
};

const methodBKCameraArea: Method = {
    type: "struct",
    fields: {
        min: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        max: {
            type: "arrayFixedLength",
            element: "s16",
            length: 3,
        },
        in_bounds: "u8",
        pad: "u8",
    },
};

const methodEffectsSetup: Method = {
    type: "struct",
    fields: {
        count: "u8",
        pad: "u8",
        data: {
            type: "arrayFieldLength",
            element: methodBKCameraArea,
            lengthField: "count",
        },
    },
};

const methodBKAnimVertList: Method = {
    type: "struct",
    fields: {
        count: "u16",
        pad: "u16",
        data: {
            type: "arrayFieldLength",
            element: methodBKAnimVertices,
            lengthField: "count",
        },
    },
};

export const methodModel: Method = {
    type: "struct",
    fields: {
        magic_number: "u32",
        geo_list_offset: {
            type: "offset",
            offsetType: "u32",
            targetMethod: {
                type: "custom",
                read: geoLayoutRead,
                write: writeGeoLayout,
            },
            offsetAlignment: "startOf",
            offsetFrom: "/",
            writePriority: 2,
            align: {
                modulo: 8,
                padValue: 0x00,
            },
        },
        texture_list_offset: {
            // offset: 0x08
            type: "offset",
            offsetType: "u16",
            targetMethod: methodTextureHeaderCount,
            offsetAlignment: "startOf",
            offsetFrom: "/",
        },
        geo_type: "u16", // offset: 0x0A
        gfx_list_offset: {
            // offset: 0x0C
            type: "offset",
            offsetType: "u32",
            targetMethod: methodDisplayListContainer,
            offsetAlignment: "startOf",
            offsetFrom: "/",
        },
        vtx_list_offset: {
            // offset: 0x10
            type: "offset",
            offsetType: "u32",
            targetMethod: methodVertexList,
            offsetAlignment: "startOf",
            offsetFrom: "/",
        },
        unk14_list_offset: {
            // offset: 0x14
            type: "offset",
            offsetType: "u32",
            targetMethod: unk14.methodStructBKModelUnk14,
            offsetAlignment: "startOf",
            offsetFrom: "/",
            nullValue: 0,
        },
        collision_list_offset: {
            // offset: 0x18
            type: "offset",
            offsetType: "u32",
            targetMethod: methodUnknown,
            offsetAlignment: "startOf",
            offsetFrom: "/",
            writePriority: 1,
            nullValue: 0,
            align: {
                modulo: 8,
                padValue: 0x00,
            },
        },
        mesh_list_offset: {
            // offset: 0x1C
            type: "offset",
            offsetType: "u32",
            targetMethod: methodCollisionSetup,
            offsetAlignment: "startOf",
            offsetFrom: "/",
            nullValue: 0,
            align: {
                modulo: 8,
                padValue: 0x00,
            },
        },
        effectsSetup: {
            // offset: 0x20
            type: "offset",
            offsetType: "u32",
            targetMethod: methodEffectsSetup,
            offsetAlignment: "startOf",
            offsetFrom: "/",
            nullValue: 0,
            writeAfter: "meshListOffset",
            align: {
                modulo: 8,
                padValue: 0x00,
            },
        },
        meshListOffset: {
            // offset: 0x24 anim tex list offset
            type: "offset",
            offsetType: "u32",
            targetMethod: methodMeshList,
            offsetAlignment: "startOf",
            offsetFrom: "/",
            nullValue: 0,
            align: {
                modulo: 8,
                padValue: 0x00,
            },
        },
        animatedTexturesOffset: {
            // offset: 0x28
            type: "offset",
            offsetType: "u32",
            targetMethod: methodBKAnimVertList,
            offsetAlignment: "startOf",
            offsetFrom: "/",
            nullValue: 0,
            align: {
                modulo: 8,
                padValue: 0x00,
            },
        },
        offsetUnk2C: {
            // offset: 0x2C
            type: "offset",
            offsetType: "u32",
            targetMethod: {
                type: "bytes",
                bytes: 32,
            },
            offsetAlignment: "startOf",
            offsetFrom: "/",
            nullValue: 0,
            align: {
                modulo: 8,
                padValue: 0x00,
            },
            writePriority: 1,
        },
        possibleCountTriangles: "u16",
        possibleCountVertices: "u16",
        unk34: "u8",
        unk35: "u8",
        unk36: "u16",
    },
};
