import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Rewrite absolute asset paths to relative paths in HTML files.
 *
 * Vite (and other bundlers) default to absolute paths like `/assets/app.js`.
 * SCORM players serve content from sandboxed paths, so absolute paths 404.
 * This rewrites them to `./assets/app.js` so they resolve correctly.
 *
 * @returns Number of replacements made across all files.
 */
export function fixAbsolutePaths(inputDir: string, files: string[]): number {
  const htmlFiles = files.filter((f) => f.endsWith('.html'));
  let totalFixes = 0;

  for (const file of htmlFiles) {
    const fullPath = join(inputDir, file);
    const original = readFileSync(fullPath, 'utf-8');

    // Match src="/...", href="/...", and url(/...) patterns.
    // Exclude protocol-relative URLs (//cdn.example.com) and data URIs.
    const fixed = original.replace(
      /((?:src|href|action)\s*=\s*["'])\/(?!\/)(.*?["'])/gi,
      '$1./$2',
    );

    if (fixed !== original) {
      const count = countDifferences(original, fixed);
      totalFixes += count;
      writeFileSync(fullPath, fixed, 'utf-8');
      console.log(`  Fixed ${count} absolute path(s) in ${file}`);
    }
  }

  return totalFixes;
}

function countDifferences(original: string, fixed: string): number {
  const pattern = /((?:src|href|action)\s*=\s*["'])\/(?!\/)/gi;
  const matches = original.match(pattern);
  return matches ? matches.length : 0;
}
