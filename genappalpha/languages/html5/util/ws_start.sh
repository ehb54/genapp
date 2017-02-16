#!/bin/bash

cd __docroot:html5__/__application__/util

mkdir ../log 2> /dev/null

nohup php msg-wsserver.php 2>&1 > ../log/ws.out &
nohup php msg-udpserver.php 2>&1 > ../log/udp.out &
nohup php msg-keepalive.php 2>&1 > ../log/keepalive.out &
