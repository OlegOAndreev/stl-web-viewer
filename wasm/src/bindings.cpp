#include <emscripten/bind.h>
#include <emscripten/val.h>

#include "not-atan.h"
// #include "split-geometry.h"

// // Helper function to convert std::vector<std::vector<float>> to JavaScript array
// val convertToJSArray(const std::vector<std::vector<float>>& parts) {
//     val result = val::array();
//     for (size_t i = 0; i < parts.size(); i++) {
//         val partArray = val::array();
//         for (size_t j = 0; j < parts[i].size(); j++) {
//             partArray.set(j, parts[i][j]);
//         }
//         result.set(i, partArray);
//     }
//     return result;
// }

// // Wrapper function that returns a JavaScript-friendly type
// val splitDisjointGeometryWrapper(uintptr_t posPtr, size_t n) {
//     float* pos = reinterpret_cast<float*>(posPtr);
//     std::vector<std::vector<float>> result = splitDisjointGeometry(pos, n);
//     return convertToJSArray(result);
// }

EMSCRIPTEN_BINDINGS(mainModule) {
    emscripten::function("notAtan2", &notAtan2);
    // emscripten::function("splitDisjointGeometry", &splitDisjointGeometryWrapper);
}
