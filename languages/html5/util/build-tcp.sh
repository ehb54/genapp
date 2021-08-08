#!/bin/sh

go get github.com/ehb54/lockfile
go get github.com/ehb54/zmq__zmqversion__
cd util && go build msg-tcpserver.go
