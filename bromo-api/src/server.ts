import { createApp } from "./app.js";
import { connectDb } from "./db/connect.js";
import { env } from "./config/env.js";

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.port, () => {
    console.log(`BROMO API listening on https://bromo.darkunde.in:${env.port}`);
  });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
