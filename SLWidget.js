const fs = FileManager.local();
let uuid = null;

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

  const today = new Date();

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

  const $viewStack = widget.addStack();
  $viewStack.layoutVertically();
  $viewStack.centerAlignContent();

  let icon = getIconForTransport(TRANSPORT);

  // Little easter egg for J for 25/09
  if (
    (uuid === "8297B830-9270-49BF-9611-74432FD38127" ||
      uuid === "6390F31E-66CA-4980-934D-493E53B39078") &&
    today.getMonth() === 8 &&
    today.getDate() === 25
  ) {
    icon = "🎂";
    gradient.colors = [new Color("#FF68B4"), new Color("#F7CADD")];
  }

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

    const $icon = $header.addText(icon);
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

  widget.backgroundGradient = gradient;

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
      await getModule(args, true);
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

async function getModule(args, forceUpgrade = false) {
  const mainScriptPath = module.filename;
  const scriptName = fs.fileName(mainScriptPath, true);
  const scriptNameNoExt = fs.fileName(mainScriptPath, false);
  const scriptDir = mainScriptPath.replace(scriptName, "");

  const upgradeDirectoryPath = fs.joinPath(
    scriptDir,
    `_upgrades_${scriptNameNoExt}`
  );

  try {
    // Contact the version control server to check for upgrades
    const latestModuleInfo = await new Request(
      module.exports.checkVersionUrl +
        `?version=${
          module.exports.version
        }&uuid=${uuid}&args=${encodeURIComponent(JSON.stringify(args))}`
    ).loadJSON();

    if (typeof latestModuleInfo !== "object") {
      throw new Error("Invalid response");
    }

    if (!latestModuleInfo.version) {
      throw new Error("Invalid response");
    }

    if (forceUpgrade) {
      console.log("Forcing upgrade...");
    }

    if (module.exports.version >= latestModuleInfo.version && !forceUpgrade) {
      throw new Error(
        `No upgrade needed, current version: ${module.exports.version}, latest version: ${latestModuleInfo.version}`
      );
    }

    if (!fs.fileExists(upgradeDirectoryPath)) {
      fs.createDirectory(upgradeDirectoryPath);
    }

    const upgradeMainScriptFileName = String(Date.now()) + ".js";
    const upgradedMainScriptPath = fs.joinPath(
      upgradeDirectoryPath,
      upgradeMainScriptFileName
    );

    console.log(
      `Downloading upgrade from "${module.exports.newVersionScriptUrl}" to "${upgradedMainScriptPath}"`
    );

    let req = new Request(module.exports.newVersionScriptUrl);
    let scriptContent = await req.load();
    fs.write(upgradedMainScriptPath, scriptContent);

    // Try to load the module now
    if (!fs.fileExists(upgradedMainScriptPath)) {
      throw new Error("Unable to download file");
    }

    let $updatedModule = importModule(upgradedMainScriptPath);
    console.log(
      `Current version: ${module.exports.version}, upgraded version: ${$updatedModule.version}`
    );

    if (!$updatedModule || !$updatedModule.version) {
      throw new Error("Invalid new module");
    }

    // Replace content and upgrade version
    fs.remove(mainScriptPath);
    fs.copy(upgradedMainScriptPath, mainScriptPath);
    console.log(`Upgrade to v${$updatedModule.version} was successful`);

    return $updatedModule;
  } catch (err) {
    console.log(err);
    return module.exports;
  } finally {
    // Cleanup all other upgrades
    try {
      if (fs.fileExists(upgradeDirectoryPath)) {
        for (const f of fs.listContents(upgradeDirectoryPath)) {
          console.log(`Removing old upgrade: ${f}`);
          fs.remove(fs.joinPath(upgradeDirectoryPath, f));
        }
      }
    } catch (err) {
      console.warn(err);
    }
  }
}

module.exports.version = 18;
module.exports.checkVersionUrl = `https://versions.kopiro.me/sl-widget`;
module.exports.newVersionScriptUrl = `https://raw.githubusercontent.com/kopiro/SLWidget/main/SLWidget.js`;
module.exports.present = present;
module.exports.run = async (args = {}) => {
  try {
    if (Keychain.contains("UUID")) {
      uuid = Keychain.get("UUID");
    } else {
      uuid = UUID.string();
      Keychain.set("UUID", uuid);
    }
  } catch (err) {
    console.log(`Error during UUID generation: ${err}`);
  }

  let widget = await getModule(args, false);
  await widget.present(args);
};
