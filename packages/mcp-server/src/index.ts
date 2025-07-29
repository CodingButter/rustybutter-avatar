#!/usr/bin/env node
/**
 * @fileoverview Entry point for the RustyButter Avatar MCP Server
 * 
 * This script starts the MCP server that provides avatar control tools
 * to LLMs. It communicates with the HTTP server via REST API.
 * 
 * Usage: rustybutter-avatar-mcp
 * 
 * Environment variables:
 * - AVATAR_SERVER_HOST: HTTP server hostname (default: localhost)
 * - AVATAR_SERVER_PORT: HTTP server port (default: 3000)
 * 
 * @author CodingButter
 * @version 1.0.5
 */

// Environment variables should be set by claude-with-env.sh script

import { startMcpServer } from './mcp-server';

// Start the MCP server
startMcpServer().catch((error) => {
  console.error('[MCP] Failed to start:', error);
  process.exit(1);
});