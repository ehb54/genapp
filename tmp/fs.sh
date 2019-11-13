#!/bin/bash

. /opt/genapp/docker/tutorial2/results/bin/my_seedme2_conf.txt 
foldershare --host $host --masquerade $username --apikey $apikey $*
