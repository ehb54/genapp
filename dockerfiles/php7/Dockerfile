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
    apt-get install -y bind9-host && \
    apt-get install -y subversion git libssl-dev bc apache2 curl wget && \
    apt-get install -y zlib1g-dev && \
    apt-get install -y software-properties-common && \
    apt-get install -y pkg-config && \
    apt-get install -y re2c && \
    apt-get install -y libzmq3-dev && \
    apt-get install -y uuid-dev && \
    apt-get install -y abiword && \
    apt-get install -y libmagickwand-6.q16-dev && \
    apt-get install -y openssh-server && \
    apt-get install -y vim && \
    apt-get install -y emacs-nox

RUN apt-get update && \
    apt-get install -y mlocate php-pear libcurl3-openssl-dev libapache2-mod-php && \
    apt-get install -y php7.2-curl php7.2-dev php7.2-gd php7.2-mbstring php7.2-zip php7.2-xml

# Mongodb bionic from mongodb.org & suppress upgrade by apt-get
RUN apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv 9DA31620334BD75D9DCB49F368818C72E52529D4 && \
    echo "deb [ arch=amd64 ] https://repo.mongodb.org/apt/ubuntu bionic/mongodb-org/4.0 multiverse" | tee /etc/apt/sources.list.d/mongodb-org-4.0.list && \
    apt-get update && \
    apt-get install -y mongodb-org && \
    echo "mongodb-org hold" | dpkg --set-selections && \
    echo "mongodb-org-server hold" | dpkg --set-selections && \
    echo "mongodb-org-shell hold" | dpkg --set-selections && \
    echo "mongodb-org-mongos hold" | dpkg --set-selections && \
    echo "mongodb-org-tools hold" | dpkg --set-selections

# cpan minus for modules

RUN curl -L http://cpanmin.us | perl - App::cpanminus
    
RUN cpanm JSON Hash::Merge Data::Dumper Try::Tiny LWP::UserAgent MIME::Lite MIME::Base64
RUN cpanm -n Net::SSLeay IO::Socket::SSL
RUN cpanm LWP::Protocol::https

RUN pear channel-update pear.php.net
RUN pear install --alldeps Mail Mail_Mime Net_SMTP
#RUN yes '' | pecl install uuid zmq-beta mongo imagick
#Mongodb php driver with pecl
#RUN yes '' | pecl install uuid zmq-beta mongodb imagick
# Check zmq-bata or apt-get -y install php-zmq
RUN yes '' | pecl install uuid mongodb imagick
RUN echo "extension=mongodb.so" >> /etc/php/7.2/cli/php.ini && \
    echo "extension=uuid.so" >> /etc/php/7.2/cli/php.ini && \
    echo "extension=imagick.so" >> /etc/php/7.2/cli/php.ini
RUN echo "extension=mongodb.so" >> /etc/php/7.2/apache2/php.ini && \
    echo "extension=uuid.so" >> /etc/php/7.2/apache2/php.ini && \
    echo "extension=imagick.so" >> /etc/php/7.2/apache2/php.ini

RUN apt-get install -y php-zmq

#RUN echo '; configuration for php zmq module\n\
#; priority=20\n\
#extension=zmq.so\n'\
#> /etc/php/5.6/mods-available/zmq.ini

#RUN echo '; Enable imagick extension module\n\   
#extension=imagick.so\n'\
#> /etc/php/7.2/mods-available/imagick.ini

#RUN echo '; Enable mongo extension module\n\
#extension=mongo.so\n'\
#> /etc/php/7.2/mods-available/mongo.ini

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
RUN sed -i.org "s/^disable_functions = pcntl/;disable_functions = pcntl/" /etc/php/7.2/apache2/php.ini

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

#GENAPP specifics
RUN apt-get install -y zip unzip
# for google closure minifier
RUN apt-get install -y openjdk-11-jre-headless

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

RUN cd $SRCBASE && git clone https://github.com/ehb54/genapp.git && cd $GENAPP && git checkout php7
RUN touch $GENAPPETC/no_sudo

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

# TODO: later update getapp.pl to use GIT ... likely own repos
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

RUN /etc/init.d/apache2 stop && \
    rm -fr /var/run/apache2/apache2.pid ; exit 0

#Generate mongodb init script: Mongodb.com doesn't provide init script for ubuntu 18.04 !!!!    
RUN curl -o /etc/init.d/mongodb https://raw.githubusercontent.com/mongodb/mongo/master/debian/init.d && \
    chmod +x /etc/init.d/mongodb && \
    sed -i.org "s/ulimit -l unlimited//g" /etc/init.d/mongodb 

RUN service mongodb start 

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

CMD service mongodb start && \
    /etc/init.d/rc.genapp start && \
    /etc/init.d/apache2 start && \
    while true; do sleep 600; done
