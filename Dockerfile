FROM node:10.16.0-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (production only)
COPY src/package.json .
COPY src/yarn.lock .

RUN NODE_ENV=production yarn install \
  --prefer-offline \
  --pure-lockfile \
  --non-interactive \
  --production=true

# Bundle app source
COPY src .

EXPOSE 8081
CMD [ "npm", "start" ]
