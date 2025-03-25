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

// === File paths ===
const itemsFilePath = path.join(__dirname, 'items.json');
const usersFilePath = path.join(__dirname, 'users.json');

// === Load inventory and users ===
let items = [];
if (fs.existsSync(itemsFilePath)) {
  items = JSON.parse(fs.readFileSync(itemsFilePath, 'utf8'));
}

let users = {};
if (fs.existsSync(usersFilePath)) {
  users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
}

// === Latest sensor data (from Raspberry Pi) ===
let latestSensorData = {};
let latestCommandFromFrontend = {}; // 🆕 New: latest command sent by frontend

// === API Routes ===

// 1) Get all inventory items
app.get('/items', (req, res) => {
  res.json(items);
});

// 2) Update inventory stock
app.patch('/items/:name', (req, res) => {
  const { name } = req.params;
  const { delta } = req.body;

  const item = items.find(i => i.name === name);
  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  item.stock += delta;
  if (item.stock < 0) item.stock = 0;

  fs.writeFileSync(itemsFilePath, JSON.stringify(items, null, 2));
  res.json({ success: true, items });
});

// 3) Login route
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    res.json({ success: true, message: `Welcome, ${username}!` });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// 4) Serve latest sensor data
app.get('/api/sensor-data', (req, res) => {
  res.json(latestSensorData);
});

// 5) Send command to Pi from frontend 🆕
app.post('/api/send-command', (req, res) => {
  latestCommandFromFrontend = req.body;
  console.log('📨 Received command from frontend:', latestCommandFromFrontend);

  // Send to connected Pi via WebSocket
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(JSON.stringify({
        type: 'actuator_command',
        data: latestCommandFromFrontend
      }));
    }
  }

  res.json({ success: true, message: 'Command sent to Raspberry Pi' });
});

// === WebSocket for receiving sensor data from Raspberry Pi ===
wss.on('connection', (ws) => {
  console.log('✅ Raspberry Pi connected via WebSocket');

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);

      // Distinguish incoming message types (optional)
      if (parsed.type === 'sensor_data') {
        latestSensorData = parsed.data;
        console.log('📩 Received Sensor Data:', latestSensorData);

        // Optional: Save to file
        fs.writeFileSync('sensor_data.json', JSON.stringify(latestSensorData, null, 2));
        console.log('💾 Sensor data saved to sensor_data.json');
      } else {
        console.log('📦 Received other message:', parsed);
      }

    } catch (err) {
      console.error('❌ Error parsing message from Pi:', err);
    }
  });

  ws.on('close', () => {
    console.log('❌ Raspberry Pi disconnected');
  });
});

// === Start HTTP + WebSocket server ===
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});

