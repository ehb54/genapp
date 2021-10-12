#!/bin/sh

zmq="__zmqversion__"
if (( ${#zmq}==1 ))
then   
    go get github.com/ehb54/lockfile
    go get github.com/ehb54/zmq__zmqversion__
    cd util && go build msg-tcpserver.go
else
    echo "no directives:zmqversion defined, will not build msg-tcpserver - only needed by genapptest application"
fi

