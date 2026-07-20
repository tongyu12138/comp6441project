import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("server-renders the AuthLab product shell", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /AuthLab/);
  assert.match(html, /Passwords, Phishing, MFA and Passkeys/);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
  assert.match(html, /og\.png/);
});

test("source includes every promised learning and privacy control", async () => {
  const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
  for (const required of [
    "Identity engineering",
    "Password failure modes",
    "Phishing and impersonation",
    "MFA and passkeys",
    "navigator.credentials.create",
    "navigator.credentials.get",
    "Export CSV",
    "Reset local data",
    "No credential collection",
  ]) assert.match(page, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
  assert.match(page, /STORAGE_KEY/);
  assert.match(page, /example\.test/);
});
