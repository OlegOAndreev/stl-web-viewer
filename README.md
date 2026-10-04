# STL Web Viewer

This is a web interface to visualize STL files.

## Development

### Preparing environment
Install node.js and run to install all the required libraries and scripts.
```bash
npm install
./wasm/install-build-deps.sh
```

### Building and testing
Full build, output in `dist/`:
```bash
npm run build
```

Other useful commands:
```bash
npm run build:ts     # TypeScript/HTML/CSS only; use when Rust is unchanged
npm test             # All tests
npm run test:ts      # TypeScript tests
npm run test:wasm    # Rust tests only
```

### Running dev server
Start the local dev server with URL http://localhost:5173/stl-web-viewer/
```bash
npm run dev
```

### Conventions
- Prefer id-based CSS selectors; add class-based rules only when they remove duplication.

## License
MIT: https://opensource.org/license/mit
