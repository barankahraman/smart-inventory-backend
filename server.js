const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws/pi' });

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
let piSocket = null; // 📡 Save the current Pi socket connection

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

// === Receive Command from Frontend and Send to Pi ===
app.post('/api/send-command', (req, res) => {
  const command = req.body;

  if (piSocket && piSocket.readyState === WebSocket.OPEN) {
    piSocket.send(JSON.stringify(command));
    console.log("📤 Sent command to Pi:", command);
    res.json({ success: true, message: "Command sent to Pi" });
  } else {
    res.status(500).json({ error: "❌ Pi not connected" });
  }
});

app.post('/api/mode', (req, res) => {
  const { type, mode, threshold } = req.body;

  if (type === "mode") {
    if (mode === "manual") {
      currentMode = "manual";
      console.log("🧍 Switched to MANUAL mode");
    } else if (mode === "auto") {
      currentMode = "auto";
      if (typeof threshold === "number") {
        currentThreshold = threshold;
        console.log(`🤖 Switched to AUTO mode with threshold ${threshold}°C`);
      }
    }

    if (piSocket && piSocket.readyState === WebSocket.OPEN) {
      piSocket.send(JSON.stringify({
        type: "mode",
        mode: currentMode,
        threshold: currentMode === "auto" ? currentThreshold : undefined
      }));
    }

    return res.json({ success: true, mode: currentMode, threshold: currentThreshold });
  }

  res.status(400).json({ error: "Invalid request payload" });
});

// === WebSocket for Raspberry Pi ===

let latestStreamFrame = null;

wss.on('connection', (ws, req) => {
  console.log('✅ Raspberry Pi connected via WebSocket');
  piSocket = ws;

  ws.on('message', (message) => {
    // 📸 If binary data, treat as image frame
    if (Buffer.isBuffer(message)) {
      latestStreamFrame = message;
    } else {
      try {
        // 🧠 Assume JSON = sensor data
        const parsed = JSON.parse(message);
        if (parsed.type === "sensor" && parsed.data) {
          latestSensorData = parsed.data;
          fs.writeFileSync('sensor_data.json', JSON.stringify(parsed.data, null, 2));
          console.log('📩 Received Sensor Data:', parsed);
        } else {
          console.log('📨 Received non-sensor message:', parsed);
        }
      } catch (err) {
        console.error('❌ Error parsing message from Pi:', err);
      }
    }
  });

  ws.on('close', () => {
    console.log('❌ Raspberry Pi disconnected');
    piSocket = null;
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
