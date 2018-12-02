'use strict';

const K8S_NAMESPACE = 'showks';
const K8S_LABEL_SELECTOR = 'class=showks-canvas';
const CACHE_MAX_AGE = {
  '/author' : 30000,
  '/thumbnail' : 6000
};

const version = process.env.npm_package_version;
const got = require('got');
const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);
const instanceNamespace = io.of('/instance');
const port = process.env.PORT || 8081;
const allowHost =
  process.env.ALLOW_HOST !== undefined && process.env.ALLOW_HOST !== ""
    ? process.env.ALLOW_HOST
    : "http://localhost:3000";

// Kubernetes Client
const k8s = require('@kubernetes/client-node');
const k8sApiEndpoint = `/api/v1/watch/namespaces/${K8S_NAMESPACE}/services`;
const kc = new k8s.KubeConfig();
kc.loadFromCluster();
//kc.loadFromDefault();
const k8sApi = kc.makeApiClient(k8s.Core_v1Api);
const k8sExtentionsApi = kc.makeApiClient(k8s.Extensions_v1beta1Api);


// Instances
let instances = {};
let instanceCache = {};

function addInstance(obj) {
  let id = obj.metadata.name;
  instances[id] = getInstanceDetails(obj);
  deleteCache(id);
  instanceNamespace.emit('updated', id);
  console.log(`Added ${id}`);
}

function updateInstance(obj) {
  let id = obj.metadata.name;
  instances[id] = getInstanceDetails(obj);
  deleteCache(id);
  instanceNamespace.emit('updated', id);
  console.log(`Updated ${id}`);
}

function deleteInstance(obj) {
  let id = obj.metadata.name;
  delete instances[id];
  deleteCache(id);
  instanceNamespace.emit('deleted', id);
  console.log(`Deleted ${id}`);
}

function deleteCache(id) {
  delete instanceCache[id];
}

function getValidCache(id, path, timestamp) {
  if (instanceCache[id] === undefined) {
    console.log(`There is no cache saved for ${id}`);
    return undefined;
  }
  let cache = instanceCache[id][path];
  let maxAge = CACHE_MAX_AGE[path];
  if (
    cache === undefined ||
    maxAge < (timestamp - cache.lastFetched)) {
      console.log(`Cache has been expired for ${id}, ${path}`);
      return undefined;
  }
  console.log(`Returning cached data for ${id}, ${path}`);
  return cache;
}

function setCache(id, path, lastFetched, contentType, data) {
  if (instanceCache[id] === undefined) {
    instanceCache[id] = {};
  }
  let cache = {
    lastFetched: lastFetched,
    contentType: contentType,
    data: data
  }
  instanceCache[id][path] = cache;
  return cache;
}

function requestInstance(id, path, options) {
  let url = instances[id].url + path;
  console.log(`Requesting ${url}`);
  return got(url, options);
}

// Set Link URL from ingress object
function setInstanceLinkUrl(obj) {
  let id = obj.metadata.name;
  let linkUrl = getLinkUrl(obj);
  instances[id].linkUrl = linkUrl;
  console.log(`Link URL ${linkUrl} set in ${id}`);
}

// Fetch Link URL from ingress API
async function fetchLinkUrl(id) {
  console.log(`Fetching link URL of ${id}`);
  // public readNamespacedIngress (name: string, namespace: string, pretty?: string, exact?: boolean, _export?: boolean) : Promise<{ response: http.IncomingMessage; body: V1beta1Ingress;  }>
  let res = await k8sExtentionsApi.readNamespacedIngress(id, K8S_NAMESPACE, undefined, true);
  let obj = res.body;
  let linkUrl = getLinkUrl(obj);
  console.log(`Link URL ${linkUrl} fetched for ${id}`);
  return linkUrl;
}


// Helper functions
function getServiceUrl(obj) {
  let host = obj.spec.clusterIP;
  let port = obj.spec.ports[0].port;
  return `http://${host}:${port}`;
}

function getLinkUrl(obj) {
  return `http://${obj.spec.rules[0].host}`;
}

function getCreationTimestamp(obj) {
  let date = new Date(obj.metadata.creationTimestamp);
  return date.getTime();
}

function getInstanceDetails(obj) {
  let id = obj.metadata.name;
  let instance = {
    id: id,
    url: getServiceUrl(obj),
    thumbnailUrl: `/${id}/thumbnail`,
    createdAt: getCreationTimestamp(obj)
  }
  return instance;
}

// Fetch remote data
async function fetchRemote(id, path, options) {
  let cache = getValidCache(id, path, Date.now());
  if (cache === undefined) {
    const response = await requestInstance(id, path, options);
    cache = setCache(id, path, Date.now(), response.headers['content-type'], response.body);
  }
  return cache;
}

async function getInstanceJSON(instance) {
  let id = instance.id;
  let authorCache = await fetchRemote(id, '/author', { encoding: 'utf8', json: true });
  if (instance.linkUrl === undefined) {
    instance.linkUrl = await fetchLinkUrl(id);
  }
  return {
    id: id,
    linkUrl: instance.linkUrl,
    thumbnailUrl: instance.thumbnailUrl,
    author: authorCache.data,
    createdAt: instance.createdAt
  }
}

// Generate instance array ordered by createdAt desc
async function getInstanceList() {
  let list = [];
  let keys = Object.keys(instances);
  for (let key of keys) {
    let instance = instances[key];
    try {
      let item = await getInstanceJSON(instance);
      list.push(item);
    } catch (err) {
      // simply ignore the instance
      console.log(`An error occurred on processing item ${instance.id}`);
      console.log(err);
    }
  };
  list.sort((a, b) => {
    return b.createdAt - a.createdAt;
  });
  return list;
}

// Response to the HTTP client with remote data
async function responseRemote(req, res, path, options) {
  console.log(`/${req.params.id}${path} was requested`);
  let id = req.params.id;
  try {
    // Fetch remote data
    let cache = await fetchRemote(id, path, options);

    // Response to the client
    res.set('Content-type', cache.contentType);
    res.send(cache.data);
  } catch (err) {
    console.log(`An error occurred on getting instance in /${id}${path}`);
    console.log(err);
    res.status(404).send("Page not found")
  }
}


// Express handlers
app.use(function(req, res, next) {
  res.header("Access-Control-Allow-Origin", allowHost);
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  res.header("Access-Control-Allow-Credentials", true);
  next();
});

// GET /
app.get('/', function(req, res) {
  res.send(`showKs Aggregator version ${version}`);
});

// GET /instances
app.get('/instances', async function(req, res) {
  try {
    console.log(`/instances was requested`);
    let list = await getInstanceList();
    res.type("json");
    res.send(JSON.stringify(list));
  } catch (err) {
    console.log(`An error occurred on getting instance list`);
    console.log(err);
    res.status(404).send("Page not found")
  }
})

// GET /:id
app.get('/:id', async function(req, res) {
  console.log(`/${req.params.id} was requested`);
  let id = req.params.id;
  try {
    let item = await getInstanceJSON(instances[id]);
    res.type("json");
    res.send(JSON.stringify(item));
  } catch (err) {
    console.log(`An error occurred on getting instance in /${id}`);
    console.log(err);
    res.status(404).send("Page not found")
  }
})

// GET /:id/thumbnail
app.get('/:id/thumbnail', function(req, res) {
  responseRemote(req, res, '/thumbnail', { encoding: null, json: false });
})


// socket.io connection handlers
function onInstanceConnection(socket) {
  console.log('Connected to instance namespace.');
}

function onNotificationConnection(socket) {
  console.log('Connected to notification namespace.');
}

// Get list of services
async function getServiceList() {
  console.log('Fetching service list');
  // public listNamespacedServiceAccount (namespace: string, pretty?: string, _continue?: string, fieldSelector?: string, includeUninitialized?: boolean, labelSelector?: string, limit?: number, resourceVersion?: string, timeoutSeconds?: number, watch?: boolean) : Promise<{ response: http.IncomingMessage; body: V1ServiceAccountList;  }>
  let res = await k8sApi.listNamespacedService(K8S_NAMESPACE, undefined, undefined, undefined, false, K8S_LABEL_SELECTOR);
  let resourceVersion = res.body.metadata.resourceVersion;
  let items = res.body.items;
  console.log(`Fetched service list (count: ${items.length}) (resourceVersion: ${resourceVersion})`);
  items.forEach((obj) => {
    addInstance(obj);
  });
  return resourceVersion;
}

// Fill link URL
async function fillLinkUrl() {
  console.log('Fetching ingress list');
  // public listNamespacedIngress (namespace: string, pretty?: string, _continue?: string, fieldSelector?: string, includeUninitialized?: boolean, labelSelector?: string, limit?: number, resourceVersion?: string, timeoutSeconds?: number, watch?: boolean) : Promise<{ response: http.IncomingMessage; body: V1beta1IngressList;  }>
  let res = await k8sExtentionsApi.listNamespacedIngress(K8S_NAMESPACE, undefined, undefined, undefined, false, K8S_LABEL_SELECTOR);
  let items = res.body.items;
  console.log(`Fetched ingress list (count: ${items.length})`);
  items.forEach((obj) => {
    setInstanceLinkUrl(obj);
  });
}

// Watch services
function watchService(resourceVersion) {
  console.log(`Start watching services from resourceVersion: ${resourceVersion}`);
  let watch = new k8s.Watch(kc);
  // public watch(path: string, queryParams: any,
  // callback: (phase: string, obj: any) => void,
  // done: (err: any) => void): any
  let req = watch.watch(
    k8sApiEndpoint,
    {
      labelSelector: K8S_LABEL_SELECTOR,
      resourceVersion: resourceVersion
    },
    (type, obj) => {
      // console.log(obj);
      try {
        if (type == 'ADDED') {
          console.log('New instance was added');
          addInstance(obj);

        } else if (type == 'MODIFIED') {
          console.log('An instance was modified');
          updateInstance(obj);

        } else if (type == 'DELETED') {
          console.log('An instance has beed deleted');
          deleteInstance(obj);

        } else {
          console.log('Unknown type: ' + type);

        }
      } catch (err) {
        console.log('An error occurred on parsing service object');
        console.log(err);
      }
    },
    // done callback is called if the watch terminates normally
    (error) => {
        if (error) {
          console.log('An error occurred in the watch callback');
          console.log(error);
        } else {
          console.log('Watch terminated normally');
        }
        console.log('Aborting...');
        process.exit(1);
    });
}

// Entry point
(async () => {
  // Start listening socket.io
  instanceNamespace.on('connection', onInstanceConnection);

  // Start listening on the port for HTTP request
  http.listen(port, () => console.log('Listening on port ' + port));

  // Get service list
  let resourceVersion = await getServiceList();

  // Fill link URL
  await fillLinkUrl();

  // Start watching Kubernetes cluster
  watchService(resourceVersion);
})().catch((err) => {
  console.log('An error occurred');
  console.log(err);
  console.log('Aborting...');
  process.exit(1);
});
