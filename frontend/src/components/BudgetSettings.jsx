import React, { useState } from 'react';

const EXPENSE_CATEGORIES = ['Food', 'Utilities', 'Transport', 'Entertainment', 'Shopping', 'Other'];

const CATEGORY_COLORS = {
  Food: '#FF5B35',
  Entertainment: '#8b5cf6',
  Utilities: '#06b6d4',
  Transport: '#f59e0b',
  Shopping: '#ec4899',
  Other: '#6b7280'
};

const CATEGORY_ICONS = {
  Food: '🍔',
  Entertainment: '🎬',
  Utilities: '⚡',
  Transport: '🚗',
  Shopping: '🛍️',
  Other: '🏷️'
};

export default function BudgetSettings({ budgets, onUpdateBudget }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [limitInput, setLimitInput] = useState('');

  const handleEditClick = (category, currentLimit) => {
    setEditingCategory(category);
    setLimitInput(currentLimit > 0 ? currentLimit.toString() : '');
  };

  const handleSave = (category) => {
    const parsed = parseFloat(limitInput);
    if (isNaN(parsed) || parsed < 0) {
      alert('Please enter a valid positive number.');
      return;
    }
    onUpdateBudget(category, parsed);
    setEditingCategory(null);
  };

  const handleClear = (category) => {
    if (window.confirm(`Are you sure you want to remove the budget limit for ${category}?`)) {
      onUpdateBudget(category, 0); // 0 or negative removes the budget in backend
      setEditingCategory(null);
    }
  };

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
  };

  return (
    <div className="budget-settings-panel glass-card animate-fade-in">
      <div className="panel-header">
        <h3>Budget Limits Configuration</h3>
        <p className="panel-subtitle">Set monthly caps on expense categories to monitor spending health.</p>
      </div>

      <div className="budget-grid">
        {EXPENSE_CATEGORIES.map(category => {
          const budget = budgets.find(b => b.category.toLowerCase() === category.toLowerCase());
          const limitAmount = budget ? budget.limit_amount : 0;
          const isEditing = editingCategory === category;
          const color = CATEGORY_COLORS[category];
          const icon = CATEGORY_ICONS[category];

          return (
            <div 
              key={category} 
              className="budget-setting-card"
              style={{ borderLeft: `4px solid ${color}` }}
            >
              <div className="card-top">
                <span className="card-cat-icon">{icon}</span>
                <span className="card-cat-name">{category}</span>
              </div>

              <div className="card-middle">
                {isEditing ? (
                  <div className="inline-edit-form">
                    <div className="input-prefix-wrapper">
                      <span className="currency-symbol">$</span>
                      <input
                        type="number"
                        step="1"
                        min="0"
                        placeholder="Limit"
                        value={limitInput}
                        onChange={e => setLimitInput(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="inline-edit-actions">
                      <button className="btn-save" onClick={() => handleSave(category)}>✓</button>
                      <button className="btn-cancel" onClick={() => setEditingCategory(null)}>✕</button>
                      {limitAmount > 0 && (
                        <button className="btn-clear" onClick={() => handleClear(category)} title="Remove Limit">🗑️</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="limit-display-row">
                    <div className="limit-value-display">
                      <span className="limit-lbl">Monthly Limit</span>
                      <span className="limit-val">
                        {limitAmount > 0 ? formatCurrency(limitAmount) : 'No Limit Set'}
                      </span>
                    </div>
                    <button 
                      className="edit-limit-btn"
                      onClick={() => handleEditClick(category, limitAmount)}
                    >
                      Configure
                    </button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
