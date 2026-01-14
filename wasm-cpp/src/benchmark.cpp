#include <emscripten/bind.h>
#include <emscripten/emscripten.h>
#include <emscripten/heap.h>
#include <emscripten/val.h>
#include <emscripten/wire.h>

#include <cmath>
#include <cstdio>
#include <type_traits>

#include "not-atan.h"

extern "C" EMSCRIPTEN_KEEPALIVE float stdAtan2(float y, float x) {
    return atan2(y, x);
}

template <typename T>
struct PodArray {
    static_assert(std::is_standard_layout<T>::value && std::is_trivially_copyable<T>::value, "T is not a POD");

    T* data;
    size_t size;

    PodArray(size_t n) : data((T*)malloc(sizeof(T) * n)), size(n) {
    }

    // Make the deletions explicit, do not rely on destructors.
    void freeData() {
        free(data);
    }

    T& operator[](size_t i) {
        if (i >= size) {
            __builtin_trap();
        }
        return data[i];
    }

    const T& operator[](size_t i) const {
        if (i >= size) {
            __builtin_trap();
        }
        return data[i];
    }

    // Make this property read-only. Embind does not play nicely with raw pointers, wrap everything in uintptr_t.
    uintptr_t getDataPtr() const {
        return reinterpret_cast<uintptr_t>(data);
    }

    // Make this property read-only
    size_t getSize() const {
        return size;
    }
};

#pragma GCC diagnostic push
#pragma GCC diagnostic ignored "-Wreturn-type-c-linkage"
extern "C" EMSCRIPTEN_KEEPALIVE PodArray<float> tripleRawPtr(const float* input, size_t size) {
    PodArray<float> result(size);
    for (size_t i = 0; i < size; i++) {
        result[i] = input[i] * 3;
    }
    return result;
}
#pragma GCC diagnostic pop

PodArray<float> tripleRawIntPtr(uintptr_t inputPtr, size_t size) {
    const float* input = (const float*)inputPtr;
    PodArray<float> result(size);
    for (size_t i = 0; i < size; i++) {
        result[i] = input[i] * 3;
    }
    return result;
}

emscripten::val tripleMemoryView(const emscripten::val& input) {
    std::vector<float> inputVec = emscripten::convertJSArrayToNumberVector<float>(input);
    PodArray<float> result(inputVec.size());
    for (size_t i = 0; i < inputVec.size(); i++) {
        result[i] = inputVec[i] * 3;
    }
    return emscripten::val(emscripten::typed_memory_view(result.size, result.data));
}

std::string getBuildSettings() {
    long initialMemory = emscripten_get_compiler_setting("INITIAL_MEMORY");
    long allowMemoryGrowth = emscripten_get_compiler_setting("ALLOW_MEMORY_GROWTH");
    const char* malloc = (const char*)emscripten_get_compiler_setting("MALLOC");
#if defined(__EMSCRIPTEN_PTHREADS__)
    bool pthreads_enabled = true;
#else
    bool pthreads_enabled = false;
#endif
#if defined(__OPTIMIZE__)
    bool optimized = true;
#else
    bool optimized = false;
#endif
    char buffer[1000];
    sprintf(buffer,
            "Initial memory = %ld, current heap: %ld, max heap: %ld, allow memory growth = %ld, malloc = %s, with "
            "pthreads = %d, optimized = %d",
            initialMemory, (long)emscripten_get_heap_size(), (long)emscripten_get_heap_max, allowMemoryGrowth, malloc,
            (int)pthreads_enabled, (int)optimized);
    return buffer;
}


extern "C" EMSCRIPTEN_KEEPALIVE unsigned getHeapSize() {
    return emscripten_get_heap_size();
}

extern "C" EMSCRIPTEN_KEEPALIVE unsigned getMaxHeapSize() {
    return emscripten_get_heap_max();
}

EMSCRIPTEN_BINDINGS(benchmark) {
    emscripten::class_<PodArray<float>>("Float32PodArray")
        .constructor<size_t>()
        .function("freeData", &PodArray<float>::freeData)
        .property("dataPtr", &PodArray<float>::getDataPtr)
        .property("size", &PodArray<float>::getSize);
    emscripten::function("embindNotAtan2", &notAtan2);
    emscripten::function("embindTripleRawPtr", &tripleRawIntPtr);
    emscripten::function("embindTriple", &tripleMemoryView);
    emscripten::function("getBuildSettings", &getBuildSettings);
}
