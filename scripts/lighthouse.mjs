import { chromium } from "@playwright/test";
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const arguments_ = process.argv.slice(2);
const urlIndex = arguments_.indexOf("--url");
const input = urlIndex >= 0 ? arguments_[urlIndex + 1] : arguments_[0];
if (!input) throw new Error("Usage: pnpm lighthouse -- --url <http-url>");
const url = new URL(input);
if (!["http:", "https:"].includes(url.protocol)) {
  throw new Error("Lighthouse URL must use http or https");
}

const chrome = await chromeLauncher.launch({
  chromeFlags: ["--headless=new", "--no-sandbox", "--disable-dev-shm-usage"],
  chromePath: chromium.executablePath(),
});

try {
  const result = await lighthouse(url.href, {
    logLevel: "error",
    onlyCategories: ["performance", "accessibility", "best-practices", "seo"],
    output: "json",
    port: chrome.port,
  });
  if (!result) throw new Error("Lighthouse produced no result");

  const scores = Object.fromEntries(
    Object.entries(result.lhr.categories).map(([id, category]) => [
      id,
      Math.round((category.score ?? 0) * 100),
    ]),
  );
  console.log(JSON.stringify(scores));
  if (Object.values(scores).some((score) => score < 95)) process.exitCode = 1;
} finally {
  chrome.kill();
}
