const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const instanceNamespace = io.of('/instance');
const port = process.env.PORT || 8081;

// Kubernetes Client
const k8s = require('@kubernetes/client-node');
const apiEndpoint = '/api/v1/watch/namespaces/default/services';

// Instances
let instances = {};

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

// Start watching Kubernetes cluster
const kc = new k8s.KubeConfig();
kc.loadFromDefault();
//kc.loadFromFile(`${process.env.HOME}/.kube/config`)
let watch = new k8s.Watch(kc);
let req = watch.watch(
  apiEndpoint,
  {},
  (type, obj) => {
    if (type == 'ADDED') {
      console.log('new object:');
      instances[obj.metadata.name] = obj;
      commandNamespace.emit('updated', obj.metadata.name);
    } else if (type == 'MODIFIED') {
      console.log('changed object:')
      instances[obj.metadata.name] = obj;
      commandNamespace.emit('updated', obj.metadata.name);
    } else if (type == 'DELETED') {
      console.log('deleted object:');
      delete instances[obj.metadata.name];
      commandNamespace.emit('deleted', obj.metadata.name);
    } else {
      console.log('unknown type: ' + type);
    }
    console.log(obj);
  },
  // done callback is called if the watch terminates normally
  (err) => {
      if (err) {
          console.log(err);
      }
  });
