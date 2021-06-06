const http = require("http");
const crypto = require("crypto");

const PORT = 1337;

// Create an HTTP server
const server = http.createServer((req, res) => {
  console.log("req", req);
  res.writeHead(200, { "Content-Type": "text/plain" });
  //res.end('okay');
});

function decodeFrame(receivedData) {
  /**
   * 5, Data Framing
   * http://tools.ietf.org/html/rfc6455#section-5.2
   * Client must masks all frames because of
   * intermediaries(e.g proxy) and security reason.
   * Server must not mask all frames
   */

  var firstByte = receivedData[0];
  /**
   * fin
   * axxx xxxx first byte
   * 1000 0000 mask with 0x80 >>> 7
   * ---------
   * 1         is final frame
   * 0         is continue after this frame
   */
  var fin = (firstByte & 0x80) >>> 7;

  /**
   * opcode
   * xxxx aaaa first byte
   * 0000 1111 mask with 0x0f
   * ---------
   * 0000 0001 is text frame
   */
  var opcode = firstByte & 0x0f;
  var payloadType;
  switch (opcode) {
    case 0x0:
      payloadType = "continuation";
      break;
    case 0x1:
      payloadType = "text";
      break;
    case 0x2:
      payloadType = "binary";
      break;
    case 0x8:
      payloadType = "connection close";
      break;
    case 0x9:
      payloadType = "ping";
      break;
    case 0xa:
      payloadType = "pong";
      break;
    default:
      payloadType = "reserved for non-control";
  }
  if (payloadType !== "text") {
    assert.fail("this script dosen't supports without text");
  }

  var secondByte = receivedData[1];

  /**
   * mask
   * axxx xxxx second byte
   * 1000 0000 mask with 0x80
   * ---------
   * 1000 0000 is masked
   * 0000 0000 is not masked
   */
  var mask = (secondByte & 0x80) >>> 7;
  if (mask === 0) {
    assert.fail("browse should always mask the payload data");
  }

  /**
   * Payload Length
   * xaaa aaaa second byte
   * 0111 1111 mask with 0x7f
   * ---------
   * 0000 0100 4(4)
   * 0111 1110 126(next UInt16)
   * 0111 1111 127(next UInt64)
   */
  var payloadLength = secondByte & 0x7f;
  if (payloadLength === 0x7e) {
    assert.fail("next 16bit is length but not supported");
  }
  if (payloadLength === 0x7f) {
    assert.fail("next 64bit is length but not supported");
  }

  /**
   * masking key
   * 3rd to 6th byte
   * (total 32bit)
   */
  var maskingKey = receivedData.readUInt32BE(2);

  /**
   * Payload Data = Extention Data + Application Data
   */

  /**
   * extention data
   * 0 byte unless negotiated during handshake
   */
  var extentionData = null;

  /**
   * application data
   * remainder of frame after extention data.
   * length of this is payload length minus
   * extention data.
   */
  var applicationData = receivedData.readUInt32BE(6);

  /**
   * unmask the data
   * application data XOR mask
   */
  var unmasked = applicationData ^ maskingKey;

  /**
   * write to temp buffer and
   * encoding to utf8
   */
  var unmaskedBuf = Buffer.alloc(4);
  unmaskedBuf.writeInt32BE(unmasked, 0);

  var encoded = unmaskedBuf.toString();

  console.log("======== Parsed Data ===============");
  console.log("fin:", fin);
  console.log("opcode:", payloadType);
  console.log("mask:", mask);
  console.log("payloadLength:", payloadLength);
  console.log("maskingkey:", maskingKey);
  console.log("applicationData:", applicationData);
  console.log("unmasked", unmasked);
  console.log("encoded data:", encoded);
  console.log("\n======== Recieved Frame ===============");
}

const getSecWebsocketAccept = (challange) =>
  require("crypto")
    .createHash("sha1")
    .update(challange + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11")
    .digest("base64");

const getUpgradeReplay = (secWebSocketAccept) =>
  "HTTP/1.1 101 Switching Protocols\r\n" +
  "Upgrade: websocket\r\n" +
  "Connection: Upgrade\r\n" +
  `Sec-WebSocket-Accept: ${secWebSocketAccept}\r\n` +
  "\r\n";

server.on("upgrade", async (req, socket, head) => {
  console.log(`>>> UPGRADE ${req.url} ${JSON.stringify(req.headers)}`);
  console.log("upgrade", head.toString());
  socket.write(
    getUpgradeReplay(getSecWebsocketAccept(req.headers["sec-websocket-key"]))
  );

  console.log(`write ret: ${ret}, secWebSocketAccept: ${secWebSocketAccept}`);
  const remoteStream = await connectToWS({});

  //socket.pipe(socket); // echo back
  //socket.write('{"message":  "hello"}');

  // socket.on('data', data => {
  //   decodeFrame(data);
  // });

  // const options = {
  //   port: 9222,
  //   host: '127.0.0.1',
  //   path: req.url,
  //   headers: {
  //     'Connection': 'Upgrade',
  //     'Upgrade': 'websocket',
  //     'sec-websocket-key': crypto.randomBytes(16).toString('base64'),
  //     'sec-websocket-version': req.headers['sec-websocket-version'],
  //   },

  // };

  // console.log('options', options);
  // const remoteReq = http.request(options);
  // remoteReq.end();

  // remoteReq.on('connect', (socket) => {
  //   console.log('connect', socket);
  // })

  // remoteReq.on('upgrade', (res, remoteSocket, upgradeHead) => {
  //   console.log('remote got upgraded!');
  //   socket.pipe(remoteSocket);
  //   remoteSocket.pipe(socket);
  // });

  // remoteReq.on('error', (err) => {
  //   console.log('error!', err);
  // });

  // remoteReq.on('close', () => {
  //   console.log('remoteReq close');
  // })

  // remoteReq.on('data', (remoteReqData) => {
  //   console.log('remoteReq data',remoteReqData);
  // })

  socket.on("close", () => console.log("close"));
  socket.on("end", () => console.log("end"));

  console.log("reached the end");
});

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
        "sec-websocket-version": "13", //req.headers['sec-websocket-version'],
      },
    };

    console.log("connectToWS", options);
    const remoteReq = http.request(options);
    remoteReq.end();

    remoteReq.on("upgrade", (res, remoteSocket, upgradeHead) => {
      console.log("remote got upgraded!");
      resolve(remoteSocket);
      // socket.pipe(remoteSocket);
      // remoteSocket.pipe(socket);
    });

    remoteReq.on("error", (error) => reject(error));
  });
}

// Now that server is running
server.listen(PORT, "127.0.0.1", () => {
  console.log(`Listening on ${PORT}`);
  //   // make a request
  //   const options = {
  //     port: 1337,
  //     host: '127.0.0.1',
  //     headers: {
  //       'Connection': 'Upgrade',
  //       'Upgrade': 'websocket'
  //     }
  //   };

  //   const req = http.request(options);
  //   req.end();

  //   req.on('upgrade', (res, socket, upgradeHead) => {
  //     console.log('got upgraded!');
  //     socket.end();
  //     process.exit(0);
  //   });
});
