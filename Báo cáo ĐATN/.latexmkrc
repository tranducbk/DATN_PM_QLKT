# Compile DoAn.tex with full pipeline: pdflatex -> biber -> pdflatex x 2
$pdf_mode = 1;
$pdflatex = 'pdflatex -interaction=nonstopmode -synctex=1 %O %S';
$bibtex_use = 2;
$biber = 'biber %O %S';

# Auxiliary files to clean with `latexmk -c`
$clean_ext = "aux bbl bcf blg fdb_latexmk fls glg glo gls glsdefs idx ilg ind ist lof log lot out run.xml synctex.gz toc";

# Default file when running `latexmk` without args
@default_files = ('DoAn.tex');
