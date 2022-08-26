import { readFile, writeFile, readdir } from "fs/promises";
import recursive from "recursive-readdir";
import { createHash } from "crypto";
import path from "path";

const dir = "public/";
const assetDir = "public/build/";

async function run() {
  let assetMap = {};
  let assets = [];

  let files = await recursive(dir);

  for (let file of files) {
    let contents = await readFile(file);

    let key = file.substring(dir.length); // strip off the prefix
    let targetKey = key;

    if (!file.startsWith(assetDir)) {
      // If it's not in the asset dir, we need to hash it ourself so
      // it's safe to cache at the edge.
      let hash = createHash("sha1").update(contents).digest("base64");
      let ext = path.extname(key);
      targetKey = `${targetKey.substring(
        0,
        targetKey.length - ext.length
      )}-${hash}${ext}`;
    }

    assets.push({
      key: targetKey,
      value: contents.toString("base64"),
      base64: true,
    });

    assetMap[key] = targetKey;
  }

  await writeFile("./assets.json", JSON.stringify(assets));
  await writeFile("./asset-mapping.json", JSON.stringify(assetMap));
}

run().catch((e) => console.error(e));
