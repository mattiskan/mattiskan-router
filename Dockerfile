FROM node
WORKDIR /src
COPY package.json /src/package.json
RUN npm install
COPY ./router/ /src/router
EXPOSE  8080

CMD node router/router.js 2>&1 | tee /log.file