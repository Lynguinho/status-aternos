// index.js
const { Client, GatewayIntentBits } = require("discord.js");
const { chromium } = require("playwright");

// ====== ENV ======
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Seu login do Aternos (o mesmo que você usa no site)
const ATERNOS_USER = process.env.ATERNOS_USER;
const ATERNOS_PASS = process.env.ATERNOS_PASS;

// Intervalo de checagem (ms). 30000 = 30s
const CHECK_EVERY = Number(process.env.CHECK_EVERY || 30000);

// ====== Discord Client ======
const client = new Client({ intents: [GatewayIntentBits.Guilds] });

// ====== Aternos checker (Playwright) ======
let browser, page, loggedIn = false;

async function ensureBrowser() {
  if (!browser) {
    browser = await chromium.launch({ headless: true });
  }
  if (!page) {
    const ctx = await browser.newContext();
    page = await ctx.newPage();
    page.setDefaultTimeout(30000);
  }
}

async function loginAternosIfNeeded() {
  if (loggedIn) return;

  if (!ATERNOS_USER || !ATERNOS_PASS) {
    throw new Error("Faltou ATERNOS_USER ou ATERNOS_PASS nas variáveis do Railway.");
  }

  await ensureBrowser();

  // Página de login
  await page.goto("https://aternos.org/go/", { waitUntil: "domcontentloaded" });

  // Alguns navegadores/contas caem em telas diferentes, então tentamos ser tolerantes
  // Campos comuns do Aternos:
  const userSel = 'input[name="user"], input[type="text"]';
  const passSel = 'input[name="password"], input[type="password"]';

  await page.fill(userSel, ATERNOS_USER);
  await page.fill(passSel, ATERNOS_PASS);

  // Botão de login
  // Às vezes é submit, às vezes um button normal
  const btnSel = 'button[type="submit"], button:has-text("Login"), button:has-text("Entrar")';
  await page.click(btnSel);

  // Espera o site redirecionar / carregar algo depois do login
  await page.waitForTimeout(2500);

  // Se ainda estiver na página de login com erro, vai acusar depois
  loggedIn = true;
}

function normalizeStatusText(txt) {
  const t = (txt || "").toLowerCase();

  // Palavras comuns no Aternos
  if (t.includes("online")) return "online";
  if (t.includes("offline")) return "offline";
  if (t.includes("starting") || t.includes("inici") || t.includes("carreg")) return "loading";
  if (t.includes("queue") || t.includes("fila")) return "loading";

  return "unknown";
}

async function getAternosStatus() {
  await loginAternosIfNeeded();

  // Página principal do servidor (normalmente abre o server ativo da conta)
  await page.goto("https://aternos.org/server/", { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(1500);

  // Tentamos pegar o texto de status de várias formas
  const statusText = await page.evaluate(() => {
    const candidates = [
      "#serverstatus",
      ".server-status",
      ".status",
      ".statuslabel",
      ".status-label",
      "[data-status]"
    ];

    for (const sel of candidates) {
      const el = document.querySelector(sel);
      if (el && el.innerText) return el.innerText.trim();
      if (el && el.getAttribute && el.getAttribute("data-status")) return el.getAttribute("data-status");
    }

    // fallback: procura qualquer texto forte no topo da página
    const bodyText = document.body ? document.body.innerText : "";
    return bodyText.slice(0, 2000); // só um pedaço
  });

  const st = normalizeStatusText(statusText);

  // Se não achou nada, tenta uma segunda passada com refresh
  if (st === "unknown") {
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForTimeout(1500);

    const statusText2 = await page.evaluate(() => {
      const bodyText = document.body ? document.body.innerText : "";
      return bodyText.slice(0, 2500);
    });

    return normalizeStatusText(statusText2);
  }

  return st;
}

// ====== Update Discord channel name ======
async function updateChannelName(serverStatus) {
  const channel = await client.channels.fetch(CHANNEL_ID).catch(() => null);
  if (!channel) throw new Error("Não achei o canal. Confere se CHANNEL_ID tá certo e se o bot tá no servidor.");

  let name = "🔴 Servidor OFF";
  if (serverStatus === "online") name = "🟢 Servidor ON";
  if (serverStatus === "loading") name = "🟡 Servidor CARREGANDO";

  if (channel.name !== name) {
    await channel.setName(name);
    console.log("Atualizou canal para:", name);
  } else {
    console.log("Status igual, não mudou:", name);
  }
}

// ====== Main ======
client.once("ready", async () => {
  console.log(`Bot ligado! (${client.user.tag})`);

  // Primeira atualização já de cara
  try {
    const st = await getAternosStatus();
    await updateChannelName(st);
  } catch (e) {
    console.error("Erro na primeira checagem:", e.message);
  }

  // Loop
  setInterval(async () => {
    try {
      const st = await getAternosStatus();
      await updateChannelName(st);
    } catch (e) {
      console.error("Erro ao atualizar:", e.message);

      // Se der erro, derruba sessão pra tentar logar de novo no próximo ciclo
      loggedIn = false;
    }
  }, CHECK_EVERY);
});

client.login(DISCORD_TOKEN);

// Fecha o browser direitinho (se o Railway mandar SIGTERM)
process.on("SIGTERM", async () => {
  try {
    if (browser) await browser.close();
  } catch {}
  process.exit(0);
});
