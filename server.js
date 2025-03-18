const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const itemsFilePath = path.join(__dirname, 'items.json');

// Load existing inventory data from file
let items = [];
if (fs.existsSync(itemsFilePath)) {
  items = JSON.parse(fs.readFileSync(itemsFilePath, 'utf8'));
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

// === 3) Start the server ===
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
