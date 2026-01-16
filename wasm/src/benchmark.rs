use wasm_bindgen::prelude::*;

#[wasm_bindgen]
pub struct Float32Vec {
    data: Vec<f32>,
}

#[wasm_bindgen]
impl Float32Vec {
    #[wasm_bindgen(constructor)]
    pub fn new(len: usize) -> Float32Vec {
        let mut data = Vec::new();
        data.resize(len, 0.0);
        Float32Vec {
            data,
        }
    }

    #[wasm_bindgen(getter)]
    pub fn data_ptr(&mut self) -> *mut f32 {
        self.data.as_mut_ptr()
    }

    #[wasm_bindgen(getter)]
    pub fn len(&self) -> usize {
        self.data.len()
    }

    // This method is a bit slower than creating a Float32Array in JS code using data_ptr + len.
    #[wasm_bindgen(getter)]
    pub fn array(&self) -> js_sys::Float32Array {
        unsafe { js_sys::Float32Array::view(&self.data) }
    }
}

#[wasm_bindgen]
pub fn alloc(n: usize) -> *mut u8 {
    unsafe { std::alloc::alloc(std::alloc::Layout::from_size_align_unchecked(n, 16)) }
}

#[wasm_bindgen]
pub fn dealloc(ptr: *mut u8, n: usize) {
    unsafe {
        std::alloc::dealloc(ptr, std::alloc::Layout::from_size_align_unchecked(n, 16))
    }
}

#[repr(C)]
pub struct SpanPair {
    ptr: *mut u8,
    len: usize,
}

#[wasm_bindgen]
pub fn triple_array(input: &[f32]) -> Box<[f32]> {
    let mut result = vec![0.0; input.len()];
    for (src, dst) in input.iter().zip(&mut result) {
        *dst = *src * 3.0;
    }
    result.into_boxed_slice()
}

#[wasm_bindgen]
pub fn triple_array_with_vec(input: &Float32Vec) -> Float32Vec {
    let mut result = vec![0.0; input.data.len()];
    for (src, dst) in input.data.iter().zip(&mut result) {
        *dst = *src * 3.0;
    }
    Float32Vec {
        data: result,
    }
}

#[wasm_bindgen]
pub fn triple_array_raw(output_ptr: *mut SpanPair, input_ptr: *mut f32, n: usize) {
    let result_ptr = alloc(n * 4) as *mut f32;
    unsafe {
        let input = std::slice::from_raw_parts(input_ptr, n);
        let output = std::slice::from_raw_parts_mut(result_ptr, n);
        for (src, dst) in input.iter().zip(output) {
            *dst = *src * 3.0;
        }
        (*output_ptr).ptr = result_ptr as *mut u8;
        (*output_ptr).len = n;
    }
}
