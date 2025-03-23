const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const http = require('http');
const WebSocket = require('ws');

const app = express();
const server = http.createServer(app); // ⬅️ Needed for WebSocket
const wss = new WebSocket.Server({ server, path: '/ws/pi' }); // Pi will connect here

const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// ==== Inventory System ====
const itemsFilePath = path.join(__dirname, 'items.json');
const usersFilePath = path.join(__dirname, 'users.json');

// Load existing inventory data
let items = [];
if (fs.existsSync(itemsFilePath)) {
  items = JSON.parse(fs.readFileSync(itemsFilePath, 'utf8'));
}

// Load users
let users = {};
if (fs.existsSync(usersFilePath)) {
  users = JSON.parse(fs.readFileSync(usersFilePath, 'utf8'));
}

// === 1) Get all inventory items ===
app.get('/items', (req, res) => {
  res.json(items);
});

// === 2) Update inventory stock ===
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

// === 3) Login ===
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    res.json({ success: true, message: `Welcome, ${username}!` });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// === 4) API to get latest sensor data ===
let latestSensorData = {}; // Store the most recent data
app.get('/api/sensor-data', (req, res) => {
  res.json(latestSensorData);
});

// === 5) WebSocket for Raspberry Pi ===
wss.on('connection', (ws) => {
  console.log('✅ Raspberry Pi connected via WebSocket');

  ws.on('message', (message) => {
    try {
      const parsed = JSON.parse(message);
      console.log('📩 Received Sensor Data:', parsed);
      latestSensorData = parsed;

      // Save to sensor_data.json
      fs.writeFileSync('sensor_data.json', JSON.stringify(latestSensorData, null, 2));
      console.log('💾 Data written to sensor_data.json');

    } catch (err) {
      console.error('❌ Error parsing sensor data:', err);
    }
  });

  ws.on('close', () => {
    console.log('❌ Raspberry Pi disconnected');
  });
});

// === 6) Start the HTTP + WebSocket Server ===
server.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
