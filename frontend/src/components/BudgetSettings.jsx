import React, { useState, useEffect } from 'react';

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

const CATEGORY_DESCRIPTIONS = {
  Food: '🍔 Food & dining: restaurants, groceries, delivery apps',
  Utilities: '⚡ Utilities: electricity, water, internet, phone bills',
  Transport: '🚗 Transport: fuel, public transit, cab rides, vehicle upkeep',
  Entertainment: '🎬 Entertainment: movies, concerts, subscriptions, outings',
  Shopping: '🛍️ Shopping: clothing, electronics, retail items, gifts',
  Other: '🏷️ Other: miscellaneous expenses or uncategorized transactions'
};

const CATEGORY_RECOMMENDATIONS = {
  Food: '₹8,000–₹12,000',
  Utilities: '₹4,000–₹6,000',
  Transport: '₹2,000–₹4,000',
  Entertainment: '₹3,000–₹6,000',
  Shopping: '₹5,000–₹10,000',
  Other: '₹2,000–₹4,000'
};

const CATEGORY_TIPS = {
  Food: '💡 Tip: Try a "no-Swiggy" weekend to save up to 10% on food spend.',
  Utilities: '💡 Tip: Review streaming plans and cancel unused subscriptions.',
  Transport: '💡 Tip: Use public transit or carpool twice a week to trim fuel costs.',
  Entertainment: '💡 Tip: Look for free local events, parks, and group discounts.',
  Shopping: '💡 Tip: Use the 48-hour rule: wait 2 days before buying retail items.',
  Other: '💡 Tip: Track cash withdrawals to capture small leaks.'
};

export default function BudgetSettings({ budgets, transactions = [], onUpdateBudget }) {
  const [editingCategory, setEditingCategory] = useState(null);
  const [sliderValue, setSliderValue] = useState(5000);
  const [showInfo, setShowInfo] = useState(() => {
    return localStorage.getItem('mb_show_limit_info') !== 'false';
  });
  
  // Track success message animations
  const [successMsg, setSuccessMsg] = useState(null); // { categoryName: "message" }
  
  // Track joined challenge
  const [joinedChallenge, setJoinedChallenge] = useState(() => {
    return localStorage.getItem('mb_joined_june_challenge') === 'true';
  });

  const toggleInfo = () => {
    setShowInfo(prev => {
      localStorage.setItem('mb_show_limit_info', String(!prev));
      return !prev;
    });
  };

  const handleJoinChallenge = () => {
    setJoinedChallenge(prev => {
      localStorage.setItem('mb_joined_june_challenge', String(!prev));
      return !prev;
    });
  };

  // --- TIME CALCULATIONS ---
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const totalDaysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  // --- SPENDING STATS CALCULATIONS ---
  
  // Current month spent per category
  const getCategorySpend = (category) => {
    return transactions
      .filter(t => 
        t.type === 'expense' && 
        t.category.toLowerCase() === category.toLowerCase() && 
        new Date(t.date).getFullYear() === currentYear && 
        new Date(t.date).getMonth() === currentMonth
      )
      .reduce((sum, t) => sum + t.amount, 0);
  };

  // Historic monthly average spent per category
  const getCategoryAverage = (category) => {
    const catTxs = transactions.filter(t => t.type === 'expense' && t.category.toLowerCase() === category.toLowerCase());
    if (catTxs.length === 0) return 0;
    
    const months = new Set(catTxs.map(t => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${d.getMonth()}`;
    }));
    
    const total = catTxs.reduce((sum, t) => sum + t.amount, 0);
    return Math.round(total / Math.max(1, months.size));
  };

  // --- EVENT HANDLERS ---

  const handleEditClick = (category, currentLimit) => {
    setEditingCategory(category);
    setSliderValue(currentLimit > 0 ? currentLimit : 5000);
  };

  const handleSave = (category) => {
    onUpdateBudget(category, sliderValue);
    
    // Set success indicator
    setSuccessMsg({ [category]: "Limit saved. We'll watch this for you!" });
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
    
    setEditingCategory(null);
  };

  const handleClear = (category) => {
    if (window.confirm(`Are you sure you want to remove the budget limit for ${category}?`)) {
      onUpdateBudget(category, 0);
      setEditingCategory(null);
    }
  };

  // Auto-Suggest Limits logic
  const handleAutoSuggest = () => {
    if (window.confirm("Do you want to auto-suggest limits based on your past spending? This will override current settings.")) {
      EXPENSE_CATEGORIES.forEach(category => {
        const avg = getCategoryAverage(category);
        let suggestion = 0;
        if (avg > 0) {
          // Suggest 1.1x past average rounded to nearest 500
          suggestion = Math.round((avg * 1.1) / 500) * 500;
          if (suggestion < 1000) suggestion = 1000; // sensible floor
        } else {
          // Defaults if no history
          const fallbacks = { Food: 10000, Utilities: 6000, Transport: 3000, Entertainment: 4000, Shopping: 8000, Other: 3000 };
          suggestion = fallbacks[category] || 3000;
        }
        onUpdateBudget(category, suggestion);
      });
    }
  };

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amt);
  };

  // --- SUMMARY CHIPS DATA ---
  const activeBudgets = budgets.filter(b => b.limit_amount > 0);
  const totalLimitAmount = activeBudgets.reduce((sum, b) => sum + b.limit_amount, 0);
  const totalCategorySpent = EXPENSE_CATEGORIES.reduce((sum, cat) => {
    const limit = budgets.find(b => b.category.toLowerCase() === cat.toLowerCase())?.limit_amount || 0;
    return sum + (limit > 0 ? getCategorySpend(cat) : 0);
  }, 0);

  // --- MILESTONE / CHAMPION CHECK ---
  // If at least one limit is set and spending is below the limit for ALL set budgets
  const hasLimitsSet = activeBudgets.length > 0;
  const isUnderAllLimits = hasLimitsSet && activeBudgets.every(b => {
    const spent = getCategorySpend(b.category);
    return spent <= b.limit_amount;
  });

  return (
    <div className="budget-settings-panel glass-card animate-fade-in" style={{ padding: '36px' }}>
      
      {/* Page Header */}
      <div className="panel-header" style={{ marginBottom: '24px' }}>
        <h3>Budget Limits Configuration</h3>
        <p className="panel-subtitle" style={{ color: 'var(--text-muted)', fontSize: '14px', marginTop: '6px' }}>
          Set monthly caps on expense categories to monitor spending health and receive alerts.
        </p>
      </div>

      {/* Milestone/Champion Banner */}
      {isUnderAllLimits && (
        <div className="milestone-banner">
          <span>🏆 Budget Champion! You are currently keeping all active budgets under control this month. Great job! 🚀</span>
        </div>
      )}

      {/* Collapsible Info Card */}
      <div className="info-collapsible-card">
        <div className="info-header-toggle" onClick={toggleInfo}>
          <span>💡 Why set monthly limits?</span>
          <span>{showInfo ? '▲ Hide' : '▼ Learn More'}</span>
        </div>
        {showInfo && (
          <div className="info-content">
            Setting limits helps you stay aware of your outflow and automatically triggers pace warnings. 
            People who configure monthly budgets save an average of <strong>15% to 20%</strong> more by preventing mid-month overspending.
            Hover over any category icon below to see what it covers.
          </div>
        )}
      </div>

      {/* Summary Chips & Auto-Suggest */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '28px' }}>
        <div className="summary-chips-container" style={{ margin: 0 }}>
          <div className="summary-chip-item">
            🎯 Total Limit: <strong>{formatCurrency(totalLimitAmount)}</strong>
          </div>
          <div className="summary-chip-item">
            ⚙️ Configured: <strong>{activeBudgets.length} of {EXPENSE_CATEGORIES.length}</strong>
          </div>
          {totalLimitAmount > 0 && (
            <div className="summary-chip-item">
              📊 Budget Spent: <strong>{formatCurrency(totalCategorySpent)} / {formatCurrency(totalLimitAmount)}</strong>
            </div>
          )}
        </div>
        
        <button 
          onClick={handleAutoSuggest}
          style={{
            background: 'rgba(255, 91, 53, 0.1)',
            border: '1px solid rgba(255, 91, 53, 0.3)',
            color: 'var(--indigo)',
            padding: '8px 16px',
            borderRadius: '20px',
            cursor: 'pointer',
            fontWeight: '600',
            fontSize: '13px',
            transition: 'all 0.2s'
          }}
          onMouseOver={e => { e.currentTarget.style.background = 'rgba(255, 91, 53, 0.18)'; }}
          onMouseOut={e => { e.currentTarget.style.background = 'rgba(255, 91, 53, 0.1)'; }}
          title="Auto-fill limits based on your past spending data"
        >
          💡 Suggest limits for me
        </button>
      </div>

      {/* Grid of Limits */}
      <div className="budget-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '24px' }}>
        {EXPENSE_CATEGORIES.map(category => {
          const budget = budgets.find(b => b.category.toLowerCase() === category.toLowerCase());
          const limitAmount = budget ? budget.limit_amount : 0;
          const isEditing = editingCategory === category;
          const color = CATEGORY_COLORS[category];
          const icon = CATEGORY_ICONS[category];
          const desc = CATEGORY_DESCRIPTIONS[category];
          const tip = CATEGORY_TIPS[category];
          
          const spent = getCategorySpend(category);
          const average = getCategoryAverage(category);
          const hasLimit = limitAmount > 0;
          
          // Spending progress percent
          const percent = hasLimit ? (spent / limitAmount) * 100 : 0;
          const progressColor = percent <= 60 ? 'var(--emerald)' : percent <= 90 ? 'var(--amber)' : 'var(--rose)';
          const hasExceeded = percent > 100;
          
          // Breach projections
          const projectedSpend = Math.round((spent / currentDay) * totalDaysInMonth);
          const isProjectedToExceed = hasLimit && projectedSpend > limitAmount && spent <= limitAmount;
          const projectedExceedPercent = isProjectedToExceed ? Math.round(((projectedSpend - limitAmount) / limitAmount) * 100) : 0;
          
          // Soft warning state in slider
          const sliderBelowAverage = isEditing && sliderValue > 0 && sliderValue < average;

          return (
            <div 
              key={category} 
              className="budget-setting-card glass-card"
              style={{ 
                borderLeft: `4px solid ${color}`,
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                position: 'relative'
              }}
            >
              {/* Top Row: Category Icon & Name */}
              <div className="card-top" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span 
                    className="card-cat-icon" 
                    style={{ fontSize: '24px', cursor: 'help' }}
                    title={desc}
                  >
                    {icon}
                  </span>
                  <span className="card-cat-name" style={{ fontWeight: '700', fontSize: '16px', color: '#fff' }}>{category}</span>
                </div>
                {/* Streak Badge */}
                {hasLimit && !hasExceeded && spent > 0 && (
                  <span className="streak-badge" title="You are staying under your limit!">
                    🔥 Under limit
                  </span>
                )}
              </div>

              {/* Progress bar inside card if limit is set */}
              {hasLimit && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: 'var(--text-muted)' }}>
                    <span>Month spent: <strong>{formatCurrency(spent)}</strong></span>
                    <span>{percent.toFixed(0)}%</span>
                  </div>
                  <div style={{ height: '6px', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div 
                      style={{
                        height: '100%',
                        width: `${Math.min(100, percent)}%`,
                        background: progressColor,
                        borderRadius: '3px',
                        boxShadow: hasExceeded ? '0 0 10px rgba(239, 68, 68, 0.4)' : 'none',
                        transition: 'width 0.5s ease'
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Middle Section: Display Limit OR Configure Form */}
              <div className="card-middle" style={{ flexGrow: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                {isEditing ? (
                  <div className="inline-slider-container">
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-muted)' }}>
                      <span>Slide or type to adjust:</span>
                      <strong style={{ color: 'white' }}>{formatCurrency(sliderValue)}</strong>
                    </div>

                    <div className="slider-row">
                      <input
                        type="range"
                        min="0"
                        max="30000"
                        step="500"
                        value={sliderValue}
                        onChange={e => setSliderValue(parseInt(e.target.value))}
                      />
                      <input
                        type="number"
                        min="0"
                        step="500"
                        value={sliderValue}
                        onChange={e => setSliderValue(Math.max(0, parseInt(e.target.value) || 0))}
                        style={{
                          width: '85px',
                          padding: '6px',
                          background: 'rgba(255,255,255,0.05)',
                          border: '1px solid var(--border-glass)',
                          borderRadius: '8px',
                          color: 'white',
                          textAlign: 'center',
                          fontSize: '13px'
                        }}
                      />
                    </div>

                    <span className="slider-preview-text">
                      You can spend up to <strong>{formatCurrency(sliderValue)}</strong> per month on {category}.
                    </span>

                    {/* Soft Warning if below average */}
                    {sliderBelowAverage && (
                      <div className="inline-warning">
                        ⚠️ Limit is below your average spent (<strong>{formatCurrency(average)}</strong>)
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
                      <button 
                        className="btn-primary" 
                        onClick={() => handleSave(category)}
                        style={{ flex: 1, padding: '8px 12px', borderRadius: '8px', justifyContent: 'center' }}
                      >
                        Save
                      </button>
                      <button 
                        className="btn-secondary" 
                        onClick={() => setEditingCategory(null)}
                        style={{ padding: '8px 12px', borderRadius: '8px' }}
                      >
                        ✕
                      </button>
                      {limitAmount > 0 && (
                        <button 
                          className="btn-secondary" 
                          onClick={() => handleClear(category)}
                          style={{ padding: '8px 12px', borderRadius: '8px', color: 'var(--rose)' }}
                          title="Remove budget limit"
                        >
                          🗑️
                        </button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly Limit</div>
                      <div style={{ fontSize: '20px', fontWeight: '800', color: hasLimit ? 'white' : 'var(--text-dim)', marginTop: '4px' }}>
                        {hasLimit ? formatCurrency(limitAmount) : 'No Limit Set'}
                      </div>
                      {!hasLimit && (
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                          Recommended: {CATEGORY_RECOMMENDATIONS[category]}
                        </div>
                      )}
                    </div>
                    
                    <button 
                      className="edit-limit-btn"
                      onClick={() => handleEditClick(category, limitAmount)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.05)',
                        border: '1px solid var(--border-glass)',
                        borderRadius: '20px',
                        padding: '6px 14px',
                        color: 'white',
                        fontWeight: '600',
                        fontSize: '12px',
                        cursor: 'pointer',
                        transition: 'all 0.2s'
                      }}
                      onMouseOver={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)';
                        e.currentTarget.style.borderColor = 'var(--border-glass-hover)';
                      }}
                      onMouseOut={e => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)';
                        e.currentTarget.style.borderColor = 'var(--border-glass)';
                      }}
                    >
                      Configure
                    </button>
                  </div>
                )}
              </div>

              {/* Bottom Alerts & Tips Section */}
              {!isEditing && (
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '10px', fontSize: '11px', color: 'var(--text-muted)' }}>
                  
                  {/* Projected Breach Warning */}
                  {isProjectedToExceed && (
                    <div className="projected-breach-alert">
                      ⚠️ Run-rate warning: Likely to exceed limit by <strong>{projectedExceedPercent}%</strong> this month.
                    </div>
                  )}

                  {/* Standard Category Tips */}
                  {!isProjectedToExceed && (
                    <div style={{ fontStyle: 'italic' }}>
                      {tip}
                    </div>
                  )}
                </div>
              )}

              {/* Success Notification Animation */}
              {successMsg && successMsg[category] && (
                <div className="success-save-indicator">
                  <span>✓</span>
                  <span>{successMsg[category]}</span>
                </div>
              )}

            </div>
          );
        })}
      </div>

      {/* June Challenge Banner Card */}
      <div className="challenge-banner-card">
        <div className="challenge-info">
          <h4>🎯 June Challenge: Cut Entertainment by 15%</h4>
          <p>
            Stay under 85% of your entertainment spend from last month and earn the "Smart Saver" badge! 
            {joinedChallenge ? ' (Progress: Tracking active)' : ' Join other members in this challenge.'}
          </p>
        </div>
        <button 
          className={`challenge-join-btn ${joinedChallenge ? 'joined' : ''}`}
          onClick={handleJoinChallenge}
        >
          {joinedChallenge ? '✓ Joined Challenge' : 'Join Challenge'}
        </button>
      </div>

    </div>
  );
}
