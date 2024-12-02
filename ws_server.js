#!/bin/node
require("colors");
const { isMainThread, parentPort } = require("worker_threads");
const WebSocket = require("ws");
const { WebSocketServer } = WebSocket;
const fs = require("fs");
const wss = new WebSocketServer({ port: 8080 });

const si = require("systeminformation");

if (isMainThread) {
  console.log(
    "\n[X]".yellow + " This script should be run as a worker thread!".white
  );
  process.exit(1);
} else {
  wss.listenin;
}

function getMaxFrequency() {
  let max = fs.readFileSync(
    "/sys/devices/system/cpu/cpu1/cpufreq/scaling_max_freq",
    "utf8"
  );
  const maxFreqNumber = parseInt(max.trim(), 10);
  return (maxFreqNumber / 1e6).toFixed(2) + " GHz";
}
wss.on("connection", (ws) => {
  console.log("\n" + " WS Server: ".blue + "New Client Connected".white);
  const intervalId = setInterval(async () => {
    try {
      const cpuTemp = await si.cpuTemperature();
      const cpuLoad = (await si.currentLoad()).currentLoad.toFixed(2);
      const osInfo = await si.osInfo();
      const osInfoString = `${osInfo.platform} ${osInfo.distro}`;
      const wifiConnection = await si.wifiConnections();
      const clockSpeed = await si.cpuCurrentSpeed();
      const maxFreq = getMaxFrequency();

      const message = {
        cpuTemperature: cpuTemp.main,
        cpuLoad: cpuLoad.currentLoad,
        osInfo: osInfoString,
        interface: wifiConnection[0].iface,
        network: wifiConnection[0].ssid || "-",
        speed: clockSpeed.avg + " KHz",
        maxFreq: maxFreq,
      };

      ws.send(JSON.stringify(message));
    } catch (error) {
      console.log(error);
    }
  }, 2000);

  ws.on("close", () => {
    console.log("\n" + " WS Server: ".blue + "Client Disconnected".white);
    clearInterval(intervalId);
  });
});
