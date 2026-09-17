const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 4173);
const ROOT = __dirname;
const DB_DIR = path.join(ROOT, "db");
const LEGACY_DB_FILE = path.join(DB_DIR, "data.json");
const MANAGEMENT_DB_FILE = path.join(DB_DIR, "management.json");
const CLIENTS_DB_FILE = path.join(DB_DIR, "clients.json");
const STAFF_DB_FILE = path.join(DB_DIR, "staff.json");
const FLAGS_DB_FILE = path.join(DB_DIR, "flags.json");
const VENUES_DB_FILE = path.join(DB_DIR, "venues.json");
const PLANS_DB_FILE = path.join(DB_DIR, "plans.json");
const PLAN_CHANGES_DB_FILE = path.join(DB_DIR, "planChanges.json");
const ORDERS_DB_FILE = path.join(DB_DIR, "orders.json");
const LOGS_DB_FILE = path.join(DB_DIR, "logs.json");

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

function defaultState() {
  return {
    clients: [],
    staff: [],
    venues: [],
    venueRooms: [],
    inventories: [],
    flagItems: [],
    branchStock: {},
    plans: [],
    planChanges: [],
    orders: [],
    notifications: [],
    audit: []
  };
}

function defaultManagementDb() {
  return {
    clients: defaultClientsDb().clients,
    staff: defaultStaffDb().staff,
    venues: defaultVenuesDb().venues,
    venueRooms: defaultVenuesDb().venueRooms,
    inventories: defaultFlagsDb().inventories,
    flagItems: defaultFlagsDb().flagItems,
    branchStock: defaultFlagsDb().branchStock,
    plans: defaultPlansDb().plans
  };
}

function defaultClientsDb() {
  return {
    clients: []
  };
}

function defaultStaffDb() {
  return {
    staff: []
  };
}

function defaultFlagsDb() {
  return {
    inventories: [],
    flagItems: [],
    branchStock: {}
  };
}

function defaultVenuesDb() {
  return {
    venues: [],
    venueRooms: []
  };
}

function defaultPlansDb() {
  return {
    plans: []
  };
}

function defaultPlanChangesDb() {
  return {
    planChanges: []
  };
}

function defaultOrdersDb() {
  return {
    orders: []
  };
}

function defaultLogsDb() {
  return {
    notifications: [],
    audit: []
  };
}

function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });
  migrateLegacyDb();
  migrateManagementDb();
  if (!fs.existsSync(CLIENTS_DB_FILE)) writeJson(CLIENTS_DB_FILE, defaultClientsDb());
  if (!fs.existsSync(STAFF_DB_FILE)) writeJson(STAFF_DB_FILE, defaultStaffDb());
  if (!fs.existsSync(FLAGS_DB_FILE)) writeJson(FLAGS_DB_FILE, defaultFlagsDb());
  if (!fs.existsSync(VENUES_DB_FILE)) writeJson(VENUES_DB_FILE, defaultVenuesDb());
  if (!fs.existsSync(PLANS_DB_FILE)) writeJson(PLANS_DB_FILE, defaultPlansDb());
  if (!fs.existsSync(PLAN_CHANGES_DB_FILE)) writeJson(PLAN_CHANGES_DB_FILE, defaultPlanChangesDb());
  if (!fs.existsSync(ORDERS_DB_FILE)) writeJson(ORDERS_DB_FILE, defaultOrdersDb());
  if (!fs.existsSync(LOGS_DB_FILE)) writeJson(LOGS_DB_FILE, defaultLogsDb());
  writeManagementManifest();
}

function readDb() {
  ensureDb();
  const clients = readJson(CLIENTS_DB_FILE, defaultClientsDb());
  const staff = readJson(STAFF_DB_FILE, defaultStaffDb());
  const flags = readJson(FLAGS_DB_FILE, defaultFlagsDb());
  const venues = readJson(VENUES_DB_FILE, defaultVenuesDb());
  const plans = readJson(PLANS_DB_FILE, defaultPlansDb());
  const planChanges = readJson(PLAN_CHANGES_DB_FILE, defaultPlanChangesDb());
  const orders = readJson(ORDERS_DB_FILE, defaultOrdersDb());
  const logs = readJson(LOGS_DB_FILE, defaultLogsDb());
  const planChangeSource = Array.isArray(planChanges.planChanges) && planChanges.planChanges.length
    ? planChanges
    : { planChanges: plans.planChanges || [] };
  const data = migrateDb({ ...clients, ...staff, ...flags, ...venues, ...plans, ...planChangeSource, ...orders, ...logs });
  writeDb(data);
  return data;
}

function writeDb(data) {
  const migrated = migrateDb(data || {});
  writeJson(CLIENTS_DB_FILE, {
    clients: migrated.clients,
  });
  writeJson(STAFF_DB_FILE, {
    staff: migrated.staff
  });
  writeJson(FLAGS_DB_FILE, {
    inventories: migrated.inventories,
    flagItems: migrated.flagItems,
    branchStock: migrated.branchStock
  });
  writeJson(VENUES_DB_FILE, {
    venues: migrated.venues,
    venueRooms: migrated.venueRooms
  });
  writeJson(PLANS_DB_FILE, {
    plans: migrated.plans
  });
  writeJson(PLAN_CHANGES_DB_FILE, {
    planChanges: migrated.planChanges
  });
  writeJson(ORDERS_DB_FILE, {
    orders: migrated.orders
  });
  writeJson(LOGS_DB_FILE, {
    notifications: migrated.notifications,
    audit: migrated.audit
  });
  writeManagementManifest();
  writeLegacyManifest();
}

function readJson(filePath, fallback) {
  try {
    if (!fs.existsSync(filePath)) return structuredClone(fallback);
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return structuredClone(fallback);
  }
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf8");
}

function migrateLegacyDb() {
  if (!fs.existsSync(LEGACY_DB_FILE)) return;
  const legacy = readJson(LEGACY_DB_FILE, null);
  if (!legacy || legacy.splitStorage === true) return;
  const data = migrateDb(legacy);
  writeDb(data);
}

function migrateManagementDb() {
  if (!fs.existsSync(MANAGEMENT_DB_FILE)) return;
  const management = readJson(MANAGEMENT_DB_FILE, null);
  if (!management || management.splitStorage === true) return;
  const data = migrateDb(management);
  writeJson(CLIENTS_DB_FILE, { clients: data.clients });
  writeJson(STAFF_DB_FILE, { staff: data.staff });
  writeJson(FLAGS_DB_FILE, { inventories: data.inventories, flagItems: data.flagItems, branchStock: data.branchStock });
  writeJson(VENUES_DB_FILE, { venues: data.venues, venueRooms: data.venueRooms });
  writeJson(PLANS_DB_FILE, { plans: data.plans });
  writeJson(PLAN_CHANGES_DB_FILE, { planChanges: data.planChanges });
  writeManagementManifest();
}

function writeManagementManifest() {
  writeJson(MANAGEMENT_DB_FILE, {
    splitStorage: true,
    files: {
      clients: path.basename(CLIENTS_DB_FILE),
      staff: path.basename(STAFF_DB_FILE),
      flags: path.basename(FLAGS_DB_FILE),
      venues: path.basename(VENUES_DB_FILE),
      plans: path.basename(PLANS_DB_FILE),
      planChanges: path.basename(PLAN_CHANGES_DB_FILE)
    }
  });
}

function writeLegacyManifest() {
  writeJson(LEGACY_DB_FILE, {
    splitStorage: true,
    files: {
      management: path.basename(MANAGEMENT_DB_FILE),
      clients: path.basename(CLIENTS_DB_FILE),
      staff: path.basename(STAFF_DB_FILE),
      flags: path.basename(FLAGS_DB_FILE),
      venues: path.basename(VENUES_DB_FILE),
      plans: path.basename(PLANS_DB_FILE),
      planChanges: path.basename(PLAN_CHANGES_DB_FILE),
      orders: path.basename(ORDERS_DB_FILE),
      logs: path.basename(LOGS_DB_FILE)
    }
  });
}

function migrateDb(data) {
  data.clients = Array.isArray(data.clients) ? data.clients : [];
  data.staff = Array.isArray(data.staff) ? data.staff : [];
  data.staff.forEach(staff => {
    staff.authority = staff.authority || "driver";
  });
  data.venues = Array.isArray(data.venues) ? data.venues : [];
  data.venueRooms = Array.isArray(data.venueRooms) ? data.venueRooms : [];
  data.venues.forEach(venue => {
    if (venue.rooms && !data.venueRooms.some(room => room.venueId === venue.id)) {
      splitRooms(venue.rooms).forEach(roomName => data.venueRooms.push({ id: uid(), venueId: venue.id, name: roomName }));
    }
    delete venue.rooms;
  });
  data.inventories = Array.isArray(data.inventories) ? data.inventories : [];
  data.flagItems = Array.isArray(data.flagItems) ? data.flagItems : [];
  if (!data.flagItems.length && data.inventories.length) {
    data.inventories.forEach(item => {
      const count = Math.max(0, Number(item.initial || 0) + Number(item.added || 0) - Number(item.damaged || 0));
      for (let index = 1; index <= count; index += 1) {
        data.flagItems.push({
          id: uid(),
          clientId: item.clientId,
          type: item.type,
          label: `${item.type === "funeral" ? "근조기" : item.type === "celebration" ? "축하기" : "단체기"}-${String(index).padStart(2, "0")}`,
          status: "office",
          holderStaffId: "",
          siteOrderId: "",
          assignedOrderId: "",
          locationMemo: "사무실",
          updatedAt: new Date().toISOString()
        });
      }
    });
  }
  data.flagItems.forEach(item => {
    item.status = item.status || "office";
    item.holderStaffId = item.holderStaffId || "";
    item.siteOrderId = item.siteOrderId || "";
    item.assignedOrderId = item.assignedOrderId || "";
    item.locationMemo = item.locationMemo || "";
    item.updatedAt = item.updatedAt || new Date().toISOString();
  });
  data.branchStock = data.branchStock || {};
  data.plans = Array.isArray(data.plans) ? data.plans : [];
  data.planChanges = Array.isArray(data.planChanges) ? data.planChanges : [];
  data.orders = Array.isArray(data.orders) ? data.orders : [];
  data.orders.forEach(order => {
    order.recoveryStaffId = order.recoveryStaffId || "";
    order.inboundAt = order.inboundAt || "";
    order.flagItemId = order.flagItemId || "";
    order.photos = order.photos || { install: "", surroundings: "", board: "", recovery: "" };
    order.photos.surroundings = order.photos.surroundings || order.photos.board || "";
  });
  data.notifications = Array.isArray(data.notifications) ? data.notifications : [];
  data.audit = Array.isArray(data.audit) ? data.audit : [];
  return data;
}

function splitRooms(value) {
  return String(value || "")
    .split(/[,，]/)
    .map(room => room.trim())
    .filter(Boolean);
}

function isActiveStaff(staff) {
  return staff && (staff.note === "활동" || staff.note === "�쒕룞" || staff.note === "?쒕룞");
}

function send(res, status, body, type = "application/json; charset=utf-8") {
  res.writeHead(status, {
    "Content-Type": type,
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 10_000_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveFile(res, filePath, type) {
  fs.readFile(filePath, (error, data) => {
    if (error) return send(res, 404, "Not found", "text/plain; charset=utf-8");
    send(res, 200, data, type);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/api/login") {
      const body = await readBody(req);
      const { role, login, password } = JSON.parse(body || "{}");
      const data = readDb();
      let session = null;

      if (role === "admin" && !session) {
        const headquarters = data.staff.find(staff => staff.authority === "headquarters" && staff.login === login && staff.password === password && isActiveStaff(staff));
        if (headquarters) session = { role: "headquarters", id: headquarters.id, login };
      }

      if (role === "driver") {
        const driver = data.staff.find(staff => (staff.authority || "driver") === "driver" && staff.login === login && staff.password === password && isActiveStaff(staff));
        if (driver) session = { role: "driver", id: driver.id, login };
      }

      if (role === "client") {
        const client = data.clients.find(item => item.login === login && item.password === password);
        if (client) session = { role: "client", id: client.id, login };
      }

      if (!session) return send(res, 401, JSON.stringify({ error: "Invalid credentials" }));
      return send(res, 200, JSON.stringify({ session }));
    }

    if (req.method === "GET" && url.pathname === "/api/state") {
      return send(res, 200, JSON.stringify(readDb()));
    }

    if (req.method === "PUT" && url.pathname === "/api/state") {
      const body = await readBody(req);
      const data = JSON.parse(body);
      writeDb(data);
      return send(res, 200, JSON.stringify({ ok: true }));
    }

    if (req.method === "GET" && (url.pathname === "/" || url.pathname === "/index.html")) {
      return serveFile(res, path.join(ROOT, "index.html"), "text/html; charset=utf-8");
    }

    if (req.method === "GET" && url.pathname === "/README.md") {
      return serveFile(res, path.join(ROOT, "README.md"), "text/markdown; charset=utf-8");
    }

    return send(res, 404, "Not found", "text/plain; charset=utf-8");
  } catch (error) {
    return send(res, 500, JSON.stringify({ error: error.message }));
  }
});

ensureDb();
server.listen(PORT, () => {
  console.log(`The Flag app running at http://localhost:${PORT}/`);
  console.log(`Clients DB: ${CLIENTS_DB_FILE}`);
  console.log(`Staff DB: ${STAFF_DB_FILE}`);
  console.log(`Flags DB: ${FLAGS_DB_FILE}`);
  console.log(`Venues DB: ${VENUES_DB_FILE}`);
  console.log(`Plans DB: ${PLANS_DB_FILE}`);
  console.log(`Plan Changes DB: ${PLAN_CHANGES_DB_FILE}`);
  console.log(`Orders DB: ${ORDERS_DB_FILE}`);
  console.log(`Logs DB: ${LOGS_DB_FILE}`);
});
