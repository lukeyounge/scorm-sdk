import { createWriteStream, readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { generateManifest } from './manifest';

interface PackOptions {
  title: string;
  inputDir: string;
  outputFile: string;
  entryPoint?: string;
}

/**
 * Collect all files in a directory recursively.
 */
function collectFiles(dir: string, base: string = dir): string[] {
  const files: string[] = [];
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

/**
 * Create a SCORM 1.2 zip package from a build directory.
 */
export async function pack(options: PackOptions): Promise<string> {
  const { title, inputDir, outputFile, entryPoint = 'index.html' } = options;

  // Dynamically import archiver (node-only dependency)
  const archiver = (await import('archiver')).default;

  // Collect all files from the build directory first
  const files = collectFiles(inputDir);

  // Generate manifest with the complete file list
  const manifestXml = generateManifest({ title, entryPoint, files });

  // Write manifest to input dir temporarily
  const manifestPath = join(inputDir, 'imsmanifest.xml');
  writeFileSync(manifestPath, manifestXml, 'utf-8');

  // Create zip
  const output = createWriteStream(outputFile);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise<string>((resolve, reject) => {
    output.on('close', () => resolve(outputFile));
    archive.on('error', reject);

    archive.pipe(output);

    // Add manifest first (at root of zip)
    archive.file(manifestPath, { name: 'imsmanifest.xml' });

    // Add all build files
    for (const file of files) {
      const fullPath = join(inputDir, file);
      archive.file(fullPath, { name: file });
    }

    archive.finalize();
  });
}
