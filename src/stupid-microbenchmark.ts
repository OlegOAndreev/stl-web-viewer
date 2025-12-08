import type { MainModule } from "../wasm/build/main-wasm-module";
import { notAtan2 } from "./not-atan";

// This is the stupidest micro-benchmark, but still useful for getting an idea on how much the function call costs.
export function stupidMicroBenchmarkSimple(module: MainModule): string {
    console.log('Starting stupidMicroBenchmarkSimple');
    const totalStartTime = performance.now();
    let result = getResultPrologue(module);

    const numValues = 25000000;
    const numTries = 3;

    const typedX = new Float32Array(numValues);
    const typedY = new Float32Array(numValues);
    for (let i = 0; i < numValues; i++) {
        typedX[i] = Math.random();
        typedY[i] = Math.random();
    }
    const untypedX = [];
    const untypedY = [];
    for (let i = 0; i < numValues; i++) {
        untypedX.push(Math.random());
        untypedY.push(Math.random());
    }

    let _unused = 0;
    const typedArrayMathAtan2 = [];
    const typedArrayNotAtan2 = [];
    const typedArrayWasmStdAtan2 = [];
    const typedArrayWasmNotAtan2 = [];
    const typedArrayWasmEmbindNotAtan2 = [];
    const arrayMathAtan2 = [];
    const arrayNotAtan2 = [];
    const arrayWasmStdAtan2 = [];
    const arrayWasmNotAtan2 = [];
    const arrayWasmEmbindNotAtan2 = [];
    for (let i = 0; i < numTries; i++) {
        let startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += Math.atan2(typedY[j], typedX[j]);
        }
        typedArrayMathAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += notAtan2(typedY[j], typedX[j]);
        }
        typedArrayNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module._stdAtan2(typedY[j], typedX[j]);
        }
        typedArrayWasmStdAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module._notAtan2(typedY[j], typedX[j]);
        }
        typedArrayWasmNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module.embindNotAtan2(typedY[j], typedX[j]);
        }
        typedArrayWasmEmbindNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += Math.atan2(untypedY[j], untypedX[j]);
        }
        arrayMathAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += notAtan2(untypedY[j], untypedX[j]);
        }
        arrayNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module._stdAtan2(untypedY[j], untypedX[j]);
        }
        arrayWasmStdAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module._notAtan2(untypedY[j], untypedX[j]);
        }
        arrayWasmNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module.embindNotAtan2(untypedY[j], untypedX[j]);
        }
        arrayWasmEmbindNotAtan2.push((performance.now() - startTime).toFixed(0));
    }
    result += `TypedArray Math.atan2: ${typedArrayMathAtan2}ms\n`;
    result += `TypedArray notAtan2: ${typedArrayNotAtan2}ms\n`;
    result += `TypedArray WASM std::atan2: ${typedArrayWasmStdAtan2}ms\n`;
    result += `TypedArray WASM notAtan2: ${typedArrayWasmNotAtan2}ms\n`;
    result += `TypedArray WASM embind notAtan2: ${typedArrayWasmEmbindNotAtan2}ms\n`;
    result += `Array Math.atan2: ${arrayMathAtan2}ms\n`;
    result += `Array notAtan2: ${arrayNotAtan2}ms\n`;
    result += `Array WASM std::atan2: ${arrayWasmStdAtan2}ms\n`;
    result += `Array WASM notAtan2: ${arrayWasmNotAtan2}ms\n`;
    result += `Array WASM embind notAtan2: ${arrayWasmEmbindNotAtan2}ms\n`;

    console.log(`Finished stupidMicroBenchmarkSimple in ${performance.now() - totalStartTime}ms`)
    return result;
}

// Memory for PodArray return values: data + size. We assume the wasm module is 32-bit.
let resultPodArrayPtr: number;

function tripleJs(n: number) {
    const inputArray = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        inputArray[i] = 123456.7 + i;
    }
    const outputArray = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        outputArray[i] = 3 * inputArray[i];
    }
}

function tripleUntypedJs(n: number) {
    const inputArray = new Array(n);
    for (let i = 0; i < n; i++) {
        inputArray[i] = 123456.7 + i;
    }
    const outputArray = new Array(n);
    for (let i = 0; i < n; i++) {
        outputArray[i] = 3 * inputArray[i];
    }
}

// Allocate memory with malloc, directly write into it, call a function, then read the results from the wasm memory.
function tripleRawPtrDirect(module: MainModule, n: number) {
    if (resultPodArrayPtr === undefined) {
        resultPodArrayPtr = module._malloc(8);
    }
    const base = 123.4;
    const inputPtr = module._malloc(n * 4);
    // This is an optimization for at least some cases in Chrome and also easier to work with.
    const inputArray = new Float32Array(module.HEAPF32.buffer, inputPtr, n);
    for (let i = 0; i < n; i++) {
        inputArray[i] = base + i;
    }
    module._tripleRawPtr(resultPodArrayPtr, inputPtr, n);
    const resultDataPtr = module.HEAPU32[resultPodArrayPtr / 4];
    const resultSize = module.HEAPU32[resultPodArrayPtr / 4 + 1];
    const lastResult = module.HEAPF32[resultDataPtr / 4 + resultSize - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
    module._free(resultDataPtr);
    module._free(inputPtr);
}

// Create a Float32Array, allocate memory with malloc, copy array into memory, call a function, then read the results
// from the wasm memory.
function tripleRawPtrCopy(module: MainModule, n: number) {
    if (resultPodArrayPtr === undefined) {
        resultPodArrayPtr = module._malloc(8);
    }
    const base = 567.8;
    const inputArray = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        inputArray[i] = base + i;
    }
    const inputPtr = module._malloc(n * 4);
    module.HEAPF32.set(inputArray, inputPtr / 4);
    module._tripleRawPtr(resultPodArrayPtr, inputPtr, n);
    const resultDataPtr = module.HEAPU32[resultPodArrayPtr / 4];
    const resultSize = module.HEAPU32[resultPodArrayPtr / 4 + 1];
    const lastResult = module.HEAPF32[resultDataPtr / 4 + resultSize - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
    module._free(resultDataPtr);
    module._free(inputPtr);
}

// // Create a Float32Array, allocate memory with malloc, copy array into memory, call a function, then read the results
// // from the wasm memory.
// function tripleEmbindRawPtrCopy(module: MainModule, n: number) {
//     if (resultPodArrayPtr === undefined) {
//         resultPodArrayPtr = module._malloc(8);
//     }
//     const base = 5678.9;
//     const inputArray = new Float32Array(n);
//     for (let i = 0; i < n; i++) {
//         inputArray[i] = base + i;
//     }
//     const input = new module.Float32PodArray(n);
//     module.HEAPF32.set(inputArray, input.dataPtr / 4);
//     const result = module.embindTripleRawPtr(input.dataPtr, input.size);
//     const lastResult = module.HEAPF32[result.dataPtr / 4 + result.size - 1];
//     const resultDiff = lastResult - 3 * (base + n - 1);
//     // Account for difference between float and double.
//     if (Math.abs(resultDiff) > 1e-5 * n) {
//         throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
//     }
//     result.freeData();
//     input.freeData();
// }

// Create a Float32Array, call an embind function, then read the results from the wasm memory.
function tripleEmbindCopy(module: MainModule, n: number) {
    const base = 345.6;
    const inputArray = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        inputArray[i] = base + i;
    }
    const result = module.embindTriple(inputArray);
    const lastResult = result[result.length - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
    module._free(result.byteOffset);
}

// This is the micro-benchmark measures the costs of passing Float32Array.
export function stupidMicroBenchmarkArrays(module: MainModule): string {
    console.log('Starting stupidMicroBenchmarkArrays');
    const totalStartTime = performance.now();
    let result = getResultPrologue(module);

    const totalData = 100000000;
    const numTries = 3;

    const js100: string[] = [];
    const jsUntyped100: string[] = [];
    const rawPtrDirect100: string[] = [];
    const rawPtrCopy100: string[] = [];
    // const embindRawPtrCopy100: string[] = [];
    const embindCopy100: string[] = [];
    const js1000: string[] = [];
    const jsUntyped1000: string[] = [];
    const rawPtrDirect1000: string[] = [];
    const rawPtrCopy1000: string[] = [];
    // const embindRawPtrCopy1000: string[] = [];
    const embindCopy1000: string[] = [];
    for (let i = 0; i < numTries; i++) {
        console.log(`Heap size ${module._getHeapSize()}, heap max: ${module._getMaxHeapSize()}, buffer: `, module.HEAPF32.buffer);
        let startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleJs(100);
        }
        js100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleUntypedJs(100);
        }
        jsUntyped100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleRawPtrDirect(module, 100);
        }
        rawPtrDirect100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleRawPtrCopy(module, 100);
        }
        rawPtrCopy100.push((performance.now() - startTime).toFixed(0));

        // // startTime = performance.now();
        // // for (let j = 0; j < totalData / 100; j++) {
        // //     tripleEmbindRawPtrCopy(module, 100);
        // // }
        // // embindRawPtrCopy100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleEmbindCopy(module, 100);
        }
        embindCopy100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 1000; j++) {
            tripleJs(1000);
        }
        js1000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 1000; j++) {
            tripleUntypedJs(1000);
        }
        jsUntyped1000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 1000; j++) {
            tripleRawPtrDirect(module, 1000);
        }
        rawPtrDirect1000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 1000; j++) {
            tripleRawPtrCopy(module, 1000);
        }
        rawPtrCopy1000.push((performance.now() - startTime).toFixed(0));

        // startTime = performance.now();
        // for (let j = 0; j < totalData / 1000; j++) {
        //     tripleEmbindRawPtrCopy(module, 1000);
        // }
        // embindRawPtrCopy1000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 1000; j++) {
            tripleEmbindCopy(module, 1000);
        }
        embindCopy1000.push((performance.now() - startTime).toFixed(0));
    }
    result += `JS(100): ${js100}ms (per ${totalData / 100} calls)\n`;
    result += `JS untyped(100): ${jsUntyped100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleRawPtrDirect(100): ${rawPtrDirect100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleRawPtrCopy(100): ${rawPtrCopy100}ms (per ${totalData / 100} calls)\n`;
    // result += `tripleEmbindRawPtrCopy(100): ${embindRawPtrCopy100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleEmbindCopy(100): ${embindCopy100}ms (per ${totalData / 100} calls)\n`;
    result += `JS(1000): ${js1000}ms (per ${totalData / 1000} calls)\n`;
    result += `JS untyped(1000): ${jsUntyped1000}ms (per ${totalData / 1000} calls)\n`;
    result += `tripleRawPtrDirect(1000): ${rawPtrDirect1000}ms (per ${totalData / 1000} calls)\n`;
    result += `tripleRawPtrCopy(1000): ${rawPtrCopy1000}ms (per ${totalData / 1000} calls)\n`;
    // result += `tripleEmbindRawPtrCopy(1000): ${embindRawPtrCopy1000}ms (per ${totalData / 1000} calls)\n`;
    result += `tripleEmbindCopy(1000): ${embindCopy1000}ms (per ${totalData / 1000} calls)\n`;

    console.log(`Finished stupidMicroBenchmarkArrays in ${performance.now() - totalStartTime}ms`)
    return result;
}

function getResultPrologue(module: MainModule): string {
    let result = navigator.userAgent + '\nEmscripten: ' + module.getBuildSettings() + '\n';
    if (!window.crossOriginIsolated) {
        result += 'WARNING: Window is not cross-origin isolated, performance.now() precision is low\n\n';
    } else {
        result += 'Window is cross-origin isolated\n\n';
    }
    return result;
}
