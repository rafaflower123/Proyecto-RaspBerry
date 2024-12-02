#!/bin/node

require("dotenv").config();
require("colors");
const { Worker } = require("worker_threads");
const { execSync } = require("child_process");
const fs = require("fs");
const si = require("systeminformation");
const influxClient = require("./influxdb.js");
const twilioClient = require("./twilioClient.js");
const getLogoImage = require("./logoImage.js");
const wsWorker = new Worker("./ws_server.js");
const svrWorker = new Worker("./webInterface.js");
const dashBoardWorker = new Worker("./WebInterface/server.js");

let running = true;
let display = [];
let isLimited = false;
let notifySMS = true;
let messageQueue = [];
let logoImage = "";
let fastInit = false;

function showLoading(promise) {
  return new Promise(async (resolve) => {
    const frames = [
      "▰▱▱▱▱▱▱",
      "▰▰▱▱▱▱▱",
      "▰▰▰▱▱▱▱",
      "▰▰▰▰▱▱▱",
      "▰▰▰▰▰▱▱",
      "▰▰▰▰▰▰▱",
      "▰▰▰▰▰▰▰",
    ];
    frameIndex = 0;
    const spinner = setInterval(() => {
      process.stdout.write(
        `\r${frames[frameIndex]}`.green + " Loading...".white.bold
      );
      frameIndex = (frameIndex + 1) % frames.length;
    }, 100);
    promise().then((result) => {
      clearInterval(spinner);
      return resolve(result);
    });
  });
}

async function showHeader() {
  if (logoImage === null && !fastInit) {
    logoImage = await getLogoImage();

    console.clear();
  }

  console.log(logoImage || "No Image");
  console.log("=====================================".grey);
  console.log("   Raspberry Pi Temperature Monitor".red.bold);
  console.log("=====================================\n".grey);
}
async function banner(withDelay = false) {
  console.clear();
  process.stderr.write("\x1B[?25l");
  await showHeader();

  const messages = [
    {
      icon: "".rainbow,
      message: "Server started at " + new Date().toLocaleString() + "\n",
      bold: true,
      postMessage: "",
    },
    {
      icon: "".green,
      message: "WebSocket Server",
      bold: false,
      postMessage: "      ".gray + "READY".green,
    },
    {
      icon: "".blue,
      message: "InfluxDB Connection",
      bold: false,
      postMessage: "   ".gray + "CONNECTED".green,
    },
    {
      icon: "󱠇".red,
      message: "Temperature Monitor",
      bold: false,
      postMessage: "   ".gray + "RUNNING".green,
    },
    {
      icon: "󰖟".cyan,
      message: "Web Interface".white,
      bold: false,
      postMessage: "         ".gray + "RUNNING".green,
    },
    {
      icon: "󰖟".blue,
      message: "Dashboard".white,
      bold: false,
      postMessage: "	         ".gray + "RUNNING".green,
    },
  ];

  if (notifySMS) {
    messages.push({
      icon: "".gray,
      message: "SMS Notfify".white,
      bold: false,
      postMessage: "           ".gray + "ACTIVE".green,
    });
  } else {
    messages.push({
      icon: "".gray,
      message: "SMS Notfify".white,
      bold: false,
      postMessage: "           ".gray + "DISABLED".yellow,
    });
  }

  //
  if (isLimited) {
    messages.push({
      icon: "󰓅".gray,
      message: "Limited Mode".white,
      bold: false,
      postMessage: "          ".gray + "ON\n".green,
    });
  } else {
    messages.push({
      icon: "󰾆".gray,
      message: "Limited Mode".white,
      bold: false,
      postMessage: "          ".gray + "OFF\n".red,
    });
  }

  function showMessage(icon, message, bold, postMessage) {
    const formattedMessage = bold ? message.bold.white : message.white;
    const outMessage = icon + " " + formattedMessage + " " + postMessage;
    console.log(outMessage);
    display.push(outMessage);
  }
  async function showMessages(messages) {
    for (const message of messages) {
      showMessage(
        message.icon,
        message.message,
        message.bold,
        message.postMessage
      );
      if (withDelay) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    return null;
  }
  return await showMessages(messages);
}

async function GetInformation() {
  //temperature,board=FX506HC,cpu=Gen Intel® Core™ i5-11400H,cpuLoad=30% celcius=50.0,farhenheit=122.0 1628580000000000000
  const measurement = "temperature";
  const board = (await si.baseboard()).model || "Raspberry Pi 3";
  const cpu = (await si.cpu()).brand.replace(/[®™]/g, "");
  const cpuLoad = (await si.currentLoad()).currentLoad.toFixed(2);
  const celcius = (await si.cpuTemperature()).main;
  const farhenheit = celcius * 1.8 + 32;
  return { measurement, board, cpu, cpuLoad, celcius, farhenheit };
}

async function displayInformation(messages) {
  console.clear();
  await banner(false);

  for (const message of messages) {
    console.log(message);
  }

  return true;
}
function getMaxFrequency() {
  let max = fs.readFileSync(
    "/sys/devices/system/cpu/cpu1/cpufreq/scaling_max_freq",
    "utf8"
  );
  const maxFreqNumber = parseInt(max.trim(), 10);
  return (maxFreqNumber / 1e6).toFixed(2) + " GHz";
}

async function limitFrequency() {
  const cmd_1 = "sudo cpufreq-set -u 600000";
  const cmd_2 =
    "tc qdisc add dev wlan0 root tbf rate 5mbit burst 32kbit latency 400ms";
  try {
    execSync(cmd_1);
    execSync(cmd_2);

    if (notifySMS) {
      const sent = await twilioClient(
        "Frequency and bandwidth has been limited"
      );
      if (sent) {
        messageQueue.push(" ".green + "SMS sent successfully!".white);
      }
    }
    messageQueue.push(
      "󰀦 ".yellow + "CPU Frequency and Bandwidth Limited!".white
    );
  } catch (error) {
    console.error(error);
  }
}

function restoreFrequency() {
  const cmd_1 = "cpufreq-set -u 1200000";
  const cmd_2 = "tc qdisc del dev wlan0 root";

  try {
    execSync(cmd_1);
    if (isLimited) {
      execSync(cmd_2);
    }
    //console.log("󰀦 ".yellow + "CPU Frequency and bandwidth limit removed!".white);
    messageQueue.push(
      "󰀦 ".yellow + "CPU Frequency and bandwidth limit removed!".white
    );
    isLimited = false;
  } catch (error) {
    console.error(error);
  }
}

function formatValue(label1, label2, value, limit1, limit2) {
  const intValue = parseInt(value);
  if (intValue >= limit1) {
    return `${label1.white.bold} ${value.red}${label2.red}`;
  } else if (intValue >= limit2) {
    return `${label1.white.bold} ${value.yellow}${label2.yellow}`;
  } else {
    return `${label1.white.bold} ${value.green}${label2.green}`;
  }
}

// Main function
async function Monitor() {
  // Initialize
  let counter = 0;

  while (running) {
    const systemInfo = await GetInformation();
    const temp = systemInfo.celcius;

    const maxFreq = await getMaxFrequency();

    // Display information
    const temperatureMessage = formatValue(
      "Pi Temperature",
      "°C",
      temp.toString(),
      56,
      50
    );
    const cpuLoad = formatValue("CPU Load", "%", systemInfo.cpuLoad, 85, 60);

    let messages = [
      " ".yellow + temperatureMessage,
      " ".green + cpuLoad,
      " ".cyan + "Board ".white.bold + systemInfo.board.white,
      "󱑼 ".blue + "Max CPU Frequency ".white.bold + maxFreq.white,
      " ".white +
        "Current Time ".white.bold +
        new Date().toLocaleString().white,
    ];

    displayInformation(messages);
    // Checks
    if (temp >= 55 && !isLimited) {
      isLimited = true;

      await limitFrequency();
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    if (temp < 55 && isLimited) {
      restoreFrequency();

      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    // Message Handler
    while (messageQueue.length > 0) {
      let message = messageQueue.shift();
      console.log("\n" + message);
    }
    if (counter == 10) {
      influxClient.SaveTemperature(systemInfo);
      messageQueue.push(" ".yellow + "Temperature saved to InfluxDB".white);
      counter = 0;
    }
    counter++;
    // Wait for 2 seconds
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
}

// Exit Handler
let closing = false;
process.on("SIGINT", async () => {
  if (!closing) {
    console.clear();
    showHeader();
    running = false;
    closing = true;

    // Close Influxdb connection
    await influxClient.closeConnection();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Close workers
    console.log("󰅗 ".red + "Closing Workers...".white);
    svrWorker.terminate();
    wsWorker.terminate();
    dashBoardWorker.terminate();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Restore frequency
    console.log("󰅗 ".red + "Restoring frequency".white);
    restoreFrequency();
    await new Promise((resolve) => setTimeout(resolve, 1000));
    // Exit the process
    console.log("󰅗 ".red + "Exiting...".white);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    process.stderr.write("\x1B[?25h");
    process.exit(0);
  }
});

Monitor();
