#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const { program } = require('commander');
const chalk = require('chalk');
const inquirer = require('inquirer');
const boxen = require('boxen');

// Get package version
const packageJson = require('../package.json');

// Configure CLI options
program
  .name('rustybutter-avatar')
  .description(packageJson.description)
  .version(packageJson.version)
  .option('-p, --port <number>', 'Port to run the server on', '3000')
  .option('-d, --detached', 'Run the server in detached mode', false)
  .option('-l, --log <file>', 'Log file path', 'rustybutter.log')
  .option('-s, --stop', 'Stop the running server', false)
  .option('-m, --mcp', 'Run in MCP server mode (for LLM integration)', false);

program.parse(process.argv);

const opts = program.opts();

// Find the server file and pidFile
const mainFile = path.resolve(__dirname, '../dist/index.js');
const pidFile = path.resolve(process.cwd(), '.pid');

// Check if running as MCP server
const isMcpMode = opts.mcp || process.env.MCP_MODE === 'true' || process.env.MCP === 'true';

// If in MCP mode, directly run the server without UI
if (isMcpMode) {
  console.error('[MCP] Starting in MCP server mode');
  // Make sure to pass MCP flag to the server
  process.argv.push('--mcp');
  // Execute the main server file directly
  require(mainFile);
  // Exit the CLI script
  return;
}

// For normal mode, display welcome message
console.log(boxen(
  chalk.bold.cyan('RustyButter Avatar') + '\n' +
  chalk.dim('OBS Avatar Expression Controller with MCP Integration for LLMs') + '\n\n' +
  chalk.white('Version: ') + chalk.yellow(packageJson.version),
  {
    padding: 1,
    margin: 1,
    borderStyle: 'round',
    borderColor: 'cyan'
  }
));

// Function to stop the server
function stopServer() {
  if (fs.existsSync(pidFile)) {
    try {
      const pid = fs.readFileSync(pidFile, 'utf8').trim();
      process.kill(pid, 'SIGTERM');
      fs.unlinkSync(pidFile);
      console.log(chalk.green('✓ Server stopped successfully.'));
    } catch (error) {
      console.error(chalk.red('✗ Error stopping server:'), error.message);
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    }
  } else {
    console.log(chalk.yellow('⚠ No running server found.'));
  }
}

// Function to start the server
function startServer() {
  // If server is already running, ask if should stop and restart
  if (fs.existsSync(pidFile)) {
    inquirer.prompt([
      {
        type: 'confirm',
        name: 'restart',
        message: 'Server is already running. Would you like to restart it?',
        default: true
      }
    ]).then(answers => {
      if (answers.restart) {
        stopServer();
        setTimeout(actuallyStartServer, 1000); // Give it a second to stop
      } else {
        console.log(chalk.yellow('⚠ Keeping existing server running.'));
      }
    });
  } else {
    actuallyStartServer();
  }
}

// Function to actually start the server
function actuallyStartServer() {
  console.log(chalk.blue('Starting RustyButter Avatar server...'));
  
  // Check if the main file exists
  if (!fs.existsSync(mainFile)) {
    console.error(chalk.red('✗ Server file not found. You may need to build the project first.'));
    console.log(chalk.blue('Try running: ') + chalk.yellow('npm run build'));
    return;
  }
  
  // Start server
  let serverProcess;
  
  if (opts.detached) {
    // Run in detached mode
    const logStream = fs.openSync(opts.log, 'a');
    // Prepare arguments - include MCP flag if needed
    const args = [mainFile, '--port', opts.port];
    if (opts.mcp) {
      args.push('--mcp');
    }
    serverProcess = spawn('node', args, {
      detached: true,
      stdio: ['ignore', logStream, logStream]
    });
    
    // Detach the child process
    serverProcess.unref();
    
    // Save PID for later
    fs.writeFileSync(pidFile, serverProcess.pid.toString());
    
    console.log(chalk.green(`✓ Server started in detached mode on port ${opts.port}`));
    console.log(chalk.blue(`  - PID: ${serverProcess.pid}`));
    console.log(chalk.blue(`  - Logs: ${path.resolve(opts.log)}`));
    console.log(chalk.blue(`  - To stop the server: `) + chalk.yellow('npx rustybutter-avatar --stop'));
  } else {
    // Run in foreground mode
    // Prepare arguments - include MCP flag if needed
    const args = [mainFile, '--port', opts.port];
    if (opts.mcp) {
      args.push('--mcp');
    }
    serverProcess = spawn('node', args, {
      stdio: 'inherit'
    });
    
    // Save PID for potential stop command
    fs.writeFileSync(pidFile, serverProcess.pid.toString());
    
    // Handle server process events
    serverProcess.on('close', (code) => {
      console.log(chalk.yellow(`Server process exited with code ${code}`));
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
    });
    
    console.log(chalk.green(`✓ Server started on port ${opts.port}`));
    console.log(chalk.blue('  Press Ctrl+C to stop'));
    
    // Handle SIGINT for cleanup
    process.on('SIGINT', () => {
      if (fs.existsSync(pidFile)) {
        fs.unlinkSync(pidFile);
      }
      process.exit(0);
    });
  }
}

// Main logic
if (opts.stop) {
  stopServer();
} else {
  startServer();
}