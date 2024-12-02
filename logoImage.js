module.exports = async function () {
  const terminalImage = await import("terminal-image");
  return await terminalImage.default.file("logo.jpg", {
    width: "35%",
    height: "35%",
  });
};
