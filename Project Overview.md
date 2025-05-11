# Local Avatar Expression Controller for OBS – Beginner’s Guide

## Introduction and Overview

This guide will help you set up a local avatar expression controller for OBS (Open Broadcaster Software) using a Node.js Express server written in TypeScript. The goal is to display an avatar on your stream whose expression (image) can be changed programmatically – in this case by a Large Language Model (LLM) using the **Model Context Protocol (MCP)**. We’ll break down how each part of the system connects: an LLM (via MCP) issues a command, the Express server receives it and switches the avatar’s expression image, and OBS displays the updated avatar through a Browser Source. By the end, you’ll have a working local web app that an AI (or you) can control to make the avatar smile, frown, etc., along with a clear understanding of how everything fits together.

**What You Will Learn in this Guide:**

- Setting up Node.js and the project dependencies (Express, TypeScript, etc.)
- Project structure and the role of each file/folder (server code, static assets, etc.)
- How OBS’s Browser Source works and how it will load the avatar page
- How the Express server serves the avatar images and switches expressions
- What MCP (Model Context Protocol) is, and how we define a “tool” for the LLM to use to change the avatar’s expression
- Step-by-step instructions to run the server and integrate it with OBS and an LLM
- Common pitfalls (caching issues, naming conventions) and how to avoid them
- Suggestions for improvements (like using metadata for expressions, real-time updates, etc.)

Throughout the guide, we’ll use simple examples with **inline code comments** to ensure everything is beginner-friendly and easy to follow. Let’s start with a quick explanation of the key concepts: the OBS Browser Source and the Model Context Protocol.

## OBS Browser Source and How It’s Used

**OBS Browser Source:** OBS Studio has a feature called the _Browser Source_, which is essentially an embedded web browser inside OBS. This means OBS can load any web page (local or online) and render it as part of your scene. In our case, we will create a local web page that shows the avatar image. OBS will load this page via a URL (e.g. `http://localhost:3000`) in a Browser Source layer. Whenever the content of that web page changes (for example, the avatar’s expression image changes), OBS will reflect those changes in real time on your stream. _Anything you can program to run in a normal browser can be added directly to OBS_, which gives us a lot of flexibility.

**How the pieces connect:** Here’s the high-level flow of our system:

1. **Express Server (Node.js & TypeScript):** This is a local web server that will serve an HTML page and avatar image files. It also contains logic to switch which avatar image is currently shown (based on commands from the LLM).
2. **Avatar Web Page (Browser Source):** This is a simple HTML/JS page served by the Express server. It displays an `<img>` tag for the avatar. The page will periodically check with the server to see if it should show a different expression image (e.g., happy, sad, etc.).
3. **OBS Studio:** We add a Browser Source in OBS pointing to the local HTML page (served by the Express server). OBS will render whatever the page shows onto your stream overlay. If the page shows a smiling avatar image, that’s what appears in OBS.
4. **LLM + MCP:** The Large Language Model (e.g. Anthropic’s Claude or another AI assistant) is configured to use the Model Context Protocol to communicate with our server. Through MCP, the server exposes a **tool** (function) that the AI can invoke, such as “change the avatar to X expression”. When the AI decides to change the avatar’s expression, it calls our tool via MCP. The server receives that call and updates the avatar’s expression. The HTML page then picks up the change and the new image appears in OBS.

To visualize this, consider the MCP setup as a bridge between the AI and our server:

&#x20;_Figure: A simplified view of the MCP architecture on your local machine. The AI runs in an “MCP Host” (e.g. Claude Desktop) which communicates via the MCP client protocol to your “MCP Server” (our Express + TypeScript app). The MCP server exposes certain functions as **tools** that the AI can call. Those tools can interact with local resources – in our case, the tool will change which avatar image is being served. This allows the AI to trigger code in your environment in a standardized, safe way._

With the big picture in mind, let’s get everything set up step-by-step.

## Project Structure and Setup

Before diving into code, let’s set up the environment and understand the project structure.

### Prerequisites

- **Node.js and npm:** Make sure you have Node.js installed (which comes with npm, the Node package manager). You can check by running `node -v` and `npm -v` in a terminal. If not installed, download the LTS version of Node from the official website and install it.
- **OBS Studio:** Install OBS if you haven’t already (not strictly needed until we want to display the result, but good to have).
- **Basic Knowledge:** This guide is beginner-friendly, but a little familiarity with running commands in a terminal and editing code will help. We will explain any TypeScript/HTML specifics as needed.

### Project Files and Folders

Let’s outline the key files and folders in our project and what they do:

- **`package.json`:** Lists project dependencies (like Express, maybe the MCP SDK) and npm scripts. It’s also used to initialize the Node project and manage scripts (like start, build).
- **`tsconfig.json`:** TypeScript configuration (specifies target JS version, module system, etc.). For our purposes, we usually don’t need to edit this – it’s set up so we can write TypeScript and compile to JavaScript.
- **`src/` folder:** Contains the TypeScript source code for our server.

  - **`src/index.ts`:** The main server code. This file sets up the Express app, serves static files, defines the MCP tool(s), and runs the server.

- **`public/` folder:** Contains static files that will be served to the browser. We will put our frontend files here.

  - **`public/index.html`:** The HTML page that OBS’s browser source will load. It contains an `<img>` tag for the avatar and some JavaScript to update the image.
  - **`public/images/`** (or a similar folder for images): Contains the avatar image files for each expression (happy, sad, etc.). For example, you might have `happy.png`, `sad.png`, etc., in this folder. We’ll assume PNG images with transparent backgrounds for the avatar.

_Note:_ Sometimes Express projects use a folder named `public` by convention for static assets. Our guide assumes that, but if your project uses a different folder (like `static/` or `assets/`), the concept is the same – that folder’s contents are served directly by the server.

### Step-by-Step Installation Guide

Follow these steps to get the project up and running:

1. **Create or Get the Project Code:** If you already have a project repository or folder (since this is a revision of an existing project overview, you likely do), navigate to that project directory in your terminal. If not, create a new folder and initialize an npm project with `npm init -y`, then install Express and any needed libraries. For example:

   ```bash
   npm install express
   npm install @modelcontextprotocol/sdk   # (if using the MCP SDK for tools, explained later)
   npm install typescript ts-node @types/node @types/express --save-dev  # TypeScript and types (dev dependencies)
   ```

   The above installs Express (web server) and the MCP SDK (for implementing MCP tools), plus TypeScript and type definitions for development. If you got the code from somewhere, these may already be listed in **package.json**, so you can just run `npm install` to install everything.

2. **Verify Project Structure:** Ensure that you have the expected files (as discussed above). At minimum, you should have `src/index.ts` (server code), and some HTML and image files in `public/`. If not, you can create them following this guide.
3. **Compile TypeScript (if needed):** If the project is new or if you made changes, compile the TypeScript to JavaScript. Usually, this is done via an npm script. Common scripts might be:

   - `npm run build` – which runs the TypeScript compiler (`tsc`) to output JS (often into a `dist/` or `build/` directory).
   - `npm run start` – which might run the compiled code with Node.
     Check your **package.json** for these scripts. If they exist, run:

   ```bash
   npm run build
   npm run start
   ```

   This will build the project and then start the server.
   **If no build script is defined:** You can compile manually by running `npx tsc` (which uses tsconfig.json settings). After compilation, run `node dist/index.js` (or wherever the output is).
   **If using ts-node (no explicit build step):** Some setups use `ts-node` to run TypeScript directly. In that case, you might have a script like `npm run dev` that calls `ts-node src/index.ts`. Use that to start the server in development mode.

4. **Run the Server:** Use the appropriate start command as determined above. For example:

   ```bash
   npm start
   ```

   This should launch the Express server. Typically, it will listen on a port (commonly 3000). In your terminal or console, you might see a log like “Server running on [http://localhost:3000”](http://localhost:3000”). If you don’t see a message, try opening [http://localhost:3000](http://localhost:3000) in your web browser. You should see the avatar page (perhaps showing a default expression image). If it loads, your server is running correctly.

5. **Add the Browser Source in OBS:** Now open OBS Studio. In your scene, add a new **Browser** source (click the “+” in the Sources list and choose _Browser_). In the properties:

   - **URL:** Enter `http://localhost:3000` (or whatever address/port your server is on). This is the URL OBS will load internally. (Make sure “Local file” is unchecked – we want OBS to use the URL.)
   - **Width/Height:** Set these to match your avatar canvas. For example, if your avatar images are 512x512 pixels, you can set the source to 512 width and 512 height. You can also adjust these later or set it larger if you plan to scale down in OBS.
   - Other settings can stay default. Notably, OBS by default enables _“Control audio via OBS”_ off (we have no audio) and sets the background to transparent by default, which is great for us (it means if your PNG images have transparency, the transparent parts will let your scene background show through). If for some reason your background isn’t transparent, you can force it with a bit of CSS (we’ll mention that in the HTML).
   - Click OK to add the source. You should now see the avatar image appear on your OBS scene. This is coming live from the local Express server via the browser source.

6. **Connect the LLM (MCP Integration):** If you plan to have an AI control the avatar, you’ll need to connect your running server to the LLM using MCP. The exact steps depend on which LLM and platform you are using:

   - _For Claude (Anthropic’s LLM) using Claude Desktop:_ You can configure Claude Desktop to recognize your MCP server. For example, in Claude Desktop’s settings JSON, add an entry under `"mcpServers"` for your server. It might look like:

     ```json
     "mcpServers": {
       "avatar": {
         "command": "node",
         "args": ["dist/index.js"]
       }
     }
     ```

     This tells Claude to launch your server (if not already running) and communicate with it via MCP. Make sure the path/command matches where your built server code is. Claude will then treat the tools you defined on this server as available functions it can call.

   - _For other LLMs or setups:_ Ensure your LLM or agent supports MCP and is configured with the connection info for this server. Some might use HTTP transport, others stdio. In a development scenario, you might run the server and the LLM separately and they communicate over a local port or via launching as above.
   - _Manual testing without an AI:_ If you just want to test the avatar control manually, you can skip this for now. We’ll show a way to trigger expression changes via a URL for testing purposes.

Once the server is running and OBS is displaying the page, you have the foundation in place. Next, let’s go through how the server code works, how the avatar images are managed, and how the LLM will trigger expression changes.

## Understanding the Code

In this section, we’ll walk through the main components of the code with examples. We’ll start with the Express server setup, then see how we load avatar expressions, define an MCP tool, and how the frontend page updates the displayed avatar.

### 1. Express Server Setup and Static File Serving

First, we set up a basic Express application. This involves creating an Express app, configuring it to serve our static files (HTML and images), and then starting an HTTP server to listen for requests.

Below is a simplified version of the **`src/index.ts`** code for setting up the server:

```ts
import express from "express"
import path from "path"
// (If needed: import other modules like fs for file operations, and MCP SDK classes which we'll get to later.)

const app = express()
const PORT = 3000 // You can choose any free port; 3000 is a common default.

// Serve the static files from the "public" folder
app.use(express.static(path.join(__dirname, "..", "public")))
// __dirname is the directory of the compiled JS file. We go one level up to find "public" relative to project root.
// This line tells Express to serve everything in the public folder at the root URL.
// e.g. index.html will be served at "/", and images at "/images/..."

// (Optional) A simple API route to check the server is running
app.get("/hello", (req, res) => {
  res.send("Hello from Avatar Server!")
})

// Start the HTTP server
app.listen(PORT, () => {
  console.log(`✅ Express server is running at http://localhost:${PORT}`)
})
```

Let’s break down what this does:

- We import `express` and create an `app`.
- We define a `PORT` (3000). If you prefer, you could read from an environment variable for flexibility, but a hardcoded port is fine for local use.
- `app.use(express.static(...))`: This is a crucial line. It serves all files under the specified folder (`public` in this case) as static assets. That means if there’s an `index.html` in `public`, it will be served at the root URL (`/`). If there’s an image file `public/images/happy.png`, it will be accessible at `http://localhost:3000/images/happy.png`. This makes serving our HTML and images very straightforward – we don’t need to write separate routes for each file.
- We added a small test route `GET /hello` returning a text message. This isn’t necessary for the project’s functionality, but it’s nice for quickly testing that our server responds (you can visit `http://localhost:3000/hello` in a browser to see if it returns the greeting).
- Finally, we start the server with `app.listen`. This makes the server start listening on port 3000 for incoming HTTP requests. In the callback, we `console.log` a message so we know it started successfully.

At this point, if you start the server and visit `http://localhost:3000`, Express will serve the `public/index.html` file (because of `express.static` setup). Now we need to fill in that HTML and also handle the avatar logic.

### 2. Managing Avatar Expressions (Images and State)

We assume you have multiple images for the avatar’s expressions in the `public/images` directory. For example: `happy.png`, `sad.png`, `surprised.png`, etc. We need the server to know about these images and be able to switch which one is currently shown.

A simple approach is to maintain a **`currentExpression`** state on the server (e.g., “happy” or “sad”), and serve the corresponding image path. We can also prepare a list or map of available expressions to their image file paths. This can be done by reading the files in the images directory or by manually listing them.

**a. Loading the images and inferring expression names:** One way is to use the Node filesystem module (`fs`) to read all files in `public/images` on startup. For each image file, we derive an expression name from the filename. For example, if a file is named `happy.png`, the expression name is “happy”. If files have a prefix like `avatar_happy.png`, we’d strip the prefix and use “happy”. We then store these in a dictionary (JavaScript object) for quick lookup.

Here’s how we could do that in the server code:

```ts
import fs from "fs"

interface ExpressionMap {
  [key: string]: string
}
const expressionImages: ExpressionMap = {} // Maps expression name -> image URL path
let currentExpression: string | null = null // Tracks the active expression name

// Read all image files from the images folder
const imagesDir = path.join(__dirname, "..", "public", "images")
const files = fs.readdirSync(imagesDir) // Synchronously get all filenames in the images directory
files.forEach((file) => {
  // We only care about image files (png in this case)
  if (file.toLowerCase().endsWith(".png")) {
    // Derive expression name from filename
    // e.g. "happy.png" -> "happy"; "avatar_sad.png" -> "sad"
    const nameWithoutExt = file.replace(".png", "")
    // If there's a prefix and an underscore, remove everything up to the underscore
    const exprName = nameWithoutExt.includes("_")
      ? nameWithoutExt.split("_").pop() // take the last part after underscore
      : nameWithoutExt
    expressionImages[exprName!] = `/images/${file}`
    // Store the web path (since our static serves from '/images/...')
  }
})

// Set a default expression
if (expressionImages["neutral"]) {
  currentExpression = "neutral"
} else {
  // If no neutral/default image, just pick the first one in the list
  const firstExpression = Object.keys(expressionImages)[0]
  currentExpression = firstExpression || null
}
console.log(`Loaded expressions: ${Object.keys(expressionImages).join(", ")}`)
console.log(`Defaulting to expression: ${currentExpression}`)
```

Let’s explain this snippet:

- We define `expressionImages` as a map from expression name to image path. For example, after running this, we might have `expressionImages = { happy: '/images/happy.png', sad: '/images/sad.png', surprised: '/images/surprised.png' }`.
- We use `fs.readdirSync` to list files in the images directory. We filter to `.png` files (assuming all images are PNG; you can extend this to `.jpg` or others if needed).
- For each file, we derive a key name:

  - We remove the file extension `.png`.
  - If the file name contains an underscore `_`, we assume the part after the last underscore is the expression (this handles names like `avatar_happy.png` or `char1_surprised.png` where the avatar’s base name is a prefix). For example, `"avatar_happy.png".split('_').pop()` yields `"happy"`.
  - If there’s no underscore, we just take the whole name (e.g., `"sad"` from `sad.png`).
  - **Note:** This is a simple inference. It requires your file names to be well-formed. Common pitfalls include spaces or special characters in filenames, which we should avoid (e.g., use `angry_face.png` rather than `angry face.png`).

- We then store the mapping of expression name to the file’s URL path (which is `/images/<filename>` because that’s how it will be accessed via our static server).
- We pick a `currentExpression` as a default. Here, we check if there is a “neutral” expression image and use that; otherwise, just take the first one from the list. This ensures `currentExpression` is never null when we start (assuming there is at least one image).

At this point, the server “knows” what expressions are available and which one is currently active. But how do we let the client (the OBS browser page) know which image to display? We’ll tackle that in the HTML section. First, let’s cover the MCP tool so the AI can change the expression.

### 3. Defining the MCP Tool (Allowing the AI to Change Expressions)

The **Model Context Protocol (MCP)** is a standardized way to expose functions (tools) and data (resources) from a server to an AI assistant. In our case, we want to expose a tool that changes the avatar’s expression. We’ll call this tool something like `"setAvatarExpression"`.

There are two ways to implement an MCP tool in our server:

- **Using the official MCP TypeScript SDK:** This is a library that handles MCP communication for us. We define tools with it, and it takes care of interfacing with the LLM (via Claude, etc.).
- **Custom implementation (manual HTTP endpoint):** Alternatively, we could create a custom API route (like a POST request) and have the AI call it. However, since MCP is our focus (and presumably the AI we’re using supports MCP calls out-of-the-box), we’ll demonstrate using the SDK for clarity and ease.

Assuming we installed `@modelcontextprotocol/sdk`, here’s how we can set up the MCP server and tool in our code:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

// Initialize MCP server instance
const mcpServer = new McpServer({
  name: "AvatarController",
  version: "1.0.0",
})

// Define a tool that the AI can call to change the avatar expression
mcpServer.tool(
  "setAvatarExpression", // tool name the AI will use
  { expression: z.string() }, // expected parameters (here, an "expression" string)
  async ({ expression }) => {
    // tool implementation
    if (!expressionImages[expression]) {
      // If the expression is not recognized, return an error message
      return { content: [{ type: "text", text: `Expression "${expression}" not found.` }] }
    }
    currentExpression = expression // update the current expression
    console.log(`🤖 MCP Tool called: switching expression to "${expression}"`)
    // You can add any side effects here (logging, etc.). The front-end will update on its next poll.
    return { content: [{ type: "text", text: `Avatar expression set to "${expression}"` }] }
  }
)

// Connect the MCP server (using standard I/O transport for Claude Desktop or similar hosts)
const transport = new StdioServerTransport()
await mcpServer.connect(transport)
console.log("✅ MCP server is ready and waiting for AI tool calls...")
```

Let’s unpack this:

- We import `McpServer` and `StdioServerTransport` from the MCP SDK. `McpServer` is our server instance that will hold tools/resources, and `StdioServerTransport` is one way of communicating (Claude Desktop uses STDIO to communicate with local tools by spawning the process, for instance).
- We also import `z` from Zod, a schema validation library. The MCP SDK uses Zod schemas to define the shape of tool parameters. In this case, we expect a single parameter `expression` which should be a string, so we use `z.string()` to enforce that.
- We create `mcpServer` with a name and version. Name can be anything descriptive (here "AvatarController").
- We define a tool using `mcpServer.tool(toolName, paramsSchema, implementation)`. The tool name `"setAvatarExpression"` is what the AI will see and call. The params schema is `{ expression: z.string() }`, meaning the tool expects one argument named "expression" of type string. The implementation is an async function that receives the parameters (we destructure `{ expression }`).
- Inside the tool implementation:

  - We first check if the given expression name exists in our `expressionImages` map (meaning we have an image for it). If not, we return a message content saying it’s not found. In MCP, a tool returns a result that can include `content` (which is like a response the AI will see). Here we return a simple text message. _This message will be visible to the AI but not necessarily needed by us; it’s mainly to inform the AI if the call succeeded or failed._
  - If the expression is valid, we set `currentExpression` to that value. This is the key state change that will cause the avatar image to update on the next refresh.
  - We log a message to the console (helpful for debugging, as we can see in our server logs when the AI calls the tool and what expression was set).
  - We return a success message content. (The content isn’t used by our server further, but the AI might use it or simply acknowledge it.)

- Finally, we connect the MCP server using a transport. Here we use `StdioServerTransport`, which means the server will listen for MCP calls via its standard input/output. When you run this server normally, this line essentially waits for an MCP host to connect (like Claude Desktop). If you started the server via Claude Desktop’s config, Claude would spawn the process and communicate. If you run it manually, it will just sit waiting (which is fine; it doesn’t block the Express part from running). **Important:** Because we’re awaiting `mcpServer.connect(transport)`, this code should ideally be in an `async` function or top-level in an ES module environment that supports top-level await. In Node, using `"type": "module"` in package.json allows top-level await. Alternatively, you can manage the promise with `.then()`.

Now our server is capable of receiving a tool call from the AI and updating the `currentExpression`. However, at this moment, the avatar on OBS won’t change until the front-end (the browser page) knows about this new `currentExpression`. We need a way for the client to get the latest expression and update the image. We’ll handle that next.

### 4. The Front-End: Avatar HTML Page and Live Update Script

The front-end is the content served to OBS’s Browser Source. This is a simple HTML page (stored as `public/index.html`). Its job is to display the current avatar image and update it whenever `currentExpression` changes on the server.

A straightforward approach is to have the page poll the server periodically (e.g. once per second) to ask “what is the current expression image?”. When it gets a response, it updates the `<img>` tag `src` to that image. This polling is easy to implement and sufficient for something low-frequency like facial expression changes (which don’t need millisecond precision). For more real-time updates, one could use WebSockets or Server-Sent Events, but we’ll stick to polling for simplicity.

Here’s a possible `index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Avatar Display</title>
    <style>
      /* Make background transparent (if OBS didn't already). 
       This ensures the page itself doesn’t have a solid color background. */
      body {
        background-color: rgba(0, 0, 0, 0);
        margin: 0;
        text-align: center;
      }
      /* Center the avatar image */
      #avatar {
        max-width: 100%;
        max-height: 100%;
      }
    </style>
  </head>
  <body>
    <!-- The image element that shows the avatar -->
    <img id="avatar" src="images/neutral.png" alt="Avatar" />
    <!-- If neutral.png exists it will show initially; otherwise it might 404 until we update it. 
       We will update this src soon via script. -->

    <script>
      // Function to fetch current expression from server and update the image
      async function updateAvatarImage() {
        try {
          const res = await fetch("/api/current-expression")
          if (!res.ok) {
            console.error("Failed to fetch current expression:", res.status)
            return
          }
          const data = await res.json()
          const imgEl = document.getElementById("avatar")
          if (data.image) {
            // Update the image source. Append a timestamp to bust cache.
            imgEl.src = data.image + "?v=" + Date.now()
          }
        } catch (err) {
          console.error("Error fetching current expression:", err)
        }
      }

      // Poll the server every 1000ms (1 second)
      setInterval(updateAvatarImage, 1000)
    </script>
  </body>
</html>
```

Key points about this HTML/JS:

- We set the `body` background to transparent. OBS by default does this as well via its custom CSS, but we include it to be explicit. This way, if your PNG images have transparent regions, those will be see-through in OBS (so your game or other video sources show behind the avatar).
- The `img#avatar` initially is set to `images/neutral.png` (assuming a neutral expression image exists). You can set it to whatever default expression you chose in the server (`currentExpression`). It’s just a starting point.
- We include a script that defines `updateAvatarImage()` which does a fetch to `/api/current-expression` (an endpoint we’ll implement next) and expects a JSON response like `{ image: "/images/happy.png" }`. If it gets that, it sets the image’s `src` attribute to that path. We add `?v=` with a timestamp (`Date.now()`) to the URL – this is a trick to avoid browser caching. It makes the URL unique each time by adding a query param, so the browser (and OBS’s browser source) will always fetch a fresh copy of the image instead of potentially using a cached one. This is important because OBS’s browser source can be quite aggressive in caching content and might not always detect the image has changed on disk.
- We use `setInterval(updateAvatarImage, 1000)` to call this function every second. You can adjust the interval – even 500ms (0.5s) could be okay if you want faster updates, but 1 second is usually fine for expressions. Polling is not super efficient, but for a lightweight app with one small request per second it’s negligible on modern systems.
- The endpoint `/api/current-expression` needs to be created on the server side to respond with the current image path. We’ll add that next in our Express code.

### 5. Adding an API Endpoint for Current Expression

To complement the front-end script, we define an API route in Express that returns the current expression’s image path in JSON format. This allows the front-end to query the current state.

Add this to the Express server setup (somewhere after we set up `currentExpression` variable):

```ts
// API route to get the current expression image
app.get("/api/current-expression", (req, res) => {
  if (!currentExpression) {
    return res.status(500).json({ error: "No expression set" })
  }
  // Send back the image URL corresponding to the current expression
  res.json({
    expression: currentExpression,
    image: expressionImages[currentExpression],
  })
})
```

This is straightforward: when a GET request comes to `/api/current-expression`, we respond with JSON containing the current expression name and the image URL for it. The front-end only uses the `image` field, but we also send `expression` in case it’s useful (e.g., one could display the name or use it for something else in the future).

Now, our earlier polling code on the front-end will hit this endpoint and get the latest image path.

### 6. (Optional) Manual Testing Endpoint

If you want to manually test changing the avatar without using the LLM (for example, to ensure everything works before hooking up the AI, or if you just want a quick way to change expressions yourself), you can add a simple endpoint to set the expression via a query parameter. This isn’t needed in production (since the AI will use MCP), but it’s a handy debug feature.

For instance:

```ts
// Debug route: manually set the expression via URL (e.g. /api/set-expression?name=happy)
app.get("/api/set-expression", (req, res) => {
  const name = req.query.name as string
  if (!name || !expressionImages[name]) {
    return res.status(400).send("Unknown or missing expression name")
  }
  currentExpression = name
  console.log(`🔧 Manual set-expression called, now: ${name}`)
  res.send(`Expression changed to "${name}"`)
})
```

Now if you go to `http://localhost:3000/api/set-expression?name=happy` in a browser, the server will set the current expression to “happy”, and you should see the avatar update in OBS on the next poll (within a second). This confirms that the end-to-end update mechanism works. Remember, this bypasses the AI; it’s just for our testing. (You can remove this route or leave it disabled when not needed.)

### Putting It All Together

All the code pieces we discussed (server setup, image loading, MCP tool, API routes) would typically reside in `src/index.ts` (or you could organize them into modules if the project grows). But for clarity, here’s a _condensed summary_ of what the final combined code might look like (omitting some comments for brevity):

```ts
import express from "express"
import path from "path"
import fs from "fs"
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js"
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js"
import { z } from "zod"

const app = express()
const PORT = 3000

// Serve static files from public folder
app.use(express.static(path.join(__dirname, "..", "public")))

// Load avatar expression images
interface ExpressionMap {
  [key: string]: string
}
const expressionImages: ExpressionMap = {}
let currentExpression: string | null = null
const files = fs.readdirSync(path.join(__dirname, "..", "public", "images"))
for (const file of files) {
  if (file.endsWith(".png")) {
    const base = file.replace(".png", "")
    const exprName = base.includes("_") ? base.split("_").pop()! : base
    expressionImages[exprName] = `/images/${file}`
  }
}
currentExpression = expressionImages["neutral"]
  ? "neutral"
  : Object.keys(expressionImages)[0] || null
console.log("Loaded expressions:", Object.keys(expressionImages))
console.log("Starting expression:", currentExpression)

// Define MCP tool for expression change
const mcpServer = new McpServer({ name: "AvatarController", version: "1.0.0" })
mcpServer.tool("setAvatarExpression", { expression: z.string() }, async ({ expression }) => {
  if (!expressionImages[expression]) {
    return { content: [{ type: "text", text: `Expression "${expression}" not found` }] }
  }
  currentExpression = expression
  console.log(`MCP: setAvatarExpression -> ${expression}`)
  return { content: [{ type: "text", text: `Expression set to "${expression}"` }] }
})
const transport = new StdioServerTransport()
mcpServer.connect(transport).then(() => {
  console.log("MCP server connected (ready for AI commands)")
})

// API route to get current expression
app.get("/api/current-expression", (req, res) => {
  if (!currentExpression) return res.status(500).json({ error: "No expression set" })
  res.json({ expression: currentExpression, image: expressionImages[currentExpression] })
})

// (Optional) Manual set route for testing
app.get("/api/set-expression", (req, res) => {
  const name = req.query.name as string
  if (!name || !expressionImages[name]) return res.status(400).send("Unknown expression")
  currentExpression = name
  console.log(`Manual set-expression -> ${name}`)
  res.send(`Expression changed to "${name}"`)
})

// Start the server
app.listen(PORT, () => {
  console.log(`Express server running at http://localhost:${PORT}`)
})
```

This code is ready to go. When run, it initializes everything and listens on port 3000. It will handle both the web content and the MCP tool calls.

## Using the System with an LLM (Example)

Now that the server and OBS are set up, how do we actually get the AI to change the avatar’s expression? That depends on your AI platform, but here’s a general idea using Claude as an example:

- Make sure Claude (or your chosen LLM) is aware of the MCP tool. If using Claude Desktop and you added it to `mcpServers` config as shown earlier, when you start a conversation, Claude should list “AvatarController” or the tool `setAvatarExpression` as available. You might see a message like “Tools available: setAvatarExpression”.
- You can then prompt the AI to use it. For instance, you might say in chat: _“Whenever you tell a joke, change the avatar to a laughing expression using the tool.”_ or directly _“Please make the avatar happy.”_ The AI should then invoke the tool: it will effectively call `setAvatarExpression` with `"happy"`.
- On your server console, you’ll see the log `MCP: setAvatarExpression -> happy`. That indicates the call came through.
- Within up to 1 second, the OBS browser source (avatar page) polls and gets the new current expression (`happy` -> image path). The image `<img>` swaps to `happy.png`. On your OBS scene, you’ll now see the happy avatar. 🎉

From the AI’s perspective, it got a confirmation and knows the tool call succeeded (because we returned a message). From the viewer’s perspective (or yours if you’re testing), the avatar on stream changed expressions as commanded by the AI. This can be a powerful way to give an AI assistant a visual presence or reactions on stream.

**Tip:** You can also have the AI enumerate or know what expressions are available. Right now, it might only know if you told it or if it guessed (if not explicitly instructed, an AI might try to call expressions that don’t exist). To help, you could either document it in the prompt (e.g., “Available expressions: happy, sad, neutral, surprised”) or provide an MCP _resource_ or _tool_ to list expressions. For example, an MCP _resource_ could be `listExpressions` that returns the list of keys from `expressionImages`. Implementing that would be similar to the tool, but returning data. This way the AI can query what expressions are possible. This is an **optional enhancement**.

## Common Pitfalls and Troubleshooting

When working with OBS, web content, and AI tools, you may encounter a few common issues. Here’s a list of pitfalls and how to address them:

- **OBS Browser Source Caching:** OBS’s browser source might cache your files (HTML, JS, images) aggressively. If you change an image file but reuse the same filename, OBS might keep showing the old cached version. To deal with this:

  - We used the `?v=timestamp` trick to bust the cache for images in our code. Make sure to do something similar for any content that can change.
  - During development, you can use the **“Refresh cache of current page”** option in the Browser Source properties (right-click your Browser Source in OBS -> _Refresh cache_). But that’s manual; better to design your page to avoid needing it.
  - In OBS settings, there isn’t a global “disable cache” (as of now), so coding around it or changing filenames (e.g., serve `happy1.png`, `happy2.png` if updated) are ways to ensure new content shows.

- **File Naming and Paths:** As mentioned, ensure your image filenames are simple (lowercase, no spaces, no special chars) to avoid issues. If your code expects a certain naming pattern (like `avatar_expression.png`), stick to it or adjust the code. Also remember that on some operating systems (e.g., Linux), file paths are case-sensitive. So `Happy.png` and `happy.png` would be different. It’s best to keep everything lowercase to avoid confusion.
- **Server Not Starting / Port Issues:** If you run `npm start` and nothing happens or you get an error like “EADDRINUSE”, it means something (maybe another instance of your server or another app) is already using that port. You can change the `PORT` in the code to another number (e.g., 3001) and try again, or stop the other process. Also check that you ran `npm install` and built the project, so that all imports (like express, the MCP SDK) are resolved.
- **TypeScript Issues:** If you see errors about types or cannot find module, ensure you installed the types (`@types/express` etc.) and that your `tsconfig.json` is properly configured (common settings: `"target": "ES2020"` or later, and `"moduleResolution": "node"`). Also, when importing JSON or non-TS files, you might need to enable `resolveJsonModule` or include a declaration. In our guide we avoided that complexity.
- **MCP Connection Problems:** If the AI isn’t calling the tool or doesn’t see it:

  - Make sure the MCP server started (the console log `MCP server connected` should appear). If you forgot to `await mcpServer.connect()` or similar, it might not actually be listening.
  - If using Claude Desktop, double-check the config JSON. Claude should list the tool in the conversation. If not, try restarting Claude Desktop after adding the config.
  - If using a different host or an HTTP transport, ensure the host knows the URL/port of the MCP server. The MCP spec supports HTTP, but configuration might differ.

- **OBS Not Showing Anything:** If the browser source in OBS is blank:

  - Check the URL in the source properties. It should be exactly your local address with the correct port (e.g., `http://localhost:3000`). Copy-paste it into a regular web browser to see if it loads the avatar page.
  - If it doesn’t load in a normal browser, the server might not be running or might have crashed (check the terminal for errors). If it does load in a normal browser but not in OBS, it could be a firewall issue (OBS may be blocked from network access, though localhost usually isn’t) or an issue with OBS’s browser. You can try enabling “Use custom frame rate” or toggling other settings as a sanity check.
  - On some systems, `localhost` might not resolve inside OBS if OBS is running as a different user or sandbox. You could try using `127.0.0.1` instead of localhost in the URL.

- **Delayed Updates:** If you notice the avatar expression takes longer than expected to update:

  - Remember we set 1 second polling. So it can take up to 1 second to change after the AI calls the tool. You can reduce the interval in `setInterval` (e.g., to 500ms) for snappier response. It should still be quite light-weight.
  - Ensure the AI actually called the tool when you expected. Check the server log for the `MCP: setAvatarExpression` message. If it’s not there, the AI might not have executed the tool. You may need to adjust your AI prompt or instructions to get it to use the tool.

By keeping these points in mind, you can resolve most issues that come up. Now, let’s consider how we can further improve this project beyond the basics.

## Possible Improvements and Next Steps

Congratulations on getting a working avatar expression controller! There are many ways you could extend or refine this project. Here are some ideas:

- **Use Metadata for Expressions:** Right now, we infer the expression name from the filename. This works, but it limits us to using the filename as the description. We could introduce a metadata file or structure (e.g., a JSON file or a database) that lists each expression, the image file, and maybe a descriptive text. For example, a `expressions.json` could map `{ "happy": { "file": "happy.png", "description": "Smiling with eyes open" }, ... }`. This would allow you to provide the AI with richer information about each expression (beyond just the name). The AI could then choose more appropriately or even explain the expression if needed. You could load this JSON in place of scanning the directory, and use it to populate `expressionImages` and perhaps another map of descriptions. This is more content to manage, but it makes the system more robust and easier to extend (you wouldn’t need specific file name patterns; the metadata defines the mapping).
- **List Available Expressions to the AI:** In addition to the tool to set the expression, you could add an MCP **resource** that provides the list of expressions (or even an explanation of each). MCP resources are like read-only endpoints the AI can query. For example, a resource named `"expressions"` could return a text or JSON listing “happy, sad, surprised, neutral”. The AI can call that to decide what’s available. This prevents the AI from guessing an expression name that doesn’t exist.
- **Better Front-end Updates (Real-time):** Polling every second is simple, but if you want instantaneous changes, implementing a WebSocket or Server-Sent Events (SSE) could be an improvement. With a WebSocket, the server would send a message to the client as soon as `currentExpression` changes (when the tool is called). The client would then update the image immediately without polling. This requires a bit more code (setting up a WebSocket server and client), but it’s a great learning step if you want to try. OBS’s browser source can handle WebSockets (since it’s just a browser under the hood). If going this route, ensure to still handle the case of reconnect or page refresh to get the current state (maybe use the API as fallback).
- **Error Handling and Logging:** For production or more complex uses, you’d want to add more robust error handling. For instance, if the server can’t find images, or if the MCP connection fails, log those clearly or even show an indicator on the OBS page (like an “X” or a message if something is wrong). Logging, as we did with `console.log`, is useful to trace what’s happening during a live session.
- **Multiple Avatars or Scenes:** If you plan to have more than one avatar or scene, you could extend the tool to specify which avatar or have multiple tools. For example, if two characters are on screen, you might have `setAvatarExpression(character, expression)` with two parameters. That increases complexity but is doable with the same principles (just maintain state for each avatar and have the front-end identify which one it is).
- **UI Controls:** Besides AI control, you could add your own control panel (another webpage or an OBS dock) to change expressions. This could simply call the same endpoint or MCP tool. For example, a local webpage with buttons for “happy”, “sad”, etc., that internally hits the `/api/set-expression` route. This might be useful for manual override or if you want to control it during a stream without AI intervention sometimes.

Each of these enhancements can add complexity, so implement them as you feel comfortable. Even without these, you have a functional system.

## Conclusion

In this guide, we revised and expanded the project overview for an OBS browser source powered by an Express + TypeScript server, controlling an avatar’s expressions via MCP. We covered everything from setting up the project environment to explaining how the AI, server, and OBS interact.

To recap, you learned how to:

- Set up a Node.js Express server and serve static files for OBS.
- Manage a set of avatar expression images and maintain the current state.
- Create an MCP tool (`setAvatarExpression`) that an AI can call to change the avatar’s expression.
- Build a simple front-end page that OBS can load to display the avatar and update it dynamically with JavaScript.
- Integrate the system with OBS Studio through a Browser Source and troubleshoot common issues like caching.
- Improve the project with ideas like metadata-driven design and real-time communications.
