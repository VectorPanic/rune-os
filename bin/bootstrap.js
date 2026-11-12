const path = require("path");
const launch = require("../scripts/electron/launch.cjs");

launch(path.join(__dirname, "index.html"));