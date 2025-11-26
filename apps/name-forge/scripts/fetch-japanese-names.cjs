const fs = require("fs");

async function fetch_japanese() {
  const base = "https://raw.githubusercontent.com/rgamici/japanese-names/master/";

  // Fetch male names
  console.log("Fetching male names...");
  const maleResp = await fetch(base + "male");
  const maleText = await maleResp.text();

  // Fetch female names
  console.log("Fetching female names...");
  const femaleResp = await fetch(base + "female");
  const femaleText = await femaleResp.text();

  // Extract romaji from format: 漢字 [かな] /(m) Romaji/
  function extractRomaji(text) {
    const names = new Set();
    for (const line of text.split("\n")) {
      const match = line.match(/\((?:m|f)\)\s+([A-Za-zōūēīā]+)/);
      if (match) {
        const name = match[1];
        // Skip very short names
        if (name.length >= 3) {
          names.add(name);
        }
      }
    }
    return Array.from(names);
  }

  const maleNames = extractRomaji(maleText);
  const femaleNames = extractRomaji(femaleText);
  const allNames = [...new Set([...maleNames, ...femaleNames])];

  console.log(`Extracted ${maleNames.length} male names`);
  console.log(`Extracted ${femaleNames.length} female names`);
  console.log(`Total unique: ${allNames.length}`);

  // Save to training file
  const outDir = "./data/markov/training";
  fs.writeFileSync(`${outDir}/japanese.txt`, allNames.join("\n"));
  console.log(`Saved to ${outDir}/japanese.txt`);

  // Show samples
  console.log("\nSample names:");
  console.log("  Male:", maleNames.slice(0, 15).join(", "));
  console.log("  Female:", femaleNames.slice(0, 15).join(", "));
}

fetch_japanese().catch(console.error);
