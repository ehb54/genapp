FROM ubuntu

# user config

ENV SRCBASE /src
ENV GENAPP $SRCBASE/genapp

ENV APPBASE /opt/genapp
ENV WEBROOT /var/www/html
ENV GENAPPETC $GENAPP/etc
ENV LOCKDIR $GENAPPETC

ENV WSPORT    30777
ENV ZMQPORT   30778
ENV UDPPORT   30779
ENV TCPPORT   30780
ENV TCPRPORT  30781
ENV MONGOPORT 27017

# end user config

ENV DEBIAN_FRONTEND noninteractive

EXPOSE 22/tcp
EXPOSE 80/tcp
EXPOSE 443/tcp
EXPOSE $ZMQPORT/tcp
EXPOSE $UDPPORT/udp
EXPOSE $TCPRPORT/tcp
EXPOSE $TCPRPORT/tcp
EXPOSE $MONGOPORT/tcp

RUN mkdir -p $SRCBASE $APPBASE

# basic install stuff

RUN apt-get update && \
    apt-get install -y --no-install-recommends apt-utils && \
    apt-get install -y build-essential && \
    apt-get install -y software-properties-common && \
    add-apt-repository -y ppa:ondrej/php && \
    apt-get update && \
    apt-get install -y bind9-host && \
    apt-get install -y subversion git libssl-dev bc apache2 curl wget && \
    apt-get install -y zlib1g-dev && \
    apt-get install -y software-properties-common && \
    apt-get install -y pkg-config && \
    apt-get install -y mlocate php5.6-dev libapache2-mod-php5.6 php5.6-xml && \
    apt-get install -y re2c && \
    apt-get install -y libzmq3-dev && \
    apt-get install -y uuid-dev && \
    apt-get install -y abiword && \
    apt-get install -y mongodb && \
    apt-get install -y libmagickwand-6.q16-dev && \
    apt-get install -y openssh-server && \
    cd $SRCBASE && svn co svn://svn.genapp.rocks/svn/base/genappalpha genapp

RUN touch $GENAPPETC/no_sudo

# cpan minus for modules

RUN curl -L http://cpanmin.us | perl - App::cpanminus
    
RUN cpanm JSON Hash::Merge Data::Dumper Try::Tiny LWP::UserAgent MIME::Lite MIME::Base64 LWP::Protocol::https

RUN pear channel-update pear.php.net
RUN pear install --alldeps Mail Mail_Mime Net_SMTP
RUN yes '' | pecl install uuid zmq-beta mongo imagick

RUN echo '; configuration for php zmq module\n\
; priority=20\n\
extension=zmq.so\n'\
> /etc/php/5.6/mods-available/zmq.ini

RUN echo '; Enable imagick extension module\n\
extension=imagick.so\n'\
> /etc/php/5.6/mods-available/imagick.ini

RUN echo '; Enable mongo extension module\n\
extension=mongo.so\n'\
> /etc/php/5.6/mods-available/mongo.ini

RUN phpenmod zmq mongo imagick

RUN sed -i.org "s/^disable_functions = pcntl/;disable_functions = pcntl/" /etc/php/5.6/apache2/php.ini

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

RUN ln -s /usr/bin/php /usr/local/bin/php

RUN groupadd genapp && \
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
    chmod g+w $GENAPP/etc

RUN echo "export GENAPP=$GENAPP\n\
export PATH=\$GENAPP/bin:$PATH\n"\
> /etc/profile.d/genapp.sh

RUN echo "<?php\n\
phpinfo();\n\
?>\n"\
> $WEBROOT/php_info.php

# setup genapptest instance

RUN $GENAPP/sbin/setconfig.pl -pj

RUN cd $APPBASE && $GENAPP/sbin/getapp.pl -force -gen svn genapptest

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


# seedme2 integration additions

## dependencies

RUN apt-get install -y libcurl4-openssl-dev libreadline-dev unzip

## php7

RUN cd $SRCBASE && \
    curl -o php-7.2.10.tar.gz -L http://php.net/get/php-7.2.10.tar.gz/from/this/mirror && \
    tar xzf php-7.2.10.tar.gz && \
    rm php-7.2.10.tar.gz && \
    cd php-7.2.10 && \
    ./configure --prefix=/usr/local/php/7.2.10 \
        --disable-all --enable-cli --enable-mbstring --with-curl  --disable-cgi --enable-json --with-readline && \
    make -j4 && \
    make install -j4

## seedme2 foldershare

RUN cd $SRCBASE && \
    curl -O https://dibbs.seedme.org/sites/dibbs.seedme.org/files/downloads/foldershare.0.5.4.zip && \
    unzip foldershare* && \
    rm foldershare.0.5.4.zip && \
    cp foldershare/applications/foldershare /usr/bin && \
    sed -i '1s/^.*$/#!\/usr\/local\/php\/7.2.10\/bin\/php/' /usr/bin/foldershare

## need to expose mongod
### generate certs

RUN cd /etc/ssl/ && \
    openssl req -newkey rsa:2048 -new -subj '/C=US/CN=127.0.0.1' -x509 -days 365 -nodes -out mongodb-cert.crt -keyout mongodb-cert.key && \
    cat mongodb-cert.key mongodb-cert.crt > mongodb.pem

### setup mongod for certs

RUN echo "# mongod.conf \
# for documentation of all options, see: \
#   http://docs.mongodb.org/manual/reference/configuration-options/ \
\
# Where and how to store data. \
storage: \
  dbPath: /var/lib/mongodb \
  journal: \
    enabled: true \
#  engine: \
#  mmapv1: \
#  wiredTiger: \
 \
# where to write logging data. \
systemLog: \
  destination: file \
  logAppend: true \
  path: /var/log/mongodb/mongod.log \
 \
# network interfaces \
net: \
  port: 27017 \
  bindIp: 127.0.0.1 \
  ssl: \
    mode: requireSSL \
    PEMKeyFile: /etc/ssl/mongodb.pem \
 \
# how the process runs \
processManagement: \
  timeZoneInfo: /usr/share/zoneinfo \
 \
#security: \
 \
#operationProfiling: \
 \
#replication: \
 \
#sharding: \
 \
## Enterprise-Only Options: \
 \
#auditLog: \
 \
#snmp: \
" > /etc/mongod.conf

### add to config.json
RUN $GENAPP/sbin/setconfig.pl -mongossl 127.0.0.1 /etc/ssl/mongod-crt.crt &&
    $GENAPP/sbin/reconfig

# forever loop
CMD /etc/init.d/mongodb start && \
    /etc/init.d/rc.genapp start && \
    /etc/init.d/apache2 start && \
    while true; do sleep 600; done
    
