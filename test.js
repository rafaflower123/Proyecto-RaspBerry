const si = require("systeminformation");

async function main() {
	const wifiConnection = await si.wifiConnections();

	console.log(wifiConnection)
}

main();
