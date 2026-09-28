# syntax=docker/dockerfile:1.7
FROM ubuntu:20.04 AS php7designer-security-base

# user config

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

# end user config

ENV DEBIAN_FRONTEND=noninteractive

ARG MONGODB_VERSION=8.0.32
ARG MONGODB_MONGOSH_VERSION=2.12.0
ARG THRIFT_JAVA_VERSION=0.24.0
ARG THRIFT_JAVA_SHA256=b72e321ff144e3e5211964764bd45794b96fdf250085f153c44416b35df89a07

EXPOSE 22/tcp
EXPOSE 80/tcp
EXPOSE 443/tcp
EXPOSE $ZMQPORT/tcp
EXPOSE $UDPPORT/udp
EXPOSE $TCPPORT/tcp
EXPOSE $TCPRPORT/tcp
EXPOSE $MONGOPORT/tcp

RUN mkdir -p $SRCBASE $APPBASE

# Install every APT-managed package while Ubuntu Pro is attached.  The attach
# config is a BuildKit secret containing the account token plus esm-infra and
# esm-apps.  Attach, update, install, detach, and cleanup must remain in this
# single layer so neither the token nor Pro APT credentials enter the image.
RUN --mount=type=secret,id=pro-attach-config,required=true \
    set -eux; \
    test -s /run/secrets/pro-attach-config; \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 -o Acquire::https::Timeout=60 update; \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 -o Acquire::https::Timeout=60 install -y --no-install-recommends ca-certificates ubuntu-pro-client; \
    if ! pro attach --attach-config /run/secrets/pro-attach-config >/tmp/pro-attach.log 2>&1; then \
        cat /tmp/pro-attach.log >&2; \
        exit 1; \
    fi; \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 -o Acquire::https::Timeout=60 update; \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 -o Acquire::https::Timeout=60 upgrade -y; \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 -o Acquire::https::Timeout=60 install -y --no-install-recommends \
        abiword \
        apache2 \
        apt-utils \
        bc \
        bind9-host \
        build-essential \
        curl \
        emacs-nox \
        git \
        gnupg \
        golang \
        libapache2-mod-php \
        libcurl3-openssl-dev \
        libmagickwand-6.q16-dev \
        liblwp-protocol-https-perl \
        libnode-dev \
        libssl-dev \
        libzmq3-dev \
        mlocate \
        node-gyp \
        npm \
        openjdk-11-jre-headless \
        openssh-server \
        php-curl \
        php-dev \
        php-gd \
        php-mail \
        php-mail-mime \
        php-mbstring \
        php-net-smtp \
        php-pear \
        php-xml \
        php-zip \
        php-zmq \
        pkg-config \
        re2c \
        software-properties-common \
        subversion \
        unzip \
        uuid-dev \
        vim \
        wget \
        zip \
        zlib1g-dev; \
    install -d -m 0755 /etc/apt/keyrings; \
    curl -fsSL -o /tmp/mongodb-server-8.0.asc https://pgp.mongodb.com/server-8.0.asc; \
    gpg --dearmor --batch --yes \
        --output /etc/apt/keyrings/mongodb-server-8.0.gpg \
        /tmp/mongodb-server-8.0.asc; \
    echo "deb [arch=amd64 signed-by=/etc/apt/keyrings/mongodb-server-8.0.gpg] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/8.0 multiverse" \
        > /etc/apt/sources.list.d/mongodb-org-8.0.list; \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 -o Acquire::https::Timeout=60 update; \
    apt-get -o Acquire::Retries=5 -o Acquire::http::Timeout=60 -o Acquire::https::Timeout=60 install -y --no-install-recommends \
        "mongodb-org-server=${MONGODB_VERSION}" \
        "mongodb-mongosh=${MONGODB_MONGOSH_VERSION}"; \
    apt-mark hold \
        mongodb-org-server \
        mongodb-mongosh; \
    rm -f /etc/ssh/ssh_host_*_key /etc/ssh/ssh_host_*_key.pub; \
    pro detach --assume-yes; \
    apt-get purge --auto-remove -y ubuntu-pro-client; \
    rm -f /tmp/mongodb-server-8.0.asc /tmp/pro-attach.log; \
    rm -rf /var/lib/apt/lists/* /var/lib/ubuntu-advantage/private; \
    rm -f /etc/apt/auth.conf.d/90ubuntu-advantage; \
    test ! -e /etc/apt/auth.conf.d/90ubuntu-advantage; \
    test ! -d /var/lib/ubuntu-advantage/private

# cpan minus for modules

RUN curl -L http://cpanmin.us | perl - App::cpanminus
    
RUN cpanm JSON Hash::Merge Data::Dumper Try::Tiny MIME::Lite MIME::Base64

# PHP 7.4 is supported by the MongoDB 1.20 extension line.  Pin every PECL
# extension so a future upstream release cannot silently raise the PHP floor.
RUN yes '' | pecl install uuid-1.3.0 mongodb-1.20.1 imagick-3.8.1 && \
    test -s /usr/lib/php/20190902/uuid.so && \
    test -s /usr/lib/php/20190902/mongodb.so && \
    test -s /usr/lib/php/20190902/imagick.so
RUN echo "extension=mongodb.so" >> /etc/php/7.4/cli/php.ini && \
    echo "extension=uuid.so" >> /etc/php/7.4/cli/php.ini && \
    echo "extension=imagick.so" >> /etc/php/7.4/cli/php.ini
RUN echo "extension=mongodb.so" >> /etc/php/7.4/apache2/php.ini && \
    echo "extension=uuid.so" >> /etc/php/7.4/apache2/php.ini && \
    echo "extension=imagick.so" >> /etc/php/7.4/apache2/php.ini

#RUN echo '; configuration for php zmq module\n\
#; priority=20\n\
#extension=zmq.so\n'\
#> /etc/php/5.6/mods-available/zmq.ini

#RUN echo '; Enable imagick extension module\n\   
#extension=imagick.so\n'\
#> /etc/php/7.4/mods-available/imagick.ini

#RUN echo '; Enable mongo extension module\n\
#extension=mongo.so\n'\
#> /etc/php/7.4/mods-available/mongo.ini

#Install Python libs
#RUN apt-get install -y python3-numpy python3-scipy python3-matplotlib
#Install Python 2.7

#RUN add-apt-repository -y ppa:deadsnakes/ppa && \
#    apt-get update && \
#    apt-get install -y python2.7
#    apt-get install -y python-scipy Add here if necessary
#Need to install python 2.7 modules in container?

#RUN phpenmod zmq mongo imagick
RUN phpenmod zmq imagick

# TODO ... probably should get version of PHP and use that as a variable, otherwise we will have to change path on PHP upgrades
RUN sed -i.org "s/^disable_functions = pcntl/;disable_functions = pcntl/" /etc/php/7.4/apache2/php.ini

RUN echo "# ws proxy pass\n\
# priority=20\n\
ProxyPass /ws2 ws://localhost:$WSPORT/\n"\
> /etc/apache2/mods-available/wsproxy.conf

RUN echo '\n'\
> /etc/apache2/mods-available/wsproxy.load

RUN echo "# wss proxy pass\n\
# priority=20\n\
ProxyPass /wss2 ws://localhost:$WSPORT/\n"\
> /etc/apache2/mods-available/wssproxy.conf

RUN echo '\n'\
> /etc/apache2/mods-available/wssproxy.load

RUN a2enmod proxy proxy_wstunnel wsproxy

RUN echo "TraceEnable Off\n\
ServerTokens Prod\n\
ServerSignature Off\n"\
> /etc/apache2/conf-enabled/security-hardening.conf

RUN ln -s /usr/bin/php /usr/local/bin/php

# mpi optional
# RUN apt-get install -y mpich

# qt optional
# RUN apt-get install -y qt5-default

# Careful here, if the genapp.git changes, you should force docker to not use a cache'd image for this
# options:
# 1. $ docker builder prune
#   ^^^ this removes all build cache images according to https://forums.docker.com/t/how-to-delete-cache/5753/4
#   ^^^ N.B. needs docker API version 1.39 or greater
#
# 2. $ docker system prune
#   ^^^ this will remove a bunch of other things too
#
# 3. add a unique RUN command here e.g. RUN echo something-unique
#   ^^^ this RUN method would require changing to something else unique every time the genapp.git changed
#
# 4. docker build --no-cache ...
#
# note 1., 2. & 4. will force the compile to take longer (all steps will have to RUN)
# 3. seems most efficient in terms of build-time - but you have to make sure you put something unique on the RUN line

# The default HTML5 target copies its assembled JavaScript and does not invoke
# Closure Compiler.  Omit the dormant compiler JAR from this hardened PHP image
# rather than ship its vulnerable shaded dependencies.  Keep the Java target's
# Thrift runtime, but replace its obsolete 0.9.1 JAR with a checksum-verified
# release that remains compatible with the existing Airavata stubs.
RUN cd $SRCBASE && \
    git clone https://github.com/ehb54/genapp.git && \
    cd $GENAPP && \
    git checkout php7designer && \
    rm -f etc/closure_compiler.jar languages/java/add/lib/libthrift-0.9.1.jar && \
    curl -fsSL \
        -o "languages/java/add/lib/libthrift-${THRIFT_JAVA_VERSION}.jar" \
        "https://repo1.maven.org/maven2/org/apache/thrift/libthrift/${THRIFT_JAVA_VERSION}/libthrift-${THRIFT_JAVA_VERSION}.jar" && \
    echo "${THRIFT_JAVA_SHA256}  languages/java/add/lib/libthrift-${THRIFT_JAVA_VERSION}.jar" | sha256sum -c -
RUN touch $GENAPPETC/no_sudo

RUN groupadd -g 5401 genapp && \
    useradd genapp -r -s /usr/sbin/nologin -d $APPBASE -u 5401 -g genapp && \
    chmod g+rwx $APPBASE && \
    chown genapp:genapp $APPBASE && \
    chmod g+s $APPBASE && \
    mkdir -p $LOCKDIR && \
    chown genapp:genapp $LOCKDIR && \
    chmod g+rwx $LOCKDIR && \
    usermod -g users -G genapp genapp && \
    usermod -G genapp www-data && \
    chgrp -R genapp $GENAPP && \
    chmod g+w $GENAPP/etc

RUN echo "export GENAPP=$GENAPP\n\
export PATH=\$GENAPP/bin:$PATH\n"\
> /etc/profile.d/genapp.sh

RUN echo "<?php\n\
phpinfo();\n\
?>\n"\
> $WEBROOT/php_info.php

# setup genapptest instance

# Keep the security/runtime base independently buildable.  The maintained
# minimal HTML5 fixture below validates the complete designer image but is not
# needed to verify the patched operating-system and web-server boundary.
FROM php7designer-security-base AS php7designer-generated

RUN $GENAPP/sbin/setconfig.pl -pj

# The former SVN genapptest project no longer generates with the current
# repository.  Reuse the repository's maintained workflow fixture while
# retaining the established /opt/genapp/genapptest runtime path.
COPY --chown=genapp:genapp t/fixtures/apps/minimal_html5/ $APPBASE/genapptest/
COPY --chown=genapp:genapp dockerfiles/php7designer/genapptest-directives.json \
    $APPBASE/genapptest/directives.json
COPY --chown=genapp:genapp dockerfiles/php7designer/genapptest-appconfig.json \
    $APPBASE/genapptest/appconfig.json
RUN cd $APPBASE/genapptest && \
    $GENAPP/bin/genapp --language=html5 -kl && \
    $GENAPP/sbin/htmlsetuppaths.pl

RUN cp $APPBASE/genapptest/output/html5/util/rc.genapp /etc/init.d

RUN echo "# add Alias /genapptest $WEBROOT/genapptest\n\
<Directory $WEBROOT/genapptest>\n\
 Options FollowSymLinks\n\
 AllowOverride None\n\
 Order Allow,Deny\n\
 Allow from all\n\
</Directory>\n\
<Directory /var/www/>\n\
	Options FollowSymLinks\n\
	AllowOverride None\n\
	Require all granted\n\
</Directory>\n"\
> /etc/apache2/conf-enabled/security.conf

RUN /etc/init.d/apache2 stop && \
    rm -fr /var/run/apache2/apache2.pid ; exit 0

#Generate mongodb init script: Mongodb.com doesn't provide init script for ubuntu 18.04 !!!!    
RUN curl -o /etc/init.d/mongodb https://raw.githubusercontent.com/mongodb/mongo/master/debian/init.d && \
    chmod +x /etc/init.d/mongodb && \
    sed -i.org "s/ulimit -l unlimited//g" /etc/init.d/mongodb 

# no service available in container
RUN /usr/bin/mongod --config /etc/mongod.conf &

#Check versions of php, mongod, php-mongodb driver 
RUN php --version && \
    mongod --version && \
    php --ri mongodb | grep version 
    
#Install Composer
# not needed - was TODO: package should be installed by "composer require package" at the local directory within GENAPP 
RUN curl -s https://getcomposer.org/installer | php && \
    mv composer.phar /usr/local/bin/composer

# emre's bits - not for production ... they don't hurt so you can leave them or comment them out
# TODO: put under --build-arg conditional https://stackoverflow.com/questions/43654656/dockerfile-if-else-condition-with-external-arguments
RUN mkdir ~/bin
RUN echo 'env TERM=vt100 emacs -nw $*' > ~/bin/e
RUN echo 'ls -sxF $*' > ~/bin/s
RUN echo 'ls -lt $* | head -40' > ~/bin/lth
RUN chmod +x ~/bin/*
RUN echo 'export EDITOR=vi' > ~/p 
RUN echo '. /etc/profile' >> ~/p
RUN echo 'export PATH=$PATH:~/bin' >> ~/p 
RUN cd ~ && tar zxvf /src/genapp/tmp/extra/ee.gz

# Generate a unique SSH server identity for each container instead of storing
# build-time host private keys in the image.  Wait for the bundled MongoDB
# server before starting GenApp messaging; a fresh MongoDB 8 data directory can
# take longer to initialize than the former MongoDB 4.2 runtime.
# no service or systemctl in container
CMD ["/bin/sh", "-c", "ssh-keygen -A && (/usr/bin/mongod --config /etc/mongod.conf &) && for i in $(seq 1 60); do mongosh --quiet --eval 'quit(db.adminCommand({ ping: 1 }).ok ? 0 : 1)' >/dev/null 2>&1 && break; test \"$i\" -lt 60 || exit 1; sleep 1; done && /etc/init.d/rc.genapp start && rm -f /run/apache2/apache2.pid && /etc/init.d/apache2 start && while true; do sleep 600; done"]

# Ubuntu 20.04 supplies an obsolete Go toolchain.  Build the small GenApp TCP
# messaging server with a checksum-pinned current Go release on the same
# digest-pinned Ubuntu 20.04 base as the runtime.  Matching the builder's glibc
# to the runtime is required because the ZeroMQ binding uses CGO.
FROM ubuntu:20.04@sha256:8feb4d8ca5354def3d8fce243717141ce31e2c428701f6682bd2fafe15388214 AS genapp-messaging-builder

ARG GO_VERSION=1.27.1
ARG GO_LINUX_AMD64_SHA256=63d339f0da5ab53635a56f2490a7984dfe12dfcff22ad749f63edaf590168445

RUN apt-get update && \
    apt-get install -y --no-install-recommends ca-certificates curl gcc libzmq3-dev pkg-config && \
    curl -fsSL -o /tmp/go.tar.gz "https://go.dev/dl/go${GO_VERSION}.linux-amd64.tar.gz" && \
    echo "${GO_LINUX_AMD64_SHA256}  /tmp/go.tar.gz" | sha256sum -c - && \
    tar -C /usr/local -xzf /tmp/go.tar.gz && \
    rm -f /tmp/go.tar.gz && \
    rm -rf /var/lib/apt/lists/*

ENV PATH=/usr/local/go/bin:$PATH

WORKDIR /build
COPY --from=php7designer-generated \
    /opt/genapp/genapptest/output/html5/util/msg-tcpserver.go ./
RUN go mod init genapp.local/msg-tcpserver && \
    go mod edit -replace=github.com/ehb54/go-ps=github.com/mitchellh/go-ps@v1.0.0 && \
    go mod edit -replace=github.com/ehb54/zmq4=github.com/pebbe/zmq4@v1.2.7 && \
    go get github.com/ehb54/lockfile@cc765475c0b71203143551503b096080206f5d73 && \
    go mod edit -require=github.com/ehb54/zmq4@v1.2.7 && \
    go mod download github.com/ehb54/zmq4 && \
    CGO_ENABLED=1 go build -trimpath -buildvcs=false -o msg-tcpserver ./msg-tcpserver.go

FROM php7designer-generated AS php7designer

COPY --from=genapp-messaging-builder --chown=root:genapp \
    /build/msg-tcpserver \
    /opt/genapp/genapptest/output/html5/util/msg-tcpserver
RUN chmod 0755 /opt/genapp/genapptest/output/html5/util/msg-tcpserver
