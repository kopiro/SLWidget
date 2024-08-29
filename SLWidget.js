module.exports.version = 4;

module.exports.present = async ({ SITE_ID, TRANSPORT, LINE, DIRECTION }) => {
  const SL_PRIMARY_COLOR = "#20252C";
  const SL_PRIMARY_COLOR_DARKER = "#13151A";
  const SL_PRIMARY_COLOR_LIGHTER = "#0A47C2";

  function getIconForTransport(transport) {
    switch (transport) {
      case "BUS":
        return "🚌";
      case "TRAM":
        return "🚋";
      case "METRO":
        return "🚇";
      case "TRAIN":
        return "🚆";
      case "FERRY":
        return "⛴";
      case "SHIP":
        return "🚢";
      case "TAXI":
        return "🚕";
      default:
        return "🚦";
    }
  }

  async function loadData(siteId, transport, line, direction) {
    try {
      let url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures?`;

      if (transport) url += `&transport=${transport}`;
      if (line) url += `&line=${line}`;
      if (direction) url += `&direction=${direction}`;

      const req = new Request(url);
      const json = await req.loadJSON();

      const departures = json.departures.filter((e) => e.state !== "CANCELLED");
      return departures;
    } catch (err) {
      console.error(err);
      return { error: err };
    }
  }

  const widget = new ListWidget();
  widget.useDefaultPadding();

  // Gradient
  let gradient = new LinearGradient();
  gradient.colors = [
    new Color(SL_PRIMARY_COLOR_DARKER),
    new Color(SL_PRIMARY_COLOR),
  ];
  gradient.locations = [0.0, 1.0];
  widget.backgroundGradient = gradient;

  const viewStack = widget.addStack();
  viewStack.layoutVertically();
  viewStack.centerAlignContent();

  const departures = await loadData(SITE_ID, TRANSPORT, LINE, DIRECTION);

  if (departures.error) {
    const error = viewStack.addText("Error fetching data");
    error.font = Font.mediumSystemFont(22);
    error.textColor = new Color("#FF0000");
  } else if (departures.length === 0) {
    const error = viewStack.addText("No departures found");
    error.font = Font.mediumSystemFont(22);
    error.textColor = new Color("#FFFFFF");
  } else {
    const first = departures[0];

    widget.refreshAfterDate = new Date(first.expected);

    const departure = viewStack.addText(
      `${getIconForTransport(TRANSPORT)} ${first.stop_area.name}`
    );
    departure.font = Font.mediumSystemFont(12);
    departure.textColor = new Color("#FFFFFF");

    const destination = viewStack.addText(
      `${first.line.designation} to ${first.destination}`
    );
    destination.font = Font.mediumSystemFont(12);
    destination.textColor = new Color("#FFFFFF");

    viewStack.addSpacer(4);

    let i = 0;
    for (const d of departures) {
      const display = viewStack.addDate(new Date(d.expected));
      display.font = Font.boldSystemFont(38 - i * i * 16);
      display.textColor = new Color("#FFFFFF");
      display.applyTimeStyle();

      const expected = new Date(d.expected) / (1000 * 60);
      const scheduled = new Date(d.scheduled) / (1000 * 60);

      if (expected - scheduled > 2) {
        display.textColor = new Color("#F92772");
      } else if (expected - scheduled > 1) {
        display.textColor = new Color("#E6DC74");
      } else {
        display.textColor = new Color("#FFFFFF");
      }

      if (++i >= 2) break;
    }

    viewStack.addSpacer(8);

    // Add last updated to
    const hStack = widget.addStack();
    hStack.layoutHorizontally();

    const label = hStack.addText("⏳ ");
    label.font = Font.mediumSystemFont(8);
    label.textColor = new Color("#FFFFFF");

    const update = hStack.addDate(new Date());
    update.applyRelativeStyle();
    update.font = Font.mediumSystemFont(8);
    update.textColor = new Color("#FFFFFF");
  }

  // Override what the script does
  widget.url = `scriptable:///run/${encodeURIComponent(
    Script.name()
  )}?refresh=true`;

  if (config.runsInApp) {
    widget.presentSmall();
  }

  Script.setWidget(widget);
  Script.complete();

  // Used only to refresh widget
  if (args.queryParameters.refresh) {
    App.close();
  }
};

async function getModule(scriptUrl) {
  const $mainModule = {
    present: module.exports.present,
    version: module.exports.version,
  };

  const fm = FileManager.local();
  const mainScriptPath = module.filename;
  const scriptName = fm.fileName(mainScriptPath, true);
  const scriptNameNoExt = fm.fileName(mainScriptPath, false);
  const scriptDir = mainScriptPath.replace(scriptName, "");

  const today = new Date().toISOString().split("T")[0].replace(/-/g, "");

  const upgradeDirectoryPath = fm.joinPath(
    scriptDir,
    `.upgrades-${scriptNameNoExt}`
  );
  const upgradeMainScriptFileName = today + ".js";
  const upgradedMainScriptPath = fm.joinPath(
    upgradeDirectoryPath,
    upgradeMainScriptFileName
  );

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
    fm.copy(upgradedMainScriptPath, mainScriptPath);
    console.log("Upgrade successful, will run next time");

    return $mainModule;
  } catch (err) {
    console.error("Error happened during upgrade");
    console.error(err);
  } finally {
    // Cleanup all other upgrades
    if (fm.fileExists(upgradeDirectoryPath)) {
      const upgrades = fm.listContents(upgradeDirectoryPath);
      for (const upgradeFileName of upgrades) {
        if (upgradeFileName !== upgradeMainScriptFileName) {
          console.log(`Removing old upgrade: ${upgradeFileName}`);
          fm.remove(fm.joinPath(upgradeDirectoryPath, upgradeFileName));
        }
      }
    }
  }

  return $mainModule;
}

module.exports.run = async (args) => {
  // download and import library
  let widget = await getModule(
    "https://raw.githubusercontent.com/kopiro/SLWidget/main/SLWidget.js"
  );
  await widget.present(args);
};
