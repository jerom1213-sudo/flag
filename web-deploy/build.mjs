import fs from "node:fs";

fs.rmSync("dist", { recursive: true, force: true });
fs.mkdirSync("dist/server", { recursive: true });
fs.mkdirSync("dist/.openai", { recursive: true });

const html = fs.readFileSync("index.html", "utf8");
const readme = fs.readFileSync("README.md", "utf8");
const hosting = fs.readFileSync(".openai/hosting.json", "utf8");

fs.writeFileSync("dist/.openai/hosting.json", hosting);
fs.writeFileSync(
  "dist/server/index.js",
  `const INDEX_HTML = ${JSON.stringify(html)};\n` +
    `const README = ${JSON.stringify(readme)};\n\n` +
    `export default {\n` +
    `  async fetch(request) {\n` +
    `    const url = new URL(request.url);\n` +
    `    if (url.pathname === "/README.md") {\n` +
    `      return new Response(README, { headers: { "content-type": "text/markdown; charset=utf-8" } });\n` +
    `    }\n` +
    `    return new Response(INDEX_HTML, { headers: { "content-type": "text/html; charset=utf-8" } });\n` +
    `  }\n` +
    `};\n`
);
