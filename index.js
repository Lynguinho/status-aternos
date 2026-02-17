// index.js
const { Client, GatewayIntentBits } = require("discord.js");
const net = require("net");

const TOKEN = process.env.DISCORD_TOKEN;
const CHANNEL_ID = process.env.CHANNEL_ID;

const SERVER_IP = "Nycojinos-vuNk.aternos.me";
const SERVER_PORT = 18629;

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

function checkServer() {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let status = "offline";

    socket.setTimeout(3000);

    socket.connect(SERVER_PORT, SERVER_IP, () => {
      status = "online";
      socket.destroy();
    });

    socket.on("timeout", () => {
      status = "loading";
      socket.destroy();
    });

    socket.on("error", () => {
      status = "offline";
    });

    socket.on("close", () => resolve(status));
  });
}

client.once("ready", async () => {
  console.log("Bot ligado!");

  setInterval(async () => {
    const channel = await client.channels.fetch(CHANNEL_ID);
    const status = await checkServer();

    let name = "🔴 Servidor OFF";
    if (status === "online") name = "🟢 Servidor ON";
    if (status === "loading") name = "🟡 Servidor CARREGANDO";

    if (channel.name !== name) {
      channel.setName(name);
    }
  }, 30000); // 30 segundos
});

client.login(TOKEN);
