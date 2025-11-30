cmake_minimum_required(VERSION 3.16)
project(main-wasm-module)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

if(CMAKE_BUILD_TYPE STREQUAL "Debug")
    add_compile_options(-fsanitize=address)
    add_link_options(-fsanitize=address)
endif()

if(EMSCRIPTEN)
    add_executable(main-wasm-module
        src/bindings.cpp
        src/not-atan.cpp
        src/split-geometry.cpp
    )
    target_link_options(main-wasm-module PRIVATE
        -lembind
        -sMODULARIZE
        -sENVIRONMENT=[web,webview,worker]
        -sEXPORT_ES6
        -sEXPORT_NAME='createMainModule'
        -sEXPORTED_FUNCTIONS=[_malloc,_free]
        --emit-tsd main-wasm-module.d.ts
    )
else()
    message(FATAL_ERROR "This project must be built with Emscripten. Please use 'emcmake cmake' instead of 'cmake'.")
endif()
