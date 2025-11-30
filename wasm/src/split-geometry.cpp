#include <cmath>
#include <cstring>
#include <queue>
#include <string>
#include <unordered_map>
#include <vector>

#include "not-atan.h"

struct Vector3 {
    float x, y, z;

    Vector3(float x, float y, float z) : x(x), y(y), z(z) {
    }

    Vector3 operator-(const Vector3& other) const {
        return Vector3(x - other.x, y - other.y, z - other.z);
    }

    Vector3 cross(const Vector3& other) const {
        return Vector3(y * other.z - z * other.y, z * other.x - x * other.z, x * other.y - y * other.x);
    }

    float dot(const Vector3& other) const {
        return x * other.x + y * other.y + z * other.z;
    }

    float length() const {
        return std::sqrt(x * x + y * y + z * z);
    }
};

struct Triangle {
    int triIdx;
    Vector3 normal;
};

std::string getEdgeKey(const Vector3& v1, const Vector3& v2) {
    return std::to_string(v1.x) + ";" + std::to_string(v1.y) + ";" + std::to_string(v1.z) + ":" + std::to_string(v2.x) +
           ";" + std::to_string(v2.y) + ";" + std::to_string(v2.z);
}

void addToEdgeMap(std::unordered_map<std::string, std::vector<Triangle>>& edgeMap, const Vector3& v1, const Vector3& v2,
                  const Vector3& v3, int triIdx) {
    std::string edge = getEdgeKey(v1, v2);
    Vector3 normal = (v2 - v1).cross(v3 - v1);
    edgeMap[edge].push_back({triIdx, normal});
}

int findNextTriangle(const Vector3& v1, const Vector3& v2, const Vector3& v3, const std::vector<Triangle>& tris) {
    Vector3 curNormal = (v2 - v1).cross(v3 - v1);
    Vector3 edgeVec = v2 - v1;

    int bestTriIdx = -1;
    float bestAngle = -INFINITY;
    float epsilon = 1e-3f * edgeVec.length();

    for (size_t i = 0; i < tris.size(); i++) {
        float dot = curNormal.dot(tris[i].normal);
        Vector3 cross = curNormal.cross(tris[i].normal);
        float crossDot = cross.dot(edgeVec);
        float angle = notAtan2(crossDot, dot);

        if (angle > M_PI - epsilon) {
            angle = -M_PI;
        }

        if (angle > bestAngle) {
            bestAngle = angle;
            bestTriIdx = tris[i].triIdx;
        }
    }

    return bestTriIdx;
}

// Splits geometry into disjoint parts based on triangle connectivity, the input must be an array of vertex positions
// (x1, y1, z1, x2, y2, z2, x3, y3, z3, ...). The return contains the array of triangle vertex positions for each
// disjoint part.
std::vector<std::vector<float>> splitDisjointGeometry(const std::vector<float>& pos) {
    if (pos.size() % 9 != 0) {
        return {};
    }
    size_t triCount = pos.size() / 9;
    if (triCount == 0) {
        return {};
    }

    std::unordered_map<std::string, std::vector<Triangle>> edgeMap;

    for (size_t triIdx = 0; triIdx < triCount; triIdx++) {
        size_t off = triIdx * 9;
        Vector3 v1(pos[off], pos[off + 1], pos[off + 2]);
        Vector3 v2(pos[off + 3], pos[off + 4], pos[off + 5]);
        Vector3 v3(pos[off + 6], pos[off + 7], pos[off + 8]);

        addToEdgeMap(edgeMap, v1, v2, v3, triIdx);
        addToEdgeMap(edgeMap, v2, v3, v1, triIdx);
        addToEdgeMap(edgeMap, v3, v1, v2, triIdx);
    }

    // BFS to find connected components
    std::vector<bool> visited(triCount, false);
    std::vector<std::vector<int>> parts;
    std::queue<int> queue;

    auto visitEdge = [&](const Vector3& v1, const Vector3& v2, const Vector3& v3) {
        std::string edgeKey = getEdgeKey(v2, v1);
        auto it = edgeMap.find(edgeKey);
        if (it == edgeMap.end()) {
            return;
        }

        const auto& tris = it->second;
        int nextTriIdx = (tris.size() == 1) ? tris[0].triIdx : findNextTriangle(v1, v2, v3, tris);

        if (nextTriIdx >= 0 && !visited[nextTriIdx]) {
            visited[nextTriIdx] = true;
            queue.push(nextTriIdx);
        }
    };

    for (size_t triIdx = 0; triIdx < triCount; triIdx++) {
        if (visited[triIdx]) {
            continue;
        }

        std::vector<int> nextPart;
        queue.push(triIdx);
        visited[triIdx] = true;

        while (!queue.empty()) {
            int currentTriIdx = queue.front();
            queue.pop();
            nextPart.push_back(currentTriIdx);

            size_t off = currentTriIdx * 9;
            Vector3 v1(pos[off], pos[off + 1], pos[off + 2]);
            Vector3 v2(pos[off + 3], pos[off + 4], pos[off + 5]);
            Vector3 v3(pos[off + 6], pos[off + 7], pos[off + 8]);

            visitEdge(v1, v2, v3);
            visitEdge(v2, v3, v1);
            visitEdge(v3, v1, v2);
        }

        parts.push_back(nextPart);
    }

    std::vector<std::vector<float>> result;

    for (const auto& part : parts) {
        std::vector<float> partData;
        partData.reserve(part.size() * 9);

        for (int triIdx : part) {
            size_t off = triIdx * 9;
            for (size_t i = 0; i < 9; i++) {
                partData.push_back(pos[off + i]);
            }
        }

        result.push_back(partData);
    }

    return result;
}
