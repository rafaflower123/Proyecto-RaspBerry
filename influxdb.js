require("colors");
require("dotenv").config();
const { InfluxDB, Point } = require("@influxdata/influxdb-client");

const token = process.env.INFLUXDB_TOKEN;
const url = process.env.INFLUXDB_URL;
const org = process.env.INFLUXDB_ORG;

const influxClient = new InfluxDB({ url, token });
const writeApi = influxClient.getWriteApi(org, "Raspberry_Temperature");
const writeApiAlerts = influxClient.getWriteApi(org, "Snort_Alerts");

async function SaveTemperature(systemInfo) {
  const { measurement, board, cpu, cpuLoad, celcius, farhenheit } = systemInfo;

  const point = new Point(measurement)
    .tag("board", board)
    .tag("cpu", cpu)
    .floatField("cpuLoad", cpuLoad)
    .floatField("celcius", celcius)
    .floatField("farhenheit", farhenheit);
  await writeApi.writePoint(point);
}

async function SaveLogs(logs) {
  for (let i = 0; i < logs.length; i++) {
    const { timestamp, sig_id, msg, src, srcport, dst, dstport } = logs[i];
    const point = new Point("alerts")
      .tag("sig_id", sig_id)
      .tag("src", src)
      .tag("dst", dst)
      .stringField("msg", msg)
      .stringField("srcport", srcport)
      .stringField("dstport", dstport)
      .stringField("alert_timestamp", timestamp);
    await writeApiAlerts.flush();
    await writeApiAlerts.writePoint(point);

    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

async function closeConnection() {
  console.log("󰅗 ".red + "Closing InfluxDB connection...".white);
  await writeApi.flush();
  await writeApiAlerts.flush();
  writeApi.close();
}
module.exports = { SaveTemperature, SaveLogs, closeConnection };

/*
const { timestamp, sig_id, msg, src, srcport, dst, dstport } = l;
const point = new Point("alerts")
  .tag("sig_id", sig_id)
  .tag("src", src)
  .tag("dst", dst)
  .stringField("msg", msg)
  .stringField("srcport", srcport)
  .stringField("dstport", dstport)
  .stringField("alert_timestamp", timestamp);
await writeApiAlerts.writePoint(point);*/
