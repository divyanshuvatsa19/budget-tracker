import React, { useState, useEffect } from 'react';
import { 
  fetchSummary, 
  fetchTransactions, 
  fetchBudgets, 
  createTransaction, 
  updateTransaction, 
  deleteTransaction, 
  updateBudget 
} from './utils/api';
import Dashboard from './components/Dashboard';
import TransactionList from './components/TransactionList';
import TransactionForm from './components/TransactionForm';
import BudgetSettings from './components/BudgetSettings';
import BankImport from './components/BankImport';
import AddCardModal from './components/AddCardModal';
import './App.css';

export default function App() {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard' | 'transactions' | 'budgets' | 'bank'
  const [transactions, setTransactions] = useState([]);
  const [budgets, setBudgets] = useState([]);
  const [summary, setSummary] = useState(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // ── Multi-user auth state ───────────────────────────────────────────────
  // activeUser: { id, name } | null
  const [activeUser, setActiveUser] = useState(() => {
    try {
      const u = localStorage.getItem('mb_active_user');
      return u ? JSON.parse(u) : null;
    } catch { return null; }
  });

  const isLoggedIn = !!activeUser;

  // Cards — per user (key: mb_cards_<userId>)
  const cardsKey = activeUser ? `mb_cards_${activeUser.id}` : 'mb_cards_guest';
  const [cards, setCards] = useState(() => {
    const key = activeUser ? `mb_cards_${activeUser.id}` : 'mb_cards_guest';
    try {
      const saved = localStorage.getItem(key);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: '1', name: 'Nexus Pro', type: 'VISA', cardType: 'Credit', number: '**** **** **** 4812', holder: activeUser?.name?.toUpperCase() || '', expiry: '08/28', theme: 'emerald' },
      { id: '2', name: 'City Bank Premium', type: 'MasterCard', cardType: 'Credit', number: '**** **** **** 9010', holder: activeUser?.name?.toUpperCase() || '', expiry: '12/29', theme: 'coral' }
    ];
  });

  const [isAddCardOpen, setIsAddCardOpen] = useState(false);

  // Persist cards when they change
  useEffect(() => {
    localStorage.setItem(cardsKey, JSON.stringify(cards));
  }, [cards, cardsKey]);

  // Reload cards when user switches
  useEffect(() => {
    if (!activeUser) return;
    const key = `mb_cards_${activeUser.id}`;
    try {
      const saved = localStorage.getItem(key);
      if (saved) setCards(JSON.parse(saved));
    } catch {}
  }, [activeUser?.id]);

  const handleLogout = () => {
    localStorage.removeItem('mb_active_user');
    setActiveUser(null);
  };

  const handleLogin = (user) => {
    localStorage.setItem('mb_active_user', JSON.stringify(user));
    setActiveUser(user);
  };

  // Load all application data in parallel
  const loadData = async () => {
    try {
      setError(null);
      const [summaryData, txData, budgetData] = await Promise.all([
        fetchSummary(),
        fetchTransactions(),
        fetchBudgets()
      ]);
      setSummary(summaryData);
      setTransactions(txData);
      setBudgets(budgetData);
    } catch (err) {
      console.error('Error loading tracker data:', err);
      setError('Failed to connect to the budget tracker backend. Make sure the server is running!');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // CRUD Handlers
  const handleFormSubmit = async (formData) => {
    try {
      setLoading(true);
      if (editingTransaction) {
        await updateTransaction(editingTransaction.id, formData);
      } else {
        await createTransaction(formData);
      }
      setIsFormOpen(false);
      setEditingTransaction(null);
      await loadData(); // Reload stats and list
    } catch (err) {
      setError('Failed to save transaction entry.');
      setLoading(false);
    }
  };

  const handleEditInit = (transaction) => {
    setEditingTransaction(transaction);
    setIsFormOpen(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this transaction?')) {
      try {
        setLoading(true);
        await deleteTransaction(id);
        await loadData();
      } catch (err) {
        setError('Failed to delete transaction.');
        setLoading(false);
      }
    }
  };

  const handleUpdateBudget = async (category, limitAmount) => {
    try {
      setLoading(true);
      await updateBudget(category, limitAmount);
      await loadData();
    } catch (err) {
      setError('Failed to update category budget.');
      setLoading(false);
    }
  };

  const handleCloseForm = () => {
    setIsFormOpen(false);
    setEditingTransaction(null);
  };

  return (
    <>
    {!isLoggedIn && <LockScreen onLogin={handleLogin} />}
    {isLoggedIn && (
    <div className="dashboard-layout-container">
      {/* Left Sidebar */}
      <aside className="left-sidebar">
        <div className="brand-logo" style={{ marginBottom: '20px' }}>
          <span className="logo-icon">🏦</span>
          <h2>MyBudget <span style={{ fontSize: '18px', color: 'var(--indigo)' }}>✨</span></h2>
        </div>
        
        <nav className="nav-tabs" style={{ flexDirection: 'column', background: 'transparent', border: 'none', gap: '12px', padding: 0 }}>
          <button 
            className={`tab-link ${activeTab === 'dashboard' ? 'active' : ''}`}
            onClick={() => setActiveTab('dashboard')}
            style={{ textAlign: 'left', padding: '12px 16px' }}
          >
            📊 Dashboard
          </button>
          <button 
            className={`tab-link ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
            style={{ textAlign: 'left', padding: '12px 16px' }}
          >
            💸 Transactions
          </button>
          <button 
            className={`tab-link ${activeTab === 'budgets' ? 'active' : ''}`}
            onClick={() => setActiveTab('budgets')}
            style={{ textAlign: 'left', padding: '12px 16px' }}
          >
            🎯 Limits
          </button>
          <button 
            className={`tab-link bank-tab ${activeTab === 'bank' ? 'active' : ''}`}
            onClick={() => setActiveTab('bank')}
            style={{ textAlign: 'left', padding: '12px 16px' }}
          >
            🏦 Import Bank
          </button>
        </nav>


      </aside>

      {/* Main Content Area */}
      <main className="app-main">
        <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '32px', flexWrap: 'wrap', gap: '16px' }}>
          <div className="search-bar" style={{ flex: 1, minWidth: '200px', maxWidth: '300px' }}>
            <input 
              type="text" 
              placeholder="Search..." 
              style={{ 
                width: '100%', 
                padding: '10px 16px', 
                borderRadius: '20px', 
                border: '1px solid var(--border-glass)', 
                background: 'rgba(255,255,255,0.05)',
                color: 'white'
              }} 
            />
          </div>
          <div className="user-profile" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div className="premium-badge" style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '20px',
              background: 'rgba(255, 91, 53, 0.1)', border: '1px solid rgba(255, 91, 53, 0.25)',
              color: '#FF8F73', fontSize: '12px', fontWeight: 'bold',
              boxShadow: '0 4px 12px rgba(255, 91, 53, 0.08)'
            }}>
              <span>✨</span> Premium
            </div>
            <button 
              className="add-tx-btn btn-primary"
              onClick={() => setIsFormOpen(true)}
              style={{ padding: '8px 16px', borderRadius: '20px', display: 'flex', alignItems: 'center', gap: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}
            >
              <span style={{ fontSize: '16px' }}>+</span> Add Transaction
            </button>
            <button 
              onClick={handleLogout}
              style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--rose)', border: '1px solid rgba(239, 68, 68, 0.25)', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold' }}
            >
              Logout
            </button>
          </div>
        </header>

        {loading && !summary && (
          <div className="state-screen">
            <div className="spinner" />
            <p>Gathering ledger data...</p>
          </div>
        )}

        {error && (
          <div className="error-banner animate-fade-in">
            <span className="error-emoji">⚠️</span>
            <div className="error-msg">
              <strong>Application Error</strong>
              <p>{error}</p>
            </div>
            <button className="btn-retry" onClick={() => { setLoading(true); loadData(); }}>Retry Connection</button>
          </div>
        )}

        {!loading && summary && (
          <div className="tab-viewport">
            {activeTab === 'dashboard' && <Dashboard summary={summary} transactions={transactions} />}
            {activeTab === 'transactions' && (
              <TransactionList 
                transactions={transactions} 
                onEdit={handleEditInit} 
                onDelete={handleDelete} 
              />
            )}
            {activeTab === 'budgets' && (
              <BudgetSettings 
                budgets={budgets} 
                onUpdateBudget={handleUpdateBudget} 
              />
            )}
            {activeTab === 'bank' && (
              <div className="glass-card bank-import-panel">
                <BankImport onImportComplete={() => { loadData(); setActiveTab('transactions'); }} />
              </div>
            )}
          </div>
        )}
      </main>

      {/* Right Side Panel */}
      <aside className="right-panel">
        <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '12px' }}>My Cards</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {cards.map((card, index) => {
            const cardStyle = index > 0 ? { marginTop: '-80px', zIndex: index + 1 } : {};
            return (
              <div 
                key={card.id} 
                className={`budget-card card-theme-${card.theme}`} 
                style={cardStyle}
              >
                <button 
                  type="button"
                  className="delete-card-btn" 
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`Are you sure you want to remove ${card.name}?`)) {
                      setCards(cards.filter(c => c.id !== card.id));
                    }
                  }}
                  title="Remove Card"
                >
                  ×
                </button>

                {/* Top row: name + network */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    {/* Credit / Debit badge */}
                    {card.cardType && (
                      <span style={{
                        fontSize: '10px', fontWeight: '700', letterSpacing: '0.8px',
                        textTransform: 'uppercase',
                        background: card.cardType === 'Debit' ? 'rgba(59,130,246,0.25)' : 'rgba(16,185,129,0.25)',
                        border: card.cardType === 'Debit' ? '1px solid rgba(59,130,246,0.5)' : '1px solid rgba(16,185,129,0.5)',
                        color: card.cardType === 'Debit' ? '#93c5fd' : '#6ee7b7',
                        padding: '2px 7px', borderRadius: '20px',
                        display: 'inline-block', marginBottom: '4px'
                      }}>{card.cardType}</span>
                    )}
                    <div style={{ fontWeight: '600', fontSize: '14px' }}>{card.name}</div>
                  </div>
                  <span style={{
                    fontWeight: 'bold',
                    fontStyle: card.type === 'MasterCard' ? 'italic' : 'normal',
                    color: card.type === 'MasterCard' ? '#ffeb3b' : 'white',
                    fontSize: '13px'
                  }}>
                    {card.type}
                  </span>
                </div>

                {/* Card number */}
                <div style={{ marginTop: '16px', fontSize: '17px', letterSpacing: '2px', fontFamily: 'monospace' }}>{card.number}</div>

                {/* Bottom: holder + expiry */}
                <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                  <span style={{ opacity: 0.8 }}>Card Holder<br/><strong>{card.holder}</strong></span>
                  <span style={{ opacity: 0.8, textAlign: 'right' }}>Expires<br/><strong>{card.expiry}</strong></span>
                </div>
              </div>
            );
          })}
          
          <button 
            style={{ width: '100%', padding: '16px', background: 'rgba(255,255,255,0.05)', border: '1px dashed var(--text-muted)', borderRadius: '16px', color: 'var(--text-main)', fontWeight: '600', cursor: 'pointer', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', transition: 'all 0.2s' }} 
            onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'} 
            onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
            onClick={() => setIsAddCardOpen(true)}
          >
            <span style={{ fontSize: '20px' }}>+</span> Add New Card
          </button>
        </div>
      </aside>

      {/* Mobile Bottom Navigation (Visible only on mobile/iOS) */}
      <nav className="mobile-bottom-nav glass-card">
        <button 
          className={`mobile-nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          <span className="mobile-nav-icon">📊</span>
          <span className="mobile-nav-label">Dashboard</span>
        </button>
        <button 
          className={`mobile-nav-link ${activeTab === 'transactions' ? 'active' : ''}`}
          onClick={() => setActiveTab('transactions')}
        >
          <span className="mobile-nav-icon">💸</span>
          <span className="mobile-nav-label">Ledger</span>
        </button>
        <button 
          className="mobile-nav-link mobile-nav-add"
          onClick={() => setIsFormOpen(true)}
          title="Add Transaction"
        >
          <span className="mobile-nav-icon-add">+</span>
        </button>
        <button 
          className={`mobile-nav-link ${activeTab === 'budgets' ? 'active' : ''}`}
          onClick={() => setActiveTab('budgets')}
        >
          <span className="mobile-nav-icon">🎯</span>
          <span className="mobile-nav-label">Limits</span>
        </button>
        <button 
          className={`mobile-nav-link mobile-bank-tab ${activeTab === 'bank' ? 'active' : ''}`}
          onClick={() => setActiveTab('bank')}
        >
          <span className="mobile-nav-icon">🏦</span>
          <span className="mobile-nav-label">Import</span>
        </button>
      </nav>

      {/* Form Modal */}
      {isFormOpen && (
        <TransactionForm
          onSubmit={handleFormSubmit}
          onClose={handleCloseForm}
          editingTransaction={editingTransaction}
        />
      )}

      {/* Add Card Modal */}
      {isAddCardOpen && (
        <AddCardModal
          onSubmit={(newCard) => {
            setCards([...cards, newCard]);
            setIsAddCardOpen(false);
          }}
          onClose={() => setIsAddCardOpen(false)}
        />
      )}

    </div>
    )}
    </>
  );
}

// ── Multi-user Login / Register Screen ────────────────────────────────────────
function LockScreen({ onLogin }) {
  // Load existing profiles from localStorage
  const [profiles, setProfiles] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('mb_profiles') || '[]');
    } catch { return []; }
  });

  const [view, setView] = useState(profiles.length === 0 ? 'create' : 'select');
  // 'select' → pick existing profile
  // 'login'  → enter PIN for selected profile
  // 'create' → new profile form

  const [selectedProfile, setSelectedProfile] = useState(null);
  const [pin, setPin] = useState('');
  const [newName, setNewName] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  const saveProfiles = (updated) => {
    localStorage.setItem('mb_profiles', JSON.stringify(updated));
    setProfiles(updated);
  };

  // ── Login with PIN ──
  const handleLogin = (e) => {
    e.preventDefault();
    if (!pin) { setError('Enter your PIN.'); return; }
    if (pin === selectedProfile.pin) {
      setError('');
      onLogin({ id: selectedProfile.id, name: selectedProfile.name });
    } else {
      setError('Incorrect PIN. Try again.');
      setShake(true);
      setPin('');
      setTimeout(() => setShake(false), 600);
    }
  };

  // ── Create new profile ──
  const handleCreate = (e) => {
    e.preventDefault();
    if (!newName.trim()) { setError('Enter your name.'); return; }
    if (newPin.length !== 4) { setError('PIN must be 4 digits.'); return; }
    if (newPin !== confirmPin) { setError('PINs do not match.'); return; }
    const profile = {
      id: Date.now().toString(),
      name: newName.trim(),
      pin: newPin,
      avatar: newName.trim()[0].toUpperCase(),
    };
    const updated = [...profiles, profile];
    saveProfiles(updated);
    setError('');
    onLogin({ id: profile.id, name: profile.name });
  };

  // ── Delete profile ──
  const handleDeleteProfile = (id) => {
    if (!window.confirm('Delete this profile and all its data?')) return;
    const updated = profiles.filter(p => p.id !== id);
    saveProfiles(updated);
    // Clear user-specific localStorage keys
    localStorage.removeItem(`mb_cards_${id}`);
    if (updated.length === 0) setView('create');
  };

  return (
    <div className="lock-screen-container">
      <div className="lock-card glass-card animate-slide-up" style={{ maxWidth: '420px' }}>
        <span className="lock-logo">🏦</span>
        <h2 className="lock-title">MyBudget</h2>

        {/* ── SELECT PROFILE VIEW ── */}
        {view === 'select' && (
          <>
            <p className="lock-subtitle">Select your profile to continue</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '20px' }}>
              {profiles.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px', background: 'rgba(255,255,255,0.05)', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.08)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => { setSelectedProfile(p); setView('login'); setError(''); setPin(''); }}
                  onMouseOver={e => e.currentTarget.style.background='rgba(255,255,255,0.1)'}
                  onMouseOut={e => e.currentTarget.style.background='rgba(255,255,255,0.05)'}
                >
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--indigo), #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '18px', flexShrink: 0 }}>
                    {p.avatar || p.name[0].toUpperCase()}
                  </div>
                  <div style={{ flex: 1, textAlign: 'left' }}>
                    <div style={{ fontWeight: '600', fontSize: '15px' }}>{p.name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Tap to unlock</div>
                  </div>
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); handleDeleteProfile(p.id); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '18px', padding: '4px 8px', borderRadius: '6px' }}
                    title="Delete profile"
                  >🗑</button>
                </div>
              ))}
            </div>
            <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setView('create'); setError(''); }}>
              + Create New Profile
            </button>
          </>
        )}

        {/* ── LOGIN WITH PIN VIEW ── */}
        {view === 'login' && selectedProfile && (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'center', marginBottom: '8px' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--indigo), #7C3AED)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '700', fontSize: '20px' }}>
                {selectedProfile.avatar || selectedProfile.name[0].toUpperCase()}
              </div>
            </div>
            <p className="lock-subtitle">Welcome back, <strong style={{ color: 'white' }}>{selectedProfile.name}</strong><br/>Enter your PIN to unlock</p>
            <form onSubmit={handleLogin}>
              <div className="pin-input-group">
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  className={`pin-field${shake ? ' pin-shake' : ''}`}
                  placeholder="••••"
                  value={pin}
                  onChange={e => { setError(''); setPin(e.target.value.replace(/\D/g, '').substring(0, 4)); }}
                  autoFocus
                />
                {error && <span style={{ color: 'var(--rose)', fontSize: '13px' }}>{error}</span>}
              </div>
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold', marginBottom: '12px' }}>
                Unlock Dashboard
              </button>
              <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setView('select'); setPin(''); setError(''); }}>
                ← Back to Profiles
              </button>
            </form>
          </>
        )}

        {/* ── CREATE PROFILE VIEW ── */}
        {view === 'create' && (
          <>
            <p className="lock-subtitle">{profiles.length === 0 ? 'Set up your profile to get started' : 'Create a new profile'}</p>
            <form onSubmit={handleCreate} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div className="form-group" style={{ textAlign: 'left' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px', display: 'block' }}>Your Name</label>
                  <input
                    type="text"
                    className="pin-field"
                    placeholder=""
                    value={newName}
                    onChange={e => { setError(''); setNewName(e.target.value); }}
                    maxLength={20}
                    style={{ fontSize: '16px', letterSpacing: '0' }}
                    autoFocus
                  />
                </div>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px', display: 'block' }}>Set your PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="pin-field"
                    placeholder="Choose a PIN"
                    value={newPin}
                    onChange={e => { setError(''); setNewPin(e.target.value.replace(/\D/g, '').substring(0, 4)); }}
                  />
                </div>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '6px', display: 'block' }}>Confirm PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={4}
                    className="pin-field"
                    placeholder="Repeat PIN"
                    value={confirmPin}
                    onChange={e => { setError(''); setConfirmPin(e.target.value.replace(/\D/g, '').substring(0, 4)); }}
                  />
                </div>
              {error && <span style={{ color: 'var(--rose)', fontSize: '13px' }}>{error}</span>}
              <button type="submit" className="btn btn-primary" style={{ width: '100%', justifyContent: 'center', padding: '14px', borderRadius: '12px', fontSize: '16px', fontWeight: 'bold' }}>
                Create Profile & Enter
              </button>
              {profiles.length > 0 && (
                <button type="button" className="btn btn-secondary" style={{ width: '100%', justifyContent: 'center' }} onClick={() => { setView('select'); setError(''); }}>
                  ← Back to Profiles
                </button>
              )}
            </form>
          </>
        )}
      </div>
    </div>
  );
}
