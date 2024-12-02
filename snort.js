#!/usr/bin/node

require("colors");
const fs = require("fs");
const csvtojsonV2 = require("csvtojson/v2");
const inquirer = require("inquirer");
const twilioClient = require("./twilioClient");
const getLogoImage = require("./logoImage.js");
const influxClient = require("./influxdb.js");
const { execSync, spawn } = require("child_process");
const logsPath = "/var/log/snort/alert.csv";
const header =
  "timestamp,sig_generator,sig_id,sig_rev,msg,proto,src,srcport,dst,dstport,ethsrc,ethdst,ethlen,tcpflags,tcpseq,tcpack,tcplen,tcpwindow,ttl,tos,id,dgmlen,iplen,icmptype,icmpcode,icmpid,icmpseq";

//timestamp,sig_generator, sig_id, sig_rev, msg, proto, src, srcport, dst, dstport, ethsrc, ethdst, ethlen, tcpflags,tcpseq, tcpack, tcplen, tcpwindow, ttl, tos, id, dgmlen, iplen, icmptype, icmpcode, icmpid, icmpseq

const uid = execSync("id -u").toString().trim();
if (uid !== "0") {
  console.log("[X]".red + " Por favor ejecute este script como root".white);
  process.exit(1);
}

const snort = spawn("snort", [
  "-q",
  "-c",
  "/etc/snort/snort.conf",
  "-i",
  "wlan0",
]);

function snortHandler() {
  snort.on("error", (err) => {
    console.error(`Error al ejecutar Snort: ${err.message}`);
  });
  snort.on("close", (code) => {
    console.log(`Snort finalizó con el código: ${code}`);
  });
}

const question = [
  {
    type: "list",
    message: "Seleccione una opcion".white,
    name: "opt",
    choices: [
      { value: 1, name: `${"1.".grey} ${"📜 Mostrar logs".white}` },
      { value: 2, name: `${"2.".grey} ${"🧹 Limpiar logs".white}` },
      {
        value: 3,
        name: `${"3.".grey} ${"💾" + " Subir Logs a base de datos".white}`,
      },
      { value: 0, name: `${"0.".grey} ${"❌ Salir".white}` },
    ],
  },
];

async function pause() {
  const pausePrompt = inquirer.createPromptModule();
  await pausePrompt({
    type: "input",
    name: "pause",
    message: `\n${"Presione".white} ${"Enter".green} ${"para continuar".white}`,
  });
  console.clear();
}
async function showBanner() {
  //const logoImage = await getLogoImage();
  //console.log(logoImage);
  console.clear();
  console.log("=====================================".grey);
  console.log("              Snort Alert".red.bold);
  console.log("=====================================\n".grey);
}

function formatTimestamp(timestamp) {
  const [datePart, timePart] = timestamp.split("-");

  const [month, day] = datePart.split("/");

  const [time, milliseconds] = timePart.split(".");
  const [hours, minutes, seconds] = time.split(":");

  return `${day}-${month}-${new Date().getFullYear()} ${hours}:${minutes}`;
}
async function getLogs() {
  const logs = await csvtojsonV2().fromFile(logsPath);
  let logsArray = [];

  logs.forEach((log, index) => {
    const logObj = {
      index,
      timestamp: formatTimestamp(log.timestamp),
      sig_id: log.sig_id,
      msg: log.msg,
      src: log.src,
      srcport: log.srcport,
      dst: log.dst,
      dstport: log.dstport,
    };
    logsArray.push(logObj);
  });
  return logsArray;
}

async function alertAction(alert) {
  const doActionPrompt = inquirer.createPromptModule();
  const selectedAlertMenu = {
    type: "list",
    message: `Alerta seleccionada: ${alert.index.toString().cyan.bold}\n${
      "Mensaje:".green
    } ${alert.msg}\n${"Origen:".blue} ${alert.src}:${alert.srcport} ${
      "=>".red.bold
    } ${"Destino:".magenta} ${alert.dst}:${
      alert.dstport
    }\n\nSeleccione una opcion`.white,
    name: "option",
    choices: [
      { value: 1, name: `${"1.".bold} 🚨 Notificar alerta`.white },
      { value: 0, name: `${"0.".bold} 🔙 Regresar`.white },
    ],
  };
  let option;
  do {
    const opt = await doActionPrompt(selectedAlertMenu);
    option = opt.option;
    switch (option) {
      case 1:
        const messagePrompt = inquirer.createPromptModule();
        const body = await messagePrompt({
          type: "input",
          name: "body",
          message: "Mensaje a enviar".white,
        });
        const message = `Alerta: ${alert.msg} - Origen: ${alert.src}:${alert.srcport} => Destino: ${alert.dst}:${alert.dstport}\n ${body}`;
        console.log("Enviando alerta...".green);
        await twilioClient(message);
        console.log("Alerta enviada ✅".green);
        break;
    }
  } while (option !== 0);
}

let opt = 0;

async function main() {
  const prompt = inquirer.createPromptModule();
  do {
    showBanner();
    response = await prompt(question);
    opt = response.opt;
    const logs = await getLogs();

    switch (opt) {
      case 1:
        if (logs.length > 0) {
          const alertPrompt = inquirer.createPromptModule();
          const alertQuestion = [
            {
              type: "list",
              message: "Seleccione una alerta".white,
              name: "alert",
              choices: logs.map((log) => ({
                value: log,
                name: `${"🔔".yellow} ${log.index.toString().cyan.bold} | ${
                  log.timestamp.gray
                } - ${log.msg.green.bold} | ${"Origen:".blue} ${log.src}${
                  ":" + log.srcport.toString().yellow
                } ${"=>".red.bold} ${"Destino:".magenta} ${log.dst}${
                  ":" + log.dstport.toString().yellow
                }`,
              })),
            },
          ];
          let { alert } = await alertPrompt(alertQuestion);
          await alertAction(alert);
        } else {
          console.log("📭 No hay logs para mostrar".white);
          await pause();
        }

        break;
      case 2:
        fs.unlinkSync(logsPath);
        fs.writeFileSync(logsPath, header + "\n");
        console.log("Logs limpiados".green);
        await pause();
        break;
      case 3:
        console.log("☁️  Subiendo Logs...".white.bold);
        const estimated = (logs.length * 100) / 1000;
        console.log(
          "⏲️  Tiempo estimado.".white +
            estimated.toString().white +
            " Segundos\n".bold.white
        );
        await influxClient.SaveLogs(logs);
        console.log("Logs subidos a influxDB ✅".green);
        await pause();
        break;
      case 0:
        console.log("Good bye!".white);
    }
  } while (opt !== 0);
}

main();
