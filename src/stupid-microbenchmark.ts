import type { EmbindModule, MainModule } from "../wasm/build/main-wasm-module";
import { notAtan2 } from "./not-atan";

// This is the stupidest micro-benchmark, but still useful for getting an idea on how much the function call costs.
export function stupidMicroBenchmark(mainModule: MainModule & EmbindModule): string {
    console.log('Starting stupid microbenchmark');
    let result = '';
    if (!window.crossOriginIsolated) {
        result += 'WARNING: Window is not cross-origin isolated, performance.now() precision is low\n\n';
    } else {
        result += 'Window is cross-origin isolated\n\n';
    }

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
            _unused += mainModule._stdAtan2(typedY[j], typedX[j]);
        }
        typedArrayWasmStdAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += mainModule._notAtan2(typedY[j], typedX[j]);
        }
        typedArrayWasmNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += mainModule.notAtan2(typedY[j], typedX[j]);
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
            _unused += mainModule._stdAtan2(untypedY[j], untypedX[j]);
        }
        arrayWasmStdAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += mainModule._notAtan2(untypedY[j], untypedX[j]);
        }
        arrayWasmNotAtan2.push((performance.now() - startTime).toFixed(0));

        startTime = performance.now();
        for (let j = 0; j < numValues; j++) {
            _unused += mainModule.notAtan2(untypedY[j], untypedX[j]);
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
    return result;
}
