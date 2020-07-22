// This is a quick flawed tool I made to generate fixtures from the raw
// Influx sample data provided. It might find its way in part into the main
// library at some point, here for posterity for now...

const readline = require("readline");
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

rl.on("line", (line) => {
  const parts = /^(.*?),(.*?) (.*?)( [0-9]+)?$/.exec(line);
  if (!parts) return;

  const [measurement, tags, fields, timestamp] = parts.slice(1);
  const pt = { measurement, tags: {}, fields: {} };
  tags.split(",").forEach((pair) => {
    const [key, value] = pair.split("=");
    pt.tags[key] = value;
  });
  fields.split(",").forEach((pair) => {
    const [key, value] = pair.split("=");
    pt.fields[key.replace("\\ ", " ")] = value.replace("\\ ", " ");
  });
  if (timestamp) {
    pt.timestamp = timestamp.trim();
  }
  console.log(JSON.stringify(pt));
});

rl.on("close", () => process.exit(0));
