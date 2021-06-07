const crypto = require("crypto");
const http = require("http");
const https = require("https");
const { debuglog } = require('util');

const log = debuglog('wroxy-client');

function connectToWS({ port, host, path, ssl }) {
  return new Promise((resolve, reject) => {
    const options = {
      port,
      host,
      path,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "sec-websocket-key": crypto.randomBytes(16).toString("base64"),
        "sec-websocket-version": "13",
      },
    };

    const remoteReq = ssl ? https.request(options) : http.request(options);
    remoteReq.end();

    remoteReq.on("upgrade", (res, remoteSocket, upgradeHead) => {
      log(`connectToWS() -> remoteReq to ${host}:${port} got upgrade`);
      resolve(remoteSocket);
    });

    remoteReq.on("error", (error) => {
      log(`connectToWS() -> remoteReq to ${host}:${port} got error ${error}`);
      reject(error);
    });
  });
}

async function tunnel(server, local) {
  const serverSocket = await connectToWS({
    port: server.port,
    host: server.host,
    path: server.path,
    ssl: server.ssl,
  });

  serverSocket.once("data", async (data) => {
    log(`tunnel() -> serverSocket ${serverSocket.host}:${server.port}${server.path} got data`);
    serverSocket.pause();

    const localSocket = await connectToWS({
      port: local.port,
      host: local.host,
      path: local.path,
      ssl: local.ssl,
    });

    localSocket.write(data);

    localSocket.pipe(serverSocket);
    serverSocket.pipe(localSocket);

    serverSocket.resume();
  });

  return serverSocket;
}

module.exports = {
  tunnel
}