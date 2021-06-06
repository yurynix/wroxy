const http = require("http");
const crypto = require("crypto");

const PORT = 1234;
const HOST = "127.0.0.1";

const getSecWebsocketAccept = (challange) =>
  crypto
    .createHash("sha1")
    .update(challange + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

const getUpgradeReplay = (secWebSocketAccept) =>
  "HTTP/1.1 101 Switching Protocols\r\n" +
  "Upgrade: websocket\r\n" +
  "Connection: Upgrade\r\n" +
  `Sec-WebSocket-Accept: ${secWebSocketAccept}\r\n` +
  "\r\n";

const getErrorReplay = (message) => `HTTP/1.1 400 ${message}\r\n\r\n`;

function createServer(options) {
  return new Promise((resolve, reject) => {
    const tunnelMap = new Map();

    // Create an HTTP server
    const server = http.createServer((req, res) => {
      res.writeHead(400, { "Content-Type": "text/plain" });
      res.end(`You're using it wrong...`);
    });

    server.on("upgrade", async (req, socket, head) => {
      console.log(
        `>>> UPGRADE ${req.url} ${JSON.stringify(
          req.headers
        )} head: ${head.toString()}`
      );
      if (req.url.indexOf("/_tunnel/") === -1) {
        return socket.write(getErrorReplay(`Missing tunnel`));
      }

      const [_, tunnelId] = req.url.split("/_tunnel/");
      socket.write(
        getUpgradeReplay(
          getSecWebsocketAccept(req.headers["sec-websocket-key"])
        )
      );

      const onTunnelTermination = () => {
        console.log(`tunnelId: ${tunnelId} onTunnelTermination`);
        tunnelMap.delete(tunnelId);
      };

      socket.on("close", () => {
        console.log("close");
        onTunnelTermination();
      });

      if (tunnelMap.has(tunnelId)) {
        console.log(`connecting ${tunnelId}`);
        const remoteSocket = tunnelMap.get(tunnelId);
        socket.pipe(remoteSocket);
        remoteSocket.pipe(socket);
      } else {
        console.log(`New tunnel ${tunnelId} awaits...`);
        tunnelMap.set(tunnelId, socket);
      }
    });

    // Now that server is running
    server.listen(options.port || PORT, options.host || HOST, (err) => {
      if (err) {
        return reject(err);
      }

      console.log(`Listening on ${server.address().port}`);
      resolve(server);
    });
  });
}

module.exports = {
  createServer,
};
