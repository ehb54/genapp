# svn-era GenApp (branch genappalpha-php8) on Ubuntu 24.04:
# Apache prefork + mod_php 8.3, the mongodb extension built from PECL (Ubuntu's 1.15 is too old for a fixed
# mongodb/mongodb), the distro zmq and imagick extensions, MongoDB 8.0, python 2.7 built from source
# (24.04 has no python2) and a current Go for util/msg-tcpserver.
#
# Build with build.sh, which assembles the build context from a git ref of this repository.
# Targets:
#   base  GenApp and its runtime, no applications (copy or check out site applications on top)
#   test  base plus the demo, tutorial2 and mulch applications exported from svn (see README.md)

ARG UBUNTU=ubuntu:24.04

FROM ${UBUNTU} AS python2
ARG PYTHON2_VERSION=2.7.18
ARG PYTHON2_SHA256=da3080e3b488f648a3d7a4560ddee895284c3380b11d6de75edb986526b9a814
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential ca-certificates curl \
        libbz2-dev libffi-dev libgdbm-dev libncursesw5-dev libreadline-dev libsqlite3-dev zlib1g-dev && \
    curl -fsSLo /tmp/python2.tgz https://www.python.org/ftp/python/$PYTHON2_VERSION/Python-$PYTHON2_VERSION.tgz && \
    echo "$PYTHON2_SHA256  /tmp/python2.tgz" | sha256sum -c - && \
    mkdir /tmp/python2 && tar -xzf /tmp/python2.tgz -C /tmp/python2 --strip-components=1 && \
    cd /tmp/python2 && \
    ./configure --prefix=/opt/python2.7 --enable-unicode=ucs4 && \
    make -j"$(nproc)" && \
    make install && \
    /opt/python2.7/bin/python2.7 -c 'import json, zlib, bz2, sqlite3, ctypes, readline'

FROM ${UBUNTU} AS phpext
ARG EXT_MONGODB_VERSION=1.21.12
ARG EXT_MONGODB_SHA256=d4d2a8ad034685eacd7ea3ed96c0c9aed8c0165ea6e79d106bdf95214d5eaa35
RUN apt-get update && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends \
        build-essential ca-certificates curl pkg-config php8.3-dev libssl-dev && \
    curl -fsSLo /tmp/mongodb.tgz https://pecl.php.net/get/mongodb-$EXT_MONGODB_VERSION.tgz && \
    echo "$EXT_MONGODB_SHA256  /tmp/mongodb.tgz" | sha256sum -c - && \
    mkdir /tmp/mongodb && tar -xzf /tmp/mongodb.tgz -C /tmp/mongodb && \
    cd /tmp/mongodb/mongodb-$EXT_MONGODB_VERSION && \
    phpize8.3 && \
    ./configure --with-php-config=php-config8.3 && \
    make -j"$(nproc)" && \
    cp modules/mongodb.so /mongodb.so

FROM ${UBUNTU} AS base

ENV DEBIAN_FRONTEND=noninteractive

# same layout and ports as dockerfiles/genappalpha
ENV SRCBASE=/src
ENV GENAPP=$SRCBASE/genapp
ENV APPBASE=/opt/genapp
ENV WEBROOT=/var/www/html
ENV GENAPPETC=$GENAPP/etc
ENV LOCKDIR=$GENAPPETC

ENV WSPORT=30777
ENV ZMQPORT=30778
ENV UDPPORT=30779
ENV TCPPORT=30780
ENV TCPRPORT=30781
ENV MONGOPORT=27017

EXPOSE 80/tcp
EXPOSE $WSPORT/tcp
EXPOSE $UDPPORT/udp
EXPOSE $TCPPORT/tcp
EXPOSE $TCPRPORT/tcp

# php: distro 8.3 with the distro zmq and imagick extensions the svn-era sites used (mongodb comes from phpext)
# perl: modules genapp needs (JSON, Hash::Merge) and those the old images added with cpanm
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        apache2 libapache2-mod-php8.3 \
        php8.3-cli php8.3-curl php8.3-mbstring php8.3-opcache php8.3-xml \
        php-zmq php-imagick \
        php-mail php-mail-mime php-net-smtp \
        perl libjson-perl libhash-merge-perl libtry-tiny-perl libwww-perl liblwp-protocol-https-perl \
        libmime-lite-perl libio-socket-ssl-perl libnet-ssleay-perl \
        imagemagick \
        build-essential pkg-config libzmq3-dev \
        ca-certificates curl wget gnupg bind9-host bc git subversion procps less \
        libbz2-1.0 libffi8 libgdbm6t64 libncursesw6 libreadline8t64 libsqlite3-0 zlib1g && \
    rm -rf /var/lib/apt/lists/*

ARG MONGODB_VERSION=8.0.34
RUN curl -fsSL https://pgp.mongodb.com/server-8.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg && \
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg ] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" \
        > /etc/apt/sources.list.d/mongodb-org-8.0.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends mongodb-org-server=$MONGODB_VERSION mongodb-mongosh mongodb-database-tools && \
    rm -rf /var/lib/apt/lists/* && \
    printf '# no usage data from interactive mongosh sessions to MongoDB, for every user\nmongosh:\n  forceDisableTelemetry: true\n' > /etc/mongosh.conf

ARG GO_VERSION=1.27.3
ARG GO_SHA256=65efbc80fdc1fa2cd2631cad5b481777a68e8725f34e89f50fc6ac714e379b40
RUN curl -fsSLo /tmp/go.tgz https://go.dev/dl/go$GO_VERSION.linux-amd64.tar.gz && \
    echo "$GO_SHA256  /tmp/go.tgz" | sha256sum -c - && \
    tar -C /usr/local -xzf /tmp/go.tgz && \
    rm /tmp/go.tgz && \
    ln -s /usr/local/go/bin/go /usr/local/bin/go

COPY --from=phpext /mongodb.so /tmp/mongodb.so
RUN mv /tmp/mongodb.so "$(php -r 'echo ini_get("extension_dir");')/mongodb.so" && \
    printf '; priority=20\nextension=mongodb.so\n' > /etc/php/8.3/mods-available/mongodb.ini && \
    phpenmod -v 8.3 mongodb && \
    php -r 'exit(version_compare(phpversion("mongodb"), "1.21.12", ">=") ? 0 : 1);'

COPY --from=python2 /opt/python2.7 /opt/python2.7
RUN ln -s /opt/python2.7/bin/python2.7 /usr/bin/python2 && \
    ln -s /opt/python2.7/bin/python2.7 /usr/bin/python

# as in dockerfiles/genappalpha: let the apache php run pcntl, websocket proxy for /ws2 and /wss2
RUN sed -i.org "s/^disable_functions = pcntl/;disable_functions = pcntl/" /etc/php/8.3/apache2/php.ini && \
    printf '# ws proxy pass\nProxyPass /ws2 ws://localhost:%s/\n' $WSPORT > /etc/apache2/mods-available/wsproxy.conf && \
    printf '\n' > /etc/apache2/mods-available/wsproxy.load && \
    printf '# wss proxy pass\nProxyPass /wss2 ws://localhost:%s/\n' $WSPORT > /etc/apache2/mods-available/wssproxy.conf && \
    printf '\n' > /etc/apache2/mods-available/wssproxy.load && \
    a2enmod proxy proxy_wstunnel wsproxy && \
    ln -s /usr/bin/php /usr/local/bin/php

COPY genapp/ $GENAPP/

RUN mkdir -p $APPBASE && \
    touch $GENAPPETC/no_sudo && \
    groupadd genapp && \
    useradd genapp -r -s /usr/sbin/nologin -d $APPBASE -g genapp && \
    chmod g+rwx $APPBASE && \
    chown genapp:genapp $APPBASE && \
    chmod g+s $APPBASE && \
    mkdir -p $LOCKDIR && \
    chown genapp:genapp $LOCKDIR && \
    chmod g+rwx $LOCKDIR && \
    usermod -g users -G genapp genapp && \
    usermod -G genapp www-data && \
    chgrp -R genapp $GENAPP && \
    chmod g+w $GENAPP/etc && \
    printf 'export GENAPP=%s\nexport PATH=$GENAPP/bin:$PATH\n' $GENAPP > /etc/profile.d/genapp.sh

# setconfig.pl would look up the public ip and guess the webroot from the host kernel; give them
# GENAPP_PUBLICPORT is the port browsers use for the web server (the page's websocket goes to it at /ws2)
ARG GENAPP_HOSTNAME=localhost
ARG GENAPP_HOSTIP=127.0.0.1
ARG GENAPP_PUBLICPORT=80
RUN $GENAPP/sbin/setconfig.pl -hostname $GENAPP_HOSTNAME -hostip $GENAPP_HOSTIP -webroot $WEBROOT -publicport $GENAPP_PUBLICPORT -pj

COPY genapp-start /usr/local/sbin/genapp-start

CMD ["/usr/local/sbin/genapp-start"]

FROM base AS test

# getapp.pl checks applications out of svn; svn-from-dir answers its 'svn ls' and 'svn co' from /src/test-apps
COPY test-apps/ /src/test-apps/
COPY svn-from-dir /usr/local/lib/genapp-test/svn
COPY test-appconfig.php /usr/local/lib/genapp-test/test-appconfig.php

# mulch only has directives.json.ubuntu_localhost (fixed paths), getapp.pl wants a directives.json.template;
# demo runs the messaging services, util/build-tcp.sh needs its zmq version (as sites set it)
RUN cd /src/test-apps/mulch && \
    [ -e directives.json.template ] || \
    sed -e 's|"/opt/genapp/|"__app_parent_directory__/|g' -e 's|"/var/www/html"|"__webroot__"|g' \
        directives.json.ubuntu_localhost > directives.json.template && \
    cd /src/test-apps/demo && \
    grep -q '"zmqversion"' directives.json.template || \
    sed -i '0,/^{/s//{\n  "zmqversion" : "4",/' directives.json.template

# install as a site would, with getapp.pl (genapp also runs util/build-tcp.sh, which builds util/msg-tcpserver),
# then finish appconfig.json as a site administrator would (test-appconfig.php); smokeadmin administers the applications.
# demo and mulch come from svn, tutorial2 from the git repository of applications (ehb54/genapp_apps), at the
# tag of its svn import, so both kinds of install are tested
RUN cd $APPBASE && \
    for app in demo mulch; do \
        PATH=/usr/local/lib/genapp-test:$PATH GENAPP_TEST_APPS=/src/test-apps $GENAPP/sbin/getapp.pl -force -gen svn $app || exit 1; \
    done && \
    $GENAPP/sbin/getapp.pl -gen -ref svn-r1767/tutorial2 git tutorial2 && \
    for app in demo tutorial2 mulch; do \
        php /usr/local/lib/genapp-test/test-appconfig.php $app/appconfig.json smokeadmin || exit 1; \
    done && \
    test -x $APPBASE/demo/output/html5/util/msg-tcpserver && \
    cp $APPBASE/demo/output/html5/util/rc.genapp /etc/init.d/rc.genapp
