#!/bin/sh
docker build -t redirect-server .
docker kill $(cat running.container) || true
docker run -d -p 80:8080 --restart=always \
       -v /var/log/mattiskan/router.log:/log.file \
       -e HOST_IP=$(ip route get 1 | awk '{print $NF;exit}') \
       redirect-server > running.container
