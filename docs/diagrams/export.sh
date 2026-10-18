#!/bin/bash
# Export all Mermaid diagrams to SVG and PNG
# Usage: ./export.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
SVG_DIR="$SCRIPT_DIR/svg"
PNG_DIR="$SCRIPT_DIR/png"

mkdir -p "$SVG_DIR" "$PNG_DIR"

DIAGRAMS=(
  "05-system-architecture"
)

echo "Exporting ${#DIAGRAMS[@]} diagrams..."

for name in "${DIAGRAMS[@]}"; do
  input="$SCRIPT_DIR/${name}.mmd"
  if [ ! -f "$input" ]; then
    echo "SKIP: $input not found"
    continue
  fi

  echo "  $name → SVG"
  mmdc -i "$input" -o "$SVG_DIR/${name}.svg" -b transparent --scale 2 2>&1 | sed 's/^/    /'

  echo "  $name → PNG"
  mmdc -i "$input" -o "$PNG_DIR/${name}.png" -b white --scale 2 2>&1 | sed 's/^/    /'
done

echo ""
echo "Done. Outputs:"
echo "  SVG: $SVG_DIR/"
echo "  PNG: $PNG_DIR/"
