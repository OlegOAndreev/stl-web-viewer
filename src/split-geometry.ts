import { BufferAttribute, BufferGeometry, type TypedArray } from 'three';

import { split_disjoint_geometry } from '../wasm/pkg/wasm_main_module';

// Splits a geometry into multiple geometries, where each geometry represents a separate body. Assumes T-junctions are
// accidental and the normals of each body are outward-facing. The bodies are found by the Rust code; here we only
// validate the input and copy the attributes of each body into new geometries.
export function splitDisjointGeometry(geo: BufferGeometry): BufferGeometry[] {
    if (geo.index !== null) {
        geo = geo.toNonIndexed();
    }

    const positionAttr = geo.getAttribute('position');
    if (!positionAttr) {
        throw new Error('Geometry does not have position attribute');
    }
    if (!(positionAttr instanceof BufferAttribute)) {
        throw new Error('Interleaved buffer position attribute not supported');
    }
    // wasm-bindgen accepts only Float32Array.
    const pos = positionAttr.array instanceof Float32Array ? positionAttr.array : new Float32Array(positionAttr.array);

    const result = split_disjoint_geometry(pos);
    try {
        // These are views into WASM memory, so they have to be read before the result is freed.
        const triIndices = result.tri_indices;
        const partSizes = result.part_sizes;

        const parts: BufferGeometry[] = [];
        let offset = 0;
        for (let i = 0; i < partSizes.length; i++) {
            const size = partSizes[i];
            parts.push(extractPartGeometry(geo, triIndices.subarray(offset, offset + size)));
            offset += size;
        }
        return parts;
    } finally {
        result.free();
    }
}

// Copies the attributes of the given triangles into a new geometry.
function extractPartGeometry(geo: BufferGeometry, triIndices: Uint32Array): BufferGeometry {
    const part = new BufferGeometry();
    for (const name in geo.attributes) {
        const attr = geo.attributes[name];
        if (!(attr instanceof BufferAttribute)) {
            throw new Error(`Interleaved buffer attribute "${name}" not supported`);
        }

        const itemSize = attr.itemSize;
        const newArray = new (attr.array.constructor as new (n: number) => TypedArray)(
            triIndices.length * 3 * itemSize,
        );
        for (let i = 0; i < triIndices.length; i++) {
            const srcOffset = triIndices[i] * 3 * itemSize;
            newArray.set(attr.array.subarray(srcOffset, srcOffset + 3 * itemSize), i * 3 * itemSize);
        }

        part.setAttribute(name, new BufferAttribute(newArray, itemSize, attr.normalized));
    }
    return part;
}
