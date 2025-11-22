import { BoxGeometry, BufferGeometry, CylinderGeometry, Vector3 } from 'three';
import { assert, test } from 'vitest';

import { splitDisjointGeometry } from './split-geometry';
import { BufferGeometryUtils } from 'three/examples/jsm/Addons.js';

test('splitDisjointGeometry empty test', () => {
    const geo = new BufferGeometry().setFromPoints([
    ]);

    const parts = splitDisjointGeometry(geo);
    assert.equal(parts.length, 0);
});

test('splitDisjointGeometry basic test', () => {
    const geo0 = new BufferGeometry().setFromPoints([
        new Vector3(0, 0, 0),
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0)
    ]);
    const geo0Tris = getTris(geo0);
    const geo1 = new BufferGeometry().setFromPoints([
        new Vector3(0, 0, 2),
        new Vector3(1, 0, 2),
        new Vector3(0, 1, 2)
    ]);
    const geo1Tris = getTris(geo1);
    const geo = BufferGeometryUtils.mergeGeometries([geo0, geo1]);
    const parts = splitDisjointGeometry(geo);
    assert.equal(parts.length, 2);

    assert.equal(parts.length, 2);
    const tris0 = getTris(parts[0]);
    const tris1 = getTris(parts[1]);
    assertEqualSet(tris0, geo0Tris);
    assertEqualSet(tris1, geo1Tris);
});

test('splitDisjointGeometry cube test', () => {
    const cube = new BoxGeometry(1, 1, 1, 3, 2, 1);
    const cubeTris = getTris(cube);

    const parts = splitDisjointGeometry(cube);
    assert.equal(parts.length, 1);
    const tris0 = getTris(parts[0]);
    assertEqualSet(tris0, cubeTris);
});

test('splitDisjointGeometry contacting cube test', () => {
    // Two boxes touching against one side
    const cube0 = new BoxGeometry(1, 1, 1);
    const cube0Tris = getTris(cube0);
    const cube1 = new BoxGeometry(1, 1, 1);
    cube1.translate(1, 0, 0);
    const cube1Tris = getTris(cube1);
    const geo = BufferGeometryUtils.mergeGeometries([cube0, cube1]);

    const parts = splitDisjointGeometry(geo);
    assert.equal(parts.length, 2);
    const tris0 = getTris(parts[0]);
    const tris1 = getTris(parts[1]);
    assertEqualSet(tris0, cube0Tris);
    assertEqualSet(tris1, cube1Tris);
});

test('splitDisjointGeometry angles test', () => {
    // Two pairs of triangles each forming an angle, all sharing one edge.
    const angle0 = new BufferGeometry().setFromPoints([
        new Vector3(0, 0, 0),
        new Vector3(1, 0, 0),
        new Vector3(0, 0, 1),

        new Vector3(0, 0, 0),
        new Vector3(0, 0, 1),
        new Vector3(1, 0.1, 0),
    ]);
    angle0.rotateX(0.1);
    angle0.rotateY(0.1);
    const angle0Tris = getTris(angle0);
    const angle1 = new BufferGeometry().setFromPoints([
        new Vector3(0, 0, 0),
        // Even if we have slighly overlapping angles, we still should not assume they belong to disjoint bodies.
        new Vector3(2, 0.1999, 0),
        new Vector3(0, 0, 1),

        new Vector3(0, 0, 0),
        new Vector3(0, 0, 1),
        new Vector3(2, -0.2, 0),
    ]);
    angle1.rotateX(0.1);
    angle1.rotateY(0.1);
    const angle1Tris = getTris(angle1);
    const geo = BufferGeometryUtils.mergeGeometries([angle0, angle1]);

    const parts = splitDisjointGeometry(geo);
    assert.equal(parts.length, 2);
    const tris0 = getTris(parts[0]);
    const tris1 = getTris(parts[1]);
    assertEqualSet(tris0, angle0Tris);
    assertEqualSet(tris1, angle1Tris);
});

test('splitDisjointGeometry stress test', () => {
    const baseGeo = new CylinderGeometry(1, 1, 1, 10);
    // Take all points from baseGeo and make all possible triangles with them.
    const basePoints = getPoints(baseGeo);

    const geoPoints: Vector3[] = [];
    for (let i = 0; i < basePoints.length; i++) {
        for (let j = 0; j < basePoints.length; j++) {
            if (i === j) {
                continue;
            }
            for (let k = 0; k < basePoints.length; k++) {
                if (i === k || j === k) {
                    continue;
                }
                geoPoints.push(basePoints[i]);
                geoPoints.push(basePoints[j]);
                geoPoints.push(basePoints[k]);
            }
        }
    }
    const numGeoTris = geoPoints.length / 3;
    const geo = new BufferGeometry().setFromPoints(geoPoints);

    // Check that we do not hang and have some basic sanity checks.
    const parts = splitDisjointGeometry(geo);
    assert(parts.length > 1);
    assert(parts.length < numGeoTris);
});

function getTris(geo: BufferGeometry): Set<string> {
    if (geo.index) {
        geo = geo.toNonIndexed();
    }
    const attr = geo.getAttribute('position').array;
    if (attr.length % 9 != 0) {
        throw new Error(`Strange position length: ${attr.length}`);
    }
    const result = new Set<string>();
    for (let i = 0; i < attr.length / 9; i++) {
        const off = i * 9;
        const v00 = attr[off];
        const v01 = attr[off + 1];
        const v02 = attr[off + 2];
        const v10 = attr[off + 3];
        const v11 = attr[off + 4];
        const v12 = attr[off + 5];
        const v20 = attr[off + 6];
        const v21 = attr[off + 7];
        const v22 = attr[off + 8];
        // Get one canonical representation of a triangle
        const key1 = `${v00};${v01};${v02}:${v10};${v11};${v12}:${v20};${v21};${v22}`;
        const key2 = `${v10};${v11};${v12}:${v20};${v21};${v22}:${v00};${v01};${v02}`;
        const key3 = `${v20};${v21};${v22}:${v00};${v01};${v02}:${v10};${v11};${v12}`;
        if (key1 < key2) {
            if (key1 < key3) {
                result.add(key1)
            } else {
                result.add(key3);
            }
        } else {
            if (key2 < key3) {
                result.add(key2);
            } else {
                result.add(key3);
            }
        }
    }
    return result;
}

function assertEqualSet(actual: Set<string>, expected: Set<string>) {
    assert.equal(actual.size, expected.size);
    for (const key of actual.keys()) {
        assert(expected.has(key), `Triangle ${key} not expected in ${setToString(expected)}`);
    }
}

function setToString(s: Set<string>): string {
    let r = '';
    for (const key of s) {
        r += key;
        r += ' , ';
    }
    return r;
}

function getPoints(geo: BufferGeometry): Vector3[] {
    if (geo.index) {
        geo = geo.toNonIndexed();
    }
    const attr = geo.getAttribute('position').array;
    if (attr.length % 3 != 0) {
        throw new Error(`Strange position length: ${attr.length}`);
    }
    const unique = new Set<string>();
    const result: Vector3[] = [];
    for (let i = 0; i < attr.length / 3; i++) {
        const off = i * 3;
        const v0 = attr[off * 3];
        const v1 = attr[off * 3 + 1];
        const v2 = attr[off * 3 + 2];
        const key = `${v0};${v1};${v2}`;
        if (unique.has(key)) {
            continue;
        }
        unique.add(key);
        result.push(new Vector3(v0, v1, v2));
    }
    return result;
}
