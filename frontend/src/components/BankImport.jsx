import React, { useState, useRef, useCallback } from 'react';
import { createTransaction } from '../utils/api';
import './BankImport.css';

// ─── Bank Format Definitions ─────────────────────────────────────────────────
// Each bank has different CSV column names. We map them to our schema.
const BANK_FORMATS = {
  HDFC: {
    name: 'HDFC Bank',
    logo: '🏦',
    color: '#004C97',
    detect: (headers) =>
      headers.some(h => h.includes('Narration')) &&
      headers.some(h => h.includes('Withdrawal Amt')),
    dateCol: h => h.includes('Date'),
    descCol: h => h.includes('Narration'),
    debitCol: h => h.includes('Withdrawal Amt'),
    creditCol: h => h.includes('Deposit Amt'),
    amountCol: null,
    typeFromCols: true,
  },
  SBI: {
    name: 'State Bank of India',
    logo: '🏛️',
    color: '#22409A',
    detect: (headers) =>
      headers.some(h => h.includes('Txn Date')) &&
      headers.some(h => h.includes('Description')) &&
      headers.some(h => h.includes('Debit')),
    dateCol: h => h.includes('Txn Date') || h.includes('Transaction Date'),
    descCol: h => h.includes('Description'),
    debitCol: h => h === 'Debit' || h.includes('Debit'),
    creditCol: h => h === 'Credit' || h.includes('Credit'),
    amountCol: null,
    typeFromCols: true,
  },
  ICICI: {
    name: 'ICICI Bank',
    logo: '🔷',
    color: '#F58220',
    detect: (headers) =>
      headers.some(h => h.includes('Transaction Date')) &&
      headers.some(h => h.includes('Transaction Remarks')),
    dateCol: h => h.includes('Transaction Date') || h.includes('Value Date'),
    descCol: h => h.includes('Transaction Remarks') || h.includes('Remarks'),
    debitCol: h => h.includes('Withdrawal Amount') || h.includes('Debit'),
    creditCol: h => h.includes('Deposit Amount') || h.includes('Credit'),
    amountCol: null,
    typeFromCols: true,
  },
  AXIS: {
    name: 'Axis Bank',
    logo: '🟣',
    color: '#97144D',
    detect: (headers) =>
      headers.some(h => h.includes('Tran Date')) &&
      headers.some(h => h.includes('PARTICULARS')),
    dateCol: h => h.includes('Tran Date') || h.includes('Transaction Date'),
    descCol: h => h.includes('PARTICULARS') || h.includes('Particulars'),
    debitCol: h => h.includes('DR') || h.includes('Debit'),
    creditCol: h => h.includes('CR') || h.includes('Credit'),
    amountCol: null,
    typeFromCols: true,
  },
  KOTAK: {
    name: 'Kotak Mahindra Bank',
    logo: '🔴',
    color: '#ED1C24',
    detect: (headers) =>
      headers.some(h => h.includes('Transaction Date')) &&
      headers.some(h => h.includes('Description')) &&
      headers.some(h => h.includes('Amount')),
    dateCol: h => h.includes('Transaction Date') || h.includes('Date'),
    descCol: h => h.includes('Description'),
    debitCol: null,
    creditCol: null,
    amountCol: h => h === 'Amount' || h.includes('Amount (INR)'),
    typeCol: h => h.includes('Dr/Cr') || h.includes('Type'),
    typeFromCols: false,
  },
  GENERIC: {
    name: 'Generic / Other',
    logo: '🏦',
    color: '#10B981',
    detect: () => true,
    dateCol: h => /date/i.test(h),
    descCol: h => /description|narration|details|particulars|remark/i.test(h),
    debitCol: h => /debit|withdrawal|dr\b|amount.*dr/i.test(h),
    creditCol: h => /credit|deposit|cr\b|amount.*cr/i.test(h),
    amountCol: h => /^amount$/i.test(h),
    typeFromCols: true,
  },
};

// ─── Helper: Detect bank from CSV headers ──────────────────────────────────
function detectBank(headers) {
  const cleanHeaders = headers.map(h => h.trim());
  for (const [key, fmt] of Object.entries(BANK_FORMATS)) {
    if (key !== 'GENERIC' && fmt.detect(cleanHeaders)) return { key, fmt };
  }
  return { key: 'GENERIC', fmt: BANK_FORMATS.GENERIC };
}

// ─── Helper: Parse CSV string into rows ───────────────────────────────────
function parseCSV(text) {
  const lines = text.split('\n').filter(l => l.trim());
  // Find the header row (first row with multiple commas)
  let headerIdx = 0;
  for (let i = 0; i < Math.min(10, lines.length); i++) {
    if (lines[i].split(',').length >= 3) {
      headerIdx = i;
      break;
    }
  }

  const headers = lines[headerIdx].split(',').map(h =>
    h.replace(/^["'\s]+|["'\s]+$/g, '').trim()
  );

  const rows = [];
  for (let i = headerIdx + 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    // Handle quoted commas
    const cols = [];
    let inQuote = false;
    let cur = '';
    for (const ch of line) {
      if (ch === '"') { inQuote = !inQuote; continue; }
      if (ch === ',' && !inQuote) { cols.push(cur.trim()); cur = ''; }
      else cur += ch;
    }
    cols.push(cur.trim());

    if (cols.length >= headers.length - 2) {
      const row = {};
      headers.forEach((h, idx) => { row[h] = (cols[idx] || '').trim(); });
      rows.push(row);
    }
  }
  return { headers, rows };
}

// ─── Helper: Parse amount string ──────────────────────────────────────────
function parseAmount(str) {
  if (!str || str.trim() === '' || str.trim() === '-') return 0;
  return parseFloat(str.replace(/[^0-9.]/g, '')) || 0;
}

// ─── Helper: Map CSV rows to transactions ─────────────────────────────────
function mapRowsToTransactions(rows, headers, fmt) {
  const dateKey = headers.find(h => fmt.dateCol(h));
  const descKey = headers.find(h => fmt.descCol(h));
  const debitKey = fmt.debitCol ? headers.find(h => fmt.debitCol(h)) : null;
  const creditKey = fmt.creditCol ? headers.find(h => fmt.creditCol(h)) : null;
  const amountKey = fmt.amountCol ? headers.find(h => fmt.amountCol(h)) : null;
  const typeKey = fmt.typeCol ? headers.find(h => fmt.typeCol(h)) : null;

  return rows.map((row, idx) => {
    const description = (row[descKey] || `Bank Transaction ${idx + 1}`).slice(0, 100);
    const rawDate = row[dateKey] || '';

    // Parse date — handle DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD
    let date = new Date().toISOString().split('T')[0];
    if (rawDate) {
      const d = rawDate.replace(/\//g, '-');
      const parts = d.split('-');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          // DD-MM-YYYY
          date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        } else {
          // YYYY-MM-DD
          date = d;
        }
      }
    }

    let amount = 0;
    let type = 'expense';

    if (fmt.typeFromCols && debitKey && creditKey) {
      const debit = parseAmount(row[debitKey]);
      const credit = parseAmount(row[creditKey]);
      if (credit > 0) { amount = credit; type = 'income'; }
      else if (debit > 0) { amount = debit; type = 'expense'; }
      else { amount = 0; }
    } else if (amountKey) {
      amount = Math.abs(parseAmount(row[amountKey]));
      // Detect type from a Dr/Cr column
      if (typeKey) {
        const t = (row[typeKey] || '').toLowerCase();
        type = t.includes('cr') || t.includes('credit') ? 'income' : 'expense';
      }
    }

    // Smart category guessing from description
    const category = guessCategory(description);

    return { description, amount, type, category, date, notes: 'Imported via Bank Statement' };
  }).filter(tx => tx.amount > 0);
}

// ─── Helper: Auto-guess category from description keywords ────────────────
function guessCategory(desc) {
  const d = desc.toLowerCase();
  if (/salary|sal credit|payroll|employer/i.test(d)) return 'Income';
  if (/grocery|bigbasket|blinkit|zepto|grofer|dmart|reliance fresh|nature|vegetable|fruit/i.test(d)) return 'Groceries';
  if (/swiggy|zomato|domino|pizza|burger|kfc|mcdonald|restaurant|cafe|food/i.test(d)) return 'Food';
  if (/petrol|fuel|diesel|bpcl|iocl|hp petro|gas station/i.test(d)) return 'Fuel';
  if (/uber|ola|rapido|metro|irctc|railway|flight|makemytrip|goibibo|bus/i.test(d)) return 'Transport';
  if (/amazon|flipkart|myntra|ajio|nykaa|meesho|shopping|mall/i.test(d)) return 'Shopping';
  if (/emi|loan|home loan|car loan|personal loan|mortgage/i.test(d)) return 'EMI';
  if (/electricity|bescom|tata power|adani|water bill|gas bill|bsnl|airtel|jio|vi |recharge/i.test(d)) return 'Utilities';
  if (/hospital|pharmacy|medic|health|apollo|fortis|doctor|clinic/i.test(d)) return 'Healthcare';
  if (/netflix|hotstar|spotify|amazon prime|youtube|subscription/i.test(d)) return 'Entertainment';
  if (/school|college|education|tuition|fees|book/i.test(d)) return 'Education';
  if (/emi|loan|home loan|car loan|personal loan|mortgage/i.test(d)) return 'EMI';
  if (/insurance|lic|premium/i.test(d)) return 'Insurance';
  if (/atm|cash withdrawal/i.test(d)) return 'Cash';
  if (/transfer|neft|rtgs|imps|upi|gpay|phonepe|paytm/i.test(d)) return 'Transfer';
  return 'Other';
}

// ─── Helper: Map CSV rows using custom column mapping ──────────────────────
function mapCustomRowsToTransactions(rows, mapping) {
  return rows.map((row, idx) => {
    const description = (row[mapping.desc] || `Transaction ${idx + 1}`).slice(0, 100);
    const rawDate = row[mapping.date] || '';

    // Parse date
    let date = new Date().toISOString().split('T')[0];
    if (rawDate) {
      const d = rawDate.replace(/\//g, '-');
      const parts = d.split('-');
      if (parts.length === 3) {
        if (parts[2].length === 4) {
          date = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
        } else {
          date = d;
        }
      }
    }

    let amount = 0;
    let type = 'expense';

    if (mapping.debit && mapping.credit) {
      const debit = parseAmount(row[mapping.debit]);
      const credit = parseAmount(row[mapping.credit]);
      if (credit > 0) {
        amount = credit;
        type = 'income';
      } else if (debit > 0) {
        amount = debit;
        type = 'expense';
      }
    } else if (mapping.amount) {
      amount = Math.abs(parseAmount(row[mapping.amount]));
      if (mapping.typeCol) {
        const t = (row[mapping.typeCol] || '').toLowerCase();
        type = t.includes('cr') || t.includes('credit') || t.includes('dep') || t.includes('inc') ? 'income' : 'expense';
      } else {
        const rawAmt = row[mapping.amount] || '';
        if (rawAmt.includes('-') || parseFloat(rawAmt.replace(/[^0-9.-]/g, '')) < 0) {
          type = 'expense';
        } else {
          type = 'income';
        }
      }
    }

    const category = guessCategory(description);
    return { description, amount, type, category, date, notes: 'Imported via Bank Statement' };
  }).filter(tx => tx.amount > 0);
}

// ─── Indian Banks Database (120+ Banks) ──────────────────────────────────────
const INDIAN_BANKS = [
  // Popular / Major
  { code: 'SBI', name: 'State Bank of India', logo: '🏛️', type: 'Public', popular: true, color: '#22409A' },
  { code: 'HDFC', name: 'HDFC Bank', logo: '🏦', type: 'Private', popular: true, color: '#004C97' },
  { code: 'ICICI', name: 'ICICI Bank', logo: '🔷', type: 'Private', popular: true, color: '#F58220' },
  { code: 'AXIS', name: 'Axis Bank', logo: '🟣', type: 'Private', popular: true, color: '#97144D' },
  { code: 'KOTAK', name: 'Kotak Mahindra Bank', logo: '🔴', type: 'Private', popular: true, color: '#ED1C24' },
  { code: 'PNB', name: 'Punjab National Bank', logo: '🏛️', type: 'Public', popular: true, color: '#8A1538' },
  { code: 'BOB', name: 'Bank of Baroda', logo: '🏛️', type: 'Public', popular: true, color: '#F26F21' },
  { code: 'CANARA', name: 'Canara Bank', logo: '🏛️', type: 'Public', popular: true, color: '#0091FF' },
  { code: 'YES', name: 'Yes Bank', logo: '🏦', type: 'Private', popular: true, color: '#0054A6' },

  // Public Sector Banks
  { code: 'UNION', name: 'Union Bank of India', logo: '🏛️', type: 'Public' },
  { code: 'BOI', name: 'Bank of India', logo: '🏛️', type: 'Public' },
  { code: 'INDIAN', name: 'Indian Bank', logo: '🏛️', type: 'Public' },
  { code: 'IOB', name: 'Indian Overseas Bank', logo: '🏛️', type: 'Public' },
  { code: 'CENTRAL', name: 'Central Bank of India', logo: '🏛️', type: 'Public' },
  { code: 'UCO', name: 'UCO Bank', logo: '🏛️', type: 'Public' },
  { code: 'MAHA', name: 'Bank of Maharashtra', logo: '🏛️', type: 'Public' },
  { code: 'PSB', name: 'Punjab & Sind Bank', logo: '🏛️', type: 'Public' },
  { code: 'IDBI', name: 'IDBI Bank', logo: '🏛️', type: 'Public' },

  // Private Sector Banks
  { code: 'INDUSIND', name: 'IndusInd Bank', logo: '🏦', type: 'Private' },
  { code: 'FEDERAL', name: 'Federal Bank', logo: '🏦', type: 'Private' },
  { code: 'IDFC', name: 'IDFC FIRST Bank', logo: '🏦', type: 'Private' },
  { code: 'RBL', name: 'RBL Bank', logo: '🏦', type: 'Private' },
  { code: 'BANDHAN', name: 'Bandhan Bank', logo: '🏦', type: 'Private' },
  { code: 'SOUTH', name: 'South Indian Bank', logo: '🏦', type: 'Private' },
  { code: 'KARUR', name: 'Karur Vysya Bank', logo: '🏦', type: 'Private' },
  { code: 'KARNATAKA', name: 'Karnataka Bank', logo: '🏦', type: 'Private' },
  { code: 'CUB', name: 'City Union Bank', logo: '🏦', type: 'Private' },
  { code: 'JK', name: 'Jammu & Kashmir Bank', logo: '🏦', type: 'Private' },
  { code: 'TMB', name: 'Tamilnad Mercantile Bank', logo: '🏦', type: 'Private' },
  { code: 'CSB', name: 'CSB Bank', logo: '🏦', type: 'Private' },
  { code: 'DCB', name: 'DCB Bank', logo: '🏦', type: 'Private' },
  { code: 'DHANLAXMI', name: 'Dhanlaxmi Bank', logo: '🏦', type: 'Private' },
  { code: 'NAINITAL', name: 'Nainital Bank', logo: '🏦', type: 'Private' },

  // Small Finance Banks
  { code: 'AU', name: 'AU Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'EQUITAS', name: 'Equitas Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'UJJIVAN', name: 'Ujjivan Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'ESAF', name: 'ESAF Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'FINCARE', name: 'Fincare Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'UTKARSH', name: 'Utkarsh Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'SURYODAY', name: 'Suryoday Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'CAPITAL', name: 'Capital Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'JANA', name: 'Jana Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'UNITY', name: 'Unity Small Finance Bank', logo: '⚡', type: 'SFB' },
  { code: 'SHIVALIK', name: 'Shivalik Small Finance Bank', logo: '⚡', type: 'SFB' },

  // Payments Banks
  { code: 'PAYTM', name: 'Paytm Payments Bank', logo: '📱', type: 'Payments' },
  { code: 'AIRTEL', name: 'Airtel Payments Bank', logo: '📱', type: 'Payments' },
  { code: 'IPPB', name: 'India Post Payments Bank', logo: '📯', type: 'Payments' },
  { code: 'JIO', name: 'Jio Payments Bank', logo: '📱', type: 'Payments' },
  { code: 'FINO', name: 'Fino Payments Bank', logo: '📱', type: 'Payments' },
  { code: 'NSDL', name: 'NSDL Payments Bank', logo: '📱', type: 'Payments' },
  { code: 'FAMPAY', name: 'FamPay / FamApp', logo: '📱', type: 'Payments' },


  // Cooperative & Gramin Banks
  { code: 'SARASWAT', name: 'Saraswat Co-operative Bank', logo: '🤝', type: 'Cooperative' },
  { code: 'COSMOS', name: 'Cosmos Co-operative Bank', logo: '🤝', type: 'Cooperative' },
  { code: 'SVC', name: 'SVC Co-operative Bank', logo: '🤝', type: 'Cooperative' },
  { code: 'TJSB', name: 'TJSB Sahakari Bank', logo: '🤝', type: 'Cooperative' },
  { code: 'GPB', name: 'Gopinath Patil Parsik Bank', logo: '🤝', type: 'Cooperative' },
  { code: 'KERALA_GRAMIN', name: 'Kerala Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'BARODA_UP', name: 'Baroda UP Bank', logo: '🌾', type: 'Rural' },
  { code: 'PRATHAMA_UP', name: 'Prathama UP Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'MAHA_GRAMIN', name: 'Maharashtra Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'APGB', name: 'Andhra Pragathi Grameena Bank', logo: '🌾', type: 'Rural' },
  { code: 'KVGB', name: 'Karnataka Vikas Grameena Bank', logo: '🌾', type: 'Rural' },
  { code: 'ODISHA_GRAMYA', name: 'Odisha Gramya Bank', logo: '🌾', type: 'Rural' },
  { code: 'PASCHIM_BANGA', name: 'Paschim Banga Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'RAJASTHAN_MARUDHARA', name: 'Rajasthan Marudhara Bank', logo: '🌾', type: 'Rural' },
  { code: 'TELANGANA_GRAMINA', name: 'Telangana Grameena Bank', logo: '🌾', type: 'Rural' },
  { code: 'UTTAR_BIHAR', name: 'Uttar Bihar Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'MADHYANCHAL', name: 'Madhyanchal Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'SAURASHTRA', name: 'Saurashtra Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'UTKAL', name: 'Utkal Grameen Bank', logo: '🌾', type: 'Rural' },
  { code: 'TRIPURA', name: 'Tripura Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'ASSAM_GRAMIN', name: 'Assam Gramin Vikash Bank', logo: '🌾', type: 'Rural' },
  { code: 'BANGIYA_GRAMIN', name: 'Bangiya Gramin Vikash Bank', logo: '🌾', type: 'Rural' },
  { code: 'BARODA_GUJ', name: 'Baroda Gujarat Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'BARODA_RAJ', name: 'Baroda Rajasthan Kshetriya Bank', logo: '🌾', type: 'Rural' },
  { code: 'CHAITANYA', name: 'Chaitanya Godavari Bank', logo: '🌾', type: 'Rural' },
  { code: 'CHHATTISGARH', name: 'Chhattisgarh Rajya Bank', logo: '🌾', type: 'Rural' },
  { code: 'DAKSHIN_BIHAR', name: 'Dakshin Bihar Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'ELLAQUAI', name: 'Ellaquai Dehati Bank', logo: '🌾', type: 'Rural' },
  { code: 'HP_GRAMIN', name: 'Himachal Pradesh Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'JK_GRAMIN', name: 'J&K Grameen Bank', logo: '🌾', type: 'Rural' },
  { code: 'JHARKHAND', name: 'Jharkhand Rajya Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'KARNATAKA_GRAMIN', name: 'Karnataka Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'MP_GRAMIN', name: 'Madhya Pradesh Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'MANIPUR_RURAL', name: 'Manipur Rural Bank', logo: '🌾', type: 'Rural' },
  { code: 'MEGHALAYA_RURAL', name: 'Meghalaya Rural Bank', logo: '🌾', type: 'Rural' },
  { code: 'MIZORAM_RURAL', name: 'Mizoram Rural Bank', logo: '🌾', type: 'Rural' },
  { code: 'NAGALAND_RURAL', name: 'Nagaland Rural Bank', logo: '🌾', type: 'Rural' },
  { code: 'PUDUVAI', name: 'Puduvai Bharathiar Bank', logo: '🌾', type: 'Rural' },
  { code: 'PUNJAB_GRAMIN', name: 'Punjab Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'HARYANA_GRAMIN', name: 'Sarva Haryana Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'UTTARAKHAND', name: 'Uttarakhand Gramin Bank', logo: '🌾', type: 'Rural' },
  { code: 'VIDHARBHA', name: 'Vidharbha Konkan Gramin Bank', logo: '🌾', type: 'Rural' },

  // Foreign Banks
  { code: 'CITI', name: 'Citibank India', logo: '🌐', type: 'Foreign' },
  { code: 'HSBC', name: 'HSBC India', logo: '🌐', type: 'Foreign' },
  { code: 'SCB', name: 'Standard Chartered India', logo: '🌐', type: 'Foreign' },
  { code: 'DBS', name: 'DBS Bank India', logo: '🌐', type: 'Foreign' },
  { code: 'DEUTSCHE', name: 'Deutsche Bank India', logo: '🌐', type: 'Foreign' },
  { code: 'BARCLAYS', name: 'Barclays Bank India', logo: '🌐', type: 'Foreign' },
  { code: 'BOA', name: 'Bank of America', logo: '🌐', type: 'Foreign' },
  { code: 'JPM', name: 'JPMorgan Chase Bank', logo: '🌐', type: 'Foreign' },
  { code: 'MUFG', name: 'MUFG Bank', logo: '🌐', type: 'Foreign' },
  { code: 'SBM', name: 'SBM Bank India', logo: '🌐', type: 'Foreign' }
];

// ─── Main Component ────────────────────────────────────────────────────────
export default function BankImport({ onImportComplete }) {
  const [stage, setStage] = useState('bank-select'); // bank-select | upload | map-columns | preview | importing | done
  const [selectedBank, setSelectedBank] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  const [dragOver, setDragOver] = useState(false);
  const [parsedRows, setParsedRows] = useState([]);
  const [headers, setHeaders] = useState([]);
  const [detectedBank, setDetectedBank] = useState(null);
  const [fmt, setFmt] = useState(null);

  // Custom Column Mapping States
  const [rawRows, setRawRows] = useState([]); // holds all raw rows from CSV
  const [rawRowsPreview, setRawRowsPreview] = useState([]); // first 3 rows
  const [mapping, setMapping] = useState({ date: '', desc: '', debit: '', credit: '', amount: '', typeCol: '' });
  const [isCustomMapped, setIsCustomMapped] = useState(false);

  const [selectedRows, setSelectedRows] = useState(new Set());
  const [importProgress, setImportProgress] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef();

  // Filters bank list
  const filteredBanks = React.useMemo(() => {
    return INDIAN_BANKS.filter(bank => {
      const matchesSearch = bank.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            bank.code.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCat = activeCategory === 'All' || 
                         (activeCategory === 'Public' && bank.type === 'Public') ||
                         (activeCategory === 'Private' && bank.type === 'Private') ||
                         (activeCategory === 'SFB' && (bank.type === 'SFB' || bank.type === 'Payments')) ||
                         (activeCategory === 'Rural' && (bank.type === 'Cooperative' || bank.type === 'Rural')) ||
                         (activeCategory === 'Foreign' && bank.type === 'Foreign');
      return matchesSearch && matchesCat;
    });
  }, [searchQuery, activeCategory]);

  // Popular banks lists
  const popularBanks = React.useMemo(() => {
    return INDIAN_BANKS.filter(b => b.popular);
  }, []);

  const handleBankSelect = (bank) => {
    setSelectedBank(bank);
    setError('');
    setStage('upload');
  };

  const processFile = useCallback((file) => {
    if (!file) return;
    if (!file.name.match(/\.(csv|xls|xlsx|txt)$/i)) {
      setError('Please upload a CSV or Excel file from your bank.');
      return;
    }
    setFileName(file.name);
    setError('');

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const text = e.target.result;
        const { headers: h, rows } = parseCSV(text);
        if (h.length === 0 || rows.length === 0) {
          setError('File seems to be empty or in an unsupported format.');
          return;
        }
        
        setHeaders(h);
        setRawRows(rows);
        setRawRowsPreview(rows.slice(0, 3));

        // Attempt automatic parsing based on bank format or generic parser
        let bankKey = selectedBank?.code || 'GENERIC';
        let detectedFmt = BANK_FORMATS[bankKey];

        // If not a pre-coded template, use GENERIC rules
        if (!detectedFmt) {
          const { key, fmt: autoFmt } = detectBank(h);
          detectedFmt = autoFmt;
          bankKey = key;
        }

        let mapped = [];
        let autoSuccess = false;
        try {
          mapped = mapRowsToTransactions(rows, h, detectedFmt);
          if (mapped.length > 0) {
            autoSuccess = true;
          }
        } catch (err) {
          autoSuccess = false;
        }

        if (autoSuccess) {
          setDetectedBank({
            key: bankKey,
            name: selectedBank?.name || detectedFmt.name,
            logo: selectedBank?.logo || detectedFmt.logo
          });
          setParsedRows(mapped);
          setFmt(detectedFmt);
          setSelectedRows(new Set(mapped.map((_, i) => i)));
          setIsCustomMapped(false);
          setStage('preview');
        } else {
          // Auto parsing failed, launch column mapper
          // Guess columns
          const dateGuess = h.find(col => /date/i.test(col)) || h[0] || '';
          const descGuess = h.find(col => /description|narration|details|particulars|remark/i.test(col)) || h[1] || '';
          const debitGuess = h.find(col => /debit|withdrawal|dr\b/i.test(col)) || '';
          const creditGuess = h.find(col => /credit|deposit|cr\b/i.test(col)) || '';
          const amountGuess = h.find(col => /^amount$/i.test(col)) || '';

          setMapping({
            date: dateGuess,
            desc: descGuess,
            debit: debitGuess,
            credit: creditGuess,
            amount: amountGuess,
            typeCol: ''
          });
          setStage('map-columns');
        }
      } catch (err) {
        setError('Failed to parse the file. Please check for formatting errors.');
      }
    };
    reader.readAsText(file, 'utf-8');
  }, [selectedBank]);

  // Calculate live mapped rows for the preview screen in mapper stage
  const liveMappedPreview = React.useMemo(() => {
    if (stage !== 'map-columns' || rawRowsPreview.length === 0) return [];
    try {
      return mapCustomRowsToTransactions(rawRowsPreview, mapping);
    } catch (e) {
      return [];
    }
  }, [rawRowsPreview, mapping, stage]);

  const handleConfirmMapping = () => {
    if (!mapping.date || !mapping.desc) {
      setError('Date and Description columns are required.');
      return;
    }
    if (!(mapping.debit && mapping.credit) && !mapping.amount) {
      setError('You must map either both Debit/Credit columns OR a single Amount column.');
      return;
    }

    try {
      const mapped = mapCustomRowsToTransactions(rawRows, mapping);
      if (mapped.length === 0) {
        setError('No transactions could be parsed with this mapping. Verify your headers and values.');
        return;
      }
      setDetectedBank({
        key: selectedBank?.code || 'GENERIC',
        name: selectedBank?.name || 'Generic Bank',
        logo: selectedBank?.logo || '🏦'
      });
      setParsedRows(mapped);
      setSelectedRows(new Set(mapped.map((_, i) => i)));
      setIsCustomMapped(true);
      setStage('preview');
      setError('');
    } catch (err) {
      setError('Error parsing mapping: ' + err.message);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    processFile(e.dataTransfer.files[0]);
  };

  const handleFileChange = (e) => processFile(e.target.files[0]);

  const toggleRow = (idx) => {
    setSelectedRows(prev => {
      const next = new Set(prev);
      next.has(idx) ? next.delete(idx) : next.add(idx);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedRows.size === parsedRows.length) setSelectedRows(new Set());
    else setSelectedRows(new Set(parsedRows.map((_, i) => i)));
  };

  const handleImport = async () => {
    const toImport = parsedRows.filter((_, i) => selectedRows.has(i));
    if (toImport.length === 0) return;

    setStage('importing');
    let count = 0;
    for (const tx of toImport) {
      try {
        await createTransaction(tx);
        count++;
        setImportProgress(Math.round((count / toImport.length) * 100));
        setImportedCount(count);
      } catch (e) {
        // skip failed ones silently
      }
    }
    setStage('done');
    if (onImportComplete) setTimeout(() => onImportComplete(), 1500);
  };

  const resetImport = () => {
    setStage('bank-select');
    setSelectedBank(null);
    setSearchQuery('');
    setParsedRows([]);
    setSelectedRows(new Set());
    setRawRows([]);
    setRawRowsPreview([]);
    setImportProgress(0);
    setImportedCount(0);
    setError('');
    setFileName('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="bank-import-container animate-fade-in">
      
      {/* ── Stage 0: Bank Select ───────────────────────────────────────── */}
      {stage === 'bank-select' && (
        <div className="bi-bank-select-stage">
          <div className="bi-hero">
            <div className="bi-hero-icon">🏛️</div>
            <h2>Select Your Bank</h2>
            <p>Select your Indian bank to import statements. Works with any Bank statement in India using our intelligent column mapper.</p>
          </div>

          {/* Popular Banks */}
          <div className="bi-popular-section">
            <div className="bi-popular-title">Popular Banks</div>
            <div className="bi-popular-grid">
              {popularBanks.map(bank => (
                <div 
                  key={bank.code} 
                  className="bi-popular-item" 
                  onClick={() => handleBankSelect(bank)}
                >
                  <span className="bi-popular-logo">{bank.logo}</span>
                  <span className="bi-popular-name">{bank.name.split(' ')[0]}</span>
                </div>
              ))}
              <div 
                className="bi-popular-item bi-popular-generic"
                onClick={() => handleBankSelect({ code: 'GENERIC', name: 'Generic CSV / Other', logo: '🏦' })}
              >
                <span className="bi-popular-logo">⚙️</span>
                <span className="bi-popular-name">Other Bank</span>
              </div>
            </div>
          </div>

          {/* Search Box */}
          <div className="bi-search-bar">
            <span className="bi-search-icon">🔍</span>
            <input 
              type="text" 
              placeholder="Search among 120+ Indian Banks (SBI, HDFC, Yes Bank, Gramin...)" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Category Tabs */}
          <div className="bi-category-tabs">
            {['All', 'Public', 'Private', 'SFB', 'Rural', 'Foreign'].map(cat => (
              <button
                key={cat}
                className={`bi-category-tab ${activeCategory === cat ? 'active' : ''}`}
                onClick={() => setActiveCategory(cat)}
              >
                {cat === 'SFB' ? 'SFB / Payments' : cat === 'Rural' ? 'Coop / Rural' : cat}
              </button>
            ))}
          </div>

          {/* Bank Selector Grid */}
          <div className="bi-bank-grid">
            {filteredBanks.slice(0, (searchQuery.trim() === '' && activeCategory === 'All') ? 12 : filteredBanks.length).map(bank => (
              <div 
                key={bank.code} 
                className="bi-bank-item"
                onClick={() => handleBankSelect(bank)}
              >
                <span className="bi-bank-item-logo">{bank.logo}</span>
                <div className="bi-bank-item-details">
                  <span className="bi-bank-item-name">{bank.name}</span>
                  <span className="bi-bank-item-type">{bank.type} Sector</span>
                </div>
              </div>
            ))}
            {filteredBanks.length === 0 && (
              <div className="bi-empty-search">
                <p>No banks match your search. Try searching for abbreviations or click below to use a Generic CSV.</p>
                <button 
                  className="bi-btn-ghost"
                  onClick={() => handleBankSelect({ code: 'GENERIC', name: 'Generic CSV / Other', logo: '🏦' })}
                >
                  ⚙️ Use Generic CSV Importer
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stage 1: Upload ─────────────────────────────────────────────── */}
      {stage === 'upload' && selectedBank && (
        <div className="bi-upload-stage">
          <div className="bi-back-header">
            <button className="bi-back-link" onClick={() => setStage('bank-select')}>
              ← Back to Select Bank
            </button>
          </div>
          
          <div className="bi-hero">
            <div className="bi-hero-logo-box">
              <span className="bi-hero-logo-large">{selectedBank.logo}</span>
            </div>
            <h2>Import {selectedBank.name} Statement</h2>
            <p>Upload your official statement CSV or TXT file downloaded from {selectedBank.name} net banking or mobile app.</p>
          </div>

          {/* Drop Zone */}
          <div
            className={`bi-dropzone ${dragOver ? 'dragover' : ''}`}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="bi-dropzone-icon">📁</div>
            <p className="bi-dropzone-title">Drop your statement file here</p>
            <p className="bi-dropzone-sub">or <strong>click to browse folders</strong></p>
            <p className="bi-dropzone-hint">Supports: .csv, .txt, .xls, .xlsx</p>
            <input
              type="file"
              ref={fileInputRef}
              accept=".csv,.txt,.xls,.xlsx"
              style={{ display: 'none' }}
              onChange={handleFileChange}
            />
          </div>

          {error && <div className="bi-error-msg">⚠️ {error}</div>}

          {/* Guide section */}
          <div className="bi-guide">
            <h4>📥 Statement Download Quick Guide</h4>
            <p className="bi-guide-general-text">
              Log in to your bank portal or mobile app, go to accounts, view statement, and export as <strong>CSV (Comma Separated Values)</strong> or Excel.
            </p>
            {selectedBank.code === 'HDFC' && (
              <div className="bi-guide-item" style={{ marginTop: '0.5rem' }}>
                <strong>HDFC Netbanking:</strong> Accounts → Download Statement → Select period and export as "Comma Delimited (CSV)".
              </div>
            )}
            {selectedBank.code === 'SBI' && (
              <div className="bi-guide-item" style={{ marginTop: '0.5rem' }}>
                <strong>SBI Online:</strong> Accounts → View Statement → Choose duration and export as Excel/CSV.
              </div>
            )}
            {selectedBank.code === 'ICICI' && (
              <div className="bi-guide-item" style={{ marginTop: '0.5rem' }}>
                <strong>iMobile / Corporate Login:</strong> Statements → Select dates → Click 'Export CSV'.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Stage 2: Custom Column Mapper ────────────────────────────────── */}
      {stage === 'map-columns' && (
        <div className="bi-mapper-stage">
          <div className="bi-hero">
            <div className="bi-hero-icon">🔧</div>
            <h2>Map Statement Columns</h2>
            <p>We couldn't automatically read your CSV columns. Please tell us which columns contain the date, description, and amounts.</p>
          </div>

          <div className="bi-mapper-layout">
            {/* Form selectors */}
            <div className="bi-mapper-form-card glass-card">
              <h3>Column Mapping</h3>
              <div className="bi-mapper-grid-fields">
                <div className="bi-mapper-group">
                  <label>Date Column *</label>
                  <select 
                    value={mapping.date} 
                    onChange={e => setMapping(prev => ({ ...prev, date: e.target.value }))}
                  >
                    <option value="">-- Select Date Column --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="bi-mapper-group">
                  <label>Description / Narration Column *</label>
                  <select 
                    value={mapping.desc} 
                    onChange={e => setMapping(prev => ({ ...prev, desc: e.target.value }))}
                  >
                    <option value="">-- Select Description Column --</option>
                    {headers.map(h => <option key={h} value={h}>{h}</option>)}
                  </select>
                </div>

                <div className="bi-mapper-group">
                  <label>Amount Formats</label>
                  <p className="bi-mapper-hint">Does your statement have two columns (Debit/Credit) or a single column (with +/- or Dr/Cr)?</p>
                </div>

                {/* Option A: Debit and Credit */}
                <div className="bi-mapper-row-split">
                  <div className="bi-mapper-group">
                    <label>Debit Column (Expenses)</label>
                    <select 
                      value={mapping.debit} 
                      disabled={!!mapping.amount}
                      onChange={e => setMapping(prev => ({ ...prev, debit: e.target.value }))}
                    >
                      <option value="">-- Select Debit Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="bi-mapper-group">
                    <label>Credit Column (Income)</label>
                    <select 
                      value={mapping.credit} 
                      disabled={!!mapping.amount}
                      onChange={e => setMapping(prev => ({ ...prev, credit: e.target.value }))}
                    >
                      <option value="">-- Select Credit Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>

                <div className="bi-mapper-divider">OR</div>

                {/* Option B: Single Amount Column */}
                <div className="bi-mapper-row-split">
                  <div className="bi-mapper-group">
                    <label>Single Amount Column</label>
                    <select 
                      value={mapping.amount} 
                      disabled={!!mapping.debit || !!mapping.credit}
                      onChange={e => setMapping(prev => ({ ...prev, amount: e.target.value, debit: '', credit: '' }))}
                    >
                      <option value="">-- Select Amount Column --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                  <div className="bi-mapper-group">
                    <label>Transaction Type Indicator (Optional)</label>
                    <select 
                      value={mapping.typeCol} 
                      disabled={!mapping.amount}
                      onChange={e => setMapping(prev => ({ ...prev, typeCol: e.target.value }))}
                    >
                      <option value="">-- Select Dr/Cr Column (Optional) --</option>
                      {headers.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {error && <div className="bi-error-msg">⚠️ {error}</div>}

              <div className="bi-mapper-actions">
                <button className="bi-btn-ghost" onClick={() => setStage('upload')}>← Back</button>
                <button className="bi-btn-primary" onClick={handleConfirmMapping}>Confirm & Preview →</button>
              </div>
            </div>

            {/* CSV data references & live preview */}
            <div className="bi-mapper-references">
              {/* File Data Reference */}
              <div className="bi-mapper-reference-card glass-card">
                <h3>Raw Statement Preview (First 3 Rows)</h3>
                <div className="bi-raw-data-wrapper">
                  <table className="bi-raw-table">
                    <thead>
                      <tr>
                        {headers.map(h => <th key={h}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {rawRowsPreview.map((row, rIdx) => (
                        <tr key={rIdx}>
                          {headers.map(h => <td key={h}>{row[h]}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Live Preview */}
              <div className="bi-mapper-reference-card glass-card">
                <h3>Live Parsing Preview</h3>
                <div className="bi-live-preview-wrapper">
                  {liveMappedPreview.length === 0 ? (
                    <p className="bi-mapper-no-preview">Map columns above to view parsed transactions...</p>
                  ) : (
                    <table className="bi-live-table">
                      <thead>
                        <tr>
                          <th>Date</th>
                          <th>Description</th>
                          <th>Type</th>
                          <th>Amount</th>
                        </tr>
                      </thead>
                      <tbody>
                        {liveMappedPreview.map((tx, idx) => (
                          <tr key={idx}>
                            <td>{tx.date}</td>
                            <td className="bi-desc">{tx.description}</td>
                            <td>
                              <span className={`bi-type-badge ${tx.type}`}>
                                {tx.type === 'income' ? 'Income' : 'Expense'}
                              </span>
                            </td>
                            <td className={`bi-amount ${tx.type}`}>₹{tx.amount.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Stage 3: Preview ────────────────────────────────────────────── */}
      {stage === 'preview' && detectedBank && (
        <div className="bi-preview-stage">
          <div className="bi-preview-header">
            <div className="bi-detected-bank">
              <span className="bi-bank-logo">{detectedBank.logo}</span>
              <div>
                <div className="bi-detected-label">Importing to</div>
                <div className="bi-detected-name">{detectedBank.name}</div>
              </div>
              {isCustomMapped && <span className="bi-custom-badge">🔧 Custom Mapped</span>}
              <div className="bi-detected-file">📄 {fileName}</div>
            </div>
            <div className="bi-stats-row">
              <div className="bi-stat">
                <span className="bi-stat-num">{parsedRows.length}</span>
                <span className="bi-stat-label">Total Found</span>
              </div>
              <div className="bi-stat income">
                <span className="bi-stat-num">{parsedRows.filter(r => r.type === 'income').length}</span>
                <span className="bi-stat-label">Income</span>
              </div>
              <div className="bi-stat expense">
                <span className="bi-stat-num">{parsedRows.filter(r => r.type === 'expense').length}</span>
                <span className="bi-stat-label">Expenses</span>
              </div>
              <div className="bi-stat selected">
                <span className="bi-stat-num">{selectedRows.size}</span>
                <span className="bi-stat-label">Selected</span>
              </div>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="bi-table-wrapper bi-desktop-table">
            <table className="bi-table">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={selectedRows.size === parsedRows.length}
                      onChange={toggleAll}
                    />
                  </th>
                  <th>Date</th>
                  <th>Description</th>
                  <th>Category</th>
                  <th>Type</th>
                  <th>Amount</th>
                </tr>
              </thead>
              <tbody>
                {parsedRows.map((row, idx) => (
                  <tr
                    key={idx}
                    className={`${selectedRows.has(idx) ? 'selected' : 'deselected'}`}
                    onClick={() => toggleRow(idx)}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedRows.has(idx)}
                        onChange={() => toggleRow(idx)}
                        onClick={e => e.stopPropagation()}
                      />
                    </td>
                    <td className="bi-date">{row.date}</td>
                    <td className="bi-desc" title={row.description}>
                      {row.description.length > 50
                        ? row.description.slice(0, 50) + '…'
                        : row.description}
                    </td>
                    <td>
                      <span className="bi-category-tag">{row.category}</span>
                    </td>
                    <td>
                      <span className={`bi-type-badge ${row.type}`}>
                        {row.type === 'income' ? '↑ Income' : '↓ Expense'}
                      </span>
                    </td>
                    <td className={`bi-amount ${row.type}`}>
                      ₹{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile responsive card list view */}
          <div className="bi-mobile-cards">
            <div className="bi-mobile-select-all">
              <label>
                <input
                  type="checkbox"
                  checked={selectedRows.size === parsedRows.length}
                  onChange={toggleAll}
                />
                <span>Select All ({selectedRows.size} / {parsedRows.length})</span>
              </label>
            </div>
            {parsedRows.map((row, idx) => (
              <div 
                key={idx} 
                className={`bi-tx-card ${selectedRows.has(idx) ? 'selected' : 'deselected'}`}
                onClick={() => toggleRow(idx)}
              >
                <div className="bi-tx-card-checkbox">
                  <input
                    type="checkbox"
                    checked={selectedRows.has(idx)}
                    onChange={() => toggleRow(idx)}
                    onClick={e => e.stopPropagation()}
                  />
                </div>
                <div className="bi-tx-card-body">
                  <div className="bi-tx-card-row-top">
                    <span className="bi-tx-card-date">📅 {row.date}</span>
                    <span className={`bi-type-badge ${row.type}`}>
                      {row.type === 'income' ? 'Income' : 'Expense'}
                    </span>
                  </div>
                  <div className="bi-tx-card-desc">{row.description}</div>
                  <div className="bi-tx-card-row-bottom">
                    <span className="bi-category-tag">{row.category}</span>
                    <span className={`bi-amount ${row.type}`}>
                      ₹{row.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {error && <div className="bi-error-msg" style={{ marginBottom: '1rem' }}>⚠️ {error}</div>}

          {/* Actions */}
          <div className="bi-actions">
            <div className="bi-actions-left">
              <button className="bi-btn-ghost" onClick={resetImport}>← Back</button>
              <button 
                className="bi-btn-ghost bi-btn-adjust" 
                onClick={() => setStage('map-columns')}
              >
                🔧 Adjust Columns
              </button>
            </div>
            <button
              className="bi-btn-primary"
              onClick={handleImport}
              disabled={selectedRows.size === 0}
            >
              Import {selectedRows.size} Transaction{selectedRows.size !== 1 ? 's' : ''} →
            </button>
          </div>
        </div>
      )}

      {/* ── Stage 4: Importing ──────────────────────────────────────────── */}
      {stage === 'importing' && (
        <div className="bi-progress-stage">
          <div className="bi-progress-icon">⚡</div>
          <h3>Importing Transactions…</h3>
          <div className="bi-progress-bar-track">
            <div
              className="bi-progress-bar-fill"
              style={{ width: `${importProgress}%` }}
            />
          </div>
          <p className="bi-progress-text">{importedCount} of {selectedRows.size} imported</p>
        </div>
      )}

      {/* ── Stage 5: Done ───────────────────────────────────────────────── */}
      {stage === 'done' && (
        <div className="bi-done-stage">
          <div className="bi-done-checkmark">✅</div>
          <h3>Import Complete!</h3>
          <p><strong>{importedCount}</strong> transactions successfully imported to MyBudget.</p>
          <p className="bi-done-sub">Dashboard is updating in real-time...</p>
          <button className="bi-btn-ghost" onClick={resetImport}>Import Another Statement</button>
        </div>
      )}
    </div>
  );
}
