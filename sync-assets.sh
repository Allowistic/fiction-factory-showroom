#!/bin/sh
# Copy Clay's bracket/corner glTFs into the served tree (browser can't read /workspace/cove-light directly).
mkdir -p "$(dirname "$0")/assets/bracket"
cp -v /workspace/cove-light/bracket/*.glb /workspace/cove-light/bracket/*.gltf /workspace/cove-light/bracket/*.bin "$(dirname "$0")/assets/bracket/" 2>/dev/null || echo "no bracket files yet"
