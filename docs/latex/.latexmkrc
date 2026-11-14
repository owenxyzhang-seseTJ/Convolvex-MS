# The supplied environment has a broken /usr/bin/bibtex alternative.
# Normal TeX installations continue using their ordinary bibtex executable.
if (!-x '/usr/bin/bibtex' && -x '/usr/bin/bibtex.original') {
    $bibtex = 'bibtex.original %O %B';
}
