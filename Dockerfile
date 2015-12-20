FROM node
EXPOSE  8080
WORKDIR /src
COPY package.json /src/package.json
RUN npm install
COPY ./router/ /src/router

CMD node router/router.js 2>&1 | tee /log.file