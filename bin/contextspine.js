#!/usr/bin/env node
import { main } from '../src/cli.js';

try {
    const code = await main(process.argv.slice(2));
    process.exit(code);
} catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
}
