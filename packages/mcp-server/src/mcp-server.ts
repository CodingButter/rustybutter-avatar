/**
 * @fileoverview Standalone MCP Server for RustyButter Avatar
 *
 * This module implements a standalone MCP server that communicates with
 * the HTTP server via REST API calls. This provides a clean separation
 * of concerns between the MCP protocol handling and the avatar state management.
 *
 * The MCP server acts as a bridge between LLMs and the avatar
 * HTTP server, translating MCP tool calls into HTTP API requests.
 *
 * @author CodingButter
 * @version 1.0.5
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { spawn, ChildProcess } from 'child_process';
import { join } from 'path';

/**
 * Configuration for connecting to the avatar HTTP server.
 * Can be customized via environment variables.
 */
const SERVER_CONFIG = {
  host: process.env.AVATAR_SERVER_HOST || 'localhost',
  port: process.env.AVATAR_SERVER_PORT || '8080',
  get baseUrl() {
    return `http://${this.host}:${this.port}`;
  },
};

/**
 * Global reference to the HTTP server process
 */
let httpServerProcess: ChildProcess | null = null;

/**
 * Start the HTTP server automatically
 */
async function startHttpServer(): Promise<void> {
  if (httpServerProcess) {
    console.error('[MCP] HTTP server already running');
    return;
  }

  const serverPath = join(__dirname, '../../server/dist/index.js');
  console.error(`[MCP] Starting HTTP server at: ${serverPath}`);

  httpServerProcess = spawn('node', [serverPath], {
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  });

  httpServerProcess.stdout?.on('data', (data) => {
    console.error(`[HTTP Server] ${data.toString().trim()}`);
  });

  httpServerProcess.stderr?.on('data', (data) => {
    console.error(`[HTTP Server] ${data.toString().trim()}`);
  });

  httpServerProcess.on('close', (code) => {
    console.error(`[MCP] HTTP server exited with code ${code}`);
    httpServerProcess = null;
  });

  // Wait a moment for the server to start
  await new Promise((resolve) => setTimeout(resolve, 2000));
}

/**
 * Stop the HTTP server
 */
function stopHttpServer(): void {
  if (httpServerProcess) {
    console.error('[MCP] Stopping HTTP server...');
    httpServerProcess.kill('SIGTERM');
    httpServerProcess = null;
  }
}

/**
 * Check if HTTP server is responding
 */
async function waitForHttpServer(maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${SERVER_CONFIG.baseUrl}/api/status`);
      if (response.ok) {
        console.error('[MCP] HTTP server is ready');
        return true;
      }
    } catch {
      // Server not ready yet
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.error('[MCP] HTTP server failed to start within timeout');
  return false;
}

/**
 * Makes an HTTP request to the avatar server.
 *
 * @async
 * @function makeRequest
 * @param {string} endpoint - API endpoint path
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {Object} [body] - Request body for POST requests
 * @returns {Promise<any>} Response data from the server
 * @throws {Error} If the request fails
 */
async function makeRequest(endpoint: string, method: string = 'GET', body?: any): Promise<any> {
  const url = `${SERVER_CONFIG.baseUrl}${endpoint}`;

  try {
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(
        (errorData as any).error || `HTTP ${response.status}: ${response.statusText}`
      );
    }

    return await response.json();
  } catch (error) {
    console.error(`[MCP] Request failed: ${method} ${url}`, error);
    throw error;
  }
}

/**
 * Initialize and start the standalone MCP server.
 *
 * This server provides MCP tools that translate to HTTP API calls:
 * - setAvatarExpression: Changes avatar expression via POST /api/set-expression
 * - listAvatarExpressions: Lists expressions via GET /api/expressions
 * - setBatchExpressions: Sets animation sequence via POST /api/set-batch-expressions
 *
 * @function startMcpServer
 * @returns {void}
 */
export async function startMcpServer() {
  console.error('[MCP] Starting RustyButter Avatar MCP server...');
  console.error(`[MCP] Will connect to avatar server at ${SERVER_CONFIG.baseUrl}`);

  // Start the HTTP server automatically
  await startHttpServer();

  // Wait for the HTTP server to be ready
  const serverReady = await waitForHttpServer();
  if (!serverReady) {
    console.error('[MCP] Failed to start HTTP server, exiting...');
    process.exit(1);
  }

  /**
   * MCP server instance configured for avatar control.
   */
  const mcpServer = new McpServer({
    name: 'RustyButterAvatar',
    version: '1.0.5',
  });

  /**
   * MCP Tool: setAvatarExpression
   * Changes the avatar's expression and visual properties.
   */
  mcpServer.tool(
    'setAvatarExpression',
    {
      name: z.string().describe('Expression name (one of the available avatar expressions)'),
      direction: z
        .enum(['right', 'left'])
        .optional()
        .describe("Direction the avatar is facing ('right' or 'left')"),
      posX: z.number().optional().describe('Horizontal position offset in pixels'),
      posY: z.number().optional().describe('Vertical position offset in pixels'),
      rotation: z
        .number()
        .optional()
        .describe('Rotation angle in degrees (-30 to 30) for leaning effect'),
      scale: z
        .number()
        .optional()
        .describe('Scale factor for avatar size (0.1 to 3.0, where 1.0 is 100%)'),
    },
    async ({ name, direction, posX, posY, rotation, scale }) => {
      try {
        await makeRequest('/api/set-expression', 'POST', {
          name,
          direction,
          posX,
          posY,
          rotation,
          scale,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Avatar expression set to ${name}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to set expression: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  /**
   * MCP Tool: listAvatarExpressions
   * Returns a list of all available avatar expressions.
   */
  mcpServer.tool('listAvatarExpressions', {}, async () => {
    try {
      const expressions = await makeRequest('/api/expressions');
      const expressionNames = expressions.map((exp: any) => exp.name).join(', ');

      return {
        content: [
          {
            type: 'text',
            text: `Available expressions: ${expressionNames}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to list expressions: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  });

  /**
   * MCP Tool: setBatchExpressions
   * Sets up an animated sequence of expressions.
   */
  mcpServer.tool(
    'setBatchExpressions',
    {
      loop: z.boolean().describe('Whether to loop through the expressions sequence'),
      random: z
        .boolean()
        .optional()
        .describe('Whether to randomize the order of expressions after each loop'),
      actions: z
        .array(
          z.object({
            expression: z
              .string()
              .describe('Expression name (one of the available avatar expressions)'),
            duration: z
              .number()
              .min(1)
              .describe('Duration to display this expression in milliseconds'),
            direction: z
              .enum(['right', 'left'])
              .optional()
              .describe("Direction the avatar is facing ('right' or 'left')"),
            posX: z.number().optional().describe('Horizontal position offset in pixels'),
            posY: z.number().optional().describe('Vertical position offset in pixels'),
            rotation: z
              .number()
              .optional()
              .describe('Rotation angle in degrees (-30 to 30) for leaning effect'),
            scale: z
              .number()
              .optional()
              .describe('Scale factor for avatar size (0.1 to 3.0, where 1.0 is 100%)'),
          })
        )
        .min(1)
        .describe('Array of expression actions with durations'),
    },
    async ({ loop, random, actions }) => {
      try {
        const response = await makeRequest('/api/set-batch-expressions', 'POST', {
          loop,
          random,
          actions,
        });

        return {
          content: [
            {
              type: 'text',
              text: `Batch expressions set with ${response.actionCount} actions, loop=${loop}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Failed to set batch expressions: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
        };
      }
    }
  );

  /**
   * MCP Tool: getAvatarStatus
   * Gets the current status of the avatar server.
   */
  mcpServer.tool('getAvatarStatus', {}, async () => {
    try {
      const status = await makeRequest('/api/status');

      return {
        content: [
          {
            type: 'text',
            text: `Avatar server status: ${status.status}\nCurrent expression: ${status.currentExpression}\nBatch active: ${status.batchActive}\n\nWeb interface: ${SERVER_CONFIG.baseUrl}\nFor OBS Browser Source, use: ${SERVER_CONFIG.baseUrl}`,
          },
        ],
      };
    } catch (error) {
      return {
        content: [
          {
            type: 'text',
            text: `Failed to get avatar status: ${error instanceof Error ? error.message : 'Unknown error'}`,
          },
        ],
      };
    }
  });

  /**
   * MCP Tool: getAvatarWebInterface
   * Returns the URL for the web interface and OBS setup instructions.
   */
  mcpServer.tool('getAvatarWebInterface', {}, async () => {
    return {
      content: [
        {
          type: 'text',
          text:
            `RustyButter Avatar Web Interface\n\n` +
            `🌐 Web Interface URL: ${SERVER_CONFIG.baseUrl}\n` +
            `📺 OBS Browser Source URL: ${SERVER_CONFIG.baseUrl}\n\n` +
            `Setup for OBS:\n` +
            `1. Add a Browser Source in OBS\n` +
            `2. Set URL to: ${SERVER_CONFIG.baseUrl}\n` +
            `3. Set Width: 800, Height: 600 (or as needed)\n` +
            `4. Check "Refresh browser when scene becomes active"\n\n` +
            `The avatar will automatically update when you use the MCP tools to change expressions!`,
        },
      ],
    };
  });

  /**
   * Connect the MCP server using stdio transport.
   */
  console.error('[MCP] Connecting MCP server with StdioServerTransport...');
  const transport = new StdioServerTransport();

  mcpServer
    .connect(transport)
    .then(() => {
      console.error(`[MCP] Server connected and ready for AI tool calls`);
      console.error(
        `[MCP] Available tools: setAvatarExpression, listAvatarExpressions, setBatchExpressions, getAvatarStatus, getAvatarWebInterface`
      );
    })
    .catch((err) => {
      console.error(`[MCP] Failed to connect MCP server: ${err}`);
      console.error(`[MCP] Error details: ${JSON.stringify(err)}`);
      process.exit(1);
    });

  console.error('[MCP] Server initialized successfully');

  // Keep the process alive for MCP communication
  process.stdin.resume();

  // Handle process termination gracefully
  process.on('SIGINT', () => {
    console.error('[MCP] Received SIGINT, shutting down gracefully...');
    stopHttpServer();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.error('[MCP] Received SIGTERM, shutting down gracefully...');
    stopHttpServer();
    process.exit(0);
  });
}
