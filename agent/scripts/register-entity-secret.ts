import { randomBytes } from "node:crypto";
import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { registerEntitySecretCiphertext } from "@circle-fin/developer-controlled-wallets";
import path from "node:path";
import dotenv from "dotenv";

// Load .env from agent directory
dotenv.config({ path: path.join(__dirname, "..", ".env") });

const apiKey: string | undefined = process.env.CIRCLE_API_KEY;
if (!apiKey) {
  throw new Error("CIRCLE_API_KEY is required. Set it in .env first.");
}

const envPath = path.join(__dirname, "..", ".env");

// Refuse to overwrite an existing entity secret in .env.
const existingEnv: string = existsSync(envPath)
  ? readFileSync(envPath, "utf8")
  : "";
if (/^CIRCLE_ENTITY_SECRET=/m.test(existingEnv)) {
  console.log("CIRCLE_ENTITY_SECRET already exists in .env. Skipping registration.");
  console.log(`Existing: ${existingEnv.match(/^CIRCLE_ENTITY_SECRET=(.+)$/m)?.[1]?.slice(0, 16)}...`);
  process.exit(0);
}

// Generate a 32-byte entity secret.
const entitySecret: string = randomBytes(32).toString("hex");
const recoveryFilePath: string = path.join(__dirname, "..", "recovery");

mkdirSync(recoveryFilePath, { recursive: true });

async function main() {
  await registerEntitySecretCiphertext({
    apiKey,
    entitySecret,
    recoveryFileDownloadPath: recoveryFilePath,
  });

  // Append to .env
  appendFileSync(envPath, `\nCIRCLE_ENTITY_SECRET=${entitySecret}\n`);

  console.log("Entity secret registered.");
  console.log(`Recovery file saved to: ${recoveryFilePath}`);
  console.log("CIRCLE_ENTITY_SECRET added to .env");
  console.log(`Entity secret: ${entitySecret.slice(0, 16)}...`);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
