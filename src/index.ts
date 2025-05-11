import express from 'express';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Define expression interface
interface Expression {
  name: string;
  imageUrl: string;
  description: string;
  useCases: string;
}

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: { [key: string]: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      options.port = args[i + 1];
      i++;
    }
  }

  return options;
}

const options = parseArgs();

// Create Express server
const app = express();
const PORT = options.port || process.env.PORT || 3000;

// Enable CORS
app.use(cors());

// Middleware to parse JSON requests
app.use(express.json());

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, '../public')));

// Default expression
let currentExpression = 'joyful';

// Load expressions from JSON file
let expressions: Expression[] = [];
try {
  const expressionsPath = path.join(__dirname, '../public/expressions.json');
  console.error(`[Debug] Loading expressions from: ${expressionsPath}`);
  const expressionsData = fs.readFileSync(expressionsPath, 'utf8');
  expressions = JSON.parse(expressionsData);
  console.error(`[Debug] Loaded ${expressions.length} expressions`);
  console.log(`Loaded ${expressions.length} expressions`);
} catch (error) {
  console.error('[Error] Error loading expressions:', error);
  // Provide some default expressions if file can't be loaded
  expressions = [
    {
      name: "joyful",
      imageUrl: "/images/joyful.png",
      description: "Happy and celebratory expression",
      useCases: "When tests pass, code works correctly, or celebrating achievements"
    }
  ];
  console.error('[Debug] Using default expression fallback');
}

// Create a map for quick lookups
const expressionMap = expressions.reduce((map, exp) => {
  map[exp.name] = exp;
  return map;
}, {} as Record<string, Expression>);

// Store the avatar positioning and direction state
let avatarState = {
  direction: 'right', // 'right' or 'left'
  posX: 0,           // horizontal offset in pixels
  posY: 0,           // vertical offset in pixels
  rotation: 0,       // rotation in degrees
  scale: 1.0         // scale factor (1.0 = 100%, 0.5 = 50%, etc.)
};

// API endpoint to get current expression
app.get('/api/current-expression', (req, res) => {
  console.error(`[API Debug] GET /api/current-expression - Current expression: ${currentExpression}`);

  if (!expressionMap[currentExpression]) {
    console.error(`[API Error] Expression not found: ${currentExpression}`);
    return res.status(404).json({ error: 'Expression not found' });
  }

  const response = {
    ...expressionMap[currentExpression],
    direction: avatarState.direction,
    posX: avatarState.posX,
    posY: avatarState.posY,
    rotation: avatarState.rotation,
    scale: avatarState.scale
  };

  console.error(`[API Debug] Returning expression: ${JSON.stringify(response)}`);
  res.json(response);
});

// API endpoint to set expression (for testing without MCP)
app.get('/api/set-expression', (req, res) => {
  const { name, direction, pos_x, pos_y, rotation, scale } = req.query;
  console.error(`[API Debug] GET /api/set-expression - Parameters: name=${name}, direction=${direction}, pos_x=${pos_x}, pos_y=${pos_y}, rotation=${rotation}, scale=${scale}`);

  if (typeof name !== 'string' || !expressionMap[name]) {
    console.error(`[API Error] Invalid expression name: ${name}`);
    return res.status(400).json({
      error: 'Invalid expression name',
      availableExpressions: Object.keys(expressionMap)
    });
  }

  // Update the expression
  console.error(`[API Debug] Changing expression from ${currentExpression} to ${name}`);
  currentExpression = name;

  // Update direction if provided and valid
  if (direction === 'left' || direction === 'right') {
    console.error(`[API Debug] Setting direction to ${direction}`);
    avatarState.direction = direction;
  }

  // Update position if provided
  if (pos_x !== undefined) {
    try {
      const parsedPosX = parseInt(pos_x as string, 10);
      console.error(`[API Debug] Setting posX to ${parsedPosX} (from ${pos_x})`);
      avatarState.posX = parsedPosX;
    } catch (e) {
      console.error(`[API Error] Invalid posX value: ${pos_x}`);
      // Ignore invalid number formats
    }
  }

  if (pos_y !== undefined) {
    try {
      const parsedPosY = parseInt(pos_y as string, 10);
      console.error(`[API Debug] Setting posY to ${parsedPosY} (from ${pos_y})`);
      avatarState.posY = parsedPosY;
    } catch (e) {
      console.error(`[API Error] Invalid posY value: ${pos_y}`);
      // Ignore invalid number formats
    }
  }

  // Update rotation if provided
  if (rotation !== undefined) {
    try {
      // Limit rotation to a reasonable range (-30 to 30 degrees)
      const rotationValue = parseInt(rotation as string, 10);
      const limitedRotation = Math.max(-30, Math.min(30, rotationValue));
      console.error(`[API Debug] Setting rotation to ${limitedRotation} (from ${rotation})`);
      avatarState.rotation = limitedRotation;
    } catch (e) {
      console.error(`[API Error] Invalid rotation value: ${rotation}`);
      // Ignore invalid number formats
    }
  }

  // Update scale if provided
  if (scale !== undefined) {
    try {
      // Parse and limit scale to reasonable values (0.1 to 3.0)
      const scaleValue = parseFloat(scale as string);
      if (!isNaN(scaleValue)) {
        const limitedScale = Math.max(0.1, Math.min(3.0, scaleValue));
        console.error(`[API Debug] Setting scale to ${limitedScale} (from ${scale})`);
        avatarState.scale = limitedScale;
      }
    } catch (e) {
      console.error(`[API Error] Invalid scale value: ${scale}`);
      // Ignore invalid number formats
    }
  }

  const response = {
    success: true,
    ...expressionMap[name],
    direction: avatarState.direction,
    posX: avatarState.posX,
    posY: avatarState.posY,
    rotation: avatarState.rotation,
    scale: avatarState.scale
  };

  console.error(`[API Debug] Final avatar state: ${JSON.stringify(avatarState)}`);
  console.error(`[API Debug] Returning response: ${JSON.stringify(response)}`);
  res.json(response);
});

// API endpoint to get all available expressions
app.get('/api/expressions', (req, res) => {
  console.error(`[API Debug] GET /api/expressions - Returning ${expressions.length} expressions`);
  console.error(`[API Debug] Expression names: ${expressions.map(e => e.name).join(', ')}`);
  res.json(expressions);
});

// MCP tool for setting avatar expression
const setAvatarExpression = async (name: string, direction?: string, posX?: number, posY?: number, rotation?: number, scale?: number) => {
  console.error(`[MCP Debug] setAvatarExpression called with: name=${name}, direction=${direction}, posX=${posX}, posY=${posY}, rotation=${rotation}, scale=${scale}`);

  if (!expressionMap[name]) {
    console.error(`[MCP Error] Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}`);
    throw new Error(`Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}`);
  }

  // Update expression
  console.error(`[MCP Debug] Changing expression from ${currentExpression} to ${name}`);
  currentExpression = name;

  // Update direction if provided and valid
  if (direction === 'left' || direction === 'right') {
    console.error(`[MCP Debug] Setting direction to ${direction}`);
    avatarState.direction = direction;
  }

  // Update position if provided
  if (posX !== undefined) {
    console.error(`[MCP Debug] Setting posX to ${posX}`);
    avatarState.posX = posX;
  }

  if (posY !== undefined) {
    console.error(`[MCP Debug] Setting posY to ${posY}`);
    avatarState.posY = posY;
  }

  // Update rotation if provided
  if (rotation !== undefined) {
    // Limit rotation to a reasonable range (-30 to 30 degrees)
    const limitedRotation = Math.max(-30, Math.min(30, rotation));
    console.error(`[MCP Debug] Setting rotation to ${limitedRotation} (original value: ${rotation})`);
    avatarState.rotation = limitedRotation;
  }

  // Update scale if provided
  if (scale !== undefined) {
    // Limit scale to reasonable values (0.1 to 3.0)
    const limitedScale = Math.max(0.1, Math.min(3.0, scale));
    console.error(`[MCP Debug] Setting scale to ${limitedScale} (original value: ${scale})`);
    avatarState.scale = limitedScale;
  }

  console.error(`[MCP Debug] Final avatar state: ${JSON.stringify(avatarState)}`);

  return {
    success: true,
    message: `Avatar expression set to ${name}`,
    expression: expressionMap[name],
    direction: avatarState.direction,
    posX: avatarState.posX,
    posY: avatarState.posY,
    rotation: avatarState.rotation,
    scale: avatarState.scale
  };
};

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Server Error] ${err.stack || err.message || err}`);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Start the server
app.listen(PORT, () => {
  console.error(`[Server] RustyButter Avatar Server started`);
  console.error(`[Server] Server running at http://localhost:${PORT}`);
  console.error(`[Server] Available expressions: ${Object.keys(expressionMap).join(', ')}`);
  console.error(`[Server] Default expression: ${currentExpression}`);
  console.error(`[Server] Avatar state: ${JSON.stringify(avatarState)}`);
  console.error(`[Server] MCP tool registered: setAvatarExpression`);
  console.error(`[Server] Use OBS Browser Source to display avatar at: http://localhost:${PORT}`);

  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Available expressions: ${Object.keys(expressionMap).join(', ')}`);
  console.log(`Default expression: ${currentExpression}`);
  console.log(`Use OBS Browser Source to display avatar at: http://localhost:${PORT}`);
});

// Initialize MCP server
const mcpServer = new McpServer({
  name: "RustyButterAvatar",
  version: "1.0.1",
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
    console.error(`[MCP Debug] setAvatarExpression called with: name=${name}, direction=${direction}, posX=${posX}, posY=${posY}, rotation=${rotation}, scale=${scale}`);

    if (!expressionMap[name]) {
      console.error(`[MCP Error] Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}`);
      return {
        content: [{
          type: "text",
          text: `Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}`
        }]
      };
    }

    // Update expression
    console.error(`[MCP Debug] Changing expression from ${currentExpression} to ${name}`);
    currentExpression = name;

    // Update direction if provided and valid
    if (direction === 'left' || direction === 'right') {
      console.error(`[MCP Debug] Setting direction to ${direction}`);
      avatarState.direction = direction;
    }

    // Update position if provided
    if (posX !== undefined) {
      console.error(`[MCP Debug] Setting posX to ${posX}`);
      avatarState.posX = posX;
    }

    if (posY !== undefined) {
      console.error(`[MCP Debug] Setting posY to ${posY}`);
      avatarState.posY = posY;
    }

    // Update rotation if provided
    if (rotation !== undefined) {
      // Limit rotation to a reasonable range (-30 to 30 degrees)
      const limitedRotation = Math.max(-30, Math.min(30, rotation));
      console.error(`[MCP Debug] Setting rotation to ${limitedRotation} (original value: ${rotation})`);
      avatarState.rotation = limitedRotation;
    }

    // Update scale if provided
    if (scale !== undefined) {
      // Limit scale to reasonable values (0.1 to 3.0)
      const limitedScale = Math.max(0.1, Math.min(3.0, scale));
      console.error(`[MCP Debug] Setting scale to ${limitedScale} (original value: ${scale})`);
      avatarState.scale = limitedScale;
    }

    console.error(`[MCP Debug] Final avatar state: ${JSON.stringify(avatarState)}`);

    return {
      content: [{
        type: "text",
        text: `Avatar expression set to ${name}`
      }]
    };
  }
);

// Instead of using resource, let's add another tool for listing expressions
mcpServer.tool(
  "listAvatarExpressions",
  {}, // No parameters needed
  async () => {
    const expressionList = Object.keys(expressionMap).join(', ');
    console.error(`[MCP Debug] listAvatarExpressions called, returning: ${expressionList}`);
    return {
      content: [{
        type: "text",
        text: `Available expressions: ${expressionList}`
      }]
    };
  }
);

// Connect the MCP server
const transport = new StdioServerTransport();
mcpServer.connect(transport).then(() => {
  console.error(`[MCP] Server connected and ready for AI tool calls`);
}).catch(err => {
  console.error(`[MCP Error] Failed to connect MCP server: ${err}`);
});

// For backward compatibility with older MCP implementations
export const mcpTools = {
  setAvatarExpression: {
    description: "Change the avatar's facial expression, direction, position, rotation, and scale",
    parameters: {
      name: {
        type: "string",
        description: "Expression name (one of the available avatar expressions)",
        enum: Object.keys(expressionMap)
      },
      direction: {
        type: "string",
        description: "Direction the avatar is facing ('right' or 'left')",
        enum: ["right", "left"],
        optional: true
      },
      posX: {
        type: "number",
        description: "Horizontal position offset in pixels",
        optional: true
      },
      posY: {
        type: "number",
        description: "Vertical position offset in pixels",
        optional: true
      },
      rotation: {
        type: "number",
        description: "Rotation angle in degrees (-30 to 30) for leaning effect",
        optional: true
      },
      scale: {
        type: "number",
        description: "Scale factor for avatar size (0.1 to 3.0, where 1.0 is 100%)",
        optional: true
      }
    },
    function: setAvatarExpression
  }
};