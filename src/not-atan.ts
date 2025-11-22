// An alternative to Math.atan2 which maps all values of y/x to the range (-PI, PI) with the similar order as
// Math.atan2: notTan(x) < notTan(y) mostly equivalent to atan2(x) < atan2(y), unless either a) the tangents differ only
// in a few ULP (see tests) or b) inputs are BOTH zeros or infinitys.
export function notAtan2(y: number, x: number): number {
    // Returned ranges:
    //   x > 0 && y > 0: (0, PI/2)
    //   x > 0 && y < 0: (-PI/2, 0)
    //   x < 0 && y > 0: (PI/2, PI)
    //   x < 0 && y < 0: (-PI, -PI/2)
    const alpha = y / x;
    if (isNaN(alpha)) {
        // Apparently real atan2 implementations contain a hardcoded list of cases here, for example see
        // https://git.musl-libc.org/cgit/musl/tree/src/math/atan2.c
        return 0.0;
    }
    // normalized = PI/2 * alpha / (abs(alpha) + 1), but we want to leave alpha only in the divisor so that we do not
    // get NaN when alpha = Infinity.
    const normalized = Math.PI * 0.5 * Math.sign(alpha) * (1 - 1 / (1 + Math.abs(alpha)));
    if (x >= 0 && !Object.is(x, -0)) {
        return normalized;
    } else {
        if (y >= 0 && !Object.is(y, -0)) {
            return normalized + Math.PI;
        } else {
            return normalized - Math.PI;
        }
    }
}
