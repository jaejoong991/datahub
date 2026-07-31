#!/bin/bash
# Screenshot app pages using headless Chrome
# Frontend harus jalan di http://localhost:5173

OUTPUT_DIR="$(cd "$(dirname "$0")" && pwd)"
BASE="http://localhost:5173"
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
W=1440 H=900
CHROME_FLAGS="--headless --window-size=$W,$H --disable-gpu --no-sandbox --hide-scrollbars"

mkdir -p "$OUTPUT_DIR"

shot() {
  local name="$1" url="$2" js="$3"
  echo "  → $name"
  "$CHROME" $CHROME_FLAGS \
    --screenshot="$OUTPUT_DIR/${name}.png" \
    --eval="$js" \
    "$url" 2>/dev/null
  echo "    ✓ ${name}.png"
}

echo "=== Screenshots Ecommerce Data Hub ==="

# Login page — langsung muncul
shot "01-login" "$BASE" ""

# Lewati login — klik tombol skip
shot "02-ringkasan" "$BASE" "
setTimeout(() => {
  document.querySelector('button')?.click()
}, 500)"

# Keuangan
shot "03-keuangan" "$BASE" "
setTimeout(() => {
  document.querySelectorAll('button').forEach(b => b.textContent.includes('Keuangan') && b.click())
}, 500)"

# Stok
shot "04-stok" "$BASE" "
setTimeout(() => {
  document.querySelectorAll('button').forEach(b => b.textContent.includes('Stok') && b.click())
}, 500)"

# Gudang / Daftar kirim
shot "05-gudang" "$BASE" "
setTimeout(() => {
  document.querySelectorAll('button').forEach(b => b.textContent.includes('Daftar kirim') && b.click())
}, 500)"

# Sinkron
shot "06-sinkron" "$BASE" "
setTimeout(() => {
  document.querySelectorAll('button').forEach(b => b.textContent.includes('Status sinkronisasi') && b.click())
}, 500)"

echo "=== Done ==="
ls -lh "$OUTPUT_DIR"/*.png
