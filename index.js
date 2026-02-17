// index.js
const { Client, GatewayIntentBits } = require("discord.js");
const { status } = require("minecraft-server-util");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

// Seu servidor Aternos
const SERVER_IP = "Nycojinos-vuNk.aternos.me";
const SERVER_PORT = 18629;

// Intervalo de atualização (ms)
const INTERVAL_MS = 30000;

// Tolerância para o “Aternos fantasma”
// Só marca OFF depois de X falhas seguidas
const MAX_FAILS = 3;
let failCount = 0;

// Estados possíveis: "online" | "loading" | "offline"
async function checkServer() {
  try {
    await status(SERVER_IP, SERVER_PORT, { timeout: 3000 });

    // Se respondeu, zerou falhas
    failCount = 0;
    return "online";
  } catch (err) {
    // Falhou: aumenta contador
    failCount++;

    // Enquanto não bateu o limite, considera como "loading"
    if (failCount < MAX_FAILS) return "loading";

    // Depois de X falhas seguidas, é OFF mesmo
    return "offline";
  }
}

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", async () => {
  console.log("Bot ligado!");

  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      if (!channel) return;

      const serverStatus = await checkServer();

      let name = "🔴 Servidor OFF";
      if (serverStatus === "online") name = "🟢 Servidor ON";
      if (serverStatus === "loading") name = "🟡 Servidor CARREGANDO";

      if (channel.name !== name) {
        await channel.setName(name);
      }

      // (Opcional) Log pra você ver o que ele tá detectando:
      // console.log(`Status: ${serverStatus} | failCount: ${failCount}/${MAX_FAILS}`);
    } catch (err) {
      console.error("Erro ao atualizar canal:", err.message);
    }
  }, INTERVAL_MS);
});

client.login(TOKEN);
