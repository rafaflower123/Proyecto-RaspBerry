

const socket = new WebSocket("ws://192.168.100.10:8081");
let global_processes = [];
let global_criteria = "";

const trafficTrendChart = new Chart(
  document.getElementById("trafficTrendChart").getContext("2d"),
  {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "Paquetes Recibidos",
          borderColor: "rgba(255, 159, 64, 1)",
          backgroundColor: "rgba(255, 159, 64, 0.2)",
          fill: false,
          data: [],
        },
        {
          label: "Paquetes Enviados",
          borderColor: "rgba(245, 87, 66, 1)",
          backgroundColor: "rgba(255, 159, 64, 0.2)",
          fill: false,
          data: [],
        },
      ],
    },
    stacked: true,
    options: {
      maintainAspectRatio: false,
      legend: {
        display: true,
        labels: {
          fontColor: "#fff",
          boxWidth: 60,
        },
      },
      tooltips: {
        displayColors: false,
      },
      scales: {
        xAxes: [
          {
            ticks: {
              beginAtZero: false,
              fontColor: "#ddd",
            },
            gridLines: {
              display: true,
              color: "rgba(221, 221, 221, 0.08)",
            },
          },
        ],
        yAxes: [
          {
            min: 67000,
            ticks: {
              beginAtZero: false,
              fontColor: "#ddd",
            },
            gridLines: {
              display: true,
              color: "rgba(221, 221, 221, 0.08)",
            },
          },
        ],
      },
    },
  }
);

//

var piTemperatureChartElement = document
  .getElementById("piTemperatureChart")
  .getContext("2d");
var piTemperatureChart = new Chart(piTemperatureChartElement, {
  type: "line",
  data: {
    labels: [],
    datasets: [
      {
        label: "Core 1",
        borderColor: "rgba(255, 84, 84, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        fill: false,
        data: [],
      },
      {
        label: "Core 2",
        borderColor: "rgba(9, 255, 144,1)",
        backgroundColor: "rgba(255, 159, 64, 0.2)",
        fill: false,
        data: [],
      },
    ],
  },
  options: {
    maintainAspectRatio: false,
    legend: {
      position: "bottom",
      display: false,
      labels: {
        fontColor: "#ddd",
        boxWidth: 15,
      },
    },
    plugins: {
      title: {
        display: true,
        text: "Chart.js Stacked Line/Bar Chart",
      },
    },
    tooltips: {
      displayColors: false,
    },
  },
});

socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  const { type } = data;
  //console.log(data);
  const timeLabel = new Date().toLocaleTimeString();

  switch (type) {
    case "temperature":
      piTemperatureChart.data.labels.push(timeLabel);
      piTemperatureChart.data.datasets[0].data.push(data.value.core_1);
      document.getElementById("core_1_act").innerHTML =
        data.value.core_1 + "°C";
      piTemperatureChart.data.datasets[1].data.push(data.value.core_2);
      document.getElementById("core_2_act").innerHTML =
        data.value.core_2 + "°C";

      if (piTemperatureChart.data.labels.length > 6) {
        piTemperatureChart.data.labels.shift();
        piTemperatureChart.data.datasets.forEach((dataset) =>
          dataset.data.shift()
        );
      }
      piTemperatureChart.update();
      break;

    case "traffic":
      trafficTrendChart.data.labels.push(timeLabel);
      //trafficTrendChart.data.datasets[0].data.push(data.value.TX_Packets);
      trafficTrendChart.data.datasets[1].data.push(data.value.RX_Packets);
      document.getElementById("packet_tx").innerHTML =
        (data.value.TX_Packets / 1000).toFixed(2) + "K";
      document.getElementById("packet_rx").innerHTML =
        (data.value.RX_Packets / 1000).toFixed(2) + "K";
      document.getElementById("uptime").innerHTML = data.value.uptime;
      if (trafficTrendChart.data.labels.length > 15) {
        trafficTrendChart.data.labels.shift();
        trafficTrendChart.data.datasets.forEach((dataset) =>
          dataset.data.shift()
        );
      }
      trafficTrendChart.update();
      break;
    case "process":
      const processTable = document.getElementById("processTable");
      global_processes = data.value;
      //console.log(global_processes);
      if (!global_criteria) {
        const processes = data.value.slice(0, 50).join("");
        processTable.innerHTML = processes;
      } else {
        sortAndUpdate();
      }

      break;
    default:
      break;
  }
};

function sortAndUpdate(criteria) {
  const processTable = document.getElementById("processTable");
  if (criteria) global_criteria = criteria;
  let processes = global_processes;

  const sortProcesses = (criteria) => {
    switch (criteria) {
      case "cpu":
        processes.sort((a, b) => {
          const cpuA = parseFloat(a.match(/<td>([\d.]+)%<\/td>/)[1]);
          const cpuB = parseFloat(b.match(/<td>([\d.]+)%<\/td>/)[1]);
          return cpuB - cpuA;
        });
        break;
      case "user":
        processes.sort((a, b) => {
          const userA = a.match(/<td>([\w\d\s\-]+)<\/td>/)[1].toLowerCase();
          const userB = b.match(/<td>([\w\d\s\-]+)<\/td>/)[1].toLowerCase();
          return userA.localeCompare(userB);
        });
        break;
      default:
        break;
    }
  };


  sortProcesses(global_criteria);
  const processesHtml = processes.slice(0,50).join("");

  // Actualizar el contenido de la tabla
  processTable.innerHTML = processesHtml;
}
