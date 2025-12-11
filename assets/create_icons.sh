#!/bin/bash

# Create a simple 1024x1024 PNG with base64 (basic purple square)
cat > icon.png.b64 << 'ICONDATA'
iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==
ICONDATA

base64 -d icon.png.b64 > temp.png

# Use sips (macOS built-in) to resize to 1024x1024
sips -z 1024 1024 -s format png temp.png --out icon.png
cp icon.png adaptive-icon.png
sips -z 1284 2778 temp.png --out splash.png  
sips -z 48 48 temp.png --out favicon.png

rm temp.png icon.png.b64

echo "✅ Created placeholder icons"
