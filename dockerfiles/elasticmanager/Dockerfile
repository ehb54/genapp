FROM debian

ENV SSHPORT 22
EXPOSE $SSHPORT/tcp

ENV GENAPP_UID                 54001
ENV GENAPP_GID                 54001

ENV JOBRUNNER_UID              54002
ENV JOBRUNNER_GID              54002
ENV JOBRUNNER_PRIVATE_KEY      jobrunner_rsa
ENV JOBRUNNER_PUBLIC_KEY       jobrunner_rsa.pub
ENV JOBRUNNER_AUTHORIZED_KEYS  jobrunner_authorized_keys
ENV SECRETS_JSON               secrets.json
ENV APPCONFIG_JSON             appconfig.json

ENV DEBIAN_FRONTEND noninteractive

RUN apt-get update
RUN apt-get install -y git
RUN apt-get install -y php-cli
RUN apt-get install -y pipx


## dev/maintenance tools

RUN cd && git clone https://github.com/ehb54/convenience &&  ./convenience/installcont.sh

RUN apt-get install -y emacs-nox

## ssh server

RUN apt-get install -y openssh-server

# Configure SSH 
RUN mkdir /var/run/sshd
RUN sed -i 's/PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config

# genapp

RUN groupadd --gid $GENAPP_GID genapp
RUN useradd -m --uid $GENAPP_UID --gid $GENAPP_GID -s /sbin/nologin -d /home/genapp genapp
RUN mkdir /src && cd /src && git clone https://github.com/ehb54/genapp && cd genapp && git checkout php7designer
RUN cd /src && chown -R genapp:genapp genapp && chmod -R g+w genapp

# Create a user 
RUN groupadd --gid $JOBRUNNER_GID jobrunner
RUN useradd -m --uid $JOBRUNNER_UID --gid $JOBRUNNER_GID -s /bin/bash -d /home/jobrunner jobrunner
RUN usermod -a -G genapp jobrunner
RUN mkdir /home/jobrunner/.ssh && chown jobrunner:jobrunner /home/jobrunner/.ssh
COPY $JOBRUNNER_PRIVATE_KEY      /home/jobrunner/.ssh/id_rsa
COPY $JOBRUNNER_PUBLIC_KEY       /home/jobrunner/.ssh/id_rsa.pub
COPY $JOBRUNNER_AUTHORIZED_KEYS  /home/jobrunner/.ssh/authorized_keys
RUN cd /home/jobrunner/.ssh && cat id_rsa.pub >> authorized_keys && chown -R jobrunner:jobrunner . && chmod go-rwx . && chmod go-rw * && chmod u-w * 


## merge these upstream as appropriate

USER jobrunner
RUN pipx ensurepath
RUN pipx install python-openstackclient
RUN ln -s /src/genapp/languages/html5/openstack /home/jobrunner/openstack
COPY $APPCONFIG_JSON /home/jobrunner/openstack/util/
COPY $SECRETS_JSON /home/jobrunner/openstack/util/

USER root
RUN chown -R jobrunner:jobrunner /home/jobrunner/openstack/util/*
RUN cp /root/.emacs /home/jobrunner/ && chown jobrunner:jobrunner /home/jobrunner/.emacs

USER jobrunner
RUN touch /home/jobrunner/p
RUN echo 'export PATH=$PATH:/home/jobrunner/.local/bin' >> /home/jobrunner/.bashrc

## setup commands

ENV SETUP_CMDS jobrunner_shell_setup
COPY $SETUP_CMDS /home/jobrunner/.local/bin/shell_setup

## mongo fake

ENV MONGO_FAKE mongo

COPY $MONGO_FAKE /home/jobrunner/.local/bin/

USER root
RUN chmod +x /home/jobrunner/.local/bin/shell_setup
RUN chmod +x /home/jobrunner/.local/bin/${MONGO_FAKE}
RUN chown jobrunner:jobrunner /home/jobrunner/.local/bin/*
RUN apt-get install -y jq



# CMD ["/usr/sbin/sshd", "-D"]
