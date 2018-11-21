const LABEL_SELECTOR = 'app=showks-canvas';

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
function getServiceUrl(obj) {
  let host = obj.spec.clusterIP;
  let port = obj.spec.ports[0].port;
  return `http://${host}:${port}`;
}

function getInstanceDetails(obj) {
  let instance = {
    id: obj.metadata.name,
    url: getServiceUrl(obj)
  }
  return instance;
}

// Pipe remote response to the HTTP client
function responseRemote(req, res, path) {
  console.log(`/${req.params.id}${path} called`);
  try {
    let instance = instances[req.params.id];
    let url = instance.url + path;
    console.log(`accessing ${url}`);
    got.stream(url).pipe(res);
  } catch (err) {
    console.log(`an error occurred on getting instance in /${req.params.id}${path}`);
    console.log(err);
    res.status(404).send("Page not found")
  }
}

// GET /
app.use(express.static(__dirname + '/public'));

// GET /instances
app.get('/instances', function (req, res) {
  res.type("json");
  res.send(JSON.stringify(instances));
})

// GET /thumbnail
app.get('/:id/thumbnail', function (req, res) {
  responseRemote(req, res, '/thumbnail');
})

// GET /author
app.get('/:id/author', function (req, res) {
  responseRemote(req, res, '/author');
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
    labelSelector: LABEL_SELECTOR
  },
  (type, obj) => {
    try {
      if (type == 'ADDED' || type == 'MODIFIED') {
        console.log('added or modified object:');
        let id = obj.metadata.name;
        instances[id] = getInstanceDetails(obj);
        instanceNamespace.emit('updated', id);

      } else if (type == 'DELETED') {
        console.log('deleted object:');
        let id = obj.metadata.name;
        delete instances[id];
        instanceNamespace.emit('deleted', id);

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
