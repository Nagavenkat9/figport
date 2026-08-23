const esbuild = require("esbuild");
const fs = require("fs");
const path = require("path");

const watch = process.argv.includes("--watch");
const buildDir = path.join(__dirname, "build");

if (!fs.existsSync(buildDir)) fs.mkdirSync(buildDir);

async function buildOnce() {
  // Sandbox (main thread, has Figma API)
  await esbuild.build({
    entryPoints: ["src/sandbox/code.ts"],
    bundle: true,
    outfile: "build/code.js",
    target: "es2019",
    minify: true,
    treeShaking: true,
  });

  // UI (iframe, has DOM)
  const uiBundle = await esbuild.build({
    entryPoints: ["src/ui/ui.ts"],
    bundle: true,
    write: false,
    target: "es2019",
    minify: true,
    treeShaking: true,
  });
  const uiScript = uiBundle.outputFiles[0].text;

  const template = fs.readFileSync("src/ui/ui.html", "utf8");
  const finalHtml = template.replace("__UI_SCRIPT__", uiScript);
  fs.writeFileSync("build/ui.html", finalHtml);

  const codeSize = fs.statSync("build/code.js").size;
  const htmlSize = fs.statSync("build/ui.html").size;
  console.log(
    `[${new Date().toLocaleTimeString()}] build complete — code.js ${codeSize}B, ui.html ${htmlSize}B`
  );
}

if (watch) {
  const ctx = { rebuild: buildOnce };
  buildOnce();
  fs.watch("src", { recursive: true }, () => {
    buildOnce().catch((e) => console.error(e));
  });
} else {
  buildOnce().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
