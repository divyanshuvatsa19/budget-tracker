import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { db } from './database.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Initialize database
await db.init();

// --- API ROUTES ---

// Get summary/statistics
app.get('/api/summary', async (req, res) => {
  try {
    const summary = await db.getSummary();
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Transactions CRUD
app.get('/api/transactions', async (req, res) => {
  try {
    let txs = await db.getTransactions();
    
    // Simple filter by type/category if query params are present
    const { type, category } = req.query;
    if (type) {
      txs = txs.filter(t => t.type === type);
    }
    if (category) {
      txs = txs.filter(t => t.category.toLowerCase() === category.toLowerCase());
    }
    
    res.json(txs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/transactions', async (req, res) => {
  try {
    const { description, amount, type, category, date, notes } = req.body;
    
    if (!description || !amount || !type || !category) {
      return res.status(400).json({ error: 'Description, amount, type, and category are required' });
    }
    
    const newTx = await db.addTransaction({ description, amount, type, category, date, notes });
    res.status(201).json(newTx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedTx = await db.updateTransaction(id, req.body);
    if (!updatedTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json(updatedTx);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteTransaction(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    res.json({ success: true, message: 'Transaction deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Budgets API
app.get('/api/budgets', async (req, res) => {
  try {
    const budgets = await db.getBudgets();
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/budgets', async (req, res) => {
  try {
    const { category, limit_amount } = req.body;
    if (!category || limit_amount === undefined) {
      return res.status(400).json({ error: 'Category and limit_amount are required' });
    }
    
    const budgets = await db.setBudget(category, limit_amount);
    res.json(budgets);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Serve frontend assets in production
const frontendDist = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));

// Fallback to React index.html for SPA routing
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(frontendDist, 'index.html'), (err) => {
    if (err) {
      // If frontend isn't built yet, output a helpful message
      res.status(200).send('Budget Tracker API is running. Build the frontend to view the UI.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
