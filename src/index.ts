import { Monitoring } from "./db.js";
import { GMX } from "./gmx.js";
require("dotenv").config();

async function main() {
  const monitoring = new Monitoring();
  await monitoring.connect();
  await monitoring.insertEvent("bot_123", "test_event", {
    foo: "bar",
    count: 1,
  });
}

main();
