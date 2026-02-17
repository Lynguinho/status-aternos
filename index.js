// index.js
const { Client, GatewayIntentBits } = require("discord.js");
const { status } = require("minecraft-server-util");
const net = require("net");

// Variáveis do Railway (Settings > Variables)
const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Seu servidor Aternos
const SERVER_IP = "Nycojinos-vuNk.aternos.me";
const SERVER_PORT = 18629;

// Intervalo de checagem (ms)
const CHECK_EVERY = 30_000; // 30s

if (!TOKEN || !CHANNEL_ID) {
  console.error("Faltou DISCORD_TOKEN ou CHANNEL_ID nas Variables do Railway.");
  process.exit(1);
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Teste 1: Minecraft status (o que importa de verdade)
async function pingMinecraft() {
  try {
    // enableSRV ajuda quando o endereço usa SRV (muito comum)
    await status(SERVER_IP, SERVER_PORT, {
      timeout: 2500,
      enableSRV: true,
    });
    return true;
  } catch {
    return false;
  }
}

// Teste 2: Porta aberta (proxy/aternos respondendo)
function checkPortOpen() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let done = false;

    const finish = (result) => {
      if (done) return;
      done = true;
      try { socket.destroy(); } catch {}
      resolve(result);
    };

    socket.setTimeout(2000);

    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));

    socket.connect(SERVER_PORT, SERVER_IP);
  });
}

// Decide ONLINE / LOADING / OFFLINE
async function getServerState() {
  const mcOk = await pingMinecraft();
  if (mcOk) return "online";

  const portOk = await checkPortOpen();
  if (portOk) return "loading";

  return "offline";
}

function nameFromState(state) {
  if (state === "online") return "🟢 Servidor ON";
  if (state === "loading") return "🟡 Servidor CARREGANDO";
  return "🔴 Servidor OFF";
}

client.once("ready", async () => {
  console.log(`Bot ligado! (${client.user.tag})`);

  // roda uma vez na hora que liga
  let lastName = null;

  const tick = async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) return console.log("Canal não encontrado. CHANNEL_ID tá certo?");

      const state = await getServerState();
      const newName = nameFromState(state);

      if (newName !== lastName && channel.name !== newName) {
        await channel.setName(newName);
        console.log("Atualizou canal para:", newName);
      }

      lastName = newName;
    } catch (err) {
      console.error("Erro ao atualizar canal:", err?.message || err);
    }
  };

  await tick();
  setInterval(tick, CHECK_EVERY);
});

client.login(TOKEN);
