#!/usr/bin/env node

// Simple dedicated MCP server for testing
const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const { z } = require('zod');
const fs = require('fs');
const path = require('path');

console.error('[MCP Test] Starting dedicated MCP server...');

// Load expressions from JSON file
let expressions = [];
try {
  const expressionsPath = path.join(__dirname, 'public/expressions.json');
  console.error(`[MCP Test] Loading expressions from: ${expressionsPath}`);
  const expressionsData = fs.readFileSync(expressionsPath, 'utf8');
  expressions = JSON.parse(expressionsData);
  console.error(`[MCP Test] Loaded ${expressions.length} expressions`);
} catch (error) {
  console.error('[MCP Test] Error loading expressions:', error);
  expressions = [
    {
      name: "joyful",
      imageUrl: "/images/joyful.png",
      description: "Happy and celebratory expression",
      useCases: "When tests pass, code works correctly, or celebrating achievements"
    }
  ];
  console.error('[MCP Test] Using default expression fallback');
}

// Create a map for quick lookups
const expressionMap = expressions.reduce((map, exp) => {
  map[exp.name] = exp;
  return map;
}, {});

// Store the current expression and avatar state
let currentExpression = 'joyful';
let avatarState = {
  direction: 'right',
  posX: 0,
  posY: 0,
  rotation: 0,
  scale: 1.0
};

// Initialize MCP server
const mcpServer = new McpServer({
  name: "RustyButterAvatar",
  version: "1.0.3",
});

// Define the setAvatarExpression tool
mcpServer.tool(
  "setAvatarExpression",
  {
    name: z.string().describe("Expression name (one of the available avatar expressions)"),
    direction: z.enum(["right", "left"]).optional().describe("Direction the avatar is facing ('right' or 'left')"),
    posX: z.number().optional().describe("Horizontal position offset in pixels"),
    posY: z.number().optional().describe("Vertical position offset in pixels"),
    rotation: z.number().optional().describe("Rotation angle in degrees (-30 to 30) for leaning effect"),
    scale: z.number().optional().describe("Scale factor for avatar size (0.1 to 3.0, where 1.0 is 100%)")
  },
  async ({ name, direction, posX, posY, rotation, scale }) => {
    console.error(`[MCP Test] setAvatarExpression called with: name=${name}, direction=${direction}, posX=${posX}, posY=${posY}, rotation=${rotation}, scale=${scale}`);
    
    if (!expressionMap[name]) {
      console.error(`[MCP Test] Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}`);
      return { 
        content: [{ 
          type: "text", 
          text: `Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}` 
        }]
      };
    }

    // Update expression
    console.error(`[MCP Test] Changing expression from ${currentExpression} to ${name}`);
    currentExpression = name;

    // Update direction if provided and valid
    if (direction === 'left' || direction === 'right') {
      console.error(`[MCP Test] Setting direction to ${direction}`);
      avatarState.direction = direction;
    }

    // Update position if provided
    if (posX !== undefined) {
      console.error(`[MCP Test] Setting posX to ${posX}`);
      avatarState.posX = posX;
    }

    if (posY !== undefined) {
      console.error(`[MCP Test] Setting posY to ${posY}`);
      avatarState.posY = posY;
    }

    // Update rotation if provided
    if (rotation !== undefined) {
      const limitedRotation = Math.max(-30, Math.min(30, rotation));
      console.error(`[MCP Test] Setting rotation to ${limitedRotation} (original value: ${rotation})`);
      avatarState.rotation = limitedRotation;
    }

    // Update scale if provided
    if (scale !== undefined) {
      const limitedScale = Math.max(0.1, Math.min(3.0, scale));
      console.error(`[MCP Test] Setting scale to ${limitedScale} (original value: ${scale})`);
      avatarState.scale = limitedScale;
    }

    console.error(`[MCP Test] Final avatar state: ${JSON.stringify(avatarState)}`);
    
    return {
      content: [{ 
        type: "text", 
        text: `Avatar expression set to ${name}` 
      }]
    };
  }
);

// Add tool for listing available expressions
mcpServer.tool(
  "listAvatarExpressions",
  {}, // No parameters needed
  async () => {
    const expressionList = Object.keys(expressionMap).join(', ');
    console.error(`[MCP Test] listAvatarExpressions called, returning: ${expressionList}`);
    return {
      content: [{
        type: "text",
        text: `Available expressions: ${expressionList}`
      }]
    };
  }
);

// Connect the MCP server with stdio transport
console.error('[MCP Test] Connecting MCP server with StdioServerTransport...');
const transport = new StdioServerTransport();

mcpServer.connect(transport).then(() => {
  console.error(`[MCP Test] Server connected and ready for AI tool calls`);
}).catch(err => {
  console.error(`[MCP Test] Failed to connect MCP server: ${err}`);
  console.error('[MCP Test] Exiting with error');
  process.exit(1);
});

// Keep the process alive
process.stdin.resume();

// Handle signals gracefully
process.on('SIGINT', () => {
  console.error('[MCP Test] Received SIGINT, shutting down gracefully');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('[MCP Test] Received SIGTERM, shutting down gracefully');
  process.exit(0);
});

console.error('[MCP Test] Server initialized and waiting for connections');