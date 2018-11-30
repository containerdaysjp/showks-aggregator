# showKs Aggregator

Japan Container Days - showKs Aggregator is a server application which aggregates deployed showks-canvas container information and let clients access the data via Socket.io channel. It also caches canvas thumbnail for better performance.

## How to use

### Run as a container

```
$ docker build -t <your username>/showks-aggregator:<your tag> .
$ docker run -p <desired port>:8081 -d <your username>/showks-aggregator:<your tag>
```

### Run with Node.js runtime

```
$ cd src
$ npm install
$ npm start
```
Open http://\<your host\>:8081 with a web browser.


### HTTP Endpoints
| Endpoint | Description |
|----------|-------------|
| /instances    | List all available instances (JSON) |
| /\<ID\>       | Instance metadata (JSON) specified with \<ID\> |
| /\<ID\>/thumbnail | Canvas thumbnail (PNG) of the container specified with \<ID\>  |

### JSON Format

/instances:
```
[ instance1, instance2, ... ]
```

/\<ID\>: instance

instance:
```
{
    id: "Instance ID",
    linkUrl: "Public URL to the instance",
    thumbnailUrl: "Thumbnail image path from the web root",
    author: "Author JSON*",
    createdAt: "Created time in number of milliseconds since 1970/01/01"
}
```

[* See showKs-webapp README for the author JSON format](https://github.com/containerdaysjp/showks-webapp)


### Socket.IO Namespaces
| Namespace | Description |
|----------|-------------|
| /instance | Notifies the client of 'updated' message with ID as its value when a container instance is created or updated, or 'deleted' message with ID when an instance is removed from the server.  |


## License

[MIT](LICENSE)
