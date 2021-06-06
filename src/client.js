const crypto = require("crypto");
const http = require("http");
//const path = require("path");
//const { invokeScriptInDebuggedProcess } = require("./utils");

function connectToWS({ port, host, path }) {
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

    const remoteReq = http.request(options);
    remoteReq.end();

    remoteReq.on("upgrade", (res, remoteSocket, upgradeHead) => {
      resolve(remoteSocket);
    });

    remoteReq.on("error", (error) => reject(error));
  });
}

async function tunnel(server, local) {
  const serverSocket = await connectToWS({
    port: server.port,
    host: server.host,
    path: server.path,
  });

  serverSocket.once("data", async (data) => {
    serverSocket.pause();

    const localSocket = await connectToWS({
      port: local.port,
      host: local.host,
      path: local.path,
    });

    localSocket.write(data);

    localSocket.pipe(serverSocket);
    serverSocket.pipe(localSocket);

    serverSocket.resume();
  });

  return serverSocket;
}

// (async function main() {
//   const scriptPath = path.resolve("./__tests__/fixtures/example-script.js");
//   const result = await invokeScriptInDebuggedProcess(scriptPath);

//   console.log(`Debugger: ${JSON.stringify(result)}`);

//   const serverSocket = await tunnel(
//     {
//       port: 1234,
//       host: "127.0.0.1",
//       path: "/_tunnel/123456",
//     },
//     {
//       port: result.port,
//       host: "127.0.0.1",
//       path: `/${result.guid}`,
//     }
//   );

//   serverSocket.on("close", () => {
//     console.log(`Server socket have been closed!`);
//     process.kill(result.pid);
//   });
// })();


module.exports = {
  tunnel
}