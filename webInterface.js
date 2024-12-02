require("colors");
const express = require("express");
const app = express();
const { parentPort, isMainThread } = require("worker_threads");

app.use(express.static("static"));
if (isMainThread) {
  console.log(
    "\n[X]".yellow + " This script should be run as a worker thread!".white
  );
  process.exit(1);
} else {
  app.listen(3000, () => {});
}
