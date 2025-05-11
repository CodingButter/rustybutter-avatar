import express from 'express';
import path from 'path';
import cors from 'cors';
import fs from 'fs';

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
  const expressionsData = fs.readFileSync(expressionsPath, 'utf8');
  expressions = JSON.parse(expressionsData);
  console.log(`Loaded ${expressions.length} expressions`);
} catch (error) {
  console.error('Error loading expressions:', error);
  // Provide some default expressions if file can't be loaded
  expressions = [
    {
      name: "joyful",
      imageUrl: "/images/joyful.png",
      description: "Happy and celebratory expression",
      useCases: "When tests pass, code works correctly, or celebrating achievements"
    }
  ];
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
  if (!expressionMap[currentExpression]) {
    return res.status(404).json({ error: 'Expression not found' });
  }

  res.json({
    ...expressionMap[currentExpression],
    direction: avatarState.direction,
    posX: avatarState.posX,
    posY: avatarState.posY,
    rotation: avatarState.rotation,
    scale: avatarState.scale
  });
});

// API endpoint to set expression (for testing without MCP)
app.get('/api/set-expression', (req, res) => {
  const { name, direction, pos_x, pos_y, rotation, scale } = req.query;

  if (typeof name !== 'string' || !expressionMap[name]) {
    return res.status(400).json({
      error: 'Invalid expression name',
      availableExpressions: Object.keys(expressionMap)
    });
  }

  // Update the expression
  currentExpression = name;

  // Update direction if provided and valid
  if (direction === 'left' || direction === 'right') {
    avatarState.direction = direction;
  }

  // Update position if provided
  if (pos_x !== undefined) {
    try {
      avatarState.posX = parseInt(pos_x as string, 10);
    } catch (e) {
      // Ignore invalid number formats
    }
  }

  if (pos_y !== undefined) {
    try {
      avatarState.posY = parseInt(pos_y as string, 10);
    } catch (e) {
      // Ignore invalid number formats
    }
  }

  // Update rotation if provided
  if (rotation !== undefined) {
    try {
      // Limit rotation to a reasonable range (-30 to 30 degrees)
      const rotationValue = parseInt(rotation as string, 10);
      avatarState.rotation = Math.max(-30, Math.min(30, rotationValue));
    } catch (e) {
      // Ignore invalid number formats
    }
  }

  // Update scale if provided
  if (scale !== undefined) {
    try {
      // Parse and limit scale to reasonable values (0.1 to 3.0)
      const scaleValue = parseFloat(scale as string);
      if (!isNaN(scaleValue)) {
        avatarState.scale = Math.max(0.1, Math.min(3.0, scaleValue));
      }
    } catch (e) {
      // Ignore invalid number formats
    }
  }

  res.json({
    success: true,
    ...expressionMap[name],
    direction: avatarState.direction,
    posX: avatarState.posX,
    posY: avatarState.posY,
    rotation: avatarState.rotation,
    scale: avatarState.scale
  });
});

// API endpoint to get all available expressions
app.get('/api/expressions', (req, res) => {
  res.json(expressions);
});

// MCP tool for setting avatar expression
const setAvatarExpression = async (name: string, direction?: string, posX?: number, posY?: number, rotation?: number, scale?: number) => {
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

// Start the server
app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Available expressions: ${Object.keys(expressionMap).join(', ')}`);
  console.log(`Default expression: ${currentExpression}`);
  console.log(`Use OBS Browser Source to display avatar at: http://localhost:${PORT}`);
});

// Export the MCP tool
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