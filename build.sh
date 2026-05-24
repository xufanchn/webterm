#!/bin/bash
set -e

echo "=== Building frontend ==="
cd ui && npm run build && cd ..

echo "=== Building backend ==="
export PATH="$HOME/.local/share/mise/installs/go/1.26.3/bin:$PATH"
go build -o webterm .

echo "=== Build complete: ./webterm ==="
echo "Run: ./webterm -config config.yaml"
