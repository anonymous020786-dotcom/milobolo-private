// Run with both dev servers up:  npx playwright install chromium && node e2e/two-browser-chat.js
// Two real browsers chat through the running dev servers.
const { chromium } = require("playwright");
const path = require("path");
const SHOTS = path.join(__dirname, "screenshots");
require("fs").mkdirSync(SHOTS, { recursive: true });

const BASE = process.env.BASE_URL || "http://localhost:3000";
const results = [];
const check = (name, ok, extra = "") => { results.push({ name, ok }); console.log(`${ok ? "PASS" : "FAIL"} ${name}${extra ? " — " + extra : ""}`); };

async function newUser(browser, fp) {
  const ctx = await browser.newContext({ permissions: ["microphone", "camera"], viewport: { width: 1280, height: 800 } });
  await ctx.addInitScript(() => {
    sessionStorage.setItem("age_confirmed", "1");
    localStorage.setItem("pwa_dismissed", "1");
    localStorage.setItem("mb_cookie_consent", JSON.stringify({ necessary: true, analytics: false, ads: false, decided: true, ts: Date.now() }));
    localStorage.setItem("mb_welcome_seen", "1");
    localStorage.setItem("milobolo_welcome_seen", "1");
    localStorage.setItem("mb_settings", JSON.stringify({ hideStrangerLinks: true, sendReadReceipts: true }));
  });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log(`[${fp} pageerror]`, e.message));
  page.on("console", (m) => { if (m.type() === "error" && !/favicon|Failed to load resource|supabase|placeholder/i.test(m.text())) console.log(`[${fp} console]`, m.text().slice(0, 200)); });
  return page;
}

async function dismissOverlays(page) {
  for (const label of [/accept all/i, /got it/i, /skip/i, /close/i]) {
    const b = page.getByRole("button", { name: label }).first();
    if (await b.isVisible().catch(() => false)) await b.click().catch(() => {});
  }
}

(async () => {
  const browser = await chromium.launch({ args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
  const a = await newUser(browser, "A");
  const b = await newUser(browser, "B");

  await a.goto(`${BASE}/chat?mode=text&interests=music,anime`);
  await a.waitForTimeout(1500);
  await dismissOverlays(a);
  await b.goto(`${BASE}/chat?mode=text&interests=music`);
  await b.waitForTimeout(1500);
  await dismissOverlays(b);

  // Match
  const sys = /now chatting with a random stranger/i;
  const matched = await Promise.all([
    a.getByText(sys).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false),
    b.getByText(sys).first().waitFor({ timeout: 20000 }).then(() => true).catch(() => false),
  ]);
  check("both browsers matched", matched.every(Boolean));
  check("shared interest shown", await a.getByText(/You both like: music/i).first().isVisible().catch(() => false));

  // Text + formatting
  const inputA = a.getByPlaceholder(/message/i).first();
  await inputA.fill("hello *there* from A");
  await inputA.press("Enter");
  const got = await b.getByText("from A").first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("message delivered A→B", got);
  check("bold formatting rendered", await b.locator("strong", { hasText: "there" }).first().isVisible().catch(() => false));

  // Read receipt: B is visible so A should see "Seen"
  await a.waitForTimeout(1200);
  check("read receipt (Seen) on sender", (await a.locator('[data-testid="DoneAllIcon"]').count()) > 0);

  // Stranger link hidden
  const inputB = b.getByPlaceholder(/message/i).first();
  await inputB.fill("check https://example.com/page");
  await inputB.press("Enter");
  const hidden = await a.getByText(/link to example\.com — show/i).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("stranger link hidden until revealed", hidden);

  // Reply
  const peerMsg = a.getByText("check").first();
  await peerMsg.hover();
  await a.getByRole("button", { name: "Reply" }).last().click();
  await inputA.fill("replying to you");
  await inputA.press("Enter");
  const quoted = await b.getByText(/↪ You: check https:\/\/example\.com\/page/).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("reply quote shown to peer (from their POV)", quoted);

  // Per-message reaction
  await b.getByText("replying to you").first().hover();
  await b.getByRole("button", { name: "React", exact: true }).last().click();
  await b.getByRole("button", { name: "🔥" }).first().click();
  const reacted = await a.getByText("🔥").first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("per-message reaction relayed", reacted);

  // Unsend
  await inputA.fill("oops wrong chat");
  await inputA.press("Enter");
  await b.getByText("oops wrong chat").first().waitFor({ timeout: 8000 });
  await a.getByText("oops wrong chat").first().hover();
  await a.getByRole("button", { name: "Unsend" }).last().click();
  const unsent = await b.getByText("Message unsent").first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("unsend removes message for peer", unsent && !(await b.getByText("oops wrong chat").count()));

  // Tic-tac-toe
  await a.screenshot({ path: path.join(SHOTS, "a-before-game.png") });
  await b.screenshot({ path: path.join(SHOTS, "b-before-game.png") });
  await a.getByRole("button", { name: "Play tic-tac-toe" }).click({ timeout: 5000 });
  const invited = await b.getByRole("button", { name: "Play", exact: true }).waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("game invite received", invited);
  if (invited) {
    await b.getByRole("button", { name: "Play", exact: true }).click();
    await a.getByText(/Your turn \(X\)/).waitFor({ timeout: 8000 });
    const cell = (p, i) => p.getByRole("button", { name: new RegExp(`^Cell ${i}`) });
    await cell(a, 1).click(); await b.getByText(/Your turn/).waitFor();
    await cell(b, 4).click(); await a.getByText(/Your turn/).waitFor();
    await cell(a, 2).click(); await b.getByText(/Your turn/).waitFor();
    await cell(b, 5).click(); await a.getByText(/Your turn/).waitFor();
    await cell(a, 3).click();
    check("game won by A", await a.getByText("You win! 🎉").waitFor({ timeout: 8000 }).then(() => true).catch(() => false));
    check("B sees loss", await b.getByText("Stranger wins!").isVisible().catch(() => false));
  }

  // Icebreaker
  await a.getByRole("button", { name: "Icebreakers" }).click();
  const firstQ = a.getByRole("menuitem").first();
  const qText = (await firstQ.innerText()).split("\n")[0].replace(/ #\w+$/, "").trim();
  await firstQ.click();
  check("icebreaker sent", await b.getByText(qText.slice(0, 25)).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false));

  await a.screenshot({ path: path.join(SHOTS, "a-chat.png") });
  await b.screenshot({ path: path.join(SHOTS, "b-chat.png") });

  // Leave → post-chat card on the other side
  await a.getByRole("button", { name: "Stop", exact: true }).click();
  const confirm = a.getByRole("dialog").getByRole("button", { name: "Stop" });
  if (await confirm.isVisible().catch(() => false)) await confirm.click();
  const left = await b.getByText(/partner has disconnected/i).first().waitFor({ timeout: 8000 }).then(() => true).catch(() => false);
  check("peer_left shown", left);
  check("post-chat rating card shown", await b.getByText("How was that chat?").isVisible().catch(() => false));
  await b.getByRole("button", { name: /Don't match again/ }).click();
  check("block acknowledged", await b.getByRole("button", { name: "Blocked" }).waitFor({ timeout: 5000 }).then(() => true).catch(() => false));
  await b.screenshot({ path: path.join(SHOTS, "b-ended.png") });

  // Other pages render without crashing
  for (const route of ["/", "/status", "/leaderboard", "/u/nobody_here", "/messages", "/friends", "/college"]) {
    const p = await newUser(browser, route);
    const res = await p.goto(`${BASE}${route}`);
    await p.waitForTimeout(1200);
    const crashed = await p.getByText(/Application error|Unhandled Runtime Error/i).count();
    check(`page ${route} renders`, !!res && res.status() < 500 && !crashed, `status ${res?.status()}`);
    if (route === "/status") await p.screenshot({ path: path.join(SHOTS, "status.png") });
    await p.context().close();
  }

  await browser.close();
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  process.exit(failed.length ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(2); });
