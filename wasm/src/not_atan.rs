use std::f32::consts::PI;
use wasm_bindgen::prelude::*;

/// An alternative to atan2 when all you need is comparing angles. It maps all values of y/x to the range (-PI, PI) and keeps
/// almost the same order as atan2: notAtan2(y1, x1) < notAtan2(y2, x2) is true when atan2(y1, x1) < atan2(y2, x2) is
/// true, unless either a) the return values differ only in a few ULP (see tests) or b) inputs are BOTH zeros or
/// infinitys.
///
/// This is a Rust version of not-atan.ts, exported for benchmarking.
#[wasm_bindgen]
pub fn not_atan2(y: f32, x: f32) -> f32 {
    // Returned ranges:
    //   x > 0 && y > 0: (0, PI/2)Ў
    //   x > 0 && y < 0: (-PI/2, 0)
    //   x < 0 && y > 0: (PI/2, PI)
    //   x < 0 && y < 0: (-PI, -PI/2)
    let alpha = y / x;
    if alpha.is_nan() {
        // Apparently real atan2 implementations contain a hardcoded list of cases here, for example see
        // https://git.musl-libc.org/cgit/musl/tree/src/math/atan2.c
        return 0.0;
    }

    // normalized = PI/2 * alpha / (abs(alpha) + 1), but we want to leave alpha only in the divisor so that we do not
    // get NaN when alpha = Infinity.
    let normalized = PI * 0.5 * alpha.signum() * (1.0 - 1.0 / (1.0 + alpha.abs()));
    if x >= 0.0 && !x.is_sign_negative() {
        normalized
    } else {
        // y = -0.0 should return normalized - PI
        normalized + PI.copysign(y)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_basic() {
        // Quick sanity check
        assert!((not_atan2(1.0, 1.0) - (PI / 4.0)).abs() < 1e-5);
        assert!((not_atan2(1.0, -1.0) - (3.0 * PI / 4.0)).abs() < 1e-5);
        assert!((not_atan2(-1.0, 1.0) - (-PI / 4.0)).abs() < 1e-5);
        assert!((not_atan2(-1.0, -1.0) - (-3.0 * PI / 4.0)).abs() < 1e-5);
    }

    #[test]
    fn test_range() {
        // Ensure result is within [-PI, PI]
        let values = [-1e9, -1e3, -1.0, -1e-3, -1e-9, -0.0, 0.0, 1e-9, 1e-3, 1.0, 1e3, 1e9];
        for &y in &values {
            for &x in &values {
                let result = not_atan2(y, x);
                assert!(result >= -PI, "notAtan2({}, {}) = {} < -PI", y, x, result);
                assert!(result <= PI, "notAtan2({}, {}) = {} > PI", y, x, result);
            }
        }
    }

    #[test]
    fn test_consistent_order() {
        fn are_both_zero_or_inf(x: f32, y: f32) -> bool {
            if x.is_infinite() && y.is_infinite() {
                return true;
            }
            if x == 0.0 && y == 0.0 {
                // This includes signed zeros because 0.0 == -0.0 in Rust.
                // However, we need to match the TypeScript logic which uses ===.
                // TypeScript's x === 0 && y === 0 is true for -0 as well.
                // So we can just compare equality to 0.0.
                return true;
            }
            false
        }

        let values = [
            f32::NEG_INFINITY,
            -1e9,
            -1e3,
            -1.0,
            -1e-3,
            -1e-9,
            -0.0,
            0.0,
            1e-9,
            1e-3,
            1.0,
            1e3,
            1e9,
            f32::INFINITY,
        ];

        for &y1 in &values {
            for &x1 in &values {
                if are_both_zero_or_inf(x1, y1) {
                    continue;
                }
                for &y2 in &values {
                    for &x2 in &values {
                        if are_both_zero_or_inf(x2, y2) {
                            continue;
                        }
                        let orig1 = y1.atan2(x1);
                        let orig2 = y2.atan2(x2);
                        let new1 = not_atan2(y1, x1);
                        let new2 = not_atan2(y2, x2);

                        let message = format!(
                            "inconsistent order for notAtan2({}, {}) = {} (orig {}) and notAtan2({}, {}) = {} (orig {})",
                            y1, x1, new1, orig1, y2, x2, new2, orig2
                        );

                        if (orig1 - orig2).abs() < 1e-6 {
                            // If original values are nearly equal, allow new values to be equal or ordered same direction
                            if orig1 < orig2 {
                                assert!(new1 <= new2, "{}", message);
                            } else {
                                assert!(new1 >= new2, "{}", message);
                            }
                        } else {
                            if orig1 < orig2 {
                                assert!(new1 < new2, "{}", message);
                            } else {
                                assert!(new1 > new2, "{}", message);
                            }
                        }
                    }
                }
            }
        }
    }
}
