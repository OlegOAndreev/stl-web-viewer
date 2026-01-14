import { assert, test } from 'vitest'

import { notAtan2 } from './not-atan'

test('notAtan2 boundaries', () => {
    // We test all possible combinations of values.
    const values = [-Infinity, -1e+9, -1e+3, -1, -1e-3, -1e-9, -0, 0, 1e-9, 1e-3, 1, 1e+3, 1e+9, Infinity];
    for (let i = 0; i < values.length; i++) {
        const y = values[i];
        for (let j = 0; j < values.length; j++) {
            const x = values[j];
            const value = notAtan2(y, x);
            assert(value >= -Math.PI, `notAtan2(${y}, ${x}) outside or range: ${value}`);
            assert(value <= Math.PI, `notAtan2(${y}, ${x}) outside or range: ${value}`);
        }
    }
});

test('notAtan2 consistent order', () => {
    function areBothZeroOrInf(x: number, y: number): boolean {
        if (Math.abs(x) === Infinity && Math.abs(y) === Infinity) {
            return true;
        }
        if (x === 0 && y === 0) {
            return true;
        }
        return false;
    }

    // We test all possible combinations of values.
    const values = [-Infinity, -1e+9, -1e+3, -1, -1e-3, -1e-9, -0, 0, 1e-9, 1e-3, 1, 1e+3, 1e+9, Infinity];
    for (let i = 0; i < values.length; i++) {
        const y1 = values[i];
        for (let j = 0; j < values.length; j++) {
            const x1 = values[j];
            if (areBothZeroOrInf(x1, y1)) {
                continue;
            }
            for (let k = 0; k < values.length; k++) {
                const y2 = values[k];
                for (let m = 0; m < values.length; m++) {
                    const x2 = values[m];
                    if (areBothZeroOrInf(x2, y2)) {
                        continue;
                    }
                    const origValue1 = Math.atan2(y1, x1);
                    const origValue2 = Math.atan2(y2, x2);
                    const newValue1 = notAtan2(y1, x1);
                    const newValue2 = notAtan2(y2, x2);
                    const message = `inconsistent order for notAtan2(${y1}, ${x1}) = ${newValue1} (orig ${origValue1})
                     and notAtan2(${y2}, ${x2}) = ${newValue2} (orig ${origValue2})`;
                    if (Math.abs(origValue1 - origValue2) < 1e-15) {
                        // Allow the newValue1 === newValue2
                        if (origValue1 < origValue2) {
                            assert(newValue1 <= newValue2, message);
                        } else {
                            assert(newValue1 >= newValue2, message);
                        }
                    } else {
                        if (origValue1 < origValue2) {
                            assert(newValue1 < newValue2, message);
                        } else {
                            assert(newValue1 > newValue2, message);
                        }
                    }
                }
            }
        }
    }
});
