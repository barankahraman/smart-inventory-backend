const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);

const sensorWSS = new WebSocket.Server({ server, path: '/ws/sensor' });
const cameraWSS = new WebSocket.Server({ server, path: '/ws/camera' });

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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

// Get all items
app.get('/items', (req, res) => {
  res.json(items);
});

// Update item stock
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

// Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    res.json({ success: true, message: `Welcome, ${username}!` });
  } else {
    res.status(401).json({ success: false, message: 'Invalid credentials' });
  }
});

// Get latest sensor data
app.get('/api/sensor-data', (req, res) => {
  res.json(latestSensorData);
});

// === WebSocket for Raspberry Pi ===

sensorWSS.on('connection', (ws) => {
  console.log("📡 Sensor Pi connected");

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      if (parsed.type === "sensor" && parsed.data) {
        latestSensorData = parsed.data;
        fs.writeFileSync('sensor_data.json', JSON.stringify(parsed.data, null, 2));
        console.log("📩 Sensor Data:", parsed.data);
      }
    } catch (err) {
      console.error("❌ Sensor JSON parse error:", err);
    }
  });

  ws.on('close', () => {
    console.log("❌ Sensor Pi disconnected");
  });
});

cameraWSS.on('connection', (ws) => {
  console.log("📸 Camera Pi connected");

  ws.on('message', (message) => {
    if (Buffer.isBuffer(message)) {
      latestStreamFrame = message;
    }
  });

  ws.on('close', () => {
    console.log("❌ Camera Pi disconnected");
    latestStreamFrame = null;
  });
});

// Frontend gets MJPEG stream here
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

// Start HTTP + WebSocket server
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
