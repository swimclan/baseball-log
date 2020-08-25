FROM node:latest

#create app folder
RUN mkdir /baseball-log
WORKDIR /baseball-log

#cache npm dependencies
COPY package.json /baseball-log
RUN npm install

#copy application files
COPY . /baseball-log

#run the application in the image
CMD ["node", "index.js"]