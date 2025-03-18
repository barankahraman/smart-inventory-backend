const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());

const itemsFilePath = path.join(__dirname, 'items.json');

// Load inventory data safely
let items = [];
try {
  if (fs.existsSync(itemsFilePath)) {
    const fileData = fs.readFileSync(itemsFilePath, 'utf8');
    items = JSON.parse(fileData);
  }
} catch (error) {
  console.error('Error loading items.json:', error);
  items = []; // Default to empty array
}

// Endpoint to get inventory items
app.get('/items', (req, res) => {
  res.json(items);
});

// Endpoint to update inventory stock
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
  try {
    fs.writeFileSync(itemsFilePath, JSON.stringify(items, null, 2));
  } catch (error) {
    console.error('Error writing to items.json:', error);
    return res.status(500).json({ error: 'Failed to save data' });
  }

  res.json({ success: true, items });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
