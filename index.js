const crypto = require("crypto");
const fs = require("fs");
const glob = require("glob");
const minimatch = require("minimatch");
const path = require("path");

if (process.argv.length !== 5) {
  console.error("Usage: node index.js <inputDir> <pattern> <outputDir>");
  return;
}

const [, , inputDir, pattern, outputDir] = process.argv;

const HASH_FILE = "last.hash";

let handle;

function md5(f) {
  const hash = crypto.createHash("md5");
  hash.update(fs.readFileSync(f));
  return hash.digest("hex");
}

function copyFiles() {
  handle = undefined;

  let hashFileContents;
  try {
    hashFileContents = fs.readFileSync(HASH_FILE, "utf8");
  } catch (e) {}
  const lastHashes = new Map(
    hashFileContents
      ? hashFileContents.split(/\r?\n/).map((line) => line.split("\t"))
      : []
  );

  const files = glob.sync(pattern, { cwd: inputDir });

  const newHashes = new Map();

  let anyChanged = false;
  for (const f of files) {
    const hash = md5(`${inputDir}/${f}`);
    newHashes.set(f, hash);
    if (lastHashes.get(f) !== hash) {
      anyChanged = true;
    }
  }

  if (!anyChanged) {
    console.log("No changes");
    return;
  }

  fs.writeFileSync(
    HASH_FILE,
    Array.from(newHashes)
      .map((e) => e.join("\t"))
      .join("\n"),
    "utf8"
  );

  console.log("Copying files");

  const d = new Date();
  const dir = [
    outputDir,
    "/",
    d.getFullYear().toString(),
    "-",
    (d.getMonth() + 1).toString().padStart(2, "0"),
    "-",
    d.getDate().toString().padStart(2, "0"),
    "T",
    d.getHours().toString().padStart(2, "0"),
    "_",
    d.getMinutes().toString().padStart(2, "0"),
    "_",
    d.getSeconds().toString().padStart(2, "0"),
  ].join("");

  for (const f of files) {
    const i = `${inputDir}/${f}`;
    const o = `${dir}/${f}`;

    fs.mkdirSync(path.dirname(o), { recursive: true });
    fs.cpSync(i, o);
  }
}

copyFiles();

fs.watch(inputDir, { recursive: true }, (_, filename) => {
  if (minimatch(filename, pattern)) {
    console.log("Changed:", filename);
    if (handle) {
      clearTimeout(handle);
    }
    handle = setTimeout(copyFiles, 1000);
  }
});
