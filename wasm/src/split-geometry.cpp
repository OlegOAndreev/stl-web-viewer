#include <emscripten/emscripten.h>

#include <cmath>
#include <cstdint>
#include <cstring>
#include <unordered_map>
#include <vector>

#include "common.h"
#include "not-atan.h"
#include "vector3.h"

struct Triangle {
    size_t triIdx;
    Vector3 triNormal;
};

struct Edge {
    Vector3 v1;
    Vector3 v2;

    bool operator==(const Edge& other) const {
        return (v1 == other.v1) && (v2 == other.v2);
    }
};

template <>
struct std::hash<Edge> {
    size_t operator()(const Edge& e) const {
        return hashCombine(e.v1, e.v2);
    }
};

// Find the next triangle to visit after triangle v1-v2-v3. All tris in tris share the edge v2-v1. The
// algorithm is quadratic and not optimized (the optimized version would sort triangles by angle and do a binary
// search). We assume that shared edge case is not too common (<100 vectors per edge).
size_t findNextTriangleWithSharedEdge(const Vector3& v1, const Vector3& v2, const Vector3& v3,
                                      const std::vector<Triangle>& tris) {
    // The fast case: only one triangle has the matching edge.
    if (tris.size() == 1) {
        return tris[0].triIdx;
    }
    // Normal of triangle v1-v2-v3
    Vector3 curTriNormal = (v2 - v1).cross(v3 - v1);
    Vector3 edgeVec = v2 - v1;

    // Compare the angles between curTriNormal and normals of candidate triangles in range [-PI, PI) and find the
    // triangle with largest angle. See
    // https://stackoverflow.com/questions/5188561/signed-angle-between-two-3d-vectors-with-same-origin-within-the-same-plane
    // for the derivation of tangent formula.
    //
    // NOTE: We do not calculate the angles themselves and compare only cotangents based on the equality x < y <=>
    // cotan(x) > cotan(y) for x, y in [0, PI]. We then need to correctly process the cases when angles are outside of
    // that range (basically what Math.atan2 does).
    size_t bestTriIdx = SIZE_MAX;
    float bestAngle = -INFINITY;
    const float epsilon = 0.001f;

    for (const Triangle& tri : tris) {
        // dot = curNormal * tris[i].normal, cross = (curNormal x tris[i].normal) * edgeVec, cotan = dot / cross
        float dot = curTriNormal.dot(tri.triNormal);
        float cross = curTriNormal.cross(tri.triNormal).dot(edgeVec);
        float angle = notAtan2(cross, dot);
        // If the angle is too close to PI, the triangles are almost parallel, consider them to be parallel and
        // belonging to different bodies.
        if (angle > M_PI - epsilon) {
            angle = -M_PI;
        }
        if (angle > bestAngle) {
            bestAngle = angle;
            bestTriIdx = tri.triIdx;
        }
    }

    return bestTriIdx;
}

// Splits a triangle mesh into multiple meshes, where each mesh represents a disjoint body. Assumes T-junctions are
// accidental and the normals of each body are outward-facing. pos must contain interleaved array of x, y, z coordinates
// of vertices, 3 vertices (9 floats) per triangle.
std::vector<std::vector<float>> splitDisjointGeometry(const std::vector<float>& pos) {
    if (pos.size() % 9 != 0) {
        return {};
    }
    size_t triCount = pos.size() / 9;
    if (triCount == 0) {
        return {};
    }

    // We find triangle neighbors by shared edges: if the triangle 2 has the same edge as triangle 1, but oriented the
    // other way, it potentially belongs to the same part as triangle 1 (e.g. if triangle 1 is v1-v2-v3, triangle 2 must
    // be one of v2-v1-v4, v3-v2-v4 or v1-v3-v4).
    //
    // The tricky case is when the edge is shared by more than two triangles, e.g. there are two cubes of the same size
    // touching by the edge. In this case we assume that triangle normals point outside of the body. Then we can find
    // the nearest candidate triangle based on angle between triangle normals.

    // Maps edge key -> list of triangles with that edge.
    std::unordered_map<Edge, std::vector<Triangle>> edgeMap;
    // Each triangle contributes 3 edges, most are not shared.
    edgeMap.reserve(3 * triCount);

    for (size_t triIdx = 0; triIdx < triCount; triIdx++) {
        size_t off = triIdx * 9;
        Vector3 v1{pos[off], pos[off + 1], pos[off + 2]};
        Vector3 v2{pos[off + 3], pos[off + 4], pos[off + 5]};
        Vector3 v3{pos[off + 6], pos[off + 7], pos[off + 8]};
        Vector3 triNormal = (v2 - v1).cross(v3 - v1);

        edgeMap[{v1, v2}].push_back({triIdx, triNormal});
        edgeMap[{v2, v3}].push_back({triIdx, triNormal});
        edgeMap[{v3, v1}].push_back({triIdx, triNormal});
    }

    // Flag for each triangle if it has been visited.
    std::vector<bool> visited(triCount, false);
    // We do a DFS on all triangles.
    std::vector<size_t> stack;

    auto visitEdge = [&](const Vector3& v1, const Vector3& v2, const Vector3& v3) {
        // We need the neighbor to have a reverse edge
        auto it = edgeMap.find({v2, v1});
        if (it == edgeMap.end()) {
            return;
        }
        size_t nextTriIdx = findNextTriangleWithSharedEdge(v1, v2, v3, it->second);
        if (!visited[nextTriIdx]) {
            stack.push_back(nextTriIdx);
            visited[nextTriIdx] = true;
        }
    };

    // A part is a list of triangle indices.
    std::vector<size_t> part;
    std::vector<std::vector<float>> result;

    for (size_t triIdx = 0; triIdx < triCount; triIdx++) {
        if (visited[triIdx]) {
            continue;
        }
        stack.push_back(triIdx);
        visited[triIdx] = true;

        while (!stack.empty()) {
            size_t nextTriIdx = stack.back();
            stack.pop_back();
            part.push_back(nextTriIdx);

            size_t off = nextTriIdx * 9;
            Vector3 v1{pos[off], pos[off + 1], pos[off + 2]};
            Vector3 v2{pos[off + 3], pos[off + 4], pos[off + 5]};
            Vector3 v3{pos[off + 6], pos[off + 7], pos[off + 8]};

            visitEdge(v1, v2, v3);
            visitEdge(v2, v3, v1);
            visitEdge(v3, v1, v2);
        }

        std::vector<float> partPos(part.size() * 9, 0.0f);
        for (size_t i = 0; i < part.size(); i++) {
            size_t to = i * 9;
            size_t from = part[i] * 9;
            memcpy(&partPos[to], &pos[from], sizeof(float) * 9);
        }
        result.push_back(std::move(partPos));
        part.clear();
    }

    return result;
}
