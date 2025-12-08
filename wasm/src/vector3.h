#pragma once

#include <functional>

#include "common.h"

struct Vector3 {
    float x;
    float y;
    float z;

    Vector3 operator-(const Vector3& other) const {
        return Vector3{x - other.x, y - other.y, z - other.z};
    }

    Vector3 cross(const Vector3& other) const {
        return Vector3{y * other.z - z * other.y, z * other.x - x * other.z, x * other.y - y * other.x};
    }

    float dot(const Vector3& other) const {
        return x * other.x + y * other.y + z * other.z;
    }

    bool operator==(const Vector3& other) const {
        return (x == other.x) && (y == other.y) && (z == other.z);
    }
};

template <>
struct std::hash<Vector3> {
    size_t operator()(const Vector3& v) const {
        return hashCombine(v.x, v.y, v.z);
    }
};
