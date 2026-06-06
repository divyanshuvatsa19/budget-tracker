import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

// Helper to ensure directory exists
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

// Default initial state for a clean first-time run
const getInitialData = () => {
  return {
    transactions: [],
    budgets: []
  };
};

class JSONDatabase {
  constructor() {
    this.data = null;
    this.lock = false;
  }

  async init() {
    await ensureDir(DATA_DIR);
    try {
      const content = await fs.readFile(DB_FILE, 'utf-8');
      this.data = JSON.parse(content);
    } catch (error) {
      // If file doesn't exist or is corrupted, initialize with default data
      this.data = getInitialData();
      await this.save();
    }
  }

  async save() {
    // Basic atomic write mechanism
    const tempFile = `${DB_FILE}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(this.data, null, 2), 'utf-8');
    await fs.rename(tempFile, DB_FILE);
  }

  async getTransactions() {
    if (!this.data) await this.init();
    return this.data.transactions;
  }

  async addTransaction(transaction) {
    if (!this.data) await this.init();
    const newTx = {
      id: Math.random().toString(36).substring(2, 9),
      description: transaction.description || 'Untitled',
      amount: parseFloat(transaction.amount) || 0,
      type: transaction.type === 'income' ? 'income' : 'expense',
      category: transaction.category || 'Other',
      date: transaction.date || new Date().toISOString().split('T')[0],
      notes: transaction.notes || ''
    };
    this.data.transactions.unshift(newTx); // Insert at beginning (newest first)
    await this.save();
    return newTx;
  }

  async updateTransaction(id, updatedFields) {
    if (!this.data) await this.init();
    const idx = this.data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return null;

    this.data.transactions[idx] = {
      ...this.data.transactions[idx],
      description: updatedFields.description ?? this.data.transactions[idx].description,
      amount: updatedFields.amount !== undefined ? parseFloat(updatedFields.amount) : this.data.transactions[idx].amount,
      type: updatedFields.type ?? this.data.transactions[idx].type,
      category: updatedFields.category ?? this.data.transactions[idx].category,
      date: updatedFields.date ?? this.data.transactions[idx].date,
      notes: updatedFields.notes ?? this.data.transactions[idx].notes
    };
    await this.save();
    return this.data.transactions[idx];
  }

  async deleteTransaction(id) {
    if (!this.data) await this.init();
    const idx = this.data.transactions.findIndex(t => t.id === id);
    if (idx === -1) return false;

    this.data.transactions.splice(idx, 1);
    await this.save();
    return true;
  }

  async getBudgets() {
    if (!this.data) await this.init();
    return this.data.budgets;
  }

  async setBudget(category, limitAmount) {
    if (!this.data) await this.init();
    const idx = this.data.budgets.findIndex(b => b.category.toLowerCase() === category.toLowerCase());
    const parsedLimit = parseFloat(limitAmount);
    
    if (idx !== -1) {
      if (parsedLimit <= 0) {
        // Remove budget if set to 0 or negative
        this.data.budgets.splice(idx, 1);
      } else {
        this.data.budgets[idx].limit_amount = parsedLimit;
      }
    } else if (parsedLimit > 0) {
      this.data.budgets.push({
        category,
        limit_amount: parsedLimit,
        period: 'monthly'
      });
    }
    await this.save();
    return this.data.budgets;
  }

  async getSummary() {
    if (!this.data) await this.init();
    const txs = this.data.transactions;
    const budgets = this.data.budgets;

    let totalIncome = 0;
    let totalExpenses = 0;
    const categoryTotals = {};

    txs.forEach(t => {
      const amt = t.amount;
      if (t.type === 'income') {
        totalIncome += amt;
      } else {
        totalExpenses += amt;
        categoryTotals[t.category] = (categoryTotals[t.category] || 0) + amt;
      }
    });

    const netBalance = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;

    // Compile category summaries including budget info
    const categoriesSummary = Object.keys(categoryTotals).map(cat => {
      const budget = budgets.find(b => b.category.toLowerCase() === cat.toLowerCase());
      return {
        category: cat,
        spent: categoryTotals[cat],
        budget: budget ? budget.limit_amount : 0
      };
    });

    // Add budgets that haven't had any expenses yet
    budgets.forEach(b => {
      if (!categoryTotals[b.category]) {
        categoriesSummary.push({
          category: b.category,
          spent: 0,
          budget: b.limit_amount
        });
      }
    });

    return {
      totalIncome,
      totalExpenses,
      netBalance,
      savingsRate: Math.max(0, parseFloat(savingsRate.toFixed(1))),
      categoriesSummary
    };
  }
}

export const db = new JSONDatabase();
