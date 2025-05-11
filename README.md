# RustyButter Avatar

A local avatar expression controller for OBS (Open Broadcaster Software) that allows an avatar to change expressions programmatically, typically controlled by a Large Language Model (LLM) using the Model Context Protocol (MCP).

## System Components

1. **Express Server**: Node.js server that serves avatar images and handles expression changes
2. **Avatar Web Page**: HTML/JS page displaying the current avatar expression
3. **OBS Browser Source**: Displays the avatar web page in OBS
4. **MCP Integration**: Allows LLMs to change the avatar's expression

## Setup

### Prerequisites

- Node.js (v14 or newer)
- npm (Node package manager)
- OBS (Open Broadcaster Software)

### Installation

#### Option 1: Using NPX (Recommended)

You can run RustyButter Avatar directly without installation:

```bash
npx rustybutter-avatar
```

For more options, see the "Using NPX" section below.

#### Option 2: Manual Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/CodingButter/rustybutter-avatar.git
   cd rustybutter-avatar
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

4. Start the server:
   ```bash
   npm start
   ```

You can also install the package globally:

```bash
npm install -g rustybutter-avatar
rustybutter-avatar
```

## Usage

### Using NPX

You can run RustyButter Avatar directly with npx without installation:

```bash
npx rustybutter-avatar
```

The command supports several options:

```bash
npx rustybutter-avatar --help
```

Options:
- `-p, --port <number>` - Port to run the server on (default: 3000)
- `-d, --detached` - Run the server in detached mode (background)
- `-l, --log <file>` - Specify a log file path (default: rustybutter.log)
- `-s, --stop` - Stop a running detached server
- `-v, --version` - Display version information

Examples:
```bash
# Run on port 8080
npx rustybutter-avatar --port 8080

# Run in background mode
npx rustybutter-avatar --detached

# Stop a running detached server
npx rustybutter-avatar --stop
```

### Adding Avatar Images

Place your avatar expression images in the `public/images` directory. The system will load expressions from the `public/expressions.json` file, which contains an array of expression objects with the following structure:

```json
{
  "name": "expression_name",
  "imageUrl": "/images/expression_name.png",
  "description": "Description of the expression",
  "useCases": "When to use this expression"
}
```

To add a new expression:
1. Add your expression image to `public/images/` (e.g., `new_expression.png`)
2. Edit `public/expressions.json` to add your new expression:
```json
{
  "name": "new_expression",
  "imageUrl": "/images/new_expression.png",
  "description": "Description of your new expression",
  "useCases": "When to use this expression"
}
```

No changes to the server code are needed, as expressions are loaded dynamically from the JSON file.

### Setting Up OBS

1. Open OBS
2. Add a new "Browser" source
3. Set the URL to `http://localhost:3000` (or the configured port)
4. Set a suitable width and height
5. Check "Refresh browser when scene becomes active"

### Testing Expressions

You can test different expressions by accessing the following URL in your browser:

```
http://localhost:3000/api/set-expression?name=joyful
```

Replace `joyful` with any expression name defined in the expressions.json file.

The set-expression endpoint also supports additional parameters:

- `direction` - Either "right" (default) or "left" to flip the avatar horizontally
- `pos_x` - Horizontal position offset in pixels (can be negative)
- `pos_y` - Vertical position offset in pixels (can be negative)
- `rotation` - Rotation angle in degrees, from -30 to 30, to make the avatar lean (positive values lean right, negative values lean left)
- `scale` - Scale factor to resize the avatar (0.1 to 3.0, where 1.0 is 100% size, 0.5 is 50% size, etc.)

Example with all parameters:
```
http://localhost:3000/api/set-expression?name=mind-blown&direction=left&pos_x=-20&pos_y=15&rotation=-15&scale=0.5
```

You can also view all available expressions at:

```
http://localhost:3000/api/expressions
```

This will return a JSON array of all available expressions with their details.

### MCP Integration

The system exports an MCP tool called `setAvatarExpression` which allows LLMs that support MCP to control the avatar's expression. It supports the following parameters:

- `name` (required) - The expression name to display
- `direction` (optional) - Either "right" or "left" to control which way the avatar faces
- `posX` (optional) - Horizontal position offset in pixels
- `posY` (optional) - Vertical position offset in pixels
- `rotation` (optional) - Rotation angle in degrees (-30 to 30) to make the avatar lean
- `scale` (optional) - Scale factor for avatar size (0.1 to 3.0, where 1.0 is 100% size)

Example MCP call:
```javascript
// Change expression, face left, lean slightly, and scale to 50% size
await mcp.invoke("setAvatarExpression", {
  name: "sipping_coffee",
  direction: "left",
  posX: 10,
  posY: -5,
  rotation: -10,
  scale: 0.5
});
```

#### Testing API Integration

A test script is included to help you test the API integration that LLMs would use. To use it:

1. First make sure the server is running (either in a separate terminal or in the background):
   ```bash
   npm start
   ```

2. In another terminal, run the test script:
   ```bash
   npm run test:mcp
   ```

The test script provides an interactive command line interface where you can:
- Set the avatar expression with all parameters: `set <expression> [direction] [posX] [posY] [rotation] [scale]`
- List all available expressions: `list`
- Get help: `help`
- Exit the script: `exit`

Example commands:
```
set joyful
set perplexed left 10 -5 15 0.75
set sipping_coffee right 0 0 -10 0.5
```

## Development

- Run in development mode (detached with logging): `npm run dev`
- Stop the development server: `npm run dev:stop`
- View logs in the `rustybutter.log` file
- Build for production: `npm run build`

## Customization

- To add new expressions, simply edit the `expressions.json` file and add your new expressions as described above.
- Modify the HTML/CSS in `public/index.html` to adjust the avatar's appearance.
- The polling interval (how often the page checks for expression updates) can be adjusted in the script section of `public/index.html`.
- Press the 'D' key when the page is active to toggle debug mode, which shows the current expression name and description.

## License

ISC