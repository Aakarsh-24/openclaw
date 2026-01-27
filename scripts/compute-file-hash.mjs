#!/usr/bin/env node
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";

// Compute SHA-256 hash of all input files (cross-platform)
const files = process.argv.slice(2);
const hash = createHash("sha256");

for (const file of files) {
  try {
    const content = readFileSync(file);
    hash.update(content);
  } catch (err) {
    // Skip files that don't exist or can't be read
    process.stderr.write(`Warning: Could not read ${file}: ${err.message}\n`);
  }
}

console.log(hash.digest("hex"));
