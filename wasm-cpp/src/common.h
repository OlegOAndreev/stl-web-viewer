#pragma once

#include <functional>

#if defined(__clang__) || defined(__GNUC__)
#define FORCE_INLINE __attribute__((always_inline)) inline
#define NO_INLINE __attribute__((noinline))
#else
#error Only Clang and GCC are supported
#endif

// Combines the number of hashable arguments into a single hash.
template <class... Args>
FORCE_INLINE size_t hashCombine(Args... args) {
    // Formula taken from https://stackoverflow.com/questions/7222143/unordered-map-hash-function-c
    size_t h = 0;
    ((h ^= std::hash<Args>{}(args) + 0x9e3779b9 + (h << 6) + (h >> 2)), ...);
    return h;
}
