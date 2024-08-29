async function getModule(scriptUrl) {
  const fm = FileManager.local();
  let scriptPath = module.filename;
  let scriptDir = scriptPath.replace(fm.fileName(scriptPath, true), "");

  const mainScriptPath = fm.joinPath(scriptDir, "main.js");

  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

  const upgradeDirectoryPath = fm.joinPath(scriptDir, ".upgrades");
  const upgradedMainScriptPath = fm.joinPath(
    upgradeDirectoryPath,
    today + ".js"
  );

  const $mainModule = importModule(mainScriptPath);

  try {
    if (!fm.fileExists(upgradeDirectoryPath)) {
      fm.createDirectory(upgradeDirectoryPath);
    }

    if (fm.fileExists(upgradedMainScriptPath)) {
      console.log(`Upgrade ${upgradedMainScriptPath} already downloaded`);
      return $mainModule;
    }

    console.log(`Downloading possible upgrade to ${upgradedMainScriptPath}`);

    let req = new Request(scriptUrl);
    let scriptContent = await req.load();
    fm.write(upgradedMainScriptPath, scriptContent);

    // Try to load the module now
    if (!fm.fileExists(upgradedMainScriptPath)) {
      throw new Error("Unable to download file");
    }

    let $updatedModule = importModule(upgradedMainScriptPath);

    console.log(
      `Current version: ${$mainModule.version}, upgraded version: ${$updatedModule.version}`
    );

    if (($mainModule.version || 0) >= ($updatedModule.version || 0)) {
      console.log(`Upgrade is not needed`);
      return $mainModule;
    }

    // Replace content and upgrade version
    fm.remove(mainScriptPath);
    fm.move(upgradedMainScriptPath, mainScriptPath);
    console.log("Upgrade successful");

    return $updatedModule;
  } catch (err) {
    console.error("Error happened during upgrade");
    console.error(err);
  } finally {
    if (fm.fileExists(upgradedMainScriptPath)) {
      console.log(`Cleaning up ${upgradedMainScriptPath}`);
      fm.remove(upgradedMainScriptPath);
    }
  }

  return $mainModule;
}

module.exports.run = async (args) => {
  // download and import library
  let module = await getModule(
    "https://raw.githubusercontent.com/kopiro/SLWidget/main/main.js"
  );
  await module.run(args);
};
