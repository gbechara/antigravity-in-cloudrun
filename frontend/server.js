/**
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

const { createServer } = require("http");
const { parse } = require("url");
const next = require("next");
const { WebSocketServer } = require("ws");
const pty = require("node-pty");

const dev = process.env.NODE_ENV !== "production";
const app = next({ dev });
const handle = app.getRequestHandler();
const port = process.env.PORT || 3000;

app.prepare().then(() => {
  const server = createServer((req, res) => {
    const forwardedHost = req.headers["x-forwarded-host"] || req.headers.host;
    const proto = req.headers["x-forwarded-proto"] || (req.socket.encrypted ? "https" : "http");
    if (forwardedHost) {
      process.env.NEXTAUTH_URL = `${proto}://${forwardedHost}`;
    }
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Attach WebSocket server for interactive Linux terminal
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const { pathname } = parse(req.url);

    if (pathname === "/ws/terminal") {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit("connection", ws, req);
      });
    } else {
      socket.destroy();
    }
  });

  wss.on("connection", (ws) => {
    console.log("[PTY] New client connected to Linux Web Terminal.");
    const defaultCwd = process.env.WORKSPACE_DIR || "/workspace";

    // Spawn bash session under current container user
    const ptyProcess = pty.spawn(process.env.SHELL || "/bin/bash", [], {
      name: "xterm-256color",
      cols: 90,
      rows: 28,
      cwd: defaultCwd,
      env: {
        ...process.env,
        TERM: "xterm-256color",
      },
    });

    // PTY stdout -> WebSocket
    ptyProcess.onData((data) => {
      if (ws.readyState === ws.OPEN) {
        ws.send(data);
      }
    });

    // WebSocket stdin -> PTY
    ws.on("message", (message) => {
      try {
        const parsed = JSON.parse(message);
        if (parsed.type === "resize") {
          ptyProcess.resize(parsed.cols, parsed.rows);
          return;
        }
      } catch (e) {
        // Raw keyboard input
      }
      ptyProcess.write(message.toString());
    });

    ws.on("close", () => {
      console.log("[PTY] Session terminated. Killing pty process.");
      ptyProcess.kill();
    });
  });

  server.listen(port, () => {
    console.log(`> Antigravity Next.js Console ready on http://localhost:${port}`);
  });
});
