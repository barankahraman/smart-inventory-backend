require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB'))
  .catch(err => console.error('MongoDB connection error:', err));

// Define Item Schema & Model
const itemSchema = new mongoose.Schema({
  name: String,
  stock: Number,
});

const Item = mongoose.model('Item', itemSchema);

// Endpoint to get all items
app.get('/items', async (req, res) => {
  try {
    const items = await Item.find();
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching items' });
  }
});

// Endpoint to update inventory stock
app.patch('/items/:name', async (req, res) => {
  const { name } = req.params;
  const { delta } = req.body;

  try {
    const item = await Item.findOne({ name });
    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    item.stock += delta;
    if (item.stock < 0) item.stock = 0; // Prevent negative stock

    await item.save();
    res.json({ success: true, item });
  } catch (error) {
    res.status(500).json({ error: 'Error updating stock' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
