const fs = require("fs");

async function download_names() {
  const response = await fetch("https://raw.githubusercontent.com/sigpwned/popular-names-by-country-dataset/main/common-forenames-by-country.csv");
  const text = await response.text();

  const lines = text.split("\n").slice(1); // Skip header

  // Group by country
  const byCountry = {};
  for (const line of lines) {
    if (!line.trim()) continue;
    const parts = line.split(",");
    const country = parts[0];
    const name = parts[11] || parts[10]; // Romanized or Localized
    if (name && name.trim()) {
      if (!byCountry[country]) byCountry[country] = new Set();
      byCountry[country].add(name.trim());
    }
  }

  console.log("Countries found:", Object.keys(byCountry).sort().join(", "));
  console.log("\nSample counts:");

  // Target countries - Asian and African
  const targets = {
    // Asian
    "JP": "japanese",
    "CN": "chinese",
    "KR": "korean",
    "VN": "vietnamese",
    "TH": "thai",
    "IN": "indian",
    "ID": "indonesian",
    "PH": "filipino",
    // African
    "NG": "nigerian",
    "KE": "kenyan",
    "TZ": "tanzanian",
    "ET": "ethiopian",
    "EG": "egyptian",
    "ZA": "southafrican",
    "GH": "ghanaian",
    "SN": "senegalese"
  };

  for (const [code, name] of Object.entries(targets)) {
    if (byCountry[code]) {
      console.log(`  ${code} (${name}): ${byCountry[code].size} names`);
    } else {
      console.log(`  ${code} (${name}): NOT FOUND`);
    }
  }

  // Save training files for found countries
  const outDir = "./data/markov/training";

  for (const [code, name] of Object.entries(targets)) {
    if (byCountry[code] && byCountry[code].size >= 10) {
      const names = Array.from(byCountry[code]);
      const outFile = `${outDir}/${name}.txt`;
      fs.writeFileSync(outFile, names.join("\n"));
      console.log(`Saved ${names.length} ${name} names to ${outFile}`);
    }
  }
}

download_names();
