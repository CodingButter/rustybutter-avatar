// MCP server module for RustyButter Avatar
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import fs from 'fs';
import path from 'path';
import { Expression } from './types';

// Store the current expression and avatar state
let currentExpression = 'joyful';
let avatarState = {
  direction: 'right' as 'right' | 'left',
  posX: 0,
  posY: 0,
  rotation: 0,
  scale: 1.0
};

// Interface for expression map
interface ExpressionMap {
  [key: string]: Expression;
}

// Callback type for expression updates
type ExpressionUpdateCallback = (name: string, avatarState: {
  direction: 'right' | 'left';
  posX: number;
  posY: number;
  rotation: number;
  scale: number;
}) => void;

/**
 * Initialize and start the MCP server
 * @param expressions The loaded expressions from the main server
 * @param expressionMap The expression map for quick lookups
 * @param onExpressionUpdate Callback to notify the main server of expression changes
 */
export function startMcpServer(
  expressions: Expression[],
  expressionMap: ExpressionMap,
  onExpressionUpdate: ExpressionUpdateCallback
) {
  console.error('[MCP] Starting RustyButter Avatar MCP server...');

  // Set initial expression
  currentExpression = Object.keys(expressionMap).includes('joyful') ? 'joyful' : Object.keys(expressionMap)[0];

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
      console.error(`[MCP] setAvatarExpression called with: name=${name}, direction=${direction}, posX=${posX}, posY=${posY}, rotation=${rotation}, scale=${scale}`);
      
      if (!expressionMap[name]) {
        console.error(`[MCP] Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}`);
        return { 
          content: [{ 
            type: "text", 
            text: `Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}` 
          }]
        };
      }

      // Update expression
      console.error(`[MCP] Changing expression from ${currentExpression} to ${name}`);
      currentExpression = name;

      // Update direction if provided and valid
      if (direction === 'left' || direction === 'right') {
        console.error(`[MCP] Setting direction to ${direction}`);
        avatarState.direction = direction;
      }

      // Update position if provided
      if (posX !== undefined) {
        console.error(`[MCP] Setting posX to ${posX}`);
        avatarState.posX = posX;
      }

      if (posY !== undefined) {
        console.error(`[MCP] Setting posY to ${posY}`);
        avatarState.posY = posY;
      }

      // Update rotation if provided
      if (rotation !== undefined) {
        const limitedRotation = Math.max(-30, Math.min(30, rotation));
        console.error(`[MCP] Setting rotation to ${limitedRotation} (original value: ${rotation})`);
        avatarState.rotation = limitedRotation;
      }

      // Update scale if provided
      if (scale !== undefined) {
        const limitedScale = Math.max(0.1, Math.min(3.0, scale));
        console.error(`[MCP] Setting scale to ${limitedScale} (original value: ${scale})`);
        avatarState.scale = limitedScale;
      }

      console.error(`[MCP] Final avatar state: ${JSON.stringify(avatarState)}`);
      
      // Notify the main server of the expression change
      onExpressionUpdate(currentExpression, { ...avatarState });
      
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
      console.error(`[MCP] listAvatarExpressions called, returning: ${expressionList}`);
      return {
        content: [{
          type: "text",
          text: `Available expressions: ${expressionList}`
        }]
      };
    }
  );

  // Connect the MCP server with stdio transport
  console.error('[MCP] Connecting MCP server with StdioServerTransport...');
  const transport = new StdioServerTransport();

  mcpServer.connect(transport).then(() => {
    console.error(`[MCP] Server connected and ready for AI tool calls`);
  }).catch(err => {
    console.error(`[MCP] Failed to connect MCP server: ${err}`);
  });

  console.error('[MCP] Server initialized successfully');
}