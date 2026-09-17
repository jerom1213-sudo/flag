import fs from "node:fs";

const dbFiles = ["clients", "staff", "flags", "venues", "plans", "planChanges", "orders", "logs"];
const state = {};

for (const name of dbFiles) {
  Object.assign(state, JSON.parse(fs.readFileSync(`db/${name}.json`, "utf8")));
}

const version = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
let html = fs.readFileSync("index.html", "utf8");
const dataBlock =
  `    const WEB_DATA_VERSION = "${version}";\n` +
  `    const WEB_INITIAL_STATE = ${JSON.stringify(state)};\n`;

if (html.includes("const WEB_DATA_VERSION =")) {
  html = html.replace(
    /    const WEB_DATA_VERSION = "[^"]+";\r?\n    const WEB_INITIAL_STATE = .*?;\r?\n/s,
    dataBlock
  );
} else {
  html = html.replace(
    '    const orderTypes = { funeral: "근조기", celebration: "축하기", group: "단체기" };\n',
    '    const orderTypes = { funeral: "근조기", celebration: "축하기", group: "단체기" };\n' + dataBlock
  );
}

html = html.replace(
  `    function loadState() {
      try {
        return migrateState(JSON.parse(localStorage.getItem(KEY) || "null") || seedState());
      } catch {
        return seedState();
      }
    }`,
  `    function loadState() {
      try {
        const storedVersion = localStorage.getItem(KEY + ".version");
        if (WEB_INITIAL_STATE && storedVersion !== WEB_DATA_VERSION) {
          const initial = migrateState(structuredClone(WEB_INITIAL_STATE));
          localStorage.setItem(KEY, JSON.stringify(initial));
          localStorage.setItem(KEY + ".version", WEB_DATA_VERSION);
          return initial;
        }
        return migrateState(JSON.parse(localStorage.getItem(KEY) || "null") || structuredClone(WEB_INITIAL_STATE) || seedState());
      } catch {
        return migrateState(structuredClone(WEB_INITIAL_STATE) || seedState());
      }
    }`
);

html = html.replace(
  /      localStorage\.setItem\(KEY, JSON\.stringify\(next\)\);\r?\n(?:      localStorage\.setItem\(KEY \+ "\.version", WEB_DATA_VERSION\);\r?\n)*/g,
  `      localStorage.setItem(KEY, JSON.stringify(next));
      localStorage.setItem(KEY + ".version", WEB_DATA_VERSION);
`
);

fs.writeFileSync("index.html", html, "utf8");
fs.copyFileSync("index.html", "web-deploy/index.html");

console.log(JSON.stringify({
  version,
  clients: state.clients.length,
  staff: state.staff.length,
  venues: state.venues.length,
  orders: state.orders.length
}));
