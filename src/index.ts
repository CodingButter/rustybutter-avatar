import express from 'express';
import path from 'path';
import cors from 'cors';
import fs from 'fs';
import { Expression, AvatarState, BatchExpressions } from './types';
import { startMcpServer } from './mcp-server';
import { v4 as uuidv4 } from 'uuid';

// Parse command line arguments
function parseArgs() {
  const args = process.argv.slice(2);
  const options: { [key: string]: string } = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--port' && i + 1 < args.length) {
      options.port = args[i + 1];
      i++;
    }
    if (args[i] === '--mcp') {
      options.mcp = 'true';
    }
  }

  return options;
}

const options = parseArgs();
const isMcpMode = options.mcp === 'true' || process.env.MCP_MODE === 'true';

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
let avatarState: AvatarState = {
  direction: 'right', // 'right' or 'left'
  posX: 0,           // horizontal offset in pixels
  posY: 0,           // vertical offset in pixels
  rotation: 0,       // rotation in degrees
  scale: 1.0         // scale factor (1.0 = 100%, 0.5 = 50%, etc.)
};

// Store the batch expressions state
let batchExpressionsState: BatchExpressions | null = null;

// Callback for MCP to update our state
const handleExpressionUpdate = (name: string, state: AvatarState) => {
  if (expressionMap[name]) {
    // Clear batch expressions when setting a single expression
    batchExpressionsState = null;

    currentExpression = name;
    avatarState = { ...state };
    console.error(`[Express] Expression updated via MCP to: ${name}, state: ${JSON.stringify(avatarState)}`);
  }
};

// Callback for MCP to update batch expressions
const handleBatchExpressionsUpdate = (batchExpressions: BatchExpressions) => {
  console.error(`[Express] Batch expressions updated via MCP: ${JSON.stringify(batchExpressions)}`);

  // Validate expressions in the batch
  const validActions = batchExpressions.actions.filter(action => {
    const isValid = expressionMap[action.expression] !== undefined;
    if (!isValid) {
      console.error(`[Express] Invalid expression in batch: ${action.expression}`);
    }
    return isValid;
  });

  if (validActions.length === 0) {
    console.error('[Express] No valid expressions in batch, ignoring update');
    return;
  }

  if (validActions.length !== batchExpressions.actions.length) {
    console.error(`[Express] Some expressions in batch were invalid and filtered out (${batchExpressions.actions.length - validActions.length})`);
    batchExpressions.actions = validActions;
  }

  // If there's only one action and not looping, just use regular expression update
  if (validActions.length === 1 && !batchExpressions.loop) {
    const action = validActions[0];
    currentExpression = action.expression;
    avatarState = {
      direction: action.direction,
      posX: action.posX,
      posY: action.posY,
      rotation: action.rotation,
      scale: action.scale
    };
    batchExpressionsState = null;
    console.error(`[Express] Single action batch converted to regular expression: ${action.expression}`);
  } else {
    // Otherwise, store the batch expressions
    batchExpressionsState = {
      ...batchExpressions,
      random: batchExpressions.random || false, // Default to false if not provided
      batchId: batchExpressions.batchId || uuidv4() // Generate a new ID if not provided
    };

    // Set initial expression
    if (validActions.length > 0) {
      const firstAction = validActions[0];
      currentExpression = firstAction.expression;
      avatarState = {
        direction: firstAction.direction,
        posX: firstAction.posX,
        posY: firstAction.posY,
        rotation: firstAction.rotation,
        scale: firstAction.scale
      };
    }
  }
};

// API endpoint to get current expression
app.get('/api/current-expression', (req, res) => {
  console.error(`[API Debug] GET /api/current-expression - Current expression: ${currentExpression}`);

  if (!expressionMap[currentExpression]) {
    console.error(`[API Error] Expression not found: ${currentExpression}`);
    return res.status(404).json({ error: 'Expression not found' });
  }

  // Basic response with current expression
  const response = {
    ...expressionMap[currentExpression],
    direction: avatarState.direction,
    posX: avatarState.posX,
    posY: avatarState.posY,
    rotation: avatarState.rotation,
    scale: avatarState.scale
  };

  // Add batch expressions if available
  if (batchExpressionsState) {
    const batchResponse = {
      ...response,
      batchExpressions: {
        ...batchExpressionsState,
        // Explicitly include the random property to ensure it's in the response
        random: batchExpressionsState.random || false
      }
    };
    console.error(`[API Debug] Returning expression with batch: ${JSON.stringify(batchResponse)}`);
    return res.json(batchResponse);
  }

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
    avatarState.direction = direction as 'left' | 'right';
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

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(`[Server Error] ${err.stack || err.message || err}`);
  res.status(500).json({ error: 'Server error', message: err.message });
});

// Start the Express server
app.listen(PORT, () => {
  console.error(`[Server] RustyButter Avatar Server started`);
  console.error(`[Server] Server running at http://localhost:${PORT}`);
  console.error(`[Server] Available expressions: ${Object.keys(expressionMap).join(', ')}`);
  console.error(`[Server] Default expression: ${currentExpression}`);
  console.error(`[Server] Avatar state: ${JSON.stringify(avatarState)}`);
  console.error(`[Server] Use OBS Browser Source to display avatar at: http://localhost:${PORT}`);

  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Available expressions: ${Object.keys(expressionMap).join(', ')}`);
  console.log(`Default expression: ${currentExpression}`);
  console.log(`Use OBS Browser Source to display avatar at: http://localhost:${PORT}`);
  
  // Start the MCP server after the Express server is running
  if (isMcpMode) {
    console.error('[Server] Starting MCP server in same process...');
    startMcpServer(expressions, expressionMap, handleExpressionUpdate, handleBatchExpressionsUpdate);
  } else {
    console.error('[Server] MCP server not started (use --mcp flag to enable)');
  }
});

// Legacy MCP tools export for backward compatibility
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
    function: async (name: string, direction?: string, posX?: number, posY?: number, rotation?: number, scale?: number) => {
      console.error(`[Legacy MCP] setAvatarExpression called with: name=${name}, direction=${direction}, posX=${posX}, posY=${posY}, rotation=${rotation}, scale=${scale}`);

      if (!expressionMap[name]) {
        throw new Error(`Invalid expression: ${name}. Available expressions: ${Object.keys(expressionMap).join(', ')}`);
      }

      // Update expression
      currentExpression = name;

      // Update direction if provided and valid
      if (direction === 'left' || direction === 'right') {
        avatarState.direction = direction;
      }

      // Update position if provided
      if (posX !== undefined) {
        avatarState.posX = posX;
      }

      if (posY !== undefined) {
        avatarState.posY = posY;
      }

      // Update rotation if provided
      if (rotation !== undefined) {
        // Limit rotation to a reasonable range (-30 to 30 degrees)
        avatarState.rotation = Math.max(-30, Math.min(30, rotation));
      }

      // Update scale if provided
      if (scale !== undefined) {
        // Limit scale to reasonable values (0.1 to 3.0)
        avatarState.scale = Math.max(0.1, Math.min(3.0, scale));
      }

      // Clear any batch expressions
      batchExpressionsState = null;

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
    }
  },

  setBatchExpressions: {
    description: "Set a sequence of expressions with durations that can optionally loop and randomize",
    parameters: {
      loop: {
        type: "boolean",
        description: "Whether to loop through the expressions sequence"
      },
      random: {
        type: "boolean",
        description: "Whether to randomize the order of expressions after each loop",
        optional: true
      },
      actions: {
        type: "array",
        description: "Array of expression actions with durations",
        items: {
          type: "object",
          properties: {
            expression: {
              type: "string",
              description: "Expression name (one of the available avatar expressions)",
              enum: Object.keys(expressionMap)
            },
            duration: {
              type: "number",
              description: "Duration to display this expression in milliseconds"
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
          required: ["expression", "duration"]
        }
      }
    },
    function: async (loop: boolean, random: boolean | undefined, actions: Array<any>) => {
      console.error(`[Legacy MCP] setBatchExpressions called with: loop=${loop}, random=${random}, actions=${JSON.stringify(actions)}`);

      if (!Array.isArray(actions) || actions.length === 0) {
        throw new Error('Actions array is required and must contain at least one expression action');
      }

      // Validate and prepare actions
      const validActions = actions.map(action => {
        if (!action.expression || !expressionMap[action.expression]) {
          throw new Error(`Invalid expression: ${action.expression}. Available expressions: ${Object.keys(expressionMap).join(', ')}`);
        }

        if (typeof action.duration !== 'number' || action.duration <= 0) {
          throw new Error(`Duration must be a positive number for expression: ${action.expression}`);
        }

        // Apply defaults and constraints
        const validAction = {
          expression: action.expression,
          duration: action.duration,
          direction: (action.direction === 'left' || action.direction === 'right') ? action.direction : 'right',
          posX: action.posX || 0,
          posY: action.posY || 0,
          rotation: action.rotation !== undefined ? Math.max(-30, Math.min(30, action.rotation)) : 0,
          scale: action.scale !== undefined ? Math.max(0.1, Math.min(3.0, action.scale)) : 1.0
        };

        return validAction;
      });

      // Create batch expressions object
      const batchExpressions: BatchExpressions = {
        loop,
        random: random || false, // Default to false if not provided
        actions: validActions,
        batchId: uuidv4()
      };

      // Update batch expressions state
      handleBatchExpressionsUpdate(batchExpressions);

      return {
        success: true,
        message: `Batch expressions set with ${validActions.length} actions, loop=${loop}`,
        batchId: batchExpressions.batchId
      };
    }
  }
};