import { readFile } from "node:fs/promises";
import { parse as parseYaml } from "yaml";
import { parseConfig } from "../apps/api/src/config/env.js";

const rootUrl = new URL("../", import.meta.url);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const [renderText, vercelText, envExample] = await Promise.all([
  readFile(new URL("render.yaml", rootUrl), "utf8"),
  readFile(new URL("vercel.json", rootUrl), "utf8"),
  readFile(new URL(".env.example", rootUrl), "utf8"),
]);

const render = parseYaml(renderText);
const vercel = JSON.parse(vercelText);

assert(Array.isArray(render.services), "render.yaml must define services");
assert(render.services.length === 3, "render.yaml must define three services");

const serviceTypes = new Map(
  render.services.map((service) => [service.name, service.type]),
);
assert(
  serviceTypes.get("pratyaya-api-alive7z") === "web",
  "Render API web service is missing",
);
assert(
  serviceTypes.get("pratyaya-provider-alive7z") === "web",
  "Render provider web service is missing",
);
assert(
  serviceTypes.get("pratyaya-worker-alive7z") === "worker",
  "Render background worker is missing",
);

for (const service of render.services) {
  assert(
    service.runtime === "node",
    `${service.name} must use the Node runtime`,
  );
  assert(
    service.autoDeployTrigger === "checksPass",
    `${service.name} must wait for CI before deployment`,
  );
}

assert(vercel.framework === "vite", "Vercel must use the Vite preset");
assert(
  vercel.outputDirectory === "apps/web/dist",
  "Vercel output directory is incorrect",
);

const credentialPatterns = [
  /mongodb\+srv:\/\/[^/\s:@]+:[^/\s@]+@/i,
  /github_pat_[A-Za-z0-9_]+/,
  /ghp_[A-Za-z0-9]+/,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
];
for (const pattern of credentialPatterns) {
  assert(
    !pattern.test(envExample),
    ".env.example contains credential-shaped data",
  );
  assert(
    !pattern.test(renderText),
    "render.yaml contains credential-shaped data",
  );
  assert(
    !pattern.test(vercelText),
    "vercel.json contains credential-shaped data",
  );
}

const productionConfig = parseConfig({
  NODE_ENV: "production",
  PORT: "10000",
  MONGODB_URI: "mongodb+srv://cluster.example.invalid/pratyaya",
  AUTH_JWT_SECRET: "a".repeat(48),
  MOCK_PROVIDER_HMAC_SECRET: "b".repeat(48),
  PROVIDER_BASE_URL:
    "https://pratyaya-provider-alive7z.onrender.com/provider/alpha",
  CORS_ORIGINS: "https://pratyaya.example",
});
assert(productionConfig.apiPort === 10000, "API must honor platform PORT");
assert(
  productionConfig.auth.secureCookies,
  "Production cookies must be secure",
);

await import("../apps/worker/src/modules/jobs/job-processor.js");

console.log(
  JSON.stringify({
    status: "ok",
    renderServices: [...serviceTypes.entries()],
    vercelOutputDirectory: vercel.outputDirectory,
    workerImport: "ok",
    credentialScan: "clean",
  }),
);
