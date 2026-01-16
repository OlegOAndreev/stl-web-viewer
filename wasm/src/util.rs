use wasm_bindgen::prelude::*;

// Copy-pasted from https://wasm-bindgen.github.io/wasm-bindgen/examples/console-log.html

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

#[allow(unused_macros)]
macro_rules! console_log {
    // Note that this is using the `log` function imported above during
    // `bare_bones`
    ($($t:tt)*) => (crate::util::log(&format_args!($($t)*).to_string()))
}

#[allow(unused)]
pub(crate) use console_log;

#[wasm_bindgen]
pub fn get_settings() -> String {
    let optimized = !cfg!(debug_assertions);

    let atomics = cfg!(target_feature = "atomics");
    let bulk_memory = cfg!(target_feature = "bulk-memory");
    let multivalue = cfg!(target_feature = "multivalue");
    let nontrapping_fptoint = cfg!(target_feature = "nontrapping-fptoint");
    let sign_ext = cfg!(target_feature = "sign-ext");
    let simd128 = cfg!(target_feature = "simd128");
    let relaxed_simd = cfg!(target_feature = "relaxed-simd");

    #[cfg(target_arch = "wasm32")]
    let memory_bytes = std::arch::wasm32::memory_size(0) * 65536;
    #[cfg(not(target_arch = "wasm32"))]
    let memory_bytes: usize = 0;

    format!(
        "optimized: {}, atomics: {}, bulk-memory: {}, multivalue: {}, nontrapping-fptoint: {}, sign-ext: {}, \
         simd128: {}, relaxed-simd: {}, memory: {}",
        optimized,
        atomics,
        bulk_memory,
        multivalue,
        nontrapping_fptoint,
        sign_ext,
        simd128,
        relaxed_simd,
        memory_bytes
    )
}
