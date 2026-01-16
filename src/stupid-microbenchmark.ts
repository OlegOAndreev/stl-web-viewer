import type { InitOutput as RustModule } from "../wasm/build/wasm_main_module";
import { Float32Vec, get_settings, not_atan2, triple_array, triple_array_with_vec } from "../wasm/build/wasm_main_module";
import { notAtan2 } from "./not-atan";

// This is the stupidest micro-benchmark, but still useful for getting an idea on how much the function call costs.
export function stupidMicroBenchmarkSimple(module: RustModule): string {
    console.log('Starting stupidMicroBenchmarkSimple');
    const totalStartTime = performance.now();
    let result = getResultPrologue();

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
    const typedArrayRustNotAtan2 = [];
    const typedArrayRustNotAtan2Module = [];
    const arrayMathAtan2 = [];
    const arrayNotAtan2 = [];
    const arrayRustNotAtan2 = [];
    const arrayRustNotAtan2Module = [];
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
            _unused += not_atan2(typedY[j], typedX[j]);
        }
        typedArrayRustNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module.not_atan2(typedY[j], typedX[j]);
        }
        typedArrayRustNotAtan2Module.push((performance.now() - startTime).toFixed(0));

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
            _unused += not_atan2(untypedY[j], untypedX[j]);
        }
        arrayRustNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += module.not_atan2(untypedY[j], untypedX[j]);
        }
        arrayRustNotAtan2Module.push((performance.now() - startTime).toFixed(0));
    }
    result += `TypedArray Math.atan2: ${typedArrayMathAtan2}ms\n`;
    result += `TypedArray notAtan2: ${typedArrayNotAtan2}ms\n`;
    result += `TypedArray Rust not_atan2: ${typedArrayRustNotAtan2}ms\n`;
    result += `TypedArray Rust not_atan2 module: ${typedArrayRustNotAtan2Module}ms\n`;
    result += `Array Math.atan2: ${arrayMathAtan2}ms\n`;
    result += `Array notAtan2: ${arrayNotAtan2}ms\n`;
    result += `Array Rust not_atan2: ${arrayRustNotAtan2}ms\n`;
    result += `Array Rust not_atan2 module: ${arrayRustNotAtan2Module}ms\n`;

    console.log(`Finished stupidMicroBenchmarkSimple in ${performance.now() - totalStartTime}ms`)
    return result;
}

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

let cachedInput: Float32Array;
function tripleRustArray(n: number) {
    const base = 765.4;
    // We do not want to benchmark JS GC, save the last array.
    if (cachedInput === undefined || cachedInput.length !== n) {
        cachedInput = new Float32Array(n);
    }
    for (let i = 0; i < n; i++) {
        cachedInput[i] = base + i;
    }

    const result = triple_array(cachedInput);
    const lastResult = result[result.length - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
}

function tripleRustArrayVec(module: RustModule, n: number) {
    const base = 543.2;
    // We do not want to benchmark JS GC, save the last array.
    if (cachedInput === undefined || cachedInput.length !== n) {
        cachedInput = new Float32Array(n);
    }
    for (let i = 0; i < n; i++) {
        cachedInput[i] = base + i;
    }
    const inputVec = new Float32Vec(n);
    // array is much slower on Firefox (a bit slower on Chrome) than creating Float32Array in JS
    // inputVec.array.set(cachedInput);
    const input = new Float32Array(module.memory.buffer, inputVec.data_ptr, n);
    input.set(cachedInput);

    const resultVec = triple_array_with_vec(inputVec);
    // const result = resultVec.array;
    const result = new Float32Array(module.memory.buffer, resultVec.data_ptr, resultVec.len);
    const lastResult = result[result.length - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
    resultVec.free();
    inputVec.free();
}

// This is the same code as tripleRustArrayVec, but using .array property instead of data_ptr and len.
function tripleRustArrayVecV2(n: number) {
    const base = 543.9;
    // We do not want to benchmark JS GC, save the last array.
    if (cachedInput === undefined || cachedInput.length !== n) {
        cachedInput = new Float32Array(n);
    }
    for (let i = 0; i < n; i++) {
        cachedInput[i] = base + i;
    }
    const inputVec = new Float32Vec(n);
    inputVec.array.set(cachedInput);

    const resultVec = triple_array_with_vec(inputVec);
    const result = resultVec.array;
    const lastResult = result[result.length - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
    resultVec.free();
    inputVec.free();
}

function tripleRustArrayVecNoCopy(module: RustModule, n: number) {
    const base = 3546.2;
    const inputVec = new Float32Vec(n);
    // See comment in tripleRustArrayVec
    // const input = inputVec.array;
    const input = new Float32Array(module.memory.buffer, inputVec.data_ptr, n);
    for (let i = 0; i < n; i++) {
        input[i] = base + i;
    }

    const resultVec = triple_array_with_vec(inputVec);
    // See comment above
    // const result = resultVec.array;
    const result = new Float32Array(module.memory.buffer, resultVec.data_ptr, resultVec.len);
    const lastResult = result[result.length - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
    resultVec.free();
    inputVec.free();
}

let resultSpanPtr: number;

// Similar to HEAPF32 in Emscripten.
let heapF32: Float32Array = new Float32Array();
function checkHeapF32(module: RustModule) {
    if (heapF32.buffer.byteLength === 0) {
        heapF32 = new Float32Array(module.memory.buffer);
    }
}

// Similar to HEAPU32 in Emscripten.
let heapU32: Uint32Array = new Uint32Array();
function checkHeapU32(module: RustModule) {
    if (heapU32.buffer.byteLength === 0) {
        heapU32 = new Uint32Array(module.memory.buffer);
    }
}

function tripleRustArrayRaw(module: RustModule, n: number) {
    if (resultSpanPtr === undefined) {
        resultSpanPtr = module.alloc(8);
    }

    const base = 4567.89;
    const inputDataPtr = module.alloc(n * 4);
    checkHeapF32(module);
    for (let i = 0; i < n; i++) {
        heapF32[inputDataPtr / 4 + i] = base + i;
    }

    module.triple_array_raw(resultSpanPtr, inputDataPtr, n);
    checkHeapU32(module);
    const resultDataPtr = heapU32[resultSpanPtr / 4];
    const resultLen = heapU32[resultSpanPtr / 4 + 1];
    checkHeapF32(module);
    const lastResult = heapF32[resultDataPtr / 4 + resultLen - 1];
    const resultDiff = lastResult - 3 * (base + n - 1);
    // Account for difference between float and double.
    if (Math.abs(resultDiff) > 1e-5 * n) {
        throw new Error(`Expected ${3 * (base + n - 1)}, got ${lastResult}, diff = ${resultDiff.toExponential()}`);
    }
    module.dealloc(resultDataPtr, resultLen * 4);
    module.dealloc(inputDataPtr, n * 4);
}

// This is the micro-benchmark measures the costs of passing Float32Array.
export function stupidMicroBenchmarkArrays(module: RustModule): string {
    console.log('Starting stupidMicroBenchmarkArrays');
    const totalStartTime = performance.now();
    let result = getResultPrologue();

    const totalData = 100000000;
    const numTries = 4;

    const js100: string[] = [];
    const jsUntyped100: string[] = [];
    const rustArray100: string[] = [];
    const rustArrayVec100: string[] = [];
    const rustArrayVecV2100: string[] = [];
    const rustArrayVecNoCopy100: string[] = [];
    const rustArrayRaw100: string[] = [];
    const js10000: string[] = [];
    const jsUntyped10000: string[] = [];
    const rustArray10000: string[] = [];
    const rustArrayVec10000: string[] = [];
    const rustArrayVecV210000: string[] = [];
    const rustArrayVecNoCopy10000: string[] = [];
    const rustArrayRaw10000: string[] = [];
    for (let i = 0; i < numTries; i++) {
        console.log(`Running try ${i} out of ${numTries}`);
        let startTime;
        startTime = performance.now();
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
            tripleRustArray(100);
        }
        rustArray100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleRustArrayVec(module, 100);
        }
        rustArrayVec100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleRustArrayVecV2(100);
        }
        rustArrayVecV2100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleRustArrayVecNoCopy(module, 100);
        }
        rustArrayVecNoCopy100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 100; j++) {
            tripleRustArrayRaw(module, 100);
        }
        rustArrayRaw100.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 10000; j++) {
            tripleJs(10000);
        }
        js10000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 10000; j++) {
            tripleUntypedJs(10000);
        }
        jsUntyped10000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 10000; j++) {
            tripleRustArray(10000);
        }
        rustArray10000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 10000; j++) {
            tripleRustArrayVec(module, 10000);
        }
        rustArrayVec10000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 10000; j++) {
            tripleRustArrayVecV2(10000);
        }
        rustArrayVecV210000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 10000; j++) {
            tripleRustArrayVecNoCopy(module, 10000);
        }
        rustArrayVecNoCopy10000.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < totalData / 10000; j++) {
            tripleRustArrayRaw(module, 10000);
        }
        rustArrayRaw10000.push((performance.now() - startTime).toFixed(0));
    }
    result += `JS(100): ${js100}ms (per ${totalData / 100} calls)\n`;
    result += `JS untyped(100): ${jsUntyped100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleRustArray(100): ${rustArray100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleRustArrayVec(100): ${rustArrayVec100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleRustArrayVecV2(100): ${rustArrayVecV2100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleRustArrayVecNoCopy(100): ${rustArrayVecNoCopy100}ms (per ${totalData / 100} calls)\n`;
    result += `tripleRustArrayRaw(100): ${rustArrayRaw100}ms (per ${totalData / 100} calls)\n`;
    result += `JS(10000): ${js10000}ms (per ${totalData / 10000} calls)\n`;
    result += `JS untyped(10000): ${jsUntyped10000}ms (per ${totalData / 10000} calls)\n`;
    result += `tripleRustArray(10000): ${rustArray10000}ms (per ${totalData / 10000} calls)\n`;
    result += `tripleRustArrayVec(10000): ${rustArrayVec10000}ms (per ${totalData / 10000} calls)\n`;
    result += `tripleRustArrayVecV2(10000): ${rustArrayVecV210000}ms (per ${totalData / 10000} calls)\n`;
    result += `tripleRustArrayVecNoCopy(10000): ${rustArrayVecNoCopy10000}ms (per ${totalData / 10000} calls)\n`;
    result += `tripleRustArrayRaw(10000): ${rustArrayRaw10000}ms (per ${totalData / 10000} calls)\n`;

    console.log(`Finished stupidMicroBenchmarkArrays in ${performance.now() - totalStartTime}ms`)
    return result;
}

function getResultPrologue(): string {
    let result = navigator.userAgent + '\nRust: ' + get_settings() + '\n';
    if (!window.crossOriginIsolated) {
        result += 'WARNING: Window is not cross-origin isolated, performance.now() precision is low\n\n';
    } else {
        result += 'Window is cross-origin isolated\n\n';
    }
    return result;
}
