// Prints an expiring /admin sign-in link, signed with ADMIN_KEY (default 24 h).
//   ADMIN_KEY=... node scripts/admin-link.mjs [hours] [base-url]
// On pip: set -a; source ~/.config/entrpy/gamecock-admin.env; set +a; node scripts/admin-link.mjs
import { createHmac } from "node:crypto";

const key = process.env.ADMIN_KEY;
if (!key) { console.error("ADMIN_KEY is not set"); process.exit(1); }
const hours = Number(process.argv[2] ?? 24);
const base = (process.argv[3] ?? "https://www.gamecock.ai").replace(/\/$/, "");
const exp = Math.floor(Date.now() / 1000 + hours * 3600);
const sig = createHmac("sha256", key).update(`gamecock-admin-link:${exp}`).digest("hex");
console.log(`${base}/admin/auth?t=${exp}.${sig}`);
console.error(`valid until ${new Date(exp * 1000).toLocaleString("en-US", { timeZone: "America/New_York" })} ET`);
