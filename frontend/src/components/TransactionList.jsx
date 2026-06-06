import React, { useState } from 'react';

const CATEGORIES = ['Food', 'Utilities', 'Transport', 'Entertainment', 'Shopping', 'Salary', 'Freelance', 'Business', 'Investment', 'Other'];

const CATEGORY_COLORS = {
  Food: '#FF5B35',
  Entertainment: '#8b5cf6',
  Utilities: '#06b6d4',
  Transport: '#f59e0b',
  Shopping: '#ec4899',
  Salary: '#10b981',
  Freelance: '#059669',
  Business: '#0d9488',
  Investment: '#2563eb',
  Other: '#6b7280'
};

const CATEGORY_ICONS = {
  Food: '🍔',
  Entertainment: '🎬',
  Utilities: '⚡',
  Transport: '🚗',
  Shopping: '🛍️',
  Salary: '💼',
  Freelance: '💻',
  Business: '📈',
  Investment: '💰',
  Other: '🏷️'
};

export default function TransactionList({ transactions, onEdit, onDelete }) {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // 'all' | 'income' | 'expense'
  const [categoryFilter, setCategoryFilter] = useState('all');

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
  };

  const formatDate = (dateStr) => {
    const d = new Date(dateStr + 'T00:00:00'); // Prevent timezone shifts
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(search.toLowerCase()) || 
                          (t.notes && t.notes.toLowerCase().includes(search.toLowerCase()));
    const matchesType = typeFilter === 'all' || t.type === typeFilter;
    const matchesCategory = categoryFilter === 'all' || t.category === categoryFilter;

    return matchesSearch && matchesType && matchesCategory;
  });

  return (
    <div className="transactions-panel glass-card animate-fade-in">
      <div className="panel-header">
        <h3>Transactions Ledger</h3>
        <span className="tx-count">{filteredTransactions.length} entries shown</span>
      </div>

      {/* Filter and Search Bar */}
      <div className="filters-bar">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search descriptions, notes..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>

        <div className="filters-group">
          {/* Type Filter Pills */}
          <div className="type-pills">
            <button 
              className={`pill ${typeFilter === 'all' ? 'active' : ''}`}
              onClick={() => setTypeFilter('all')}
            >
              All
            </button>
            <button 
              className={`pill pill-income ${typeFilter === 'income' ? 'active' : ''}`}
              onClick={() => setTypeFilter('income')}
            >
              Income
            </button>
            <button 
              className={`pill pill-expense ${typeFilter === 'expense' ? 'active' : ''}`}
              onClick={() => setTypeFilter('expense')}
            >
              Expenses
            </button>
          </div>

          {/* Category Dropdown */}
          <select 
            className="filter-select"
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
          >
            <option value="all">All Categories</option>
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* List Container */}
      <div className="transactions-list">
        {filteredTransactions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📂</div>
            <p>No transactions found matching the filters.</p>
          </div>
        ) : (
          filteredTransactions.map(t => {
            const color = CATEGORY_COLORS[t.category] || CATEGORY_COLORS.Other;
            const icon = CATEGORY_ICONS[t.category] || CATEGORY_ICONS.Other;
            const isIncome = t.type === 'income';

            return (
              <div className="transaction-row" key={t.id}>
                {/* Visual Category Badge */}
                <div className="tx-category-badge" style={{ backgroundColor: `${color}15`, border: `1px solid ${color}30` }}>
                  <span className="tx-badge-icon">{icon}</span>
                </div>

                {/* Details */}
                <div className="tx-details">
                  <div className="tx-title-row">
                    <span className="tx-description">{t.description}</span>
                    <span className="tx-category-tag" style={{ color: color, backgroundColor: `${color}12` }}>
                      {t.category}
                    </span>
                  </div>
                  <div className="tx-sub-row">
                    <span className="tx-date">{formatDate(t.date)}</span>
                    {t.notes && <span className="tx-notes">• {t.notes}</span>}
                  </div>
                </div>

                {/* Amount & Actions */}
                <div className="tx-actions-amount">
                  <span className={`tx-amount ${isIncome ? 'income' : 'expense'}`}>
                    {isIncome ? '+' : '-'}{formatCurrency(t.amount)}
                  </span>
                  
                  <div className="tx-actions">
                    <button 
                      className="action-btn edit-btn" 
                      onClick={() => onEdit(t)} 
                      title="Edit Transaction"
                    >
                      ✏️
                    </button>
                    <button 
                      className="action-btn delete-btn" 
                      onClick={() => onDelete(t.id)} 
                      title="Delete Transaction"
                    >
                      🗑️
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
