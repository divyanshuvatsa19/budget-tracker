import React from 'react';

const CATEGORY_COLORS = {
  Food: '#FF5B35',         // Coral / Orange-Red
  Entertainment: '#8b5cf6', // Violet
  Utilities: '#06b6d4',     // Cyan
  Transport: '#f59e0b',     // Amber
  Shopping: '#ec4899',      // Pink
  Other: '#6b7280'          // Gray
};

export default function Dashboard({ summary, transactions = [] }) {
  const { totalIncome, totalExpenses, netBalance, savingsRate, categoriesSummary } = summary;

  // All active categories from summary
  const filteredCategories = categoriesSummary || [];
  const activeCategories = filteredCategories.filter(c => c.spent > 0 || c.budget > 0);

  // SVG Doughnut Calculation
  const totalSpent = filteredCategories.reduce((sum, c) => sum + c.spent, 0);
  let accumulatedPercent = 0;

  const doughnutSlices = activeCategories
    .filter(c => c.spent > 0)
    .map(c => {
      const percentage = totalSpent > 0 ? (c.spent / totalSpent) * 100 : 0;
      const startPercent = accumulatedPercent;
      accumulatedPercent += percentage;

      const radius = 50;
      const circumference = 2 * Math.PI * radius;
      const strokeLength = (percentage / 100) * circumference;
      const strokeOffset = circumference - strokeLength + (startPercent / 100) * circumference;

      return {
        ...c,
        percentage,
        strokeLength,
        strokeOffset,
        circumference,
        color: CATEGORY_COLORS[c.category] || CATEGORY_COLORS.Other
      };
    });

  const formatCurrency = (amt) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(amt);
  };

  const budgetAlerts = activeCategories.filter(c => {
    if (!c.budget) return false;
    return c.spent >= c.budget * 0.85;
  });

  // Spline Chart Calculation
  const sortedTx = [...transactions].sort((a, b) => new Date(a.date) - new Date(b.date));
  let runningBalance = 0;
  const dataPoints = [];
  
  if (sortedTx.length > 0) {
    sortedTx.forEach(tx => {
      runningBalance += tx.type === 'income' ? tx.amount : -tx.amount;
      dataPoints.push({ date: tx.date, balance: runningBalance });
    });
  } else {
    dataPoints.push(
      { balance: 1000 }, { balance: 1200 }, { balance: 1100 }, 
      { balance: 1800 }, { balance: 1500 }, { balance: 2200 }, { balance: 2800 }
    );
  }

  const chartWidth = 500;
  const chartHeight = 160;
  const maxBalance = Math.max(...dataPoints.map(d => d.balance), 100);
  const minBalance = Math.min(...dataPoints.map(d => d.balance), 0);
  const range = maxBalance - minBalance || 1;
  
  const pts = dataPoints.map((dp, i) => {
    const x = (i / Math.max((dataPoints.length - 1), 1)) * chartWidth;
    const y = chartHeight - ((dp.balance - minBalance) / range) * chartHeight * 0.8 - 20;
    return { x, y, balance: dp.balance };
  });

  const createSplinePath = (points) => {
    if (points.length === 0) return '';
    if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
    let path = `M ${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cx = (p0.x + p1.x) / 2;
      path += ` C ${cx},${p0.y} ${cx},${p1.y} ${p1.x},${p1.y}`;
    }
    return path;
  };

  const linePath = createSplinePath(pts);
  const areaPath = pts.length > 1 ? `${linePath} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z` : '';
  const peakPoint = pts.reduce((max, p) => p.y < max.y ? p : max, pts[0] || {x:0, y:0, balance: 0});

  return (
    <div className="dashboard-grid animate-fade-in" style={{ gap: '32px' }}>
      
      {/* Account Details Spline Chart Panel */}
      <div className="glass-card chart-panel" style={{ padding: '32px', position: 'relative', overflow: 'hidden' }}>
        <h3 style={{ marginBottom: '8px', fontSize: '20px' }}>Account Details</h3>
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', marginBottom: '24px' }}>Net Balance over time</div>
        
        <div style={{ width: '100%', overflowX: 'auto', paddingBottom: '16px' }}>
          <svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`} preserveAspectRatio="none" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--indigo)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--indigo)" stopOpacity="0.0" />
              </linearGradient>
            </defs>
            <path d={areaPath} fill="url(#areaGradient)" />
            <path d={linePath} fill="none" stroke="var(--indigo)" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
            
            {pts.length > 0 && (
              <g transform={`translate(${peakPoint.x}, ${peakPoint.y})`}>
                <circle cx="0" cy="0" r="6" fill="#fff" stroke="var(--indigo)" strokeWidth="3" />
                <circle cx="0" cy="0" r="12" fill="var(--indigo)" opacity="0.3" className="pulse-anim" />
                <rect x="-40" y="-35" width="80" height="24" rx="12" fill="var(--bg-card)" stroke="var(--border-glass)" />
                <text x="0" y="-18" textAnchor="middle" fill="#fff" fontSize="11" fontWeight="bold">
                  {formatCurrency(peakPoint.balance)}
                </text>
              </g>
            )}
          </svg>
        </div>
      </div>

      <div className="dashboard-main-layout">
        {/* Expenses Summary Doughnut */}
        <div className="glass-card chart-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>Expenses Summary</h3>
          {totalSpent === 0 ? (
            <div className="empty-chart">
              <div className="empty-chart-icon">📊</div>
              <p>No expense data available.</p>
            </div>
          ) : (
            <div className="chart-container" style={{ gap: '32px' }}>
              <div className="chart-svg-wrapper">
                <svg width="240" height="240" viewBox="0 0 140 140" className="doughnut-svg">
                  <defs>
                    <linearGradient id="doughnutGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="var(--indigo)" />
                    </linearGradient>
                  </defs>
                  <circle cx="70" cy="70" r="50" fill="transparent" stroke="rgba(255,255,255,0.05)" strokeWidth="20" />
                  {doughnutSlices.map((slice, index) => (
                    <circle
                      key={slice.category}
                      cx="70"
                      cy="70"
                      r="50"
                      fill="transparent"
                      stroke={slice.category === 'Food' ? 'url(#doughnutGrad)' : slice.color}
                      strokeWidth="20"
                      strokeDasharray={slice.circumference}
                      strokeDashoffset={-slice.strokeOffset}
                      strokeLinecap="round"
                      className="doughnut-segment"
                      style={{
                        transformOrigin: '70px 70px',
                        transform: 'rotate(-90deg)',
                        transition: 'stroke-dashoffset 0.8s ease'
                      }}
                    />
                  ))}
                  <g className="chart-center-text">
                    <text x="70" y="66" textAnchor="middle" fill="#fff" fontSize="14" fontWeight="bold">
                      {formatCurrency(totalSpent)}
                    </text>
                    <text x="70" y="84" textAnchor="middle" fill="var(--text-muted)" fontSize="10" textTransform="uppercase" letterSpacing="1">
                      Total Spent
                    </text>
                  </g>
                </svg>
              </div>

              <div className="chart-legend">
                {doughnutSlices.map(slice => (
                  <div className="legend-item" key={slice.category} style={{ gridTemplateColumns: '12px 1fr auto auto', gap: '16px', marginBottom: '8px' }}>
                    <span className="legend-dot" style={{ backgroundColor: slice.color, borderRadius: '4px' }} />
                    <span className="legend-name" style={{ color: '#fff' }}>{slice.category}</span>
                    <span className="legend-percent" style={{ color: 'var(--text-muted)' }}>{slice.percentage.toFixed(0)}%</span>
                    <span className="legend-spent" style={{ color: '#fff', fontWeight: 'bold' }}>{formatCurrency(slice.spent)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Budget Progress & Metrics */}
        <div className="glass-card budget-panel" style={{ padding: '32px' }}>
          <h3 style={{ fontSize: '20px', marginBottom: '24px' }}>Budget Progress</h3>
          
          <div className="budgets-progress-list" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {activeCategories.map(cat => {
              const color = CATEGORY_COLORS[cat.category] || CATEGORY_COLORS.Other;
              const hasBudget = cat.budget > 0;
              const percent = hasBudget ? (cat.spent / cat.budget) * 100 : 0;
              const barWidth = Math.min(100, percent);
              const isExceeded = percent > 100;

              return (
                <div key={cat.category} className="budget-item">
                  <div className="budget-item-header" style={{ marginBottom: '12px' }}>
                    <div className="budget-item-info">
                      <span className="budget-category-name" style={{ color: '#fff', fontSize: '15px' }}>{cat.category}</span>
                    </div>
                    <span className="budget-stats" style={{ fontSize: '13px' }}>
                      <strong style={{ color: '#fff' }}>{formatCurrency(cat.spent)}</strong> 
                      <span style={{ color: 'var(--text-muted)' }}>{hasBudget ? ` / ${formatCurrency(cat.budget)}` : ''}</span>
                    </span>
                  </div>
                  
                  {hasBudget && (
                    <div className="progress-bar-container budget-progress" style={{ height: '8px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px' }}>
                      <div 
                        className={`progress-bar ${isExceeded ? 'danger-glow' : ''}`}
                        style={{ 
                          width: `${barWidth}%`, 
                          backgroundColor: isExceeded ? 'var(--rose)' : color,
                          borderRadius: '4px'
                        }}
                      />
                    </div>
                  )}
                </div>
              );
            })}

            {activeCategories.length === 0 && (
              <p className="no-data-text" style={{ color: 'var(--text-muted)' }}>No active budgets.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
