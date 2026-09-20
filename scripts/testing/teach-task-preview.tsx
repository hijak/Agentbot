import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { TeachTask, type HostedTeachTaskApi } from "../../src/components/TeachTask";
import type { HostedSession, HostedTeachSession } from "../../src/lib/agenthosting/client";
import { AndromedaShell } from "../../src/components/andromeda/Shell";
import "../../src/styles.css";

const hostedSession: HostedSession = {
  hosted: true,
  token: "fixture",
  apiURL: "http://127.0.0.1:9",
  dashboardURL: "https://dashboard.example.test",
  selectedAgentId: "fixture-agent",
};

let current: HostedTeachSession | null = null;
let polls = 0;
const teachApi: HostedTeachTaskApi = {
  async active() {
    return current?.status === "recording" ? current : null;
  },
  async start(input) {
    current = {
      id: "11111111-1111-4111-8111-111111111111",
      name: input.name,
      notes: input.notes ?? "",
      status: "recording",
      startedAt: new Date().toISOString(),
      result: null,
    };
    return current;
  },
  async stop(sessionId) {
    if (!current || current.id !== sessionId) throw new Error("Fixture session not found");
    current = { ...current, status: "queued", endedAt: new Date().toISOString() };
    return current;
  },
  async status(sessionId) {
    if (!current || current.id !== sessionId) throw new Error("Fixture session not found");
    polls += 1;
    if (current.status === "queued" && polls >= 2) current = { ...current, status: "processing" };
    if (current.status === "processing" && polls >= 3) {
      current = {
        ...current,
        status: "completed",
        result: {
          status: "completed",
          summary: "Learned the weekly report workflow.",
          learnedSteps: ["Open the Finance workspace.", "Fill the report fields.", "Verify before submitting."],
          dryRunPrompt: "Dry run the weekly report skill.",
          skill: {
            id: "weekly-report",
            name: "Weekly Report",
            description: "Prepares the weekly Finance report.",
            link: "/skills?skill=weekly-report",
          },
        },
      };
    }
    return current;
  },
  async cancel() {
    current = null;
  },
};

function Fixture() {
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const [dryRun, setDryRun] = useState("");

  useEffect(() => {
    const canvas = desktopRef.current?.querySelector("canvas");
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#172033";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#dbeafe";
    context.font = "24px sans-serif";
    context.fillText("Disposable Open Computer", 46, 82);
    context.fillStyle = "#60a5fa";
    context.fillRect(46, 125, 230, 54);
    context.fillStyle = "#08111f";
    context.fillText("Submit report", 75, 160);
  }, []);

  return (
    <AndromedaShell className="items-center justify-center p-8">
      <main className="grid w-full max-w-5xl gap-6 md:grid-cols-[minmax(0,1fr)_22rem]">
        <div
          ref={desktopRef}
          className="overflow-hidden rounded border border-[var(--ah-border-base)] bg-black"
        >
          <canvas
            width="720"
            height="450"
            tabIndex={0}
            role="application"
            aria-label="Demonstration desktop"
            className="block h-auto w-full"
          />
        </div>
        <section className="ah-card-bordered p-4">
          <TeachTask
            session={hostedSession}
            surfaceId="fixture-surface"
            connected
            api={teachApi}
            onDryRun={(prompt) => setDryRun(prompt)}
          />
          <output id="teaching-result" className="mt-4 block whitespace-pre-wrap text-xs">
            {dryRun}
          </output>
        </section>
      </main>
    </AndromedaShell>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
