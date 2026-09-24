import { spawn, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createInterface } from "node:readline";
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { release as systemRelease } from "node:os";
import { fileURLToPath } from "node:url";

import { DATA_DIR } from "./config.ts";

export const LAYA_MLX_VERSION = "0.2.0";
export const LAYA_MLX_MODEL = "aac6fef/laya-typed-decisions-mlx";
export const LAYA_PYTHON_VERSION = "3.12.14";
export const LAYA_PYTHON_BUILD = "20260814";
export const LAYA_PYTHON_SHA256 = "4572133a5542f306b9bdb155da5800f9e38950cd0a98d469b832ce256fe299ea";
const INSTALL_TIMEOUT_MS = 10 * 60_000;
const PYTHON_DOWNLOAD_TIMEOUT_MS = 3 * 60_000;
const REQUEST_TIMEOUT_MS = 5 * 60_000;
const PYTHON_ARCHIVE = `cpython-${LAYA_PYTHON_VERSION}+${LAYA_PYTHON_BUILD}-aarch64-apple-darwin-install_only.tar.gz`;
const PYTHON_ARCHIVE_URL = `https://github.com/astral-sh/python-build-standalone/releases/download/${LAYA_PYTHON_BUILD}/${PYTHON_ARCHIVE.replace("+", "%2B")}`;

type LayaChoiceRequest = {
  state: Record<string, unknown>;
  instructions: string;
  criteria: Record<string, string>;
};

type WorkerResponse = {
  id: string;
  ok: boolean;
  result?: unknown;
  error?: string;
};

type WorkerPending = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: NodeJS.Timeout;
};

let installing: Promise<void> | null = null;
let installError: string | null = null;
let worker: ReturnType<typeof spawn> | null = null;
let nextRequestId = 0;
const pendingRequests = new Map<string, WorkerPending>();

function toolsDirectory(baseDir = DATA_DIR) {
  return join(baseDir, "tools", "laya-mlx");
}

function pythonPath(baseDir = DATA_DIR) {
  return join(toolsDirectory(baseDir), ".venv", "bin", "python");
}

function managedPythonPath(baseDir = DATA_DIR) {
  return join(toolsDirectory(baseDir), "python", "bin", "python3.12");
}

function installedMarker(baseDir = DATA_DIR) {
  return join(toolsDirectory(baseDir), ".installed");
}

function workerScriptPath() {
  return fileURLToPath(new URL("./laya-mlx-worker.py", import.meta.url));
}

export function isLayaMlxSupported(
  platform = process.platform,
  arch = process.arch,
  darwinRelease = systemRelease(),
) {
  const darwinMajor = Number(darwinRelease.split(".", 1)[0]);
  return platform === "darwin" && arch === "arm64" && Number.isInteger(darwinMajor) && darwinMajor >= 23;
}

export function layaMlxStatus(baseDir = DATA_DIR) {
  const supported = isLayaMlxSupported();
  const installed = supported && existsSync(installedMarker(baseDir)) && existsSync(pythonPath(baseDir));
  return {
    supported,
    installed,
    installing: installing !== null,
    ready: installed && installError === null,
    version: LAYA_MLX_VERSION,
    model: LAYA_MLX_MODEL,
    ...(installError ? { error: installError } : {}),
  };
}

function runInstallCommand(command: string, args: string[], cwd: string, timeoutMs: number): Promise<void> {
  return new Promise((resolve, reject) => {
    let child: ReturnType<typeof spawn>;
    try {
      child = spawn(command, args, {
        cwd,
        env: {
          ...process.env,
          PIP_DISABLE_PIP_VERSION_CHECK: "1",
          HF_HUB_DISABLE_TELEMETRY: "1",
          PYTHONUNBUFFERED: "1",
        },
        stdio: ["ignore", "ignore", "pipe"],
      });
    } catch (error) {
      reject(error instanceof Error ? error : new Error(String(error)));
      return;
    }
    let stderr = "";
    child.stderr?.on("data", (chunk: Buffer) => {
      // Keep only a small, useful tail, and don't log the installer output.
      stderr = `${stderr}${chunk.toString("utf8")}`.slice(-2_000);
    });
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error("Laya-MLX installation timed out. Check your network and try again."));
    }, timeoutMs);
    timer.unref?.();
    child.once("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
      } else {
        const detail = stderr.trim().split(/\r?\n/).slice(-5).join("\n");
        reject(new Error(
          code === null
            ? "The Laya-MLX installer was stopped."
            : `Could not install laya-mlx (${code}).${detail ? `\n${detail}` : ""}`,
        ));
      }
    });
  });
}

function pythonVersion(command: string): string | null {
  const probe = spawnSync(command, ["-c", "import sys; print('.'.join(map(str, sys.version_info[:3])))"], {
    encoding: "utf8",
    timeout: 5_000,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });
  return probe.status === 0 ? probe.stdout.trim() : null;
}

function isSupportedPython(command: string): boolean {
  const version = pythonVersion(command)?.split(".").map(Number) ?? [];
  return version[0] === 3 && Number.isInteger(version[1]) && version[1] >= 11;
}

function chooseSystemPython(): string | null {
  const configured = process.env.AGENTBOT_LAYA_PYTHON?.trim();
  const candidates = [...new Set([
    ...(configured ? [configured] : []),
    "python3.13",
    "python3.12",
    "python3.11",
    "python3",
  ])];
  return candidates.find(isSupportedPython) ?? null;
}

export async function downloadPythonArchive(
  url: string,
  dependencies: {
    fetchImpl?: typeof fetch;
    sleep?: (milliseconds: number) => Promise<void>;
    sha256?: string;
  } = {},
): Promise<Buffer> {
  const fetchImpl = dependencies.fetchImpl ?? fetch;
  const expectedSha256 = dependencies.sha256 ?? LAYA_PYTHON_SHA256;
  const sleep = dependencies.sleep ?? ((milliseconds: number) =>
    new Promise((resolve) => setTimeout(resolve, milliseconds))
  );
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        signal: AbortSignal.timeout(PYTHON_DOWNLOAD_TIMEOUT_MS),
        headers: { "User-Agent": "Agentbot-Laya-MLX" },
      });
      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}`);
        if (response.status < 500) {
          throw Object.assign(
            new Error(`Could not download the local Python runtime: ${error.message}`, { cause: error }),
            { retryable: false },
          );
        }
        lastError = error;
      } else {
        const bytes = Buffer.from(await response.arrayBuffer());
        const digest = createHash("sha256").update(bytes).digest("hex");
        if (digest !== expectedSha256) {
          throw Object.assign(
            new Error("The downloaded local Python runtime failed its SHA-256 check."),
            { retryable: false },
          );
        }
        return bytes;
      }
    } catch (error) {
      if (error instanceof Error && "retryable" in error && error.retryable === false) {
        throw error;
      }
      lastError = error;
    }
    if (attempt < 3) await sleep(attempt * 1_000);
  }
  const cause = lastError instanceof Error ? lastError : new Error(String(lastError));
  const code = "cause" in cause && cause.cause && typeof cause.cause === "object" && "code" in cause.cause
    ? ` (${String(cause.cause.code)})`
    : "";
  throw new Error(
    `Could not download the local Python runtime after 3 attempts${code}. Check your network and try enabling Laya again.`,
    { cause },
  );
}

export async function provisionLayaPython(
  baseDir = DATA_DIR,
  dependencies: {
    download?: (url: string) => Promise<Buffer>;
    extract?: (archive: string, destination: string) => Promise<void>;
  } = {},
): Promise<string> {
  const root = toolsDirectory(baseDir);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const existing = managedPythonPath(baseDir);
  if (isSupportedPython(existing)) return existing;

  const staging = mkdtempSync(join(root, "python-stage-"));
  try {
    const archivePath = join(staging, PYTHON_ARCHIVE);
    const bytes = await (dependencies.download ?? downloadPythonArchive)(PYTHON_ARCHIVE_URL);
    writeFileSync(archivePath, bytes, { mode: 0o600 });
    await (dependencies.extract ?? ((archive, destination) =>
      runInstallCommand("/usr/bin/tar", ["-xzf", archive, "-C", destination], destination, INSTALL_TIMEOUT_MS)
    ))(archivePath, staging);

    const stagedPython = join(staging, "python", "bin", "python3.12");
    if (!isSupportedPython(stagedPython) || pythonVersion(stagedPython) !== LAYA_PYTHON_VERSION) {
      throw new Error(`The downloaded local Python runtime is not Python ${LAYA_PYTHON_VERSION}.`);
    }
    const managedRoot = join(root, "python");
    rmSync(managedRoot, { recursive: true, force: true });
    cpSync(join(staging, "python"), managedRoot, { recursive: true });
    chmodSync(managedPythonPath(baseDir), 0o700);
    return managedPythonPath(baseDir);
  } finally {
    rmSync(staging, { recursive: true, force: true });
  }
}

async function installOnce(baseDir: string) {
  if (!isLayaMlxSupported()) {
    throw new Error("Laya-MLX requires macOS on Apple Silicon.");
  }
  const root = toolsDirectory(baseDir);
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const python = chooseSystemPython() ?? await provisionLayaPython(baseDir);
  const venvPython = pythonPath(baseDir);
  await runInstallCommand(python, ["-m", "venv", join(root, ".venv")], root, INSTALL_TIMEOUT_MS);
  await runInstallCommand(
    venvPython,
    ["-m", "pip", "install", "--no-input", "--disable-pip-version-check", `laya-mlx==${LAYA_MLX_VERSION}`],
    root,
    INSTALL_TIMEOUT_MS,
  );
  // The worker script is shipped with both development and packaged servers.
  if (!existsSync(workerScriptPath())) {
    throw new Error("The Laya-MLX worker script is missing. Reinstall or update Agentbot.");
  }
  writeFileSync(installedMarker(baseDir), `${LAYA_MLX_VERSION}\n`, { mode: 0o600 });
}

/** Install the pinned Python package only after the user opts in. Model
 * weights are fetched by Hugging Face on the first local decision. If the
 * machine has no compatible Python, provision a pinned app-managed runtime. */
export function installLayaMlx(baseDir = DATA_DIR): Promise<void> {
  if (installing) return installing;
  installError = null;
  const run = installOnce(baseDir)
    .catch((error: unknown) => {
      installError = error instanceof Error ? error.message : String(error);
      throw error;
    })
    .finally(() => {
      if (installing === run) installing = null;
    });
  installing = run;
  return run;
}

function rejectPending(error: Error) {
  for (const [id, request] of pendingRequests) {
    clearTimeout(request.timer);
    request.reject(error);
    pendingRequests.delete(id);
  }
}

function ensureWorker(baseDir = DATA_DIR) {
  if (!layaMlxStatus(baseDir).installed) {
    throw new Error("Install Laya-MLX before enabling fast browser decisions.");
  }
  if (worker && worker.exitCode === null && worker.signalCode === null) return worker;

  const child = spawn(pythonPath(baseDir), ["-u", workerScriptPath()], {
    env: {
      ...process.env,
      HF_HOME: join(toolsDirectory(baseDir), "hf-cache"),
      HF_HUB_DISABLE_TELEMETRY: "1",
      PYTHONUNBUFFERED: "1",
    },
    stdio: ["pipe", "pipe", "ignore"],
  });
  worker = child;
  const lines = createInterface({ input: child.stdout! });
  lines.on("line", (line) => {
    let response: WorkerResponse;
    try {
      response = JSON.parse(line) as WorkerResponse;
    } catch {
      return;
    }
    const pending = pendingRequests.get(response.id);
    if (!pending) return;
    pendingRequests.delete(response.id);
    clearTimeout(pending.timer);
    if (response.ok) pending.resolve(response.result);
    else pending.reject(new Error(response.error || "Laya-MLX could not make a decision."));
  });
  child.on("error", (error) => {
    if (worker === child) worker = null;
    rejectPending(new Error(`Laya-MLX could not start: ${error.message}`));
  });
  child.on("close", () => {
    if (worker === child) worker = null;
    rejectPending(new Error("The Laya-MLX worker stopped. Reinstall it and try again."));
  });
  return child;
}

export async function predictLayaChoice(input: LayaChoiceRequest): Promise<string | null> {
  const child = ensureWorker();
  if (!input.instructions.trim() || Object.keys(input.criteria).length < 2) {
    throw new Error("A Laya decision needs instructions and at least two choices.");
  }
  const id = `laya-${++nextRequestId}`;
  const response = new Promise<unknown>((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingRequests.delete(id);
      reject(new Error("Laya-MLX did not return a decision in time."));
    }, REQUEST_TIMEOUT_MS);
    timer.unref?.();
    pendingRequests.set(id, { resolve, reject, timer });
  });
  child.stdin!.write(`${JSON.stringify({ id, ...input })}\n`);
  const result = await response;
  if (typeof result === "string") return result;
  if (result && typeof result === "object") {
    const answer = result as Record<string, unknown>;
    for (const key of ["answer", "choice", "value", "selected", "label"]) {
      if (typeof answer[key] === "string") return answer[key] as string;
    }
  }
  return null;
}

/** Test-only reset hook. Does not delete installed packages or model files. */
export function resetLayaMlxWorkerForTests() {
  worker?.kill();
  worker = null;
  rejectPending(new Error("Laya worker reset."));
  installError = null;
  installing = null;
}
