cd __application__
command -v qmake >/dev/null 2>&1 || { echo >&2 "Install qt4 make sure qmake is in your path to compile programs in the target language 'qt4'."; exit 1; }
qmake -project
qmake
make
