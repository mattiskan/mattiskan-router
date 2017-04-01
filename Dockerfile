FROM  ubuntu:latest

ENTRYPOINT ["/usr/bin/dumb-init", "--"]

RUN apt-get update && apt-get install -y nodejs npm wget
RUN wget https://github.com/Yelp/dumb-init/releases/download/v1.2.0/dumb-init_1.2.0_amd64.deb
RUN dpkg -i dumb-init_*.deb

EXPOSE  8080

WORKDIR /src
COPY package.json /src/package.json
RUN npm install
COPY ./router/ /src/router

CMD ["nodejs", "router/router.js"]