# SLWidget

iOS widget that display next departures for SL traffic in Stockholm

## Find your variables

Open [https://transport.integration.sl.se/v1/sites?expand=true
](https://transport.integration.sl.se/v1/sites?expand=true
) to find your departure location and keep note of its `id`; this is your `SITE_ID`.

`TRANSPORT` can be one of these: `BUS`, `TRAM`, `METRO`, `TRAIN`, `FERRY`, `SHIP`, `TAXI`.

`LINE` is your line number.

`DIRECTION` can either be `1` or `2`, most likely `1`.

## Installation

1. Install [Scriptable](https://apps.apple.com/us/app/scriptable/id1405459188) from the App Store and run it a first time

2. Create a new script and copy the content of `SLWidget.js`

3. Create a new script with the following content

```js
// Variables used by Scriptable.
// icon-color: deep-gray; icon-glyph: traffic-light;
const module = importModule("SLWidget.js");
await module.run({
  SITE_ID: "9261",
  TRANSPORT: "METRO",
  LINE: "14",
  DIRECTION: "1",
});
```

4. Run the script to check that everything is working
5. Go to iOS home page and add a Scriptable widget; select your script and make sure you select "Run script" on "When Interacting" 

## Update

Just replace the content of `SLWidget.js` with the new code, keeping all your widgets with your variables intact.