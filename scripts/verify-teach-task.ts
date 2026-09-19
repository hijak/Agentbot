import { mountPreview, parkUntilSignal } from "./testing/preview-fixture.ts";

const preview = await mountPreview(
  { info: { url: "http://127.0.0.1:9" } },
  {
    entry: "/scripts/testing/teach-task-preview.tsx",
    route: "/__teach-task.html",
    title: "Isolated Teach a Task",
    logLevel: "silent",
  },
);

process.stdout.write(`${JSON.stringify({ previewUrl: preview.previewUrl })}\n`);
try {
  await parkUntilSignal();
} finally {
  await preview.close();
}
