#!/bin/bash

# Quick helper to import your reference library into ARTHUR

echo "📚 ARTHUR Reference Library Import Helper"
echo "=========================================="
echo ""

# Check if directory argument provided
if [ -z "$1" ]; then
    echo "Usage: ./import-library.sh <path-to-books>"
    echo ""
    echo "Examples:"
    echo "  ./import-library.sh \"./DOCUMENT _TO_MD_CONVERTER V1/input_docs\""
    echo "  ./import-library.sh \"./my-books\""
    echo "  ./import-library.sh \"/path/to/downloaded/books\""
    echo ""
    exit 1
fi

SOURCE_DIR="$1"

# Check if directory exists
if [ ! -d "$SOURCE_DIR" ]; then
    echo "❌ Directory not found: $SOURCE_DIR"
    exit 1
fi

# Count files
FILE_COUNT=$(find "$SOURCE_DIR" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" -o -name "*.epub" \) | wc -l)

echo "Found $FILE_COUNT file(s) in $SOURCE_DIR"
echo ""

if [ "$FILE_COUNT" -eq 0 ]; then
    echo "⚠️  No supported files found (.md, .txt, .pdf, .epub)"
    echo ""
    echo "Available converters:"
    echo "  - Place EPUB/PDF files in: ./DOCUMENT _TO_MD_CONVERTER V1/input_docs/"
    echo "  - Run: cd \"./DOCUMENT _TO_MD_CONVERTER V1\" && python batch_doc_to_md.py"
    echo "  - Converted files will appear in output_md/"
    exit 1
fi

echo "Starting import..."
echo ""

# Run the import script
node backend/scripts/bulk-import-library.js "$SOURCE_DIR"
