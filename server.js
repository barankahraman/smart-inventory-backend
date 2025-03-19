const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const itemsFilePath = path.join(__dirname, 'items.json');
const usersFilePath = path.join(__dirname, 'users.json'); // ✅ Add users.json

// Load existing inventory data from file
let items = [];
if (fs.existsSync(itemsFilePath)) {
  items = JSON.parse(fs.readFileSync(itemsFilePath, 'utf8'));
}

// Load users from file
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
  if (item.stock < 0) item.stock = 0; // Prevent negative stock

  // Save updated inventory back to file
  fs.writeFileSync(itemsFilePath, JSON.stringify(items, null, 2));

  res.json({ success: true, items });
});

// === 3) Login Route ===
app.post('/login', (req, res) => {
  const { username, password } = req.body;

  if (users[username] && users[username] === password) {
    res.json({ success: true, message: `Welcome, ${username}!` });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// === 4) Start the server ===
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
