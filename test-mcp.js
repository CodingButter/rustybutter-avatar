#!/usr/bin/env node

// Simple test script to simulate calling the MCP tools for avatar expressions
const fs = require('fs');
const readline = require('readline');

// Load expressions from the JSON file
const expressionsPath = './public/expressions.json';
const expressions = JSON.parse(fs.readFileSync(expressionsPath, 'utf8'));

// Build expression map
const expressionMap = {};
expressions.forEach(exp => {
  expressionMap[exp.name] = exp;
});

// Create interface for reading from stdin
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

// Display available expressions
function listExpressions() {
  const expressionNames = Object.keys(expressionMap);
  console.log('\nAvailable expressions:');
  expressionNames.forEach(expression => console.log(`- ${expression}`));
  console.log();
}

// Display available commands
function showHelp() {
  console.log('\nCommands:');
  console.log('  set <expression> [direction] [posX] [posY] [rotation] [scale]  - Set avatar expression');
  console.log('  list                                                           - List available expressions');
  console.log('  help                                                           - Show this help');
  console.log('  exit                                                           - Exit the test script');
  console.log();
  console.log('Examples:');
  console.log('  set joyful');
  console.log('  set perplexed left 10 -5 15 0.75');
  console.log('  set sipping_coffee right 0 0 -10 0.5');
  console.log();
}

// Process user input
async function processCommand(input) {
  const parts = input.trim().split(/\s+/);
  const command = parts[0].toLowerCase();

  switch (command) {
    case 'set':
      if (parts.length < 2) {
        console.log('Error: Expression name required');
        return;
      }

      const expressionName = parts[1];
      const direction = parts[2];
      const posX = parts[3] !== undefined ? parseInt(parts[3], 10) : undefined;
      const posY = parts[4] !== undefined ? parseInt(parts[4], 10) : undefined;
      const rotation = parts[5] !== undefined ? parseInt(parts[5], 10) : undefined;
      const scale = parts[6] !== undefined ? parseFloat(parts[6]) : undefined;

      try {
        // Instead of calling the MCP tool directly, we'll send a request to the API
        // This simulates what would happen when an LLM calls the MCP tool
        const url = new URL('http://localhost:3000/api/set-expression');

        // Add query parameters
        if (expressionName) url.searchParams.append('name', expressionName);
        if (direction) url.searchParams.append('direction', direction);
        if (posX !== undefined) url.searchParams.append('pos_x', posX.toString());
        if (posY !== undefined) url.searchParams.append('pos_y', posY.toString());
        if (rotation !== undefined) url.searchParams.append('rotation', rotation.toString());
        if (scale !== undefined) url.searchParams.append('scale', scale.toString());

        // Make the actual HTTP request
        const http = require('http');
        const request = http.get(url, (response) => {
          let data = '';

          response.on('data', (chunk) => {
            data += chunk;
          });

          response.on('end', () => {
            try {
              const result = JSON.parse(data);
              console.log('\nAPI Response:');
              console.log(JSON.stringify(result, null, 2));
              console.log();
              rl.prompt();
            } catch (e) {
              console.error(`\nError parsing response: ${e.message}\n`);
              rl.prompt();
            }
          });
        });

        request.on('error', (err) => {
          console.error(`\nError: ${err.message}`);
          console.log('Make sure the avatar server is running on http://localhost:3000\n');
          rl.prompt();
        });

        // Don't prompt again here, as we'll prompt after the request completes
        return;
      } catch (error) {
        console.error(`\nError: ${error.message}\n`);
      }
      break;

    case 'list':
      listExpressions();
      break;

    case 'help':
      showHelp();
      break;

    case 'exit':
      console.log('Exiting test script.');
      rl.close();
      process.exit(0);
      break;

    default:
      console.log('Unknown command. Type "help" for available commands.');
  }
}

// Start the test script
console.log('======================================================');
console.log('RustyButter Avatar - MCP Test Script');
console.log('======================================================');
console.log('This script allows you to test the MCP tools for controlling');
console.log('the avatar expressions. The avatar server should be running');
console.log('separately for you to see the visual changes.');
console.log();
console.log('NOTE: Make sure to build the project and start the server:');
console.log('  npm run build');
console.log('  npm start');
console.log();

showHelp();
listExpressions();

// Main prompt loop
rl.setPrompt('mcp-test> ');
rl.prompt();

rl.on('line', async (line) => {
  await processCommand(line);
  rl.prompt();
}).on('close', () => {
  console.log('Exiting test script.');
  process.exit(0);
});