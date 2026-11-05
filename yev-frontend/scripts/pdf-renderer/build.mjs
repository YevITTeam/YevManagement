// Bundles render.mjs + the OT form template into one file for the backend (CompanySystem.HostApi/pdf-renderer).
// --with-node also copies this node.exe there, so the server needs no Node install.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontend = path.resolve(here, "../..");
const outDir = path.resolve(frontend, "../yev-backend/CompanySystem.HostApi/pdf-renderer");
const require = createRequire(import.meta.url);

fs.rmSync(outDir, { recursive: true, force: true });
fs.mkdirSync(path.join(outDir, "fonts"), { recursive: true });

await build({
    entryPoints: [path.join(here, "render.mjs")],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: path.join(outDir, "render.cjs"),
    alias: { "@": path.join(frontend, "src") },
    // jsdom's optional native canvas is never used.
    external: ["canvas"],
    logLevel: "warning",
    // jsdom resolves its xhr worker at runtime; the file is copied next to the bundle below.
    logOverride: { "require-resolve-not-external": "silent" },
});

// Files the bundled libraries read from disk next to themselves at runtime.
const pdfkitDir = path.dirname(require.resolve("pdfkit", { paths: [path.dirname(require.resolve("pdfmake"))] }));
fs.cpSync(path.join(pdfkitDir, "data"), path.join(outDir, "data"), { recursive: true });
fs.copyFileSync(path.join(path.dirname(require.resolve("jsdom")), "jsdom/living/xhr/xhr-sync-worker.js"), path.join(outDir, "xhr-sync-worker.js"));
for (const font of ["NotoSerifJP-Regular.subset.otf", "NotoSerifJP-Bold.latin.otf"])
    fs.copyFileSync(path.join(frontend, "public/fonts", font), path.join(outDir, "fonts", font));

if (process.argv.includes("--with-node")) fs.copyFileSync(process.execPath, path.join(outDir, "node.exe"));
console.log(`pdf-renderer -> ${outDir}`);
