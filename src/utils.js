const { fork } = require("child_process");
const urlParser = require("url");

function getWsEndpointFromStream(stream) {
  return new Promise((resolve) => {
    let stderrContent = [];
    const handler = (data) => {
      stderrContent = stderrContent.concat(data);
      const content = stderrContent.toString().match(/\bws?:\/\/\S+/gi);
      if (content) {
        const { port, pathname } = new urlParser.URL(content[0]);
        stream.removeListener("data", handler);
        resolve({ port: parseInt(port, 10), guid: pathname.slice(1) });
      }
    };
    stream.on("data", handler);
  });
}

function invokeScriptInDebuggedProcess(scriptPath, options = {}) {
  return new Promise((resolve, reject) => {
    const childProcess = fork(
      require.resolve(scriptPath),
      [],
      Object.assign({}, options, {
        execArgv: ["--inspect-brk=0"],
        stdio: "pipe",
      })
    );

    childProcess.on("error", (error) => reject(error));

    getWsEndpointFromStream(childProcess.stderr)
      .then(({ port, guid }) => ({ pid: childProcess.pid, port, guid }))
      .then(resolve);
  });
}

module.exports = {
  getWsEndpointFromStream,
  invokeScriptInDebuggedProcess,
};
