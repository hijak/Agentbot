// Stage onnxruntime-node (with its onnxruntime-common peer) outside ASAR
// for packaged installs. The harness's integrated Piper engine runs VITS
// inference through this native module; the packaged app ships zero
// node_modules, so the runtime is copied next to the app resources — the
// same pattern as the CUA SDK. Fail loudly if a target's binding is
// missing: a silent skip would ship an app whose Piper engine can never
// start.
//
// onnxruntime's dist bundles its onnxruntime-common dependency as a bare
// require, which resolves through a node_modules walk. Packaged installs
// have no node_modules, and electron-builder drops any node_modules folder
// it finds in an extraResources copy — so the peer is staged as a sibling
// directory and the copied dist files are rewritten to a relative require
// ("../onnxruntime-common"). The rewrite is asserted: a pin drift that
// changes the bundle format fails the build instead of shipping an engine
// that cannot resolve its peer.
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

// pnpm keeps the real package under .pnpm; resolve through it so the copy
// has no symlinks left behind.
const ortEntry = fileURLToPath(import.meta.resolve("onnxruntime-node"));
const ortRoot = realpathSync(join(dirname(ortEntry), ".."));
const ortPackage = JSON.parse(await readFile(join(ortRoot, "package.json"), "utf8"));
const commonRoot = realpathSync(join(dirname(ortRoot), "onnxruntime-common"));

// The binding directory is napi-vX with X per release (v3 in 1.21, v6 in
// 1.30); resolve it rather than pinning the ABI folder name.
const binDirs = readdirSync(join(ortRoot, "bin"), { withFileTypes: true }).filter((entry) => entry.isDirectory());
if (binDirs.length !== 1) {
  throw new Error(`expected one napi directory in onnxruntime-node/bin, found: ${binDirs.map((d) => d.name).join(", ")}`);
}
const napi = binDirs[0].name;

// The os→arches the app actually ships. macOS builds single-arch artifacts
// for both arm64 and x64 from one machine, so darwin stages both.
const TARGETS = {
  darwin: ["arm64", "x64"],
  win32: ["x64"],
  linux: ["x64"],
};

function parseArgs(argv) {
  const args = { os: process.platform, arch: null };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--os") args.os = argv[++i];
    else if (argv[i] === "--arch") args.arch = argv[++i];
    else throw new Error(`unknown argument: ${argv[i]}`);
  }
  if (!Object.hasOwn(TARGETS, args.os)) throw new Error(`unsupported os: ${args.os}`);
  return args;
}

const args = parseArgs(process.argv.slice(2));
const arches = args.arch ? [args.arch] : TARGETS[args.os];

for (const arch of arches) {
  const binding = join(ortRoot, "bin", napi, args.os, arch, `onnxruntime_binding.node`);
  if (!existsSync(binding)) {
    throw new Error(
      `onnxruntime-node ${ortPackage.version} has no ${args.os}/${arch} binding — cannot stage the Piper engine for this target`,
    );
  }
  const stage = join(root, "dist-native", "onnxruntime", `${args.os}-${arch}`);
  rmSync(stage, { recursive: true, force: true });
  mkdirSync(stage, { recursive: true });
  cpSync(join(ortRoot, "dist"), join(stage, "dist"), { recursive: true });
  cpSync(join(ortRoot, "package.json"), join(stage, "package.json"));
  cpSync(join(ortRoot, "README.md"), join(stage, "README.md"));
  cpSync(join(ortRoot, "bin", napi, args.os, arch), join(stage, "bin", napi, args.os, arch), {
    recursive: true,
  });
  // onnxruntime-common is a peer of onnxruntime-node's runtime: the copied
  // dist requires it by bare specifier. Packaged apps have no node_modules
  // (and electron-builder drops one from extraResources anyway), so stage
  // the peer as a sibling and rewrite those requires to a relative path.
  cpSync(commonRoot, join(stage, "onnxruntime-common"), { recursive: true });
  for (const rel of ["dist/index.js", "dist/binding.js"]) {
    const file = join(stage, rel);
    const source = readFileSync(file, "utf8");
    const patched = source.replaceAll('require("onnxruntime-common")', 'require("../onnxruntime-common")');
    if (patched === source) {
      throw new Error(`no bare onnxruntime-common require in ${rel} — onnxruntime-node pin has drifted, rework this patch`);
    }
    writeFileSync(file, patched);
  }
  console.log(`staged onnxruntime-node ${ortPackage.version} for ${args.os}/${arch} → ${stage}`);
}
