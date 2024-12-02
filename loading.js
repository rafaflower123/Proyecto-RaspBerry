async function showLoading(promise) {
  const ora = (await import("ora")).default;
  const spinner = ora("Loading...").start();
  const result = await promise();

  spinner.succeed("Ready");
  return result;
}

module.exports = showLoading;
