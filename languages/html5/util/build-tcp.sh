#!/bin/sh

# builds util/msg-tcpserver in GOPATH mode, as before. current go no longer has GOPATH-mode 'go get'
# (GOPATH-mode 'go build' is still supported), so the github.com/ehb54 packages that 'go get' fetched
# are cloned into the GOPATH here, at pinned commits. go.mod files are ignored in GOPATH mode, which
# the ehb54 forks need: their go.mod files still name the upstream modules.
# needs git, cgo and the libzmq development files (e.g. ubuntu libzmq3-dev)

case "zmq__zmqversion__" in
    zmq4) zmq=zmq4; zmqcommit=4714f8323b61d678dd9e13b8ae4f6a5251f1f6af ;;
    zmq3) zmq=zmq3; zmqcommit=b8950c97e00473973a6b6d772214af7ce59f25f2 ;;
    *)    echo "no directives:zmqversion defined, will not build msg-tcpserver - only needed by genapptest application"
          exit 0 ;;
esac

export GO111MODULE=off
GOPATH=$(go env GOPATH) || exit 1
export GOPATH=${GOPATH%%:*}

fetch() {
    d="$GOPATH/src/github.com/ehb54/$1"
    [ -d "$d/.git" ] || git clone -q "https://github.com/ehb54/$1" "$d" || exit 1
    git -C "$d" fetch -q origin || exit 1
    git -C "$d" -c advice.detachedHead=false checkout -q "$2" || exit 1
}

fetch lockfile cc765475c0b71203143551503b096080206f5d73
fetch go-ps    ddafa7589c607e0e81a7436520ccdbac913665a2
fetch $zmq     $zmqcommit

cd util && go build -o msg-tcpserver msg-tcpserver.go
