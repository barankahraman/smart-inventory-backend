const express = require('express');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// Authentication data
const users = JSON.parse(fs.readFileSync('users.json'));

// In-memory items array
let items = [
  { name: 'Laptop', stock: 10 },
  { name: 'Keyboard', stock: 15 },
  { name: 'Mouse', stock: 5 },
];

// === 1) Login route ===
app.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (users[username] && users[username] === password) {
    res.json({ success: true, message: `Welcome, ${username}!` });
  } else {
    res.status(401).json({ success: false, message: 'Invalid username or password' });
  }
});

// === 2) Get all items ===
app.get('/items', (req, res) => {
  res.json(items);
});

// === 3) Update (patch) item stock ===
app.patch('/items/:name', (req, res) => {
  const { name } = req.params;            // e.g. 'Laptop'
  const { delta } = req.body;            // e.g. +1 or -1
  const item = items.find((i) => i.name === name);

  if (!item) {
    return res.status(404).json({ error: 'Item not found' });
  }

  item.stock += delta;
  if (item.stock < 0) {
    item.stock = 0; // prevent negative
  }

  res.json({ success: true, items });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
