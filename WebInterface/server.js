// server.js
const WebSocket = require("ws");
const si = require("systeminformation");
const wss = new WebSocket.Server({ port: 8081 });
const express = require("express");
const app = express();
const { execSync } = require("child_process")

app.use(express.static("/home/eliud1013/Rasp/WebInterface/public"));

wss.on("connection", (ws) => {
  let seconds = 0;
  console.log("Client connected");

  const interval = setInterval(async () => {
    seconds += 1;

    // Send temperature
    if (seconds % 2 === 0) {
      const temperatures = await si.cpuTemperature();
      let core_1 = temperatures.main;
      let core_2 = core_1 - Math.floor(Math.random() * 13)
      const piTemperature = { core_1, core_2};

      const message = { type: "temperature", value: piTemperature };
      ws.send(JSON.stringify(message));
    }
    // Send Traffic Trend
    if (seconds % 1 === 0) {
      let RX_Packets = execSync('ifconfig wlan0  | grep -oP "(?<=RX packets )\\d+"').toString();
      let TX_Packets = execSync('ifconfig wlan0  | grep -oP "(?<=TX packets )\\d+"').toString();
      const time = await si.time();
      const hours = Math.floor(time.uptime / 3600); 
      const minutes = Math.floor((time.uptime % 3600) / 60); 
      const uptime = `${hours}h ${minutes}m`

      const trafficTrend = { RX_Packets, TX_Packets, uptime };
      const message = { type: "traffic", value: trafficTrend };
      ws.send(JSON.stringify(message));
    }
    // Process
    if (seconds % 2 === 0) {
      try {
        const data = await si.processes();
        const processes = [];
        data.list.forEach((process) => {
          const processRow = `
            <tr>
              <td>${process.user}</td>
              <td>${process.pid}</td>
              <td>${(process.cpu || 0).toFixed(1)}%</td>
              <td>${(process.mem || 0).toFixed(1)}%</td>
              <td>${process.state}</td>
              <td>${process.name}</td>
            </tr>
          `;
          processes.push(processRow);
        });
        const message = { type: "process", value: processes };
        ws.send(JSON.stringify(message));
      } catch (error) {
        console.error("Error fetching process information:", error);
      }
    }
    // Send Resource Usage
    if (seconds % 20 === 0) {
      resourceUsage = {
        cpu: Math.random() * 100, // CPU Usage
        memory: Math.random() * 100, // Memoria
        storage: Math.random() * 100, // Almacenamiento
      };
      const message = { type: "resource", value: resourceUsage };
      ws.send(JSON.stringify(message));
    }

    ws.send(JSON.stringify({ type: "uptime", value: seconds }));
  }, 1000);

  ws.on("close", () => {
    clearInterval(interval);
    console.log("Client disconnected");
  });
});

app.listen(80, console.log(""));
