module.exports.version = 1;

module.exports.run = async ({ SITE_ID, TRANSPORT, LINE, DIRECTION }) => {
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
      const url = `https://transport.integration.sl.se/v1/sites/${siteId}/departures?transport=${transport}&line=${line}&direction=${direction}&forecast=60`;
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
  widget.backgroundColor = new Color("#44464C");

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
        display.textColor = new Color("#FF0000");
      } else if (expected - scheduled > 1) {
        display.textColor = new Color("#FFFF00");
      } else {
        display.textColor = new Color("#00FF00");
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
