const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ noServer: true });

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const piSockets = new Map();

// === File Paths ===
const itemsFilePath = path.join(__dirname, 'items.json');
const usersFilePath = path.join(__dirname, 'users.json');

let items = [];
if (fs.existsSync(itemsFilePath)) {
  items = JSON.parse(fs.readFileSync(itemsFilePath, 'utf8'));
}

let users = {};
if (fs.existsSync(usersFilePath)) {
  users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
}

let latestSensorData = {};
let latestStreamFrame = null;

// === Routes ===

app.get('/items', (req, res) => {
  res.json(items);
});

app.patch('/items/:name', (req, res) => {
  const { name } = req.params;
  const { delta } = req.body;
  const item = items.find(i => i.name === name);

  if (!item) return res.status(404).json({ error: 'Item not found' });

  item.stock += delta;
  if (item.stock < 0) item.stock = 0;

  fs.writeFileSync(itemsFilePath, JSON.stringify(items, null, 2));
  res.json({ success: true, items });
});

app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    res.json({ success: true, message: `Welcome, ${username}!` });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

app.get('/api/sensor-data', (req, res) => {
  res.json(latestSensorData);
});

app.post('/api/send-command', (req, res) => {
  const command = req.body;
  const piId = "sensor-pi-1";
  const socket = piSockets.get(piId);

  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'actuator', data: command }));
    console.log("📤 Sent actuator command to Pi:", command);
    return res.json({ success: true });
  }
  return res.status(500).json({ error: "❌ Pi not connected" });
});

app.post('/api/mode', (req, res) => {
  const { type, mode, threshold, piId } = req.body;
  if (type !== 'mode' || !piId) {
    return res.status(400).json({ error: 'Missing or invalid request payload' });
  }

  const socket = piSockets.get(piId);
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: 'mode', mode, threshold }));
    console.log(`📤 Sent mode update to ${piId}:`, { mode, threshold });
    return res.json({ success: true, mode, threshold });
  }
  return res.status(500).json({ error: `❌ Pi ${piId} not connected` });
});

app.get('/video_feed', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-cache',
    'Connection': 'close',
    'Pragma': 'no-cache',
  });

  const interval = setInterval(() => {
    if (latestStreamFrame) {
      res.write(`--frame\r\n`);
      res.write(`Content-Type: image/jpeg\r\n\r\n`);
      res.write(latestStreamFrame);
      res.write(`\r\n`);
    }
  }, 8);

  req.on('close', () => {
    clearInterval(interval);
  });
});

// === Handle Upgrade Manually for Multiple WS Paths ===
server.on('upgrade', (req, socket, head) => {
  const { url } = req;
  if (url === '/ws/sensor' || url === '/ws/camera') {
    wss.handleUpgrade(req, socket, head, (ws) => {
      ws.pathname = url;
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

// === Unified WebSocket Handler ===
wss.on('connection', (ws, req) => {
  const ip = req.socket.remoteAddress;
  console.log(`🔌 WebSocket connection from ${ip} to ${ws.pathname}`);

  if (ws.pathname === '/ws/sensor') {
    const piId = 'sensor-pi-1';
    piSockets.set(piId, ws);
    
    ws.on('message', (message) => {
      try {
        const raw = Buffer.isBuffer(message) ? message.toString() : message;
        const parsed = JSON.parse(raw);

        if (parsed.type === "sensor" && parsed.data) {
          latestSensorData = parsed.data;
          fs.writeFileSync('sensor_data.json', JSON.stringify(parsed.data, null, 2));
          console.log("📩 Sensor Data:", parsed.data);
        } else {
          console.log("⚠️ Unknown sensor payload:", parsed);
        }
      } catch (err) {
        console.error("❌ Sensor JSON parse error:", err);
      }
    });

    ws.on('close', () => {
      console.log("❌ Sensor Pi disconnected");
      piSockets.delete(piId);
    });
  }

  else if (ws.pathname === '/ws/camera') {
    ws.on('message', (message) => {
      if (Buffer.isBuffer(message)) {
        latestStreamFrame = message;
      } else {
        console.log("⚠️ Non-buffer camera data:", message.toString());
      }
    });

    ws.on('close', () => {
      console.log("❌ Camera Pi disconnected");
      latestStreamFrame = null;
    });
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
