const axios = require("axios");
const url =
  "https://yllnjtemja4eog4zq6m6x4um4u0agkwl.lambda-url.us-west-2.on.aws";
//const addMessage = require("./main");

function formatTime() {
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes().toString().padStart(2, "0");
  const ampm = hours >= 12 ? "PM" : "AM";
  hours = hours % 12;
  hours = hours ? hours : 12;
  return `${hours}:${minutes} ${ampm}`;
}

module.exports = async function (body) {
  const data = {
    to: "+526421345926",
    body: `${body} at ${formatTime()}`,
  };

return await axios
    .get(url, {
      headers: {
        "Content-Type": "application/json",
      },
      data: data,
      timeout: 70000,
    })
    .then((response) => {
      //console.log("".green + " SMS sent successfully!".white);
      return true;
    })
    .catch((error) => {
      console.log("".red + " Error sending SMS!".white);
    });
};
