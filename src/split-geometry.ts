import { BufferAttribute, BufferGeometry, Vector3, type TypedArray } from 'three';

// An alternative to Math.atan2 which maps all values of y/x to the range (-PI, PI) with the similar order as
// Math.atan2: notTan(x) < notTan(y) mostly equivalent to atan2(x) < atan2(y), unless either a) the tangents differ only
// in a few ULP (see tests) or b) inputs are BOTH zeros or infinitys.
export function notAtan2(y: number, x: number): number {
    // Returned ranges:
    //   x > 0 && y > 0: (0, PI/2)
    //   x > 0 && y < 0: (-PI/2, 0)
    //   x < 0 && y > 0: (PI/2, PI)
    //   x < 0 && y < 0: (-PI, -PI/2)
    const alpha = y / x;
    if (isNaN(alpha)) {
        // Apparently real atan2 implementations contain a hardcoded list of cases here, for example see
        // https://git.musl-libc.org/cgit/musl/tree/src/math/atan2.c
        return 0.0;
    }
    // normalized = PI/2 * alpha / (abs(alpha) + 1), but we want to leave alpha only in the divisor so that we do not
    // get NaN when alpha = Infinity.
    const normalized = Math.PI * 0.5 * Math.sign(alpha) * (1 - 1 / (1 + Math.abs(alpha)));
    if (x >= 0 && !Object.is(x, -0)) {
        return normalized;
    } else {
        if (y >= 0 && !Object.is(y, -0)) {
            return normalized + Math.PI;
        } else {
            return normalized - Math.PI;
        }
    }
}

// Splits a non-indexed BufferGeometry into multiple geometries, where each geometry represents a separate body. Assumes
// T-junctions are accidental and the normals of each body are outward-facing.
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
    const pos = positionAttr.array;
    const triCount = pos.length / 9;
    if (triCount === 0) {
        return [];
    }

    // We find triangle neighbors by shared edges: if the triangle 2 has the same edge as triangle 1, but oriented the
    // other way, it potentially belongs to the same part as triangle 1 (e.g. if triangle 1 is v1-v2-v3,
    // triangle 2 must be one of v2-v1-v4, v3-v2-v4 or v1-v3-v4).
    //
    // The tricky case is when the edge is shared by more than two triangles, e.g. there are two cubes of the same size
    // touching by the edge. In this case we assume that triangle normals point outside of the body. Then we can find
    // the nearest candidate triangle based on angle between triangle normals.

    // Maps edge key -> list of triangles with that edge.
    interface Triangle {
        triIdx: number,
        normal: Vector3,
    }
    const edgeMap = new Map<string, Triangle[]>();
    function getEdgeKey(v1: Vector3, v2: Vector3): string {
        return `${v1.x};${v1.y};${v1.z}:${v2.x};${v2.y};${v2.z}`;
    }

    const tmp = new Vector3();
    function addToEdgeMap(v1: Vector3, v2: Vector3, v3: Vector3, triIdx: number) {
        const edge = getEdgeKey(v1, v2);
        let tris = edgeMap.get(edge);
        if (tris === undefined) {
            tris = [];
            edgeMap.set(edge, tris);
        }
        const normal = v2.clone().sub(v1)
            .cross(tmp.copy(v3).sub(v1));
        tris.push({
            triIdx: triIdx,
            normal: normal,
        })
    }

    const v1 = new Vector3();
    const v2 = new Vector3();
    const v3 = new Vector3();
    for (let triIdx = 0; triIdx < triCount; triIdx++) {
        const off = triIdx * 9;
        v1.set(pos[off], pos[off + 1], pos[off + 2]);
        v2.set(pos[off + 3], pos[off + 4], pos[off + 5]);
        v3.set(pos[off + 6], pos[off + 7], pos[off + 8]);

        addToEdgeMap(v1, v2, v3, triIdx);
        addToEdgeMap(v2, v3, v1, triIdx);
        addToEdgeMap(v3, v1, v2, triIdx);
    }

    // Flag for each triangle if it has been visited.
    const visited: boolean[] = new Array(triCount).fill(false);
    // A part is a list of triangle indices.
    const parts: number[][] = [];
    // Use BFS instead of DFS, otherwise we get stack overflow on complex models.
    const queue: number[] = [];

    // Find the next triangle to visit after triangle v1-v2-v3. All triangles in tris share the edge v2-v1. The
    // algorithm is quadratic and not optimized (the optimized version would sort triangles by angle and do a binary
    // search). We assume that shared edge case is not too common (<100 vectors per edge).
    const curNormal = new Vector3();
    const edgeVec = new Vector3();
    function findNextTriangle(v1: Vector3, v2: Vector3, v3: Vector3, tris: Triangle[]): number {
        // Compute normal of current triangle = (v2-v1) x (v3-v1).
        curNormal.copy(v2).sub(v1)
            .cross(tmp.copy(v3).sub(v1));
        // Compute the normal between two normals.
        edgeVec.copy(v2).sub(v1);

        // Compare the angles between curNormal and normals of candidate triangles in range [-PI, PI) and find the
        // triangle with largest angle. See
        // https://stackoverflow.com/questions/5188561/signed-angle-between-two-3d-vectors-with-same-origin-within-the-same-plane
        // for the derivation of tangent formula.
        //
        // NOTE: We do not calculate the angles themselves and compare only cotangents based on the equality x < y <=>
        // cotan(x) > cotan(y) for x, y in [0, PI]. We then need to correctly process the cases when angles are
        // outside of that range (basically what Math.atan2 does).
        let bestTriIdx = -1;
        let bestAngle = -Infinity;
        const epsilon = 1e-3 * edgeVec.length();
        for (let i = 0; i < tris.length; i++) {
            // dot = curNormal * tris[i].normal, cross = (curNormal x tris[i].normal) * edgeVec, cotan = dot / cross
            const dot = tmp.copy(curNormal).dot(tris[i].normal);
            const cross = tmp.copy(curNormal).cross(tris[i].normal).dot(edgeVec);
            let angle = notAtan2(cross, dot);
            // If the angle is too close to PI, the triangles are almost parallel, consider them to be parallel and
            // belonging to different bodies.
            if (angle > Math.PI - epsilon) {
                angle = -Math.PI;
            }
            if (angle > bestAngle) {
                bestAngle = angle;
                bestTriIdx = tris[i].triIdx;
            }
        }
        return bestTriIdx;
    }

    function visitEdge(v1: Vector3, v2: Vector3, v3: Vector3) {
        // We need the neighbor to have a reverse edge 
        const tris = edgeMap.get(getEdgeKey(v2, v1));
        if (!tris) {
            return;
        }
        // Separately process the fast case: only one triangle has the matching edge.
        const nextTriIdx = (tris.length === 1) ? tris[0].triIdx : findNextTriangle(v1, v2, v3, tris);
        if (!visited[nextTriIdx]) {
            visited[nextTriIdx] = true;
            queue.push(nextTriIdx);
        }
    }

    for (let triIdx = 0; triIdx < triCount; triIdx++) {
        if (visited[triIdx]) {
            continue;
        }

        const nextPart: number[] = [];
        queue.push(triIdx);
        while (queue.length > 0) {
            const triIdx = queue.pop()!;
            nextPart.push(triIdx);

            const off = triIdx * 9;
            v1.set(pos[off], pos[off + 1], pos[off + 2]);
            v2.set(pos[off + 3], pos[off + 4], pos[off + 5]);
            v3.set(pos[off + 6], pos[off + 7], pos[off + 8]);

            visitEdge(v1, v2, v3);
            visitEdge(v2, v3, v1);
            visitEdge(v3, v1, v2);
        }
        parts.push(nextPart);
    }

    const result: BufferGeometry[] = [];

    for (const part of parts) {
        const newGeo = new BufferGeometry();
        for (const name in geo.attributes) {
            const attr = geo.attributes[name];
            if (!(attr instanceof BufferAttribute)) {
                throw new Error(`Interleaved buffer attribute "${name}" not supported`);
            }

            const itemSize = attr.itemSize;
            const newArray = new (attr.array.constructor as new (n: number) => TypedArray)(
                part.length * 3 * itemSize
            );
            for (let i = 0; i < part.length; i++) {
                const triIdx = part[i];
                const srcOffset = triIdx * 3 * itemSize;
                const dstOffset = i * 3 * itemSize;
                for (let j = 0; j < 3 * itemSize; j++) {
                    newArray[dstOffset + j] = attr.array[srcOffset + j];
                }
            }

            const newAttr = new BufferAttribute(newArray, itemSize, attr.normalized);
            newGeo.setAttribute(name, newAttr);
        }
        result.push(newGeo);
    }

    return result;
}
