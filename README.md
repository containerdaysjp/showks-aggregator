# showKs Aggregator

test08 

Japan Container Days - showKs Aggregator is a server application which aggregates deployed container information and let clients access the data via Socket.io channel.

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
| /\<ID\>/thumbnail | Canvas thumbnail (PNG) of the container specified with \<ID\>  |
| /\<ID\>/author    | Author information (JSON) of the container specified with \<ID\> |

[See showKs-webapp README for the author JSON format](https://github.com/containerdaysjp/showks-webapp)


### Socket.IO Namespaces
| Namespace | Description |
|----------|-------------|
| /instance | Notifies the client of 'updated' message with ID as its value when a container instance is created or updated, or 'deleted' message with ID when an instance is removed from the server.  |


## License

[MIT](LICENSE)
