const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const instanceNamespace = io.of('/instance');
const port = process.env.PORT || 8081;

// Create a canvas for server-side drawing
const Canvas = require('canvas');
const canvas = new Canvas(CANVAS_WIDTH, CANVAS_HEIGHT);
const ctx = canvas.getContext('2d');
const thCanvas = new Canvas(THUMBNAIL_WIDTH, THUMBNAIL_HEIGHT);
const thCtx = thCanvas.getContext('2d');

var instances = [
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00001'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00002'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00003'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00004'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00005'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00006'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00007'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00008'},
  {'id': 'ABCDEFGHIJKLMNOPQRSTUVWXYZ00009'}
];

var nextId = 10;

// Fill the background
ctx.fillStyle="white";
ctx.fillRect(0, 0, canvas.width, canvas.height);

// Setup the express web app

// GET /
app.use(express.static(__dirname + '/public'));

// GET /instances
app.get('/instances', function (req, res) {
  res.type("json");
  res.send(JSON.stringify(instances));
})

// GET /thumbnail
app.get('/:id/thumbnail', function (req, res) {
  thCtx.drawImage(canvas, 0, 0, canvas.width, canvas.height, 0, 0, thCanvas.width, thCanvas.height);
  res.type("png");
  let stream = thCanvas.createPNGStream();
  stream.pipe(res);
})

// GET /author
app.get('/:id/author', function (req, res) {
  res.type("json");
  res.send(JSON.stringify({
    name: "Koji Hatanaka",
    twitter: "@kojiha__",
    note: "This endpoint is to be implemented"
  }));
})

// socket.io connection handler
function onInstanceConnection(socket) {
  console.log('Connected to instance namespace.');
}

function onNotificationConnection(socket) {
  console.log('Connected to notification namespace.');
}

// Start listening socket.io
instanceNamespace.on('connection', onInstanceConnection);

// Start listening on the port for HTTP request
http.listen(port, () => console.log('listening on port ' + port));

// Start timer for dummy data
setInterval(function () {
  if (0.8 < Math.random()) {
    let id = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' + ('00000' + nextId).slice();
    instances.push({'id': id});
    commandNamespace.emit('updated', id);
    ++nextId;
  }
}, 300)