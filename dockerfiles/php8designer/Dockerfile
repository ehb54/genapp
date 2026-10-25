# GenApp branch php8designer (php7designer on PHP 8) on Ubuntu 24.04, without Ubuntu Pro:
# Apache prefork + mod_php 8.3, the mongodb extension built from PECL (Ubuntu's 1.15 is too old for
# mongodb/mongodb 1.21), the distro zmq and imagick extensions, MongoDB 8.0, python 2.7 built from source
# (24.04 has no python2), and checksum-pinned releases of Go (util/msg-tcpserver) and Node.js LTS (the
# nodeapi target and the repository's JavaScript tests; Ubuntu's nodejs 18 is end of life upstream).
# Adapted from dockerfiles/genappalpha_php8 of the genappalpha-php8 branch, with dockerfiles/php7designer's
# Apache hardening and genapptest fixture.
#
# Build with build.sh, which assembles the build context from a git ref of this repository.
# Targets:
#   base  GenApp and its runtime, no applications (copy or check out site applications on top)
#   test  base plus genapptest (t/fixtures/apps/minimal_html5) and the demo, tutorial2 and mulch
#         applications of the svn era (see README.md)

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

# same layout and ports as dockerfiles/php7designer and dockerfiles/genappalpha
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

# the mongodb user and group as mongodb-org-server's postinst would make them, but with fixed ids: uid 100
# and gid 101 own the database files in the sites' volumes, and packages installed before MongoDB create
# system users of their own (abiword brings dbus and its messagebus), which would take those ids first
RUN groupadd --system --gid 101 mongodb && \
    useradd --system --uid 100 --gid nogroup --groups mongodb --home-dir /nonexistent --no-create-home \
        --shell /usr/sbin/nologin mongodb

# php: distro 8.3 with the distro zmq and imagick extensions (mongodb comes from phpext)
# perl: modules genapp needs (JSON, Hash::Merge) and those the old images added with cpanm
# abiword: bin/doc2html.pl converts the Word documents that application pages include
# zip, bzip2, xz-utils: the file manager's download packages (sys_file_manager_run.php)
# python3: applications' python 3 executables and the repository's python helpers and their tests
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
        apache2 libapache2-mod-php8.3 \
        php8.3-cli php8.3-curl php8.3-mbstring php8.3-opcache php8.3-xml \
        php-zmq php-imagick \
        php-mail php-mail-mime php-net-smtp \
        perl libjson-perl libhash-merge-perl libtry-tiny-perl libwww-perl liblwp-protocol-https-perl \
        libmime-lite-perl libio-socket-ssl-perl libnet-ssleay-perl \
        python3 \
        imagemagick abiword \
        build-essential pkg-config libzmq3-dev \
        ca-certificates curl wget gnupg bind9-host bc git subversion procps less \
        zip unzip bzip2 xz-utils \
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

ARG NODE_VERSION=24.22.1
ARG NODE_SHA256=eb6728e77c576a35162c122c45ccadf224d89ff00abc8dae46cc2897c6002d7c
RUN curl -fsSLo /tmp/node.tgz https://nodejs.org/dist/v$NODE_VERSION/node-v$NODE_VERSION-linux-x64.tar.gz && \
    echo "$NODE_SHA256  /tmp/node.tgz" | sha256sum -c - && \
    mkdir /opt/node && \
    tar -C /opt/node -xzf /tmp/node.tgz --strip-components=1 --no-same-owner && \
    rm /tmp/node.tgz && \
    for b in node npm npx corepack; do ln -s /opt/node/bin/$b /usr/local/bin/$b; done && \
    test "$(node --version)" = "v$NODE_VERSION"

COPY --from=phpext /mongodb.so /tmp/mongodb.so
RUN mv /tmp/mongodb.so "$(php -r 'echo ini_get("extension_dir");')/mongodb.so" && \
    printf '; priority=20\nextension=mongodb.so\n' > /etc/php/8.3/mods-available/mongodb.ini && \
    phpenmod -v 8.3 mongodb && \
    php -r 'exit(version_compare(phpversion("mongodb"), "1.21.12", ">=") ? 0 : 1);'

COPY --from=python2 /opt/python2.7 /opt/python2.7
RUN ln -s /opt/python2.7/bin/python2.7 /usr/bin/python2 && \
    ln -s /opt/python2.7/bin/python2.7 /usr/bin/python

# let the apache php run pcntl, websocket proxy for /ws2 and /wss2
RUN sed -i.org "s/^disable_functions = pcntl/;disable_functions = pcntl/" /etc/php/8.3/apache2/php.ini && \
    printf '# ws proxy pass\nProxyPass /ws2 ws://localhost:%s/\n' $WSPORT > /etc/apache2/mods-available/wsproxy.conf && \
    printf '\n' > /etc/apache2/mods-available/wsproxy.load && \
    printf '# wss proxy pass\nProxyPass /wss2 ws://localhost:%s/\n' $WSPORT > /etc/apache2/mods-available/wssproxy.conf && \
    printf '\n' > /etc/apache2/mods-available/wssproxy.load && \
    a2enmod proxy proxy_wstunnel wsproxy && \
    ln -s /usr/bin/php /usr/local/bin/php

# Apache hardening, as in dockerfiles/php7designer: no version in headers and error pages, no TRACE, no
# directory listings. security.conf is set itself: a separate file sorts before it and would be overridden
RUN sed -i -e 's/^ServerTokens .*/ServerTokens Prod/' -e 's/^ServerSignature .*/ServerSignature Off/' \
        -e 's/^TraceEnable .*/TraceEnable Off/' /etc/apache2/conf-available/security.conf && \
    grep -qx 'ServerTokens Prod' /etc/apache2/conf-available/security.conf && \
    grep -qx 'ServerSignature Off' /etc/apache2/conf-available/security.conf && \
    grep -qx 'TraceEnable Off' /etc/apache2/conf-available/security.conf && \
    printf '# no directory listings under /var/www\n<Directory /var/www/>\n    Options -Indexes\n</Directory>\n' \
        > /etc/apache2/conf-available/genapp-hardening.conf && \
    a2enconf security genapp-hardening && \
    apache2ctl -t

COPY genapp/ $GENAPP/

# build.sh leaves out etc/closure_compiler.jar and the Java target's libthrift-0.9.1.jar, as
# dockerfiles/php7designer does: no Java here, and the html5 target copies its assembled JavaScript
RUN test ! -e $GENAPP/etc/closure_compiler.jar && \
    test ! -e $GENAPP/languages/java/add/lib/libthrift-0.9.1.jar && \
    mkdir -p $APPBASE && \
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

# mulch only has directives.json.ubuntu_localhost (fixed paths), getapp.pl wants a directives.json.template.
# Its pages include files/*_my.html that each site writes and svn never had: this branch's genapp requires
# every included file (genappalpha's left the include text in the page), so stand-ins are written. This
# genapp also requires a module's moduleid to be its file name: acknowledgements.json says Acknowledgements
# (its menu entry is acknowledgements).
# demo runs the messaging services, util/build-tcp.sh needs its zmq version (as sites set it). It also lists
# the qt4 target, which this branch's genapp cannot generate (qt4 has no template for the grid2 type that
# sys_job2_manager uses), so demo is generated for html5 only
RUN cd /src/test-apps/mulch && \
    { [ -e directives.json.template ] || \
      sed -e 's|"/opt/genapp/|"__app_parent_directory__/|g' -e 's|"/var/www/html"|"__webroot__"|g' \
          directives.json.ubuntu_localhost > directives.json.template; } && \
    mkdir -p files && \
    for f in $(sed -n 's/.*"__< *\([A-Za-z0-9_]*_my\.html\)".*/\1/p' modules/*.json | sort -u); do \
        [ -e files/$f ] || printf '<p>%s: the text of this page is written by each site</p>\n' $f > files/$f; \
    done && \
    sed -i 's/"moduleid"\( *\): *"Acknowledgements"/"moduleid"\1: "acknowledgements"/' modules/acknowledgements.json && \
    grep -q '"moduleid" *: "acknowledgements"' modules/acknowledgements.json && \
    cd /src/test-apps/demo && \
    { grep -q '"zmqversion"' directives.json.template || \
      sed -i '0,/^{/s//{\n  "zmqversion" : "4",/' directives.json.template; } && \
    sed -i 's/"languages"\( *\): *\[ *"html5" *, *"qt4" *\]/"languages"\1: [ "html5" ]/' directives.json.template && \
    grep -q '"languages" *: \[ "html5" \]' directives.json.template

# install as a site would, with getapp.pl (genapp also runs util/build-tcp.sh, which builds util/msg-tcpserver),
# then finish appconfig.json as a site administrator would (test-appconfig.php); TEST_ADMIN administers them.
# demo and mulch come from svn, tutorial2 from the git repository of applications (ehb54/genapp_apps), at the
# tag of its svn import, so both kinds of install are tested
ARG TEST_ADMIN=testadmin
RUN cd $APPBASE && \
    for app in demo mulch; do \
        PATH=/usr/local/lib/genapp-test:$PATH GENAPP_TEST_APPS=/src/test-apps $GENAPP/sbin/getapp.pl -force -gen svn $app || exit 1; \
    done && \
    $GENAPP/sbin/getapp.pl -gen -ref svn-r1767/tutorial2 git tutorial2 && \
    for app in demo tutorial2 mulch; do \
        php /usr/local/lib/genapp-test/test-appconfig.php $app/appconfig.json $TEST_ADMIN || exit 1; \
    done && \
    test -x $APPBASE/demo/output/html5/util/msg-tcpserver && \
    cp $APPBASE/demo/output/html5/util/rc.genapp /etc/init.d/rc.genapp

# genapptest: the repository's maintained minimal html5 fixture, at the established /opt/genapp/genapptest
# path, as in dockerfiles/php7designer
RUN cp -a $GENAPP/t/fixtures/apps/minimal_html5 $APPBASE/genapptest && \
    cp $GENAPP/dockerfiles/php8designer/genapptest-directives.json $APPBASE/genapptest/directives.json && \
    cp $GENAPP/dockerfiles/php8designer/genapptest-appconfig.json $APPBASE/genapptest/appconfig.json && \
    chown -R genapp:genapp $APPBASE/genapptest && \
    cd $APPBASE/genapptest && \
    $GENAPP/bin/genapp --language=html5 -kl && \
    $GENAPP/sbin/htmlsetuppaths.pl
