import { resolve, basename } from 'node:path';
import { existsSync } from 'node:fs';
import { pack } from './pack';

function printHelp() {
  console.log(`
@thinkshow/scorm-sdk — SCORM packaging CLI

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

function parseArgs(args: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg.startsWith('--') && i + 1 < args.length && !args[i + 1].startsWith('--')) {
      result[arg.slice(2)] = args[i + 1];
      i++;
    } else if (arg === 'pack') {
      result._command = 'pack';
    } else if (arg === '--help' || arg === '-h') {
      result._command = 'help';
    }
  }
  return result;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args._command === 'help' || !args._command) {
    printHelp();
    process.exit(0);
  }

  if (args._command === 'pack') {
    const title = args.title;
    if (!title) {
      console.error('Error: --title is required\n');
      printHelp();
      process.exit(1);
    }

    const inputDir = resolve(args.dir || './dist');
    if (!existsSync(inputDir)) {
      console.error(`Error: Build directory not found: ${inputDir}`);
      console.error('Run your build command first (e.g., npm run build)');
      process.exit(1);
    }

    const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const outputFile = resolve(args.output || `./${slug}.zip`);
    const entryPoint = args.entry || 'index.html';

    console.log(`Packaging SCORM 1.2 content...`);
    console.log(`  Title:       ${title}`);
    console.log(`  Input:       ${inputDir}`);
    console.log(`  Entry point: ${entryPoint}`);
    console.log(`  Output:      ${outputFile}`);
    console.log('');

    try {
      const result = await pack({ title, inputDir, outputFile, entryPoint });
      console.log(`SCORM package created: ${basename(result)}`);
      console.log('Upload this zip file to any SCORM 1.2 compatible LMS.');
    } catch (err) {
      console.error('Packaging failed:', err);
      process.exit(1);
    }
  }
}

main();
