import React, { useState, useEffect } from 'react';

// ─── Card Network Detection (from card prefix) ──────────────────────────────
function detectNetwork(number) {
  const n = number.replace(/\D/g, '');
  if (!n) return null;

  if (/^4/.test(n)) return 'VISA';
  if (/^(51|52|53|54|55|2[2-7])/.test(n)) return 'MasterCard';
  if (/^3[47]/.test(n)) return 'Amex';
  if (/^(6011|622|64|65)/.test(n)) return 'Discover';
  if (/^(36|38|30[0-5])/.test(n)) return 'Diners';
  if (/^(60|6521|6522|508|353|356)/.test(n)) return 'RuPay';
  if (/^35(2[89]|[3-8]\d)/.test(n)) return 'JCB';
  return 'Unknown';
}

// ─── Card Type Detection (Credit / Debit) ────────────────────────────────────
// Simplified: Amex cards tend to be credit-only;
// certain BIN ranges are debit by issuer policy.
function detectCardType(number) {
  const n = number.replace(/\D/g, '');
  if (!n || n.length < 4) return null;

  // Known debit BIN prefixes for Indian banks
  const debitPrefixes = [
    '4083','4084','4508','4512','4532','4556','4561','4607',
    '4614','4619','4643','4649','4684','4724','4727','4744',
    '5200','5204','5205','5206','5259','5260','5261','5310',
    '5329','5330','5331','6070','6071','6072','6073','6079',
    '6522','6074'
  ];
  const prefix4 = n.substring(0, 4);
  if (debitPrefixes.includes(prefix4)) return 'Debit';

  // Amex is always credit
  if (/^3[47]/.test(n)) return 'Credit';

  // Default: length-based guess
  return n.length >= 4 ? 'Credit' : null;
}

// ─── BIN → Bank & Theme lookup ───────────────────────────────────────────────
// theme maps to CSS class: card-theme-{theme}
const BIN_DB = [
  // ── HDFC Bank ─────────────────────────────────────────────────────────
  { prefix: '4083',   name: 'HDFC Bank',        theme: 'hdfc'      },
  { prefix: '4084',   name: 'HDFC Bank',        theme: 'hdfc'      },
  { prefix: '4508',   name: 'HDFC Bank',        theme: 'hdfc'      },
  { prefix: '4556',   name: 'HDFC Bank',        theme: 'hdfc'      },
  { prefix: '5238',   name: 'HDFC Bank',        theme: 'hdfc'      },
  { prefix: '5239',   name: 'HDFC Bank',        theme: 'hdfc'      },
  { prefix: '5241',   name: 'HDFC Bank',        theme: 'hdfc'      },
  { prefix: '5243',   name: 'HDFC Bank',        theme: 'hdfc'      },
  // ── SBI ───────────────────────────────────────────────────────────────
  { prefix: '4532',   name: 'State Bank of India', theme: 'sbi'    },
  { prefix: '4561',   name: 'State Bank of India', theme: 'sbi'    },
  { prefix: '5200',   name: 'State Bank of India', theme: 'sbi'    },
  { prefix: '5204',   name: 'State Bank of India', theme: 'sbi'    },
  { prefix: '5259',   name: 'State Bank of India', theme: 'sbi'    },
  { prefix: '6071',   name: 'State Bank of India', theme: 'sbi'    },
  { prefix: '6074',   name: 'State Bank of India', theme: 'sbi'    },
  // ── ICICI Bank ────────────────────────────────────────────────────────
  { prefix: '4386',   name: 'ICICI Bank',        theme: 'icici'    },
  { prefix: '4387',   name: 'ICICI Bank',        theme: 'icici'    },
  { prefix: '4512',   name: 'ICICI Bank',        theme: 'icici'    },
  { prefix: '5130',   name: 'ICICI Bank',        theme: 'icici'    },
  { prefix: '5131',   name: 'ICICI Bank',        theme: 'icici'    },
  { prefix: '5176',   name: 'ICICI Bank',        theme: 'icici'    },
  // ── Axis Bank ─────────────────────────────────────────────────────────
  { prefix: '4607',   name: 'Axis Bank',         theme: 'axis'     },
  { prefix: '4614',   name: 'Axis Bank',         theme: 'axis'     },
  { prefix: '5329',   name: 'Axis Bank',         theme: 'axis'     },
  { prefix: '5330',   name: 'Axis Bank',         theme: 'axis'     },
  // ── Kotak Mahindra ────────────────────────────────────────────────────
  { prefix: '4619',   name: 'Kotak Mahindra',    theme: 'kotak'    },
  { prefix: '4643',   name: 'Kotak Mahindra',    theme: 'kotak'    },
  { prefix: '5310',   name: 'Kotak Mahindra',    theme: 'kotak'    },
  { prefix: '5331',   name: 'Kotak Mahindra',    theme: 'kotak'    },
  // ── Bank of Baroda ────────────────────────────────────────────────────
  { prefix: '4649',   name: 'Bank of Baroda',    theme: 'bob'      },
  { prefix: '4684',   name: 'Bank of Baroda',    theme: 'bob'      },
  { prefix: '5205',   name: 'Bank of Baroda',    theme: 'bob'      },
  // ── Punjab National Bank ──────────────────────────────────────────────
  { prefix: '4724',   name: 'Punjab National Bank', theme: 'pnb'   },
  { prefix: '4727',   name: 'Punjab National Bank', theme: 'pnb'   },
  { prefix: '5206',   name: 'Punjab National Bank', theme: 'pnb'   },
  // ── Canara Bank ──────────────────────────────────────────────────────
  { prefix: '4744',   name: 'Canara Bank',       theme: 'canara'   },
  { prefix: '5260',   name: 'Canara Bank',       theme: 'canara'   },
  // ── IndusInd Bank ─────────────────────────────────────────────────────
  { prefix: '4539',   name: 'IndusInd Bank',     theme: 'indusind' },
  { prefix: '5261',   name: 'IndusInd Bank',     theme: 'indusind' },
  // ── YES Bank ──────────────────────────────────────────────────────────
  { prefix: '4070',   name: 'YES Bank',          theme: 'yes'      },
  { prefix: '5261',   name: 'YES Bank',          theme: 'yes'      },
  // ── RuPay (NPCI) ──────────────────────────────────────────────────────
  { prefix: '6070',   name: 'RuPay Card',        theme: 'rupay'    },
  { prefix: '6072',   name: 'RuPay Card',        theme: 'rupay'    },
  { prefix: '6073',   name: 'RuPay Card',        theme: 'rupay'    },
  { prefix: '6079',   name: 'RuPay Card',        theme: 'rupay'    },
  { prefix: '6522',   name: 'RuPay Card',        theme: 'rupay'    },
  // ── Amex ──────────────────────────────────────────────────────────────
  { prefix: '3400',   name: 'American Express',  theme: 'amex'     },
  { prefix: '3700',   name: 'American Express',  theme: 'amex'     },
  { prefix: '3710',   name: 'American Express',  theme: 'amex'     },
];

// Theme display names for the UI
const CARD_THEMES = {
  hdfc:     { label: 'HDFC Midnight Blue',   gradient: 'linear-gradient(135deg, #003f88 0%, #0071c5 100%)' },
  sbi:      { label: 'SBI Royal Blue',       gradient: 'linear-gradient(135deg, #1a237e 0%, #283593 100%)' },
  icici:    { label: 'ICICI Coral Red',      gradient: 'linear-gradient(135deg, #b71c1c 0%, #e53935 100%)' },
  axis:     { label: 'Axis Maroon',          gradient: 'linear-gradient(135deg, #6a1c35 0%, #a01e48 100%)' },
  kotak:    { label: 'Kotak Red',            gradient: 'linear-gradient(135deg, #bf360c 0%, #e64a19 100%)' },
  bob:      { label: 'BoB Orange',           gradient: 'linear-gradient(135deg, #e65100 0%, #f57c00 100%)' },
  pnb:      { label: 'PNB Dark Red',         gradient: 'linear-gradient(135deg, #4a0000 0%, #b71c1c 100%)' },
  canara:   { label: 'Canara Deep Blue',     gradient: 'linear-gradient(135deg, #01579b 0%, #0288d1 100%)' },
  indusind: { label: 'IndusInd Purple',      gradient: 'linear-gradient(135deg, #4a148c 0%, #7b1fa2 100%)' },
  yes:      { label: 'YES Bank Blue',        gradient: 'linear-gradient(135deg, #002a9e 0%, #0041bf 100%)' },
  rupay:    { label: 'RuPay Tricolor',       gradient: 'linear-gradient(135deg, #1565c0 0%, #2e7d32 100%)' },
  amex:     { label: 'Amex Centurion',       gradient: 'linear-gradient(135deg, #37474f 0%, #607d8b 100%)' },
  // Generic fallbacks (manual selection)
  emerald:  { label: 'Emerald Ocean',        gradient: 'linear-gradient(135deg, #10B981 0%, #06B6D4 100%)' },
  coral:    { label: 'Coral Sunset',         gradient: 'linear-gradient(135deg, #FF5B35 0%, #FF8F73 100%)' },
  indigo:   { label: 'Indigo Nebula',        gradient: 'linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)' },
  sunset:   { label: 'Sunset Glow',          gradient: 'linear-gradient(135deg, #EC4899 0%, #F43F5E 100%)' },
  glass:    { label: 'Translucent Frost',    gradient: 'rgba(255,255,255,0.08)'                            },
};

function detectBankInfo(number) {
  const n = number.replace(/\D/g, '');
  if (n.length < 4) return null;

  // Try longest prefix match first (6 digits), then 5, then 4
  for (let len = 6; len >= 4; len--) {
    const prefix = n.substring(0, len);
    const match = BIN_DB.find(b => b.prefix === prefix);
    if (match) return match;
  }
  return null;
}

const FALLBACK_THEMES = ['emerald', 'coral', 'indigo', 'sunset', 'glass'];

// Network badge coloring
const NETWORK_COLORS = {
  VISA:       '#1a1f71',
  MasterCard: '#ffeb3b',
  RuPay:      '#34c759',
  Amex:       '#2196f3',
  Discover:   '#ff9800',
  Diners:     '#607d8b',
  JCB:        '#9c27b0',
  Unknown:    '#7D8B9D',
};

export default function AddCardModal({ onSubmit, onClose }) {
  const [cardNumberInput, setCardNumberInput] = useState(''); // raw 16-digit input
  const [holder, setHolder]     = useState('DIVYA');
  const [expiry, setExpiry]     = useState('');
  const [theme, setTheme]       = useState('emerald');
  const [manualName, setManualName] = useState('');
  const [cardType, setCardType] = useState('Credit'); // 'Credit' | 'Debit'

  // Auto-detected fields
  const [detectedNetwork, setDetectedNetwork] = useState(null);
  const [detectedCardType, setDetectedCardType] = useState(null);
  const [detectedBank, setDetectedBank] = useState(null); // { name, theme }

  // ── Watch card number input for auto-detection ─────────────────────────
  useEffect(() => {
    const digits = cardNumberInput.replace(/\D/g, '');

    const network = detectNetwork(digits);
    setDetectedNetwork(digits.length >= 1 ? network : null);

    const autoCardType = detectCardType(digits);
    setDetectedCardType(digits.length >= 4 ? autoCardType : null);
    // Auto-update the user-facing toggle too
    if (digits.length >= 4 && autoCardType) setCardType(autoCardType);

    const bankInfo = detectBankInfo(digits);
    setDetectedBank(digits.length >= 4 ? bankInfo : null);

    // Auto-apply bank theme & name when we have a match
    if (bankInfo) {
      setTheme(bankInfo.theme);
      setManualName(bankInfo.name);
    } else if (network && network !== 'Unknown') {
      // No bank match yet: keep current theme
    }
  }, [cardNumberInput]);

  // ── Format card number display (groups of 4) ─────────────────────────────
  const formatCardInput = (raw) => {
    const digits = raw.replace(/\D/g, '').substring(0, 16);
    return digits.replace(/(.{4})/g, '$1 ').trim();
  };

  const handleCardNumberChange = (e) => {
    const formatted = formatCardInput(e.target.value);
    setCardNumberInput(formatted);
  };

  const handleExpiryChange = (e) => {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length > 2) value = value.substring(0, 2) + '/' + value.substring(2, 4);
    setExpiry(value.substring(0, 5));
  };

  const getLast4 = () => {
    const digits = cardNumberInput.replace(/\D/g, '');
    return digits.length >= 4 ? digits.slice(-4) : null;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const digits = cardNumberInput.replace(/\D/g, '');
    const last4 = getLast4();

    if (digits.length < 13) {
      alert('Please enter a valid card number (at least 13 digits).');
      return;
    }
    if (!holder.trim()) {
      alert('Please enter the card holder name.');
      return;
    }
    if (!expiry.match(/^\d{2}\/\d{2}$/)) {
      alert('Expiry must be in MM/YY format.');
      return;
    }

    onSubmit({
      id: Math.random().toString(36).substring(2, 9),
      name: manualName || detectedBank?.name || detectedNetwork || 'My Card',
      type: detectedNetwork || 'Unknown',
      cardType,
      number: `**** **** **** ${last4}`,
      holder: holder.toUpperCase(),
      expiry,
      theme,
    });
  };

  const last4 = getLast4();
  const currentThemeStyle = CARD_THEMES[theme] || CARD_THEMES.emerald;

  return (
    <div className="modal-overlay animate-fade-in" onClick={onClose}>
      <div
        className="modal-content glass-card animate-slide-up"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '480px', width: '100%' }}
      >
        <div className="modal-header">
          <h3>Add New Card</h3>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {/* ── Live Card Preview ── */}
        <div
          style={{
            background: theme === 'glass'
              ? 'rgba(255,255,255,0.08)'
              : currentThemeStyle.gradient,
            backdropFilter: theme === 'glass' ? 'blur(20px)' : 'none',
            border: theme === 'glass' ? '1px solid rgba(255,255,255,0.15)' : 'none',
            borderRadius: '16px',
            padding: '20px',
            margin: '16px 0',
            color: 'white',
            minHeight: '150px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            transition: 'background 0.5s ease',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative circle */}
          <div style={{
            position: 'absolute', top: -30, right: -30,
            width: 120, height: 120,
            borderRadius: '50%',
            background: 'rgba(255,255,255,0.08)',
            pointerEvents: 'none'
          }} />

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <div style={{ fontSize: '13px', opacity: 0.75 }}>
                {detectedCardType
                  ? <span style={{
                      background: 'rgba(255,255,255,0.15)',
                      padding: '2px 8px',
                      borderRadius: '20px',
                      fontSize: '11px',
                      fontWeight: '600',
                      letterSpacing: '0.5px',
                    }}>{detectedCardType} Card</span>
                  : null}
              </div>
              <div style={{ fontSize: '16px', fontWeight: '700', marginTop: '4px' }}>
                {manualName || detectedBank?.name || (detectedNetwork && detectedNetwork !== 'Unknown' ? `${detectedNetwork} Card` : 'Your Card')}
              </div>
            </div>
            {detectedNetwork && detectedNetwork !== 'Unknown' && (
              <div style={{
                background: detectedNetwork === 'MasterCard' ? '#1a1f71' : 'rgba(255,255,255,0.15)',
                padding: '4px 10px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 'bold',
                fontStyle: detectedNetwork === 'MasterCard' ? 'italic' : 'normal',
                color: NETWORK_COLORS[detectedNetwork] === '#ffeb3b' ? '#ffeb3b' : 'white',
              }}>
                {detectedNetwork}
              </div>
            )}
          </div>

          <div style={{ fontSize: '20px', letterSpacing: '3px', fontFamily: 'monospace', textShadow: '0 1px 3px rgba(0,0,0,0.3)', marginTop: '16px' }}>
            {cardNumberInput
              ? cardNumberInput.replace(/\d(?=\d{4})/g, '*').padEnd(19, '_').replace(/_/g, ' ')
              : '**** **** **** ****'}
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginTop: '16px', opacity: 0.85 }}>
            <span>Card Holder<br /><strong>{holder.toUpperCase() || 'YOUR NAME'}</strong></span>
            <span>Expires<br /><strong>{expiry || 'MM/YY'}</strong></span>
          </div>
        </div>

        {/* ── Auto-detected info badges ── */}
        {(detectedNetwork || detectedCardType || detectedBank) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '12px' }}>
            {detectedNetwork && detectedNetwork !== 'Unknown' && (
              <span style={{
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                color: 'var(--text-main)',
              }}>🔍 {detectedNetwork}</span>
            )}
            {detectedCardType && (
              <span style={{
                background: detectedCardType === 'Credit'
                  ? 'rgba(16,185,129,0.1)' : 'rgba(59,130,246,0.1)',
                border: `1px solid ${detectedCardType === 'Credit' ? 'rgba(16,185,129,0.3)' : 'rgba(59,130,246,0.3)'}`,
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                color: detectedCardType === 'Credit' ? 'var(--emerald)' : '#60a5fa',
              }}>💳 {detectedCardType}</span>
            )}
            {detectedBank && (
              <span style={{
                background: 'rgba(255,91,53,0.1)',
                border: '1px solid rgba(255,91,53,0.3)',
                padding: '3px 10px',
                borderRadius: '20px',
                fontSize: '12px',
                color: 'var(--indigo)',
              }}>🏦 {detectedBank.name}</span>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="transaction-form" style={{ marginTop: '4px' }}>
          {/* Card Number */}
          <div className="form-group">
            <label htmlFor="cardNumber">Card Number *</label>
            <input
              id="cardNumber"
              type="text"
              inputMode="numeric"
              value={cardNumberInput}
              onChange={handleCardNumberChange}
              placeholder="1234 5678 9012 3456"
              required
              style={{ fontFamily: 'monospace', fontSize: '18px', letterSpacing: '2px' }}
            />
          </div>

          {/* ── Credit / Debit Toggle ── */}
          <div className="form-group">
            <label>Card Type <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>(auto-detected · tap to override)</span></label>
            <div style={{ display: 'flex', gap: '10px', marginTop: '8px' }}>
              {['Credit', 'Debit'].map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setCardType(t)}
                  style={{
                    flex: 1, padding: '10px', borderRadius: '10px',
                    fontWeight: '700', fontSize: '13px', cursor: 'pointer',
                    border: cardType === t
                      ? `1px solid ${t === 'Credit' ? 'rgba(16,185,129,0.6)' : 'rgba(59,130,246,0.6)'}`
                      : '1px solid rgba(255,255,255,0.08)',
                    background: cardType === t
                      ? (t === 'Credit' ? 'rgba(16,185,129,0.15)' : 'rgba(59,130,246,0.15)')
                      : 'rgba(255,255,255,0.03)',
                    color: cardType === t
                      ? (t === 'Credit' ? '#6ee7b7' : '#93c5fd')
                      : 'var(--text-muted)',
                    transition: 'all 0.2s',
                  }}
                >
                  {t === 'Credit' ? '💳 Credit' : '🏧 Debit'}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Card Holder */}
            <div className="form-group">
              <label htmlFor="holder">Card Holder *</label>
              <input
                id="holder"
                type="text"
                value={holder}
                onChange={e => setHolder(e.target.value)}
                placeholder="e.g. DIVYA"
                required
                maxLength="30"
              />
            </div>
            {/* Expiry */}
            <div className="form-group">
              <label htmlFor="expiry">Expiry (MM/YY) *</label>
              <input
                id="expiry"
                type="text"
                value={expiry}
                onChange={handleExpiryChange}
                placeholder="MM/YY"
                required
              />
            </div>
          </div>

          {/* Bank / Card Name (editable override) */}
          <div className="form-group">
            <label htmlFor="manualName">Bank / Card Name</label>
            <input
              id="manualName"
              type="text"
              value={manualName}
              onChange={e => setManualName(e.target.value)}
              placeholder={detectedBank?.name || 'e.g. HDFC Regalia'}
              maxLength="25"
            />
          </div>

          {/* Theme Picker (manual override) */}
          <div className="form-group">
            <label>Card Color Theme <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>(auto-set by bank, override below)</span></label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '8px' }}>
              {Object.entries(CARD_THEMES).map(([id, { label, gradient }]) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => setTheme(id)}
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: '50%',
                    background: gradient,
                    backdropFilter: id === 'glass' ? 'blur(4px)' : 'none',
                    border: theme === id ? '2.5px solid #FFFFFF' : '2px solid transparent',
                    cursor: 'pointer',
                    boxShadow: theme === id ? '0 0 8px rgba(255,255,255,0.7)' : 'none',
                    transition: 'all 0.2s',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
            <div style={{ marginTop: '6px', fontSize: '12px', color: 'var(--text-muted)' }}>
              {CARD_THEMES[theme]?.label || 'Custom'}
            </div>
          </div>

          <div className="form-actions" style={{ marginTop: '20px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary">Add Card</button>
          </div>
        </form>
      </div>
    </div>
  );
}
