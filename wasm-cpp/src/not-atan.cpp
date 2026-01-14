#include <emscripten/emscripten.h>

#include <cmath>

// An alternative to atan2 when all you need is comparing angles. It all values of y/x to the range (-PI, PI) and keeps
// almost the same order as atan2: notAtan2(y1, x1) < notAtan2(y2, x2) is true when atan2(y1, x1) < atan2(y2, x2) is
// true, unless either a) the return values differ only in a few ULP (see tests) or b) inputs are BOTH zeros or
// infinitys.
//
// This is a C++ version of not-atan.ts, exported only for benchmarking.
extern "C" EMSCRIPTEN_KEEPALIVE float notAtan2(float y, float x) {
    // Returned ranges:
    //   x > 0 && y > 0: (0, PI/2)
    //   x > 0 && y < 0: (-PI/2, 0)
    //   x < 0 && y > 0: (PI/2, PI)
    //   x < 0 && y < 0: (-PI, -PI/2)
    float alpha = y / x;
    if (isnan(alpha)) {
        // Apparently real atan2 implementations contain a hardcoded list of cases here, for example see
        // https://git.musl-libc.org/cgit/musl/tree/src/math/atan2.c
        return 0.0;
    }

    // normalized = PI/2 * alpha / (abs(alpha) + 1), but we want to leave alpha only in the divisor so that we do not
    // get NaN when alpha = Infinity.
    float normalized = M_PI * 0.5f * copysign(1.0f, alpha) * (1.0f - 1.0f / (1.0f + abs(alpha)));
    if (x >= 0.0f && !signbit(x)) {
        return normalized;
    } else {
        // y = -0.0f should return normalized - M_PI
        return normalized + copysign(M_PI, y);
    }
}
