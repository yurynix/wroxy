const path = require("path");
const fs = require("fs");
const { expect, it } = require("@jest/globals");
const { invokeScriptInDebuggedProcess } = require("../src/utils");
const { tunnel } = require("../src/client");
const { createServer } = require("../src/server");
const WebSocket = require('ws');


function getPromise() {
    let resolve, reject;
    const promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
  
    return {
      promise,
      resolve,
      reject,
    };
  }
  

function connectToWs(port, path, ssl) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(`ws${ssl ? 's' : ''}://127.0.0.1:${port}/${path}`);
      ws.on('open', function open() {
        resolve(ws);
      });
      ws.onerror = function (err) {
        reject(err);
      };
    });
  }

describe("debugger", () => {
  it("should invoke a node process with debugger active and tunnel it", async () => {
    const scriptPath = path.resolve("./__tests__/fixtures/example-script.js");
    const debugProcess = await invokeScriptInDebuggedProcess(scriptPath);
    const server = await createServer({ port: 0, host: "127.0.0.1" });
    const serverPort = server.address().port;

    const serverSocket = await tunnel(
      {
        port: serverPort,
        host: "127.0.0.1",
        path: "/_tunnel/123456",
      },
      {
        port: debugProcess.port,
        host: "127.0.0.1",
        path: `/${debugProcess.guid}`,
      }
    );

    const ws = await connectToWs(serverPort, '_tunnel/123456');

    const { promise, resolve, reject } = getPromise();

    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.id === 1337) {
            resolve(data);
        }
    };

    ws.send(JSON.stringify({
        id: 1337,
        method: 'Debugger.enable',
    }));

    const replayData = await promise;

    expect(replayData.result.debuggerId).toMatch(/\([A-F0-9]+\)/);

    server.close();
    process.kill(debugProcess.pid);
  });

  it("should invoke a node process with debugger active and tunnel it over SSL", async () => {
    // NODE_TLS_REJECT_UNAUTHORIZED=0 set in package.json, this is to disable the CA verification, because we don't have a valid CA.

    const scriptPath = path.resolve("./__tests__/fixtures/example-script.js");
    const debugProcess = await invokeScriptInDebuggedProcess(scriptPath);
    const server = await createServer({ port: 0, host: "127.0.0.1", key: fs.readFileSync('./__tests__/fixtures/fake-ssl-cert-and-key/key.pem'), cert: fs.readFileSync('./__tests__/fixtures/fake-ssl-cert-and-key/cert.pem') });
    const serverPort = server.address().port;

    const serverSocket = await tunnel(
      {
        port: serverPort,
        host: "127.0.0.1",
        path: "/_tunnel/123456",
        ssl: true,
      },
      {
        port: debugProcess.port,
        host: "127.0.0.1",
        path: `/${debugProcess.guid}`,
      }
    );

    const ws = await connectToWs(serverPort, '_tunnel/123456', true);

    const { promise, resolve, reject } = getPromise();

    ws.onmessage = (message) => {
        const data = JSON.parse(message.data);
        if (data.id === 1337) {
            resolve(data);
        }
    };

    ws.send(JSON.stringify({
        id: 1337,
        method: 'Debugger.enable',
    }));

    const replayData = await promise;

    expect(replayData.result.debuggerId).toMatch(/\([A-F0-9]+\)/);

    server.close();
    process.kill(debugProcess.pid);
  });
});
