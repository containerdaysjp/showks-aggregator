FROM node:8-alpine

# Create app directory
WORKDIR /usr/src/app

# Install app dependencies (production only)
COPY src/package*.json ./
RUN npm install --only=production
RUN touch /final-amsy810
RUN echo hoge2

# Bundle app source
COPY src .

EXPOSE 8081
CMD [ "npm", "start" ]
