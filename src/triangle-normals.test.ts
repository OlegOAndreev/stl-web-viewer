import { BufferGeometry, Vector3 } from 'three';
import { assert, test } from 'vitest';

import { computeTriangleNormals } from "./triangle-normals";

test('computeTriangleNormals empty test', () => {
    const geo = new BufferGeometry().setFromPoints([]);
    const [outwardGeometry, inwardGeometry] = computeTriangleNormals(geo);
    const outwardPoints = outwardGeometry.getAttribute('position');
    const inwardPoints = inwardGeometry.getAttribute('position');
    assert.equal(outwardPoints.count, 0);
    assert.equal(inwardPoints.count, 0);
})

test('computeTriangleNormals basic test', () => {
    const geo = new BufferGeometry().setFromPoints([
        new Vector3(0, 0, 0),
        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0),

        new Vector3(1, 0, 0),
        new Vector3(1, 1, 0),
        new Vector3(0, 1, 0),

        new Vector3(1, 0, 0),
        new Vector3(0, 1, 0),
        new Vector3(0, 0, 1)
    ]);

    const [outwardGeometry, inwardGeometry] = computeTriangleNormals(geo);
    const outwardPoints = outwardGeometry.getAttribute('position');
    const inwardPoints = inwardGeometry.getAttribute('position');
    assert.equal(outwardPoints.count, 6);
    assert.equal(inwardPoints.count, 6);

    // Check that the first two normals start at plane z = 0 and have const x, y.
    assert.equal(outwardPoints.getZ(0), 0);
    assert.equal(outwardPoints.getZ(2), 0);
    assert.isAtLeast(outwardPoints.getZ(1), 0.01);
    assert.isAtLeast(outwardPoints.getZ(3), 0.01);
    assert.equal(outwardPoints.getX(0), outwardPoints.getX(1));
    assert.equal(outwardPoints.getX(2), outwardPoints.getX(3));
    assert.equal(outwardPoints.getY(0), outwardPoints.getY(1));
    assert.equal(outwardPoints.getY(2), outwardPoints.getY(3));
    // The last normal should have a vector (a, a, a)
    assert.closeTo(outwardPoints.getX(4), outwardPoints.getY(4), 1e-7);
    assert.closeTo(outwardPoints.getX(4), outwardPoints.getZ(4), 1e-7);
    assert.closeTo(outwardPoints.getX(5), outwardPoints.getY(5), 1e-7);
    assert.closeTo(outwardPoints.getX(5), outwardPoints.getZ(5), 1e-7);
    assert.isAtLeast(outwardPoints.getX(5) - outwardPoints.getX(4), 0.01);

    assert.equal(inwardPoints.getZ(0), 0);
    assert.equal(inwardPoints.getZ(2), 0);
    assert.isAtMost(inwardPoints.getZ(1), -0.01);
    assert.isAtMost(inwardPoints.getZ(3), -0.01);
    assert.equal(inwardPoints.getX(0), inwardPoints.getX(1));
    assert.equal(inwardPoints.getX(2), inwardPoints.getX(3));
    assert.equal(inwardPoints.getY(0), inwardPoints.getY(1));
    assert.equal(inwardPoints.getY(2), inwardPoints.getY(3));
    assert.closeTo(inwardPoints.getX(4), inwardPoints.getY(4), 1e-7);
    assert.closeTo(inwardPoints.getX(4), inwardPoints.getZ(4), 1e-7);
    assert.closeTo(inwardPoints.getX(5), inwardPoints.getY(5), 1e-7);
    assert.closeTo(inwardPoints.getX(5), inwardPoints.getZ(5), 1e-7);
    assert.isAtMost(inwardPoints.getX(5) - inwardPoints.getX(4), -0.01);
});

test('computeTriangleNormals without position', () => {
    const geo = new BufferGeometry();

    assert.throws(() => {
        computeTriangleNormals(geo);
    }, 'Geometry does not have position attribute');
});
