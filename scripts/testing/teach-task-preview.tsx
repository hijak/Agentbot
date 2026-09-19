import { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { HostedTeachTask } from "../../src/pair/HostedTeachTask";
import { buildTeachTaskPrompt, type TaughtTaskDemonstration } from "../../src/lib/agenthosting/teach-a-task";
import { AndromedaShell } from "../../src/pair/andromeda/Shell";
import "../../src/styles.css";

function Fixture() {
  const desktopRef = useRef<HTMLDivElement | null>(null);
  const [result, setResult] = useState<TaughtTaskDemonstration | null>(null);

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
          <HostedTeachTask
            desktopRef={desktopRef}
            connected
            onComplete={(demo) => setResult(demo)}
          />
          <output id="teaching-result" className="mt-4 block whitespace-pre-wrap text-xs">
            {result
              ? JSON.stringify({
                  name: result.name,
                  notes: result.notes,
                  events: result.events,
                  screenshots: result.screenshots.map((file) => file.name),
                  prompt: buildTeachTaskPrompt(result),
                })
              : ""}
          </output>
        </section>
      </main>
    </AndromedaShell>
  );
}

createRoot(document.getElementById("root")!).render(<Fixture />);
