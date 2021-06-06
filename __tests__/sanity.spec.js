const path = require("path");
const { expect, it } = require("@jest/globals");
const { invokeScriptInDebuggedProcess } = require("../src/utils");

describe("sanity", () => {
  it("should invoke a node process with debugger active", async () => {
    const scriptPath = path.resolve("./__tests__/fixtures/example-script.js");
    const result = await invokeScriptInDebuggedProcess(scriptPath);
    expect(result.pid).toBeGreaterThan(0);
    expect(result.guid).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-5][0-9a-f]{3}-[089ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    ); // uuid
    expect(result.port).toBeGreaterThan(0);
    process.kill(result.pid);
  });
});
