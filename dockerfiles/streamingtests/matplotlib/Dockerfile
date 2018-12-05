FROM ubuntu

ENV BASEDIR /test
ENV LISTENPORT 8080

expose $LISTENPORT/tcp

RUN mkdir -p $BASEDIR

RUN apt-get update
RUN apt-get install -y python python-pip wget
RUN pip install matplotlib numpy tornado

RUN cd $BASEDIR && \
    wget https://matplotlib.org/examples/user_interfaces/embedding_webagg.py && \
    sed -i "s/8080/$LISTENPORT/" embedding_webagg.py 

CMD cd $BASEDIR && python embedding_webagg.py



