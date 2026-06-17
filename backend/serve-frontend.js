const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3000;
const PUBLIC_DIR = path.join(__dirname, "../frontend/dist");

const MIME_TYPES = {
  ".html": "text/html",
  ".css": "text/css",
  ".js": "text/javascript",
  ".json": "application/json",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

const server = http.createServer((req, res) => {
  const decodedUrl = decodeURIComponent(req.url);
  let filePath = path.join(PUBLIC_DIR, decodedUrl);
  
  // SPA Fallback: If requesting a route without an extension (like /login or /transfers), serve index.html
  const extname = path.extname(filePath);
  if (!extname) {
    filePath = path.join(PUBLIC_DIR, "index.html");
  }

  const fileExt = path.extname(filePath);
  const contentType = MIME_TYPES[fileExt] || "application/octet-stream";

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === "ENOENT") {
        // Fallback to index.html for SPA client-side routing
        fs.readFile(path.join(PUBLIC_DIR, "index.html"), (fallBackErr, fallbackContent) => {
          if (fallBackErr) {
            res.writeHead(404, { "Content-Type": "text/html" });
            res.end("<h1>404 Not Found (Build output missing - please run npm run build)</h1>", "utf-8");
          } else {
            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(fallbackContent, "utf-8");
          }
        });
      } else {
        res.writeHead(500);
        res.end(`Server Error: ${err.code}`);
      }
    } else {
      res.writeHead(200, { "Content-Type": contentType });
      res.end(content, "utf-8");
    }
  });
});

server.listen(PORT, () => {
  console.log(`✅ SPA Frontend server running at http://localhost:${PORT}/`);
  console.log(`👉 Please ensure you run 'npm run build' inside 'frontend/' folder first.`);
});
