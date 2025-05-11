# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This project is a local avatar expression controller for OBS (Open Broadcaster Software) using a Node.js Express server written in TypeScript. The system allows an avatar on a stream to change expressions (images) programmatically - typically controlled by a Large Language Model (LLM) using the Model Context Protocol (MCP).

### System Components

1. **Express Server (Node.js & TypeScript)**: Serves an HTML page and avatar image files, contains logic to switch which avatar image is displayed.
2. **Avatar Web Page**: Simple HTML/JS page with an image tag for the avatar, periodically polls the server for expression updates.
3. **OBS Browser Source**: Displays the avatar web page in OBS.
4. **MCP Integration**: Allows LLMs to call tools that change the avatar's expression.

## Setup Commands

```bash
# Install dependencies
npm install

# Build the TypeScript project
npm run build

# Start the server
npm start
```

## Project Structure

- `src/index.ts`: Main server code that sets up Express, serves static files, defines MCP tools, and runs the server
- `public/`: Contains static files served to the browser
  - `public/index.html`: HTML page loaded by OBS's browser source
  - `public/images/`: Avatar expression image files (e.g., happy.png, sad.png)

## Key Implementation Details

1. The server maintains a `currentExpression` state and maps expression names to image file paths.
2. The MCP tool `setAvatarExpression` allows an LLM to change the current expression.
3. The front-end polls an API endpoint to get the current expression image URL.
4. The server provides `/api/current-expression` endpoint to return the current expression data.
5. A manual testing endpoint `/api/set-expression?name=happy` allows testing without LLM integration.

## Important Notes

- Avatar image files should follow a consistent naming pattern (e.g., `happy.png`, `sad.png`)
- OBS Browser Source should point to `http://localhost:3000` (or configured port)
- The front-end adds a timestamp query parameter to image URLs to prevent OBS caching
- The server listens on port 3000 by default