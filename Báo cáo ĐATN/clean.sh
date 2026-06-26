#!/usr/bin/env bash
# Remove LaTeX build junk from the report tree: auxiliary files plus the
# per-chapter subfile PDFs left behind when a single Chuong/*.tex is compiled.
# Keeps all sources (.tex/.bib), figures under Hinhve/, and the final DoAn.pdf.
set -euo pipefail

cd "$(dirname "$0")"

find . -type f -not -path './Hinhve/*' \( \
  -name '*.aux' -o -name '*.log' -o -name '*.out' -o -name '*.toc' \
  -o -name '*.lof' -o -name '*.lot' -o -name '*.fls' -o -name '*.fdb_latexmk' \
  -o -name '*.bbl' -o -name '*.blg' -o -name '*.bcf' -o -name '*.run.xml' \
  -o -name '*.synctex.gz' -o -name '*.nav' -o -name '*.snm' -o -name '*.vrb' \
  -o -name '*.xdv' -o -name '*.idx' -o -name '*.ind' -o -name '*.ilg' \
  -o -name '*.glo' -o -name '*.gls' -o -name '*.glg' -o -name '*.acn' \
  -o -name '*.acr' -o -name '*.alg' -o -name '*.ist' -o -name '*-SAVE-ERROR' \
\) -delete

# A subfile PDF is one whose source X.tex sits beside it; DoAn.pdf is the final
# output and Hinhve/ holds figure PDFs, so both are spared.
find . -type f -name '*.pdf' -not -path './Hinhve/*' -print0 | while IFS= read -r -d '' pdf; do
  base="${pdf%.pdf}"
  [ "$(basename "$base")" = "DoAn" ] && continue
  [ -f "$base.tex" ] && rm -f "$pdf"
done

echo "Đã dọn file rác LaTeX (giữ DoAn.pdf, Hinhve/ và các file nguồn)."
