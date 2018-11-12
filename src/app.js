const got = require('got');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const instanceNamespace = io.of('/instance');
const port = process.env.PORT || 8081;

// Kubernetes Client
const k8s = require('@kubernetes/client-node');
const k8sApiEndpoint = '/api/v1/watch/namespaces/showks/services';
const kc = new k8s.KubeConfig();
kc.loadFromCluster();


// Instances
let instances = {};

// Helper functions
function getServiceUrl(instance) {
  let host = obj.spec.clusterIP;
  let port = obj.spec.ports[0].port;
  return `http://${host}:${port}`;
}


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
  let url;
  try {
    let instance = instances[id];
    url = getServiceUrl(instance);
  } catch (err) {
    console.log('an error occurred on getting instance in /:id/author');
    console.log(err);
  }
  got(`http://${host}:${port}`, {})
  .then(response => {
    console.log('responce: ' + response.body);
    res.type("json");
    res.send(response.body);
  }).catch(error => {
    console.log('an error occurred on fetching author in /:id/author');
    console.log(error);
  });
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
let watch = new k8s.Watch(kc);
let req = watch.watch(
  k8sApiEndpoint,
  {
    labelSelector: 'app=canvas'
  },
  (type, obj) => {
    try {
      if (type == 'ADDED' || type == 'MODIFIED') {
        console.log('added or modified object:');
        instances[obj.metadata.name] = obj;
  //      commandNamespace.emit('updated', obj.metadata.name);
      } else if (type == 'DELETED') {
        console.log('deleted object:');
        delete instances[obj.metadata.name];
  //      commandNamespace.emit('deleted', obj.metadata.name);
      } else {
        console.log('unknown type: ' + type);
      }
      console.log(obj);  
    } catch (err) {
      console.log('an error occurred on parsing service object');
      console.log(err);
    }
  },
  // done callback is called if the watch terminates normally
  (error) => {
      if (error) {
        console.log('an error occurred in the watch callback');
        console.log(error);
      }
  });
