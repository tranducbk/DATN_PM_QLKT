# Hướng dẫn cài đặt và compile LaTeX

Tài liệu này tổng hợp toàn bộ thiết lập LaTeX để compile báo cáo ĐATN trên macOS. Sau khi cài 1 lần là dùng được cho mọi dự án LaTeX trên máy.

## 1. Cài đặt TeX Live (BasicTeX)

BasicTeX nhẹ (~100MB) đủ dùng cho ĐATN. Cài qua Homebrew:

```bash
brew install --cask basictex
```

Sau khi cài, restart terminal hoặc nạp PATH thủ công:

```bash
eval "$(/usr/libexec/path_helper)"
which pdflatex
# /Library/TeX/texbin/pdflatex
```

## 2. Cài các package LaTeX cần thiết

Toàn bộ package cần cho dự án PM QLKT (gộp 1 lệnh, sẽ hỏi password Mac):

```bash
sudo /Library/TeX/texbin/tlmgr update --self

sudo /Library/TeX/texbin/tlmgr install \
  vntex biblatex biblatex-ieee glossaries glossary-superragged \
  subfiles scrextend titlesec algorithm2e capt-of fancyhdr xurl \
  tocbasic blindtext multirow appendix indentfirst chngcntr \
  pdflscape afterpage hyphenat enumitem subcaption parskip \
  setspace fancybox texcount mfirstuc xfor datatool substr \
  changepage relsize pgf ifoddpage koma-script tools \
  collection-fontsrecommended supertabular outline outlines \
  biber latexmk
```

Trong đó các package quan trọng:

| Package | Vai trò |
|---|---|
| `vntex` | Hỗ trợ tiếng Việt (T5 encoding) |
| `biblatex` + `biber` | Tài liệu tham khảo theo IEEE, xử lý UTF-8 trong .bib |
| `glossaries` | Sinh Danh sách thuật ngữ tự động từ `Tu_viet_tat.tex` |
| `subfiles` | Cho phép chia chương ra file riêng và compile độc lập |
| `outlines` | Cú pháp `\1` `\2` trong môi trường outline (Phụ lục A) |
| `latexmk` | Tự chạy pipeline `pdflatex → biber → pdflatex × N` |

Nếu sau này thấy lỗi `File 'xxx.sty' not found` thì cài thêm:

```bash
sudo /Library/TeX/texbin/tlmgr install xxx
```

## 3. Cấu hình global `~/.latexmkrc`

Tạo file `~/.latexmkrc` để latexmk tự dùng cho mọi thư mục LaTeX:

```perl
$pdf_mode = 1;
$pdflatex = 'pdflatex -interaction=nonstopmode -synctex=1 %O %S';
$bibtex_use = 2;
$biber = 'biber %O %S';
$max_repeat = 5;

$clean_ext = "aux bbl bcf blg fdb_latexmk fls glg glo gls glsdefs idx ilg ind ist lof log lot out run.xml synctex.gz toc nav snm vrb auxlock";
```

## 4. Compile báo cáo

Vào thư mục có file `.tex` chính (ví dụ `DoAn.tex`):

```bash
cd "/đường/dẫn/đến/SOICT_DATN_Application_VIE_Template"
```

| Mục đích | Lệnh |
|---|---|
| Compile đầy đủ (pdflatex + biber + 2 lần pdflatex) | `latexmk DoAn.tex` |
| Compile + auto re-run khi save file | `latexmk -pvc DoAn.tex` |
| Dọn auxiliary files (giữ `.pdf`) | `latexmk -c` |
| Dọn sạch (xoá cả `.pdf`) | `latexmk -C` |

Sau compile, output là `DoAn.pdf` cùng thư mục.

## 5. Cấu trúc thư mục dự án PM QLKT

```
SOICT_DATN_Application_VIE_Template/
├── DoAn.tex                            # File chính, gọi tất cả subfile
├── Bia.tex                             # Bìa
├── Bia_lot.tex                         # Bìa lót
├── Tu_viet_tat.tex                     # Glossary entries
├── Danh_sach_tai_lieu_tham_khao.bib    # Bibliography
├── .latexmkrc                          # (tuỳ chọn, override global)
├── .gitignore                          # Bỏ qua auxiliary files
├── DoAn.pdf                            # Output sau compile
├── Chuong/
│   ├── 0_2_Loi_cam_on.tex
│   ├── 0_3_Tom_tat_noi_dung.tex
│   ├── 0_5_Danh_muc_viet_tat.tex       # (không include — backup)
│   ├── 1_Gioi_thieu.tex                # Chương 1
│   ├── 2_Khao_sat.tex                  # Chương 2
│   ├── 3_Cong_nghe.tex                 # Chương 3
│   ├── 4_Ket_qua_thuc_nghiem.tex       # Chương 4
│   ├── 5_Giai_phap_dong_gop.tex        # Chương 5
│   ├── 6_Ket_luan.tex                  # Chương 6
│   ├── 7_Luu_y_tai_lieu_tham_khao.tex
│   ├── Phu_luc_A.tex                   # Hướng dẫn mẫu (KHÔNG sửa)
│   └── Phu_luc_B.tex                   # Đặc tả UC bổ sung
└── Hinhve/                             # Hình ảnh PNG/JPG để chèn
```

## 6. Workflow soạn thảo gợi ý

1. Mở project bằng VSCode + extension `LaTeX Workshop` (auto compile khi save).
2. Hoặc dùng terminal: `latexmk -pvc DoAn.tex` để watch mode.
3. Khi bí câu/cú pháp tiếng Việt: tham khảo `report/BAO_CAO.md` (bản markdown gốc).
4. Khi muốn sửa cấu trúc/section: chỉnh trong `Chuong/N_*.tex` riêng từng file.
5. Khi muốn thêm hình: copy vào `Hinhve/`, gọi qua `\includegraphics{Hinhve/xxx.png}`.
6. Khi đẩy lên Git: file `.gitignore` đã bỏ qua mọi auxiliary nên `git add .` an toàn.

## 7. Troubleshooting

| Triệu chứng | Cách xử lý |
|---|---|
| `File 'xxx.sty' not found` | `sudo tlmgr install xxx` |
| `Environment outline undefined` | `sudo tlmgr install outlines` (số nhiều) |
| BibTeX báo `Invalid UTF-8` | Đảm bảo `backend=biber` trong `\usepackage[...]{biblatex}`, dùng `latexmk` thay vì `bibtex` |
| Tiếng Việt không hiển thị | Đảm bảo `\usepackage[utf8]{vietnam}` ở preamble |
| Tràn margin với `\texttt{}` dài | Đã có `\sloppy` + `\setlength{\emergencystretch}{3em}` trong DoAn.tex |
| TOC/refs sai số trang | Chạy lại `latexmk` (nó tự chạy 2-3 lần đến khi hội tụ) |

## 8. Tài liệu tham khảo

- TeX Live macOS: <https://www.tug.org/mactex/>
- latexmk manual: <https://www.cantab.net/users/johncollins/latexmk/>
- biblatex docs: <https://ctan.org/pkg/biblatex>
- vntex docs: <https://ctan.org/pkg/vntex>
