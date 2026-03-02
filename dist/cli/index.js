#!/usr/bin/env node

// src/cli/index.ts
import { resolve, basename } from "path";
import { existsSync } from "fs";

// src/cli/pack.ts
import { createWriteStream, readdirSync, statSync, writeFileSync } from "fs";
import { join, relative } from "path";

// src/cli/manifest.ts
function generateManifest(options) {
  const {
    title,
    identifier = `thinkshow-${slugify(title)}-${Date.now()}`,
    description = title,
    entryPoint = "index.html",
    version = "1.0"
  } = options;
  return `<?xml version="1.0" encoding="UTF-8"?>
<manifest identifier="${escapeXml(identifier)}"
          version="${escapeXml(version)}"
          xmlns="http://www.imsproject.org/xsd/imscp_rootv1p1p2"
          xmlns:adlcp="http://www.adlnet.org/xsd/adlcp_rootv1p2"
          xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
          xsi:schemaLocation="http://www.imsproject.org/xsd/imscp_rootv1p1p2 imscp_rootv1p1p2.xsd
                              http://www.imsglobal.org/xsd/imsmd_rootv1p2p1 imsmd_rootv1p2p1.xsd
                              http://www.adlnet.org/xsd/adlcp_rootv1p2 adlcp_rootv1p2.xsd">

  <metadata>
    <schema>ADL SCORM</schema>
    <schemaversion>1.2</schemaversion>
  </metadata>

  <organizations default="org-1">
    <organization identifier="org-1">
      <title>${escapeXml(title)}</title>
      <item identifier="item-1" identifierref="res-1">
        <title>${escapeXml(title)}</title>
        <adlcp:prerequisites type="aicc_script"></adlcp:prerequisites>
      </item>
    </organization>
  </organizations>

  <resources>
    <resource identifier="res-1"
              type="webcontent"
              adlcp:scormtype="sco"
              href="${escapeXml(entryPoint)}">
      <file href="${escapeXml(entryPoint)}" />
    </resource>
  </resources>

</manifest>`;
}
function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}
function escapeXml(text) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
}

// src/cli/pack.ts
function collectFiles(dir, base = dir) {
  const files = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectFiles(fullPath, base));
    } else {
      files.push(relative(base, fullPath));
    }
  }
  return files;
}
async function pack(options) {
  const { title, inputDir, outputFile, entryPoint = "index.html" } = options;
  const archiver = (await import("archiver")).default;
  const manifestXml = generateManifest({ title, entryPoint });
  const manifestPath = join(inputDir, "imsmanifest.xml");
  writeFileSync(manifestPath, manifestXml, "utf-8");
  const output = createWriteStream(outputFile);
  const archive = archiver("zip", { zlib: { level: 9 } });
  return new Promise((resolve2, reject) => {
    output.on("close", () => resolve2(outputFile));
    archive.on("error", reject);
    archive.pipe(output);
    const files = collectFiles(inputDir);
    for (const file of files) {
      const fullPath = join(inputDir, file);
      archive.file(fullPath, { name: file });
    }
    archive.finalize();
  });
}

// src/cli/index.ts
function printHelp() {
  console.log(`
@thinkshow/scorm-sdk \u2014 SCORM packaging CLI

Usage:
  scorm-sdk pack [options]       Create a SCORM 1.2 zip package

Options:
  --title <name>          Exercise title (required)
  --dir <path>            Build directory (default: ./dist)
  --output <path>         Output zip file (default: ./<title>.zip)
  --entry <file>          Entry point HTML file (default: index.html)
  --help                  Show this help message

Examples:
  npx @thinkshow/scorm-sdk pack --title "My Exercise"
  npx @thinkshow/scorm-sdk pack --title "Quiz App" --dir ./build --output quiz.zip
`);
}
function parseArgs(args) {
  const result = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith("--") && i + 1 < args.length && !args[i + 1].startsWith("--")) {
      result[arg.slice(2)] = args[i + 1];
      i++;
    } else if (arg === "pack") {
      result._command = "pack";
    } else if (arg === "--help" || arg === "-h") {
      result._command = "help";
    }
  }
  return result;
}
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args._command === "help" || !args._command) {
    printHelp();
    process.exit(0);
  }
  if (args._command === "pack") {
    const title = args.title;
    if (!title) {
      console.error("Error: --title is required\n");
      printHelp();
      process.exit(1);
    }
    const inputDir = resolve(args.dir || "./dist");
    if (!existsSync(inputDir)) {
      console.error(`Error: Build directory not found: ${inputDir}`);
      console.error("Run your build command first (e.g., npm run build)");
      process.exit(1);
    }
    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const outputFile = resolve(args.output || `./${slug}.zip`);
    const entryPoint = args.entry || "index.html";
    console.log(`Packaging SCORM 1.2 content...`);
    console.log(`  Title:       ${title}`);
    console.log(`  Input:       ${inputDir}`);
    console.log(`  Entry point: ${entryPoint}`);
    console.log(`  Output:      ${outputFile}`);
    console.log("");
    try {
      const result = await pack({ title, inputDir, outputFile, entryPoint });
      console.log(`SCORM package created: ${basename(result)}`);
      console.log("Upload this zip file to any SCORM 1.2 compatible LMS.");
    } catch (err) {
      console.error("Packaging failed:", err);
      process.exit(1);
    }
  }
}
main();
