use std::collections::HashMap;
use std::f32::consts::PI;

use wasm_bindgen::prelude::*;

use crate::not_atan::not_atan2;
use crate::vector3::{Edge, Vector3};

#[derive(Clone, Copy, Debug)]
struct TriangleInfo {
    tri_idx: usize,
    tri_normal: Vector3,
}

// Find the next triangle to visit after triangle v1-v2-v3. All tris in tris share the edge v2-v1. The algorithm is
// quadratic and not optimized (the optimized version would sort triangles by angle and do a binary search). We assume
// that shared edge case is not too common (<100 vectors per edge). tris must not be empty.
fn find_next_triangle_with_shared_edge(v1: Vector3, v2: Vector3, v3: Vector3, tris: &[TriangleInfo]) -> usize {
    assert!(!tris.is_empty());

    // The fast case: only one triangle has the matching edge.
    if tris.len() == 1 {
        return tris[0].tri_idx;
    }

    // Normal of triangle v1-v2-v3
    let cur_tri_normal = (v2 - v1).cross(v3 - v1);
    let edge_vec = v2 - v1;

    // Compare the angles between curTriNormal and normals of candidate triangles in range [-PI, PI) and find the
    // triangle with largest angle. See
    // https://stackoverflow.com/questions/5188561/signed-angle-between-two-3d-vectors-with-same-origin-within-the-same-plane
    // for the derivation of tangent formula.
    //
    // NOTE: We do not calculate the angles themselves and compare only cotangents based on the equality x < y <=>
    // cotan(x) > cotan(y) for x, y in [0, PI]. We then need to correctly process the cases when angles are outside of
    // that range (basically what Math.atan2 does).
    let mut best_tri = tris[0];
    let mut best_angle = -f32::INFINITY;

    for tri in tris {
        // dot = curNormal * tri.triNormal, cross = (curNormal x tri.triNormal) * edgeVec, cotan = dot / cross,
        // angle = notAtan2(cross, dot)
        let dot = cur_tri_normal.dot(tri.tri_normal);
        #[rustfmt::skip]
        let cross = cur_tri_normal.cross(tri.tri_normal).dot(edge_vec);
        let mut angle = not_atan2(cross, dot);
        // If the angle is too close to PI, the triangles are almost parallel, consider them to be parallel and
        // belonging to different bodies.
        if angle > PI - 0.001 {
            angle = -PI;
        }
        if angle > best_angle {
            best_angle = angle;
            best_tri = *tri;
        }
    }

    best_tri.tri_idx
}

/// Triangle indices of the disjoint bodies and the number of triangles in each body.
#[wasm_bindgen]
pub struct SplitGeometryResult {
    tri_indices: Vec<u32>,
    part_sizes: Vec<u32>,
}

#[wasm_bindgen]
impl SplitGeometryResult {
    /// Triangle indices of all bodies, concatenated body by body. This is a view into WASM memory, so it has to be read
    /// before the object is freed and before any allocation grows the WASM memory.
    #[wasm_bindgen(getter)]
    pub fn tri_indices(&self) -> js_sys::Uint32Array {
        unsafe { js_sys::Uint32Array::view(&self.tri_indices) }
    }

    /// Number of triangles in each body, see `tri_indices` for the memory lifetime.
    #[wasm_bindgen(getter)]
    pub fn part_sizes(&self) -> js_sys::Uint32Array {
        unsafe { js_sys::Uint32Array::view(&self.part_sizes) }
    }
}

// Splits a triangle mesh into multiple meshes, where each mesh represents a disjoint body. Assumes T-junctions are
// accidental and the normals of each body are outward-facing. `pos` must contain interleaved array of x, y, z
// coordinates of vertices, 3 vertices (9 floats) per triangle. Returns triangle indices of each body; the caller is
// responsible for splitting the attributes of the original mesh using these indices
#[wasm_bindgen]
pub fn split_disjoint_geometry(pos: &[f32]) -> SplitGeometryResult {
    if !pos.len().is_multiple_of(9) {
        return SplitGeometryResult { tri_indices: vec![], part_sizes: vec![] };
    }
    let tri_count = pos.len() / 9;
    if tri_count == 0 {
        return SplitGeometryResult { tri_indices: vec![], part_sizes: vec![] };
    }

    // We find triangle neighbors by shared edges: if the triangle 2 has the same edge as triangle 1, but oriented the
    // other way, it potentially belongs to the same part as triangle 1 (e.g. if triangle 1 is v1-v2-v3, triangle 2 must
    // be one of v2-v1-v4, v3-v2-v4 or v1-v3-v4).
    //
    // The tricky case is when the edge is shared by more than two triangles, e.g. there are two cubes of the same size
    // touching by the edge. In this case we assume that triangle normals point outside of the body. Then we can find
    // the nearest candidate triangle based on angle between triangle normals.

    // Maps edge -> list of triangles with that edge.
    let mut edge_map: HashMap<Edge, Vec<TriangleInfo>> = HashMap::with_capacity(3 * tri_count);

    for tri_idx in 0..tri_count {
        let off = tri_idx * 9;
        let v1 = Vector3::new(pos[off], pos[off + 1], pos[off + 2]);
        let v2 = Vector3::new(pos[off + 3], pos[off + 4], pos[off + 5]);
        let v3 = Vector3::new(pos[off + 6], pos[off + 7], pos[off + 8]);
        let tri_normal = (v2 - v1).cross(v3 - v1);

        let tri_info = TriangleInfo { tri_idx, tri_normal };
        #[rustfmt::skip]
        edge_map.entry(Edge::new(v1, v2)).or_default().push(tri_info);
        #[rustfmt::skip]
        edge_map.entry(Edge::new(v2, v3)).or_default().push(tri_info);
        #[rustfmt::skip]
        edge_map.entry(Edge::new(v3, v1)).or_default().push(tri_info);
    }

    // Flag for each triangle if it has been visited.
    let mut visited = vec![false; tri_count];
    // We do a DFS on all triangles.
    let mut stack = vec![];

    // A part is a list of triangle indices.
    let mut part = vec![];

    // Helper function to visit an edge and add neighboring triangle to the stack.
    let visit_edge = |stack: &mut Vec<usize>, visited: &mut [bool], v1: Vector3, v2: Vector3, v3: Vector3| {
        // We need the neighbor to have a reverse edge
        let Some(tris) = edge_map.get(&Edge::new(v2, v1)) else {
            return;
        };
        if tris.is_empty() {
            return;
        }
        let next_tri = find_next_triangle_with_shared_edge(v1, v2, v3, tris);
        if !visited[next_tri] {
            stack.push(next_tri);
            visited[next_tri] = true;
        }
    };

    let mut tri_indices = Vec::with_capacity(tri_count);
    let mut part_sizes = vec![];

    for start_tri_idx in 0..tri_count {
        if visited[start_tri_idx] {
            continue;
        }
        assert!(stack.is_empty());
        assert!(part.is_empty());

        stack.push(start_tri_idx);
        visited[start_tri_idx] = true;

        while let Some(next_tri_idx) = stack.pop() {
            part.push(next_tri_idx as u32);

            let off = next_tri_idx * 9;
            let v1 = Vector3::new(pos[off], pos[off + 1], pos[off + 2]);
            let v2 = Vector3::new(pos[off + 3], pos[off + 4], pos[off + 5]);
            let v3 = Vector3::new(pos[off + 6], pos[off + 7], pos[off + 8]);

            // Visit each edge
            visit_edge(&mut stack, &mut visited, v1, v2, v3);
            visit_edge(&mut stack, &mut visited, v2, v3, v1);
            visit_edge(&mut stack, &mut visited, v3, v1, v2);
        }

        // Sort the triangles for better cache utilization in the caller.
        part.sort_unstable();
        part_sizes.push(part.len() as u32);
        tri_indices.append(&mut part);
    }

    SplitGeometryResult { tri_indices, part_sizes }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashSet;

    // Helper function similar to TypeScript's getTris
    fn get_tris_set(pos: &[f32]) -> HashSet<String> {
        if pos.len() % 9 != 0 {
            panic!("Position array length must be multiple of 9");
        }
        let mut result = HashSet::new();
        for i in 0..pos.len() / 9 {
            let off = i * 9;
            let v00 = pos[off];
            let v01 = pos[off + 1];
            let v02 = pos[off + 2];
            let v10 = pos[off + 3];
            let v11 = pos[off + 4];
            let v12 = pos[off + 5];
            let v20 = pos[off + 6];
            let v21 = pos[off + 7];
            let v22 = pos[off + 8];

            // Get canonical representation (minimum of three rotations)
            let key1 = format!("{};{};{}:{};{};{}:{};{};{}", v00, v01, v02, v10, v11, v12, v20, v21, v22);
            let key2 = format!("{};{};{}:{};{};{}:{};{};{}", v10, v11, v12, v20, v21, v22, v00, v01, v02);
            let key3 = format!("{};{};{}:{};{};{}:{};{};{}", v20, v21, v22, v00, v01, v02, v10, v11, v12);
            let canonical = key1.min(key2).min(key3);
            result.insert(canonical);
        }
        result
    }

    // Extracts the triangle indices of each body.
    fn part_indices(result: &SplitGeometryResult) -> Vec<&[u32]> {
        let mut parts = Vec::with_capacity(result.part_sizes.len());
        let mut offset = 0;
        for &size in &result.part_sizes {
            let size = size as usize;
            parts.push(&result.tri_indices[offset..offset + size]);
            offset += size;
        }
        parts
    }

    // Extracts positions of the triangles with the given indices.
    fn part_positions(pos: &[f32], tri_indices: &[u32]) -> Vec<f32> {
        let mut result = Vec::with_capacity(tri_indices.len() * 9);
        for &tri_idx in tri_indices {
            let off = tri_idx as usize * 9;
            result.extend_from_slice(&pos[off..off + 9]);
        }
        result
    }

    // Collects triangles of all bodies to compare them against the original mesh.
    fn reassembled_tris(pos: &[f32], result: &SplitGeometryResult) -> HashSet<String> {
        let mut tris = HashSet::new();
        for part in part_indices(result) {
            tris.extend(get_tris_set(&part_positions(pos, part)));
        }
        tris
    }

    #[test]
    fn test_empty() {
        let result = split_disjoint_geometry(&[]);
        assert_eq!(result.part_sizes.len(), 0);
    }

    #[test]
    fn test_invalid_length() {
        // Not a multiple of 9
        let result = split_disjoint_geometry(&[0.0; 8]);
        assert_eq!(result.part_sizes.len(), 0);
    }

    #[test]
    fn test_single_triangle() {
        // A single triangle
        let pos = [0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0];
        let result = split_disjoint_geometry(&pos);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 1);
        assert_eq!(part_positions(&pos, parts[0]), pos);
    }

    #[test]
    fn test_two_disjoint_triangles() {
        // Two triangles far apart
        let pos = [
            0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, // triangle 1
            10.0, 0.0, 0.0, 11.0, 0.0, 0.0, 10.0, 1.0, 0.0, // triangle 2
        ];
        let result = split_disjoint_geometry(&pos);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 2);
        // Each part should have one triangle
        assert_eq!(parts[0].len(), 1);
        assert_eq!(parts[1].len(), 1);

        // Verify triangle sets match
        assert_eq!(reassembled_tris(&pos, &result), get_tris_set(&pos));
    }

    #[test]
    fn test_two_separate_cubes() {
        // Two cubes far apart (not touching)
        let cube1 = create_cube_geometry();
        let mut cube2 = create_cube_geometry();

        // Translate cube2 far away
        for i in 0..cube2.len() / 3 {
            cube2[i * 3] += 10.0; // Move 10 units in x
        }

        // Merge
        let mut merged = cube1.clone();
        merged.extend_from_slice(&cube2);

        let result = split_disjoint_geometry(&merged);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 2, "Two separate cubes should be 2 parts");

        // Each part should have 12 triangles
        assert_eq!(parts[0].len(), 12);
        assert_eq!(parts[1].len(), 12);
        assert_eq!(reassembled_tris(&merged, &result), get_tris_set(&merged));
    }

    // Helper to create a simple cube geometry (12 triangles, 8 vertices). Returns flat array of 12*9 = 108 floats. All
    // faces have counter-clockwise winding when viewed from outside (outward-facing normals)
    fn create_cube_geometry() -> Vec<f32> {
        // Cube vertices
        let vertices = [
            [-0.5, -0.5, -0.5], // 0: left-bottom-back
            [0.5, -0.5, -0.5],  // 1: right-bottom-back
            [0.5, 0.5, -0.5],   // 2: right-top-back
            [-0.5, 0.5, -0.5],  // 3: left-top-back
            [-0.5, -0.5, 0.5],  // 4: left-bottom-front
            [0.5, -0.5, 0.5],   // 5: right-bottom-front
            [0.5, 0.5, 0.5],    // 6: right-top-front
            [-0.5, 0.5, 0.5],   // 7: left-top-front
        ];

        // Cube faces (12 triangles) - all with consistent CCW winding (outward normals)
        #[rustfmt::skip]
        let faces = [
            [0, 2, 1], [0, 3, 2], // back face (normal -Z)
            [4, 5, 6], [4, 6, 7], // front face (normal +Z)
            [1, 2, 6], [1, 6, 5], // right face (normal +X)
            [0, 7, 3], [0, 4, 7], // left face (normal -X)
            [3, 6, 2], [3, 7, 6], // top face (normal +Y)
            [0, 1, 5], [0, 5, 4], // bottom face (normal -Y)
        ];

        let mut result = Vec::with_capacity(12 * 9);
        for face in faces {
            for &vi in &face {
                let v = vertices[vi];
                result.extend_from_slice(&v);
            }
        }
        result
    }

    // Helper to create an L-shaped bracket (20 triangles). The cross-section is the counter-clockwise polygon
    // (0,0) -> (2,0) -> (2,1) -> (1,1) -> (1,2) -> (0,2) extruded along z from -0.5 to 0.5. The corner at (1, 1) is
    // reflex, so the edge (1, 1, z) is the concave edge of the bracket. The notch has size 1x1, so a unit cube fits
    // into it exactly.
    // All faces have counter-clockwise winding when viewed from outside (outward-facing normals)
    fn create_l_bracket_geometry() -> Vec<f32> {
        let vertices = [
            [0.0, 0.0, -0.5], // 0
            [2.0, 0.0, -0.5], // 1
            [2.0, 1.0, -0.5], // 2
            [1.0, 1.0, -0.5], // 3: reflex corner of the cross-section
            [1.0, 2.0, -0.5], // 4
            [0.0, 2.0, -0.5], // 5
            [0.0, 0.0, 0.5],  // 6
            [2.0, 0.0, 0.5],  // 7
            [2.0, 1.0, 0.5],  // 8
            [1.0, 1.0, 0.5],  // 9
            [1.0, 2.0, 0.5],  // 10
            [0.0, 2.0, 0.5],  // 11
        ];

        // Faces (20 triangles) - all with consistent CCW winding (outward normals)
        #[rustfmt::skip]
        let faces = [
            [0, 2, 1], [0, 3, 2], [0, 4, 3], [0, 5, 4], // front face (normal -Z)
            [6, 7, 8], [6, 8, 9], [6, 9, 10], [6, 10, 11], // back face (normal +Z)
            [0, 1, 7], [0, 7, 6], // bottom side (normal -Y)
            [1, 2, 8], [1, 8, 7], // right side of the horizontal bar (normal +X)
            [2, 3, 9], [2, 9, 8], // notch bottom side (normal +Y)
            [3, 4, 10], [3, 10, 9], // notch left side (normal +X)
            [4, 5, 11], [4, 11, 10], // top side (normal +Y)
            [5, 0, 6], [5, 6, 11], // left side (normal -X)
        ];

        let mut result = Vec::with_capacity(20 * 9);
        for face in faces {
            for &vi in &face {
                let v = vertices[vi];
                result.extend_from_slice(&v);
            }
        }
        result
    }

    // Translates all vertices of a position array by the given offset.
    fn translate_pos(pos: &mut [f32], offset: [f32; 3]) {
        for v in pos.chunks_exact_mut(3) {
            v[0] += offset[0];
            v[1] += offset[1];
            v[2] += offset[2];
        }
    }

    #[test]
    fn test_cube() {
        // Single cube should remain as one part
        let cube_pos = create_cube_geometry();
        let cube_tris = get_tris_set(&cube_pos);

        let result = split_disjoint_geometry(&cube_pos);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 1, "Single cube should be one part");

        let part_tris = get_tris_set(&part_positions(&cube_pos, parts[0]));
        assert_eq!(part_tris, cube_tris);
    }

    #[test]
    fn test_contacting_cubes() {
        // Two cubes touching at one side
        let cube1 = create_cube_geometry();
        let cube2 = create_cube_geometry();

        // Translate cube2 by 1.0 in x direction
        let mut cube2_translated = Vec::with_capacity(cube2.len());
        for i in 0..cube2.len() / 3 {
            let x = cube2[i * 3] + 1.0;
            let y = cube2[i * 3 + 1];
            let z = cube2[i * 3 + 2];
            cube2_translated.push(x);
            cube2_translated.push(y);
            cube2_translated.push(z);
        }

        // Merge the two cubes
        let mut merged = cube1.clone();
        merged.extend_from_slice(&cube2_translated);

        let cube1_tris = get_tris_set(&cube1);
        let cube2_tris = get_tris_set(&cube2_translated);

        let result = split_disjoint_geometry(&merged);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 2, "Expected 2 parts for contacting cubes, got {}", parts.len());

        // Check that each part matches one of the original cubes
        let part0_tris = get_tris_set(&part_positions(&merged, parts[0]));
        let part1_tris = get_tris_set(&part_positions(&merged, parts[1]));

        // One part should match cube1, the other cube2
        if part0_tris == cube1_tris {
            assert_eq!(part1_tris, cube2_tris);
        } else if part0_tris == cube2_tris {
            assert_eq!(part1_tris, cube1_tris);
        } else {
            panic!("Neither part matches original cubes");
        }
    }

    #[test]
    fn test_edge_touching_cubes() {
        // Two cubes touching along a single edge (no shared faces): cube2 is translated by (1, 1, 0), so the cubes
        // share only the edge (0.5, 0.5, z). That edge has 4 triangles (2 per cube), and the splitter must pick the
        // same-body neighbor by the largest angle between the triangle normals.
        let cube1 = create_cube_geometry();
        let mut cube2 = create_cube_geometry();
        translate_pos(&mut cube2, [1.0, 1.0, 0.0]);

        // Merge the two cubes
        let mut merged = cube1.clone();
        merged.extend_from_slice(&cube2);

        let cube1_tris = get_tris_set(&cube1);
        let cube2_tris = get_tris_set(&cube2);

        let result = split_disjoint_geometry(&merged);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 2, "Expected 2 parts for edge-touching cubes, got {}", parts.len());
        let mut sizes: Vec<usize> = parts.iter().map(|part| part.len()).collect();
        sizes.sort_unstable();
        assert_eq!(sizes, vec![12usize, 12], "Each cube must have 12 triangles");

        // Check that each part matches one of the original cubes
        let part0_tris = get_tris_set(&part_positions(&merged, parts[0]));
        let part1_tris = get_tris_set(&part_positions(&merged, parts[1]));
        if part0_tris == cube1_tris {
            assert_eq!(part1_tris, cube2_tris);
        } else if part0_tris == cube2_tris {
            assert_eq!(part1_tris, cube1_tris);
        } else {
            panic!("Neither part matches original cubes");
        }
    }

    #[test]
    fn test_concave_contact() {
        // A cube sitting in the notch of an L-shaped bracket: the cube touches the two faces of the notch, so the
        // concave (reflex) edge of the bracket is shared by 4 triangles (2 per body). At that edge the fold between
        // the two bracket faces is 270 degrees, which the largest angle heuristic scores as -PI/2, while the cube's
        // antiparallel face across the edge is scored close to PI and clamped to -PI. So the bracket faces must win
        // and the bodies must not be merged.
        let bracket = create_l_bracket_geometry();
        let mut cube = create_cube_geometry();
        translate_pos(&mut cube, [1.5, 1.5, 0.0]);

        // Merge the bracket and the cube
        let mut merged = bracket.clone();
        merged.extend_from_slice(&cube);

        let bracket_tris = get_tris_set(&bracket);
        let cube_tris = get_tris_set(&cube);

        let result = split_disjoint_geometry(&merged);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 2, "Expected 2 parts for the bracket and the notch cube, got {}", parts.len());
        let mut sizes: Vec<usize> = parts.iter().map(|part| part.len()).collect();
        sizes.sort_unstable();
        assert_eq!(sizes, vec![12usize, 20], "The bracket must have 20 triangles and the cube 12");

        // Check that one part matches the bracket and the other the cube
        let part0_tris = get_tris_set(&part_positions(&merged, parts[0]));
        let part1_tris = get_tris_set(&part_positions(&merged, parts[1]));
        if part0_tris == bracket_tris {
            assert_eq!(part1_tris, cube_tris);
        } else if part0_tris == cube_tris {
            assert_eq!(part1_tris, bracket_tris);
        } else {
            panic!("Neither part matches the bracket or the cube");
        }
    }

    #[test]
    fn test_angles() {
        // Two pairs of triangles each forming an angle, all sharing one edge. First angle: two triangles sharing edge
        // (0,0,0)-(1,0,0)
        let angle0 = vec![
            // triangle 1
            0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 0.0, 1.0, // triangle 2
            0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 1.0, 0.1, 0.0,
        ];

        // Second angle: slightly offset
        let angle1 = vec![
            // triangle 1
            0.0, 0.0, 0.0, 2.0, 0.1999, 0.0, 0.0, 0.0, 1.0, // triangle 2
            0.0, 0.0, 0.0, 0.0, 0.0, 1.0, 2.0, -0.2, 0.0,
        ];

        // Merge angles
        let mut merged = angle0.clone();
        merged.extend_from_slice(&angle1);

        let angle0_tris = get_tris_set(&angle0);
        let angle1_tris = get_tris_set(&angle1);

        let result = split_disjoint_geometry(&merged);
        let parts = part_indices(&result);
        assert_eq!(parts.len(), 2);

        let part0_tris = get_tris_set(&part_positions(&merged, parts[0]));
        let part1_tris = get_tris_set(&part_positions(&merged, parts[1]));

        // One part should match angle0, the other angle1
        if part0_tris == angle0_tris {
            assert_eq!(&part1_tris, &angle1_tris);
        } else if part0_tris == angle1_tris {
            assert_eq!(&part1_tris, &angle0_tris);
        } else {
            panic!("Neither part matches original angles");
        }
    }

    #[test]
    fn test_signed_zero_edges() {
        // The triangles share the edge (0,0,0)-(1,0,0), but the second triangle stores the zero coordinates as -0.0.
        // Since -0.0 == 0.0, the shared edge must still be found and both triangles must belong to the same body.
        let pos = [
            // triangle 0
            0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0, 0.0, // triangle 1, sharing the reversed edge (1,0,0)-(0,0,0)
            1.0, 0.0, 0.0, -0.0, -0.0, -0.0, 0.0, -1.0, 0.0,
        ];
        let result = split_disjoint_geometry(&pos);
        assert_eq!(result.part_sizes.len(), 1, "Signed zeros must not split the body");
    }

    #[test]
    fn test_stress() {
        // Create many triangles from points on a cylinder-like shape

        // Generate some points on a circle
        let mut points = Vec::new();
        let num_points = 8; // Reduced for test speed
        for i in 0..num_points {
            let angle = 2.0 * std::f32::consts::PI * i as f32 / num_points as f32;
            points.push(Vector3::new(angle.cos(), angle.sin(), 0.0));
            points.push(Vector3::new(angle.cos(), angle.sin(), 1.0));
        }

        // Create all possible triangles from these points
        let mut geo_points = Vec::new();
        for i in 0..points.len() {
            for j in 0..points.len() {
                if i == j {
                    continue;
                }
                for k in 0..points.len() {
                    if i == k || j == k {
                        continue;
                    }
                    geo_points.push(points[i]);
                    geo_points.push(points[j]);
                    geo_points.push(points[k]);
                }
            }
        }

        // Convert to flat array
        let mut pos = Vec::with_capacity(geo_points.len() * 3);
        for v in geo_points {
            pos.push(v.x);
            pos.push(v.y);
            pos.push(v.z);
        }

        let num_geo_tris = pos.len() / 9;

        // Check that we do not hang and have some basic sanity checks
        let result = split_disjoint_geometry(&pos);
        let parts = part_indices(&result);
        assert!(parts.len() > 1);
        assert!(parts.len() < num_geo_tris);

        // Every triangle must be in exactly one part.
        assert_eq!(parts.iter().map(|part| part.len()).sum::<usize>(), num_geo_tris);

        // Verify all triangles are accounted for
        assert_eq!(reassembled_tris(&pos, &result), get_tris_set(&pos));
    }
}
