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

function getSwedishNameForTransport(transport) {
  switch (transport) {
    case "BUS":
      return "bus station";
    case "TRAM":
      return "spårvagn";
    case "METRO":
      return "t-bana";
    case "TRAIN":
      return "pendeltåg";
    case "FERRY":
      return "färja";
    case "SHIP":
      return "båt";
    case "TAXI":
      return "taxi";
    default:
      return "transport";
  }
}

async function loadDirectionsData(
  siteId,
  transport,
  line,
  direction,
  direction_name
) {
  try {
    let url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures?forecast=60`;

    if (transport) url += `&transport=${transport}`;
    if (line) url += `&line=${line}`;
    if (direction) url += `&direction=${direction}`;

    const req = new Request(url);
    const json = await req.loadJSON();

    let departures = json.departures;
    departures = departures.filter((e) => e.state !== "CANCELLED");

    if (direction_name) {
      console.log(`Filtering by direction: ${direction_name} (${url})`);
      departures = departures.filter(
        (e) => e.destination.toLowerCase() === direction_name.toLowerCase()
      );
    }

    return departures;
  } catch (err) {
    console.error(err);
    return { error: err };
  }
}

function usesAMPM() {
  // Get OS hour format (12 or 24)
  const dateFormatter = new DateFormatter();
  dateFormatter.useShortTimeStyle();
  const usesAMPM = /AM|PM/i.test(dateFormatter.string(new Date()));
  return usesAMPM;
}

async function present({
  SITE_ID,
  TRANSPORT,
  LINE,
  DIRECTION,
  DESTINATION_NAME,
  DIRECTION_NAME,
}) {
  const SL_PRIMARY_COLOR = "#20252C";
  const SL_PRIMARY_COLOR_DARKER = "#070809";
  const SL_PRIMARY_COLOR_LIGHTER = "#0A47C2";
  const ARGS_INTERACTED = "interacted";

  const departures = await loadDirectionsData(
    SITE_ID,
    TRANSPORT,
    LINE,
    DIRECTION,
    DIRECTION_NAME
  );

  const widget = new ListWidget();
  widget.useDefaultPadding();

  // Gradient
  let gradient = new LinearGradient();
  gradient.colors = [
    new Color(SL_PRIMARY_COLOR_DARKER),
    new Color(SL_PRIMARY_COLOR),
  ];
  gradient.locations = [0.0, 1.0];
  gradient.startPoint = new Point(0, 0);
  gradient.endPoint = new Point(0, 1);
  widget.backgroundGradient = gradient;

  const $viewStack = widget.addStack();
  $viewStack.layoutVertically();
  $viewStack.centerAlignContent();

  if (departures.error) {
    const error = $viewStack.addText("Error fetching data");
    error.font = Font.boldSystemFont(16);
    error.textColor = new Color("#FF0000");
  } else if (departures.length === 0) {
    const error = $viewStack.addText("No departures found");
    error.font = Font.boldSystemFont(16);
    error.textColor = new Color("#FFFFFF");
  } else {
    const first = departures[0];

    widget.refreshAfterDate = new Date(first.expected);

    const $header = $viewStack.addStack();
    $header.layoutHorizontally();
    $header.bottomAlignContent();

    const $icon = $header.addText(getIconForTransport(TRANSPORT));
    $icon.font = Font.mediumSystemFont(28);
    $icon.textColor = new Color("#FFFFFF");

    $header.addSpacer(2);

    const $headerView = $header.addStack();
    $headerView.layoutVertically();

    const $departure = $headerView.addText(first.stop_area.name);
    $departure.font = Font.mediumSystemFont(12);
    $departure.textColor = new Color("#FFFFFF");
    $departure.textOpacity = 0.8;

    const $destination = $headerView.addText(
      `${first.line.designation} / ${first.destination}`
    );
    $destination.font = Font.mediumSystemFont(12);
    $destination.textColor = new Color("#FFFFFF");
    $destination.textOpacity = 0.8;

    $viewStack.addSpacer(10);

    let i = 0;
    for (const d of departures) {
      const $display = $viewStack.addDate(new Date(d.expected));
      const fontSize = i === 0 ? 38 - (usesAMPM() ? 12 : 0) : i === 1 ? 22 : 18;

      $display.font = Font.blackSystemFont(fontSize);
      $display.textOpacity = i === 0 ? 1 : 0.7;
      $display.lineLimit = 1;
      $display.applyTimeStyle();

      const expected = new Date(d.expected) / (1000 * 60);
      const scheduled = new Date(d.scheduled) / (1000 * 60);

      if (expected - scheduled > 2) {
        $display.textColor = new Color("#F92772");
      } else if (expected - scheduled > 1) {
        $display.textColor = new Color("#E6DC74");
      } else {
        $display.textColor = new Color("#FFFFFF");
      }

      if (i === 0) {
        $viewStack.addSpacer(2);
      }

      if (++i >= 3) break;
    }
  }

  if (args.queryParameters[ARGS_INTERACTED]) {
    const prompt = new Alert();
    prompt.title = `SL Widget v${module.exports.version}`;

    prompt.addAction("Refresh time");
    prompt.addAction(`Upgrade widget to latest`);
    if (departures.length > 0) {
      prompt.addAction("Maps Directions");
      prompt.addAction("Check departures");
    }
    prompt.addCancelAction("Close");

    const actionIndex = await prompt.present();

    if (actionIndex === 0) {
      App.close();
    } else if (actionIndex === 1) {
      await getModule(true);
      App.close();
    } else if (actionIndex === 2) {
      const daddr = DESTINATION_NAME || departures[0].destination;
      const saddr = departures[0].stop_area.name;
      Safari.open(
        `https://maps.google.com/?daddr=${encodeURIComponent(
          daddr
        )}&saddr=${encodeURIComponent(saddr)}&directionsmode=transit`
      );
    } else if (actionIndex === 3) {
      const q = `${departures[0].stop_area.name} ${getSwedishNameForTransport(
        TRANSPORT
      )}`;
      Safari.open(`https://maps.google.com/?q=${encodeURIComponent(q)}`);
    }
  }

  // Override what the script does
  widget.url = `scriptable:///run/${encodeURIComponent(
    Script.name()
  )}?${ARGS_INTERACTED}=1`;

  if (config.runsInApp) {
    widget.presentSmall();
  }

  Script.setWidget(widget);
  Script.complete();
}

async function getModule(forceUpgrade = false) {
  const scriptUrl = module.exports.upgradeUrl;

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
    `_upgrades_${scriptNameNoExt}`
  );
  const upgradeMainScriptFileName = today + ".js";
  const upgradedMainScriptPath = fm.joinPath(
    upgradeDirectoryPath,
    upgradeMainScriptFileName
  );

  if (forceUpgrade && fm.fileExists(upgradedMainScriptPath)) {
    console.log("Removing today's upgrade");
    fm.remove(upgradedMainScriptPath);
  }

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
    alert(`Error during upgrade: ${err}`);
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

module.exports.upgradeUrl =
  "https://raw.githubusercontent.com/kopiro/SLWidget/main/SLWidget.js";

module.exports.version = 11;

module.exports.present = present;

module.exports.run = async (args = {}) => {
  let widget = await getModule();
  await widget.present(args);
};
