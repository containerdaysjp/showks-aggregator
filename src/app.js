const K8S_NAMESPACE = 'showks';
const K8S_LABEL_SELECTOR = 'app=showks-canvas';

const got = require('got');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const instanceNamespace = io.of('/instance');
const port = process.env.PORT || 8081;


// Kubernetes Client
const k8s = require('@kubernetes/client-node');
const k8sApiEndpoint = `/api/v1/watch/namespaces/${K8S_NAMESPACE}/services`;
const kc = new k8s.KubeConfig();
kc.loadFromCluster();


// Instances
let instances = {};

function addInstance(obj) {
  let id = obj.metadata.name;
  instances[id] = getInstanceDetails(obj);
  instanceNamespace.emit('updated', id);
  console.log(`Added ${id}`);
}

function deleteInstance(obj) {
  let id = obj.metadata.name;
  delete instances[id];
  instanceNamespace.emit('deleted', id);
  console.log(`Deleted ${id}`);
}


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


// Get list of services
const k8sApi = kc.makeApiClient(k8s.Core_v1Api);
//  public listNamespacedService (namespace: string, pretty?: string, _continue?: string, fieldSelector?: string, includeUninitialized?: boolean, labelSelector?: string, limit?: number, resourceVersion?: string, timeoutSeconds?: number, watch?: boolean) : Promise<{ response: http.IncomingMessage; body: V1ServiceList;  }>
k8sApi.listNamespacedService(K8S_NAMESPACE, undefined, undefined, undefined, false, K8S_LABEL_SELECTOR)
.then((res) => {
  // console.log(res.body);
  try {
    let resourceVersion = res.body.metadata.resourceVersion;
    console.log(`Retrieved service list (resourceVersion: ${resourceVersion})`);
    let items = res.body.items;
    items.forEach((obj) => {
      addInstance(obj);
    });
    return resourceVersion;
  } catch (err) {
    console.log('an error occurred on parsing service list');
    console.log(err);
  }
})
.then((resourceVersion) => {
  // Start watching Kubernetes cluster
  console.log(`Start watching Kubernetes cluster from resourceVersion: ${resourceVersion}`);
  let watch = new k8s.Watch(kc);
  let req = watch.watch(
    k8sApiEndpoint,
    {
      labelSelector: K8S_LABEL_SELECTOR,
      resourceVersion: resourceVersion
    },
    (type, obj) => {
      // console.log(obj);  
      try {
        if (type == 'ADDED' || type == 'MODIFIED') {
          // console.log('added or modified object:');
          addInstance(obj);

        } else if (type == 'DELETED') {
          // console.log('deleted object:');
          deleteInstance(obj);

        } else {
          console.log('unknown type: ' + type);

        }
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
});
