import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

// preload.cjs is renderer-side CommonJS that destructures require("electron")
// at load time. Node tests run without Electron, so satisfy that require from
// the require cache before the bridge module is first loaded — the real
// preload source still executes end to end, only the electron surface is fake.
const require = createRequire(import.meta.url);

const listeners = new Map(); // channel -> Set<handler>
const exposed = { name: null, api: null };
const invoked = []; // { channel, args } for every ipcRenderer.invoke call
const fakeIpcRenderer = {
  on: (channel, handler) => {
    if (!listeners.has(channel)) listeners.set(channel, new Set());
    listeners.get(channel).add(handler);
  },
  removeListener: (channel, handler) => {
    listeners.get(channel)?.delete(handler);
  },
  invoke: async (channel, ...args) => {
    invoked.push({ channel, args });
    return undefined;
  },
  send: () => undefined,
};
const fakeElectron = {
  ipcRenderer: fakeIpcRenderer,
  contextBridge: {
    exposeInMainWorld: (name, api) => {
      exposed.name = name;
      exposed.api = api;
    },
  },
  webUtils: { getPathForFile: () => "" },
};

const electronEntry = require.resolve("electron");
require.cache[electronEntry] = {
  id: electronEntry,
  filename: electronEntry,
  loaded: true,
  exports: fakeElectron,
};
require("./preload.cjs");

/** Simulate the main process emitting a channel to its subscribers. */
const emit = (channel, ...args) => {
  for (const handler of listeners.get(channel) ?? []) handler({}, ...args);
};
const subscriberCount = (channel) => listeners.get(channel)?.size ?? 0;

test("exposes the full local-shell bridge on window.ogb", () => {
  assert.equal(exposed.name, "ogb");
  assert.equal(typeof exposed.api, "object");
  // The settings channel is local-shell only, so it exists on the bridge
  // exactly when the page is local (no --omb-local-origin in argv here).
  assert.equal(typeof exposed.api.onOpenAppSettings, "function");
});

test("onOpenAppSettings subscribes to the exact app:open-settings channel, forwards every emit, and unsubscribes cleanly", () => {
  // Channel contract: electron/main.mjs answers the Preferences… item with
  // webContents.send("app:open-settings"). Listening on any other name would
  // leave the shortcut inert while every menu-construction test still passes,
  // so pin the literal on the receiving side too.
  const cbCalls = [];
  const unsubscribe = exposed.api.onOpenAppSettings(() => cbCalls.push(1));
  assert.equal(subscriberCount("app:open-settings"), 1);

  emit("app:open-settings");
  emit("app:open-settings");
  assert.equal(cbCalls.length, 2);

  unsubscribe();
  assert.equal(subscriberCount("app:open-settings"), 0);
  emit("app:open-settings");
  assert.equal(cbCalls.length, 2);
});

test("phoneCalls bridge invokes the exact main-process channels", async () => {
  // Channel contract: electron/main.mjs handles phone-calls:directory,
  // phone-calls:set-directory and phone-calls:save-transcript. Invoking any
  // other name would leave transcript saving inert while the overlay still
  // renders, so pin the literals on the invoking side too.
  const bridge = exposed.api.phoneCalls;
  assert.equal(typeof bridge?.directory, "function");
  assert.equal(typeof bridge?.setDirectory, "function");
  assert.equal(typeof bridge?.saveTranscript, "function");

  await bridge.directory();
  await bridge.setDirectory("/tmp/calls");
  const input = { sessionId: "abc", agentName: "Pepper", startedAt: "2026-09-20T00:00:00.000Z", lines: [] };
  await bridge.saveTranscript(input);
  assert.deepEqual(
    invoked.map((call) => call.channel),
    ["phone-calls:directory", "phone-calls:set-directory", "phone-calls:save-transcript"],
  );
  assert.deepEqual(invoked[1].args, ["/tmp/calls"]);
  assert.deepEqual(invoked[2].args, [input]);
});
