// index.js
const { Client, GatewayIntentBits } = require("discord.js");
const { status } = require("minecraft-server-util");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const SERVER_IP = "Nycojinos-vuNk.aternos.me";
const SERVER_PORT = 18629;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

async function checkServer() {
  try {
    await status(SERVER_IP, SERVER_PORT, { timeout: 3000 });
    return "online";
  } catch (err) {
    return "offline";
  }
}

client.once("ready", async () => {
  console.log("Bot ligado!");

  setInterval(async () => {
    try {
      const channel = await client.channels.fetch(CHANNEL_ID);
      const serverStatus = await checkServer();

      let name = "🔴 Servidor OFF";
      if (serverStatus === "online") name = "🟢 Servidor ON";

      if (channel && channel.name !== name) {
        await channel.setName(name);
      }
    } catch (err) {
      console.error("Erro ao atualizar canal:", err.message);
    }
  }, 30000); // 30s
});

client.login(TOKEN);
