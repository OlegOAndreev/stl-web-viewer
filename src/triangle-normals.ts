import { BufferAttribute, BufferGeometry, Vector3 } from 'three';

// Return two geometries containing pairs of points: one containing line segments for pointing normals and one for
// inward pointing normals.
export function computeTriangleNormals(geo: BufferGeometry): [BufferGeometry, BufferGeometry] {
    if (geo.index != null) {
        geo = geo.toNonIndexed();
    }
    geo.computeBoundingSphere();
    const modelRadius = geo.boundingSphere!.radius;

    const positionAttr = geo.getAttribute('position');
    if (!positionAttr) {
        throw new Error('Geometry does not have position attribute');
    }
    if (!(positionAttr instanceof BufferAttribute)) {
        throw new Error('Interleaved buffer position attribute not supported');
    }
    const pos = positionAttr.array;
    const triCount = pos.length / 9;
    const outwardPoints: Vector3[] = new Array(triCount * 2);
    const inwardPoints: Vector3[] = new Array(triCount * 2);
    const v1 = new Vector3();
    const v2 = new Vector3();
    const v3 = new Vector3();
    const tmp = new Vector3();
    for (let triIdx = 0; triIdx < triCount; triIdx++) {
        const off = triIdx * 9;
        v1.set(pos[off], pos[off + 1], pos[off + 2]);
        v2.set(pos[off + 3], pos[off + 4], pos[off + 5]);
        v3.set(pos[off + 6], pos[off + 7], pos[off + 8]);
        const midpoint = v1.clone().add(v2).add(v3)
            .divideScalar(3.0);
        const normal = v2.clone().sub(v1)
            .cross(tmp.copy(v3).sub(v1))
            .setLength(modelRadius / 25.0);
        const negativeNormal = midpoint.clone().sub(normal);
        normal.add(midpoint);

        outwardPoints[triIdx * 2] = midpoint;
        outwardPoints[triIdx * 2 + 1] = normal;
        inwardPoints[triIdx * 2] = midpoint;
        inwardPoints[triIdx * 2 + 1] = negativeNormal;
    }
    return [
        new BufferGeometry().setFromPoints(outwardPoints),
        new BufferGeometry().setFromPoints(inwardPoints)
    ];
}
