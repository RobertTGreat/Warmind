import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");
const [command = "dev", ...extraArgs] = process.argv.slice(2);

const env = { ...process.env };

if (process.platform === "win32" && !env.TRUST_STORES) {
  // Avoid mkcert trying to update the Java trust store under Program Files.
  env.TRUST_STORES = "system";
}

const child = spawn(
  process.execPath,
  [nextBin, command, "--experimental-https", ...extraArgs],
  {
    stdio: "inherit",
    env,
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});

child.on("error", (error) => {
  console.error("Failed to launch Next.js with HTTPS:", error);
  process.exit(1);
});
