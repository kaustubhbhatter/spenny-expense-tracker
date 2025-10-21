// Firebase Configuration - Replace with your own Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyAmgOL0tYT-18VcfVmZ2CK5_79XfRLLAzs",
  authDomain: "my-expense-tracker-9d0f9.firebaseapp.com",
  projectId: "my-expense-tracker-9d0f9",
  storageBucket: "my-expense-tracker-9d0f9.firebasestorage.app",
  messagingSenderId: "384865958037",
  appId: "1:384865958037:web:0cfa22e56aaef3dfe9439c",
  measurementId: "G-E526DX0EVW"
};

// Firebase instances
let auth = null;
let db = null;
let isFirebaseEnabled = false;
let currentAuthUser = null;
let isGuestMode = false;

// Global variables
let currentUser = null;
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let currentScreen = 'transactions';
let currentTransactionType = 'expense';
let editingTransaction = null;
let editingAccount = null;
let editingCategory = null;
let editingAccountType = null;
let currentCategoryType = 'expense';
let confirmCallback = null;
let recurringDropdownOpen = false;
let editingProfile = null;

// Profile colors
const profileColors = ['#8B4513', '#DC143C', '#1E88E5', '#4CAF50', '#9C27B0', '#FF9800'];

// Initialize Firebase
function initializeFirebase() {
  try {
    // Check if Firebase is available
    if (typeof firebase === 'undefined') {
      console.log('Firebase not available, using guest mode');
      isFirebaseEnabled = false;
      showGuestMode();
      return;
    }

    // Initialize Firebase
    firebase.initializeApp(firebaseConfig);
    auth = firebase.auth();
    db = firebase.firestore();
    isFirebaseEnabled = true;

    // Enable offline persistence
    db.enablePersistence()
      .then(() => {
        console.log('Offline persistence enabled');
      })
      .catch((err) => {
        console.log('Offline persistence error:', err);
      });

    // Set up auth state listener
    auth.onAuthStateChanged((user) => {
      console.log('Auth state changed:', user ? user.uid : 'null');
      if (user) {
        currentAuthUser = user;
        isGuestMode = false;
        onUserSignedIn(user);
      } else {
        currentAuthUser = null;
        if (!isGuestMode) {
          showLoginScreen();
        }
      }
    });

    console.log('Firebase initialized successfully');
    
  } catch (error) {
    console.error('Firebase initialization failed:', error);
    isFirebaseEnabled = false;
    showGuestMode();
  }
}

// Authentication Functions
function showLoginScreen() {
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loading-screen').classList.add('hidden');
}

function showMainApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('loading-screen').classList.add('hidden');
}

function showLoadingScreen(text = 'Loading...') {
  document.getElementById('loading-text').textContent = text;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.add('hidden');
  document.getElementById('loading-screen').classList.remove('hidden');
}

function showGuestMode() {
  isGuestMode = true;
  setSyncStatus('synced'); // Show as local mode
  initializeData();
  initializeDefaultUser();
  updateMonthDisplay();
  showMainApp();
  switchScreen('transactions');
}

async function signInWithGoogle() {
  if (!isFirebaseEnabled) {
    showToast('Firebase not available', 'error');
    return;
  }

  try {
    setSyncStatus('syncing');
    const provider = new firebase.auth.GoogleAuthProvider();
    const result = await auth.signInWithPopup(provider);
    console.log('Google sign-in successful:', result.user.uid);
  } catch (error) {
    console.error('Google sign-in error:', error);
    setSyncStatus('error');
    showToast(getAuthErrorMessage(error), 'error');
  }
}

async function signInWithEmail(email, password) {
  if (!isFirebaseEnabled) {
    showToast('Firebase not available', 'error');
    return;
  }

  try {
    setSyncStatus('syncing');
    const result = await auth.signInWithEmailAndPassword(email, password);
    console.log('Email sign-in successful:', result.user.uid);
  } catch (error) {
    console.error('Email sign-in error:', error);
    setSyncStatus('error');
    showToast(getAuthErrorMessage(error), 'error');
  }
}

async function signUpWithEmail(email, password) {
  if (!isFirebaseEnabled) {
    showToast('Firebase not available', 'error');
    return;
  }

  try {
    setSyncStatus('syncing');
    const result = await auth.createUserWithEmailAndPassword(email, password);
    console.log('Email sign-up successful:', result.user.uid);
    showToast('Account created successfully!');
  } catch (error) {
    console.error('Email sign-up error:', error);
    setSyncStatus('error');
    showToast(getAuthErrorMessage(error), 'error');
  }
}

async function signOut() {
  try {
    if (isFirebaseEnabled && auth.currentUser) {
      await auth.signOut();
      showToast('Signed out successfully');
    } else {
      // Guest mode logout - just show login screen
      isGuestMode = false;
      showLoginScreen();
    }
  } catch (error) {
    console.error('Sign out error:', error);
    showToast('Error signing out', 'error');
  }
}

function getAuthErrorMessage(error) {
  switch (error.code) {
    case 'auth/user-not-found':
      return 'No account found with this email';
    case 'auth/wrong-password':
      return 'Incorrect password';
    case 'auth/email-already-in-use':
      return 'An account already exists with this email';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters';
    case 'auth/invalid-email':
      return 'Invalid email address';
    case 'auth/popup-closed-by-user':
      return 'Sign-in cancelled';
    default:
      return error.message || 'Authentication failed';
  }
}

// User Management
async function onUserSignedIn(user) {
  showLoadingScreen('Loading your data...');
  
  try {
    // Check for existing data to migrate
    const hasLocalData = await checkForLocalDataToMigrate();
    
    if (hasLocalData) {
      // Note: Migration prompt would be implemented as a modal
      // For now, just show a toast
      showToast('Local data found. Go to Settings to import it.', 'info');
    }
    
    // Set up current user object
    currentUser = {
      id: user.uid,
      name: user.displayName || 'User',
      email: user.email,
      initials: getInitials(user.displayName || user.email),
      photoURL: user.photoURL,
      color: '#8B4513'
    };
    
    // Load user data from Firestore
    await loadUserDataFromCloud();
    
    // Update UI
    updateUserProfileUI();
    updateMonthDisplay();
    setSyncStatus('synced');
    
    // Show main app
    showMainApp();
    
    // Initialize the app
    switchScreen('transactions');
    
  } catch (error) {
    console.error('Error loading user data:', error);
    showToast('Error loading data', 'error');
    setSyncStatus('error');
    // Still show the app with local data
    showMainApp();
    switchScreen('transactions');
  }
}

function getInitials(name) {
  if (!name) return 'U';
  return name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
}

// Initialize default user
function initializeDefaultUser() {
  const defaultUser = {
    id: 'default',
    name: 'Guest User',
    initials: 'GU',
    color: '#8B4513'
  };
  
  // Load current profile or use default
  const profiles = loadFromStorage('profiles', [defaultUser]);
  const currentProfileId = loadFromStorage('currentProfileId', 'default');
  currentUser = profiles.find(p => p.id === currentProfileId) || defaultUser;
  
  // Update UI
  updateUserProfileUI();
  
  // Initialize user data
  initializeUserData();
}

function updateUserProfileUI() {
  const initialsElement = document.getElementById('user-initials');
  const nameElement = document.getElementById('user-name');
  const avatarElement = document.getElementById('user-avatar');
  
  initialsElement.textContent = currentUser.initials;
  nameElement.textContent = currentUser.name;
  avatarElement.style.background = `linear-gradient(135deg, ${currentUser.color} 0%, ${adjustColorBrightness(currentUser.color, -20)} 100%)`;
}

function adjustColorBrightness(color, amount) {
  const usePound = color[0] === '#';
  const col = usePound ? color.slice(1) : color;
  const num = parseInt(col, 16);
  let r = (num >> 16) + amount;
  let g = (num >> 8 & 0x00FF) + amount;
  let b = (num & 0x0000FF) + amount;
  r = r > 255 ? 255 : r < 0 ? 0 : r;
  g = g > 255 ? 255 : g < 0 ? 0 : g;
  b = b > 255 ? 255 : b < 0 ? 0 : b;
  return (usePound ? '#' : '') + String('000000' + (r << 16 | g << 8 | b).toString(16)).slice(-6);
}

const sampleData = {
  accounts: [
    {
      id: 'acc1',
      name: 'ICICI Salary Account',
      type: 'Bank Account',
      balance: 45000,
      includeInTotal: true,
      createdAt: '2024-01-01'
    },
    {
      id: 'acc2',
      name: 'HDFC Credit Card',
      type: 'Credit Card',
      balance: -8500,
      includeInTotal: true,
      creditLimit: 100000,
      billingDay: 15,
      paymentDay: 25,
      autopay: true,
      autopayFrom: 'acc1',
      createdAt: '2024-01-01'
    },
    {
      id: 'acc3',
      name: 'Cash Wallet',
      type: 'Cash',
      balance: 5000,
      includeInTotal: true,
      createdAt: '2024-01-01'
    },
    {
      id: 'acc4',
      name: 'PPF Investment',
      type: 'Investment',
      balance: 125000,
      includeInTotal: false,
      createdAt: '2024-01-01'
    }
  ],
  expenseCategories: [
    { id: 'exp1', name: 'Food & Dining', color: '#ef4444', icon: '🍽️', budget: 8000 },
    { id: 'exp2', name: 'Transportation', color: '#3b82f6', icon: '🚗', budget: 3000 },
    { id: 'exp3', name: 'Shopping', color: '#ec4899', icon: '🛍️', budget: 5000 },
    { id: 'exp4', name: 'Bills & Utilities', color: '#f59e0b', icon: '💡', budget: 4000 },
    { id: 'exp5', name: 'Entertainment', color: '#8b5cf6', icon: '🎬', budget: 2000 },
    { id: 'exp6', name: 'Healthcare', color: '#10b981', icon: '⚕️', budget: 3000 },
    { id: 'exp7', name: 'Education', color: '#06b6d4', icon: '📚', budget: 2000 },
    { id: 'exp8', name: 'Personal Care', color: '#f97316', icon: '💇', budget: 1500 }
  ],
  incomeCategories: [
    { id: 'inc1', name: 'Salary', color: '#10b981', icon: '💼' },
    { id: 'inc2', name: 'Business', color: '#6366f1', icon: '🏢' },
    { id: 'inc3', name: 'Investments', color: '#8b5cf6', icon: '📈' },
    { id: 'inc4', name: 'Freelance', color: '#14b8a6', icon: '💻' },
    { id: 'inc5', name: 'Other', color: '#64748b', icon: '💰' }
  ],
  transactions: [
    {
      id: 'tx1',
      date: '2024-10-01',
      type: 'income',
      amount: 50000,
      account: 'acc1',
      accountName: 'ICICI Salary Account',
      category: 'inc1',
      categoryName: 'Salary',
      description: 'Monthly salary credit',
      recurring: 'monthly',
      createdAt: '2024-10-01T09:00:00'
    },
    {
      id: 'tx2',
      date: '2024-10-05',
      type: 'expense',
      amount: 2500,
      account: 'acc2',
      accountName: 'HDFC Credit Card',
      category: 'exp1',
      categoryName: 'Food & Dining',
      description: 'Grocery shopping at Big Bazaar',
      recurring: 'none',
      createdAt: '2024-10-05T18:30:00'
    },
    {
      id: 'tx3',
      date: '2024-10-07',
      type: 'expense',
      amount: 1200,
      account: 'acc3',
      accountName: 'Cash Wallet',
      category: 'exp2',
      categoryName: 'Transportation',
      description: 'Auto fare and metro',
      recurring: 'none',
      createdAt: '2024-10-07T20:15:00'
    },
    {
      id: 'tx4',
      date: '2024-10-10',
      type: 'expense',
      amount: 3500,
      account: 'acc2',
      accountName: 'HDFC Credit Card',
      category: 'exp3',
      categoryName: 'Shopping',
      description: 'New shoes from Nike',
      recurring: 'none',
      createdAt: '2024-10-10T15:45:00'
    },
    {
      id: 'tx5',
      date: '2024-10-12',
      type: 'expense',
      amount: 1800,
      account: 'acc1',
      accountName: 'ICICI Salary Account',
      category: 'exp4',
      categoryName: 'Bills & Utilities',
      description: 'Electricity bill',
      recurring: 'monthly',
      createdAt: '2024-10-12T11:20:00'
    },
    {
      id: 'tx6',
      date: '2024-10-15',
      type: 'transfer',
      amount: 10000,
      account: 'acc1',
      accountName: 'ICICI Salary Account',
      category: 'transfer',
      categoryName: 'Transfer',
      description: 'Transfer to PPF',
      toAccount: 'acc4',
      toAccountName: 'PPF Investment',
      recurring: 'monthly',
      createdAt: '2024-10-15T10:00:00'
    },
    {
      id: 'tx7',
      date: '2024-10-18',
      type: 'expense',
      amount: 850,
      account: 'acc2',
      accountName: 'HDFC Credit Card',
      category: 'exp5',
      categoryName: 'Entertainment',
      description: 'Movie tickets and dinner',
      recurring: 'none',
      createdAt: '2024-10-18T21:30:00'
    },
    {
      id: 'tx8',
      date: '2024-10-20',
      type: 'expense',
      amount: 500,
      account: 'acc3',
      accountName: 'Cash Wallet',
      category: 'exp1',
      categoryName: 'Food & Dining',
      description: 'Lunch at cafe',
      recurring: 'none',
      createdAt: '2024-10-20T13:00:00'
    }
  ],
  settings: {
    currency: '₹',
    theme: 'light',
    budgets: {},
    firstLaunch: true
  }
};

// Sync Status Management
function setSyncStatus(status) {
  const indicator = document.getElementById('sync-indicator');
  const icon = document.getElementById('sync-icon');
  const text = document.getElementById('sync-text');
  
  if (!indicator || !icon || !text) return;
  
  // Remove all status classes
  indicator.classList.remove('syncing', 'offline', 'error');
  
  switch (status) {
    case 'syncing':
      indicator.classList.add('syncing');
      text.textContent = 'Syncing...';
      indicator.title = 'Syncing data with cloud';
      break;
    case 'synced':
      text.textContent = isGuestMode ? 'Local' : 'Synced';
      indicator.title = isGuestMode ? 'Data stored locally' : 'Data synced with cloud';
      break;
    case 'offline':
      indicator.classList.add('offline');
      text.textContent = 'Offline';
      indicator.title = 'Working offline';
      break;
    case 'error':
      indicator.classList.add('error');
      text.textContent = 'Error';
      indicator.title = 'Sync error occurred';
      break;
    default:
      text.textContent = 'Unknown';
  }
}

// Data management with cloud/local storage switching
function getUserKey(key) {
  if (!currentUser) return key;
  // Global keys that don't depend on user
  const globalKeys = ['profiles', 'currentProfileId'];
  if (globalKeys.includes(key)) return key;
  return `user_${currentUser.id}_${key}`;
}

async function saveToStorage(key, data) {
  try {
    // Always save to local storage as backup
    const storageKey = getUserKey(key);
    const jsonData = JSON.stringify(data);
    window[storageKey + '_data'] = jsonData;
    
    // If user is authenticated and Firebase is enabled, also save to Firestore
    if (!isGuestMode && isFirebaseEnabled && currentAuthUser && db) {
      await saveToFirestore(key, data);
    }
    
    return true;
  } catch (error) {
    console.error('Error saving data:', error);
    showToast('Failed to save data', 'error');
    setSyncStatus('error');
    return false;
  }
}

async function saveToFirestore(key, data) {
  if (!currentAuthUser || !db) return;
  
  try {
    setSyncStatus('syncing');
    
    const userId = currentAuthUser.uid;
    const docRef = db.collection('users').doc(userId);
    
    // Save different data types to appropriate subcollections/documents
    switch (key) {
      case 'transactions':
        // Save each transaction as a separate document
        const batch = db.batch();
        
        // First, get existing transactions to delete removed ones
        const existingTransactions = await docRef.collection('transactions').get();
        existingTransactions.forEach((doc) => {
          const existingId = doc.id;
          const stillExists = data.some(tx => tx.id === existingId);
          if (!stillExists) {
            batch.delete(doc.ref);
          }
        });
        
        // Add/update current transactions
        data.forEach((transaction) => {
          const txRef = docRef.collection('transactions').doc(transaction.id);
          batch.set(txRef, {
            ...transaction,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        
        await batch.commit();
        break;
        
      case 'accounts':
        // Save each account as a separate document
        const accountBatch = db.batch();
        
        // Clear existing accounts and add current ones
        const existingAccounts = await docRef.collection('accounts').get();
        existingAccounts.forEach((doc) => {
          const existingId = doc.id;
          const stillExists = data.some(acc => acc.id === existingId);
          if (!stillExists) {
            accountBatch.delete(doc.ref);
          }
        });
        
        data.forEach((account) => {
          const accRef = docRef.collection('accounts').doc(account.id);
          accountBatch.set(accRef, {
            ...account,
            updatedAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        });
        
        await accountBatch.commit();
        break;
        
      case 'expenseCategories':
        await docRef.collection('categories').doc('expense').set({
          categories: data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        break;
        
      case 'incomeCategories':
        await docRef.collection('categories').doc('income').set({
          categories: data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        break;
        
      case 'accountTypes':
        await docRef.collection('accountTypes').doc('types').set({
          types: data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        break;
        
      case 'settings':
        await docRef.collection('settings').doc('preferences').set({
          ...data,
          updatedAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        break;
    }
    
    setSyncStatus('synced');
    
  } catch (error) {
    console.error(`Error saving ${key} to Firestore:`, error);
    setSyncStatus('error');
    throw error;
  }
}

function loadFromStorage(key, defaultData = null) {
  try {
    // Always use local storage for synchronous operations
    // Async cloud loading happens separately
    const storageKey = getUserKey(key);
    const data = window[storageKey + '_data'];
    if (data) {
      return JSON.parse(data);
    }
    return defaultData;
  } catch (error) {
    console.error('Error loading data:', error);
    return defaultData;
  }
}

// Async version for cloud loading
async function loadFromStorageAsync(key, defaultData = null) {
  try {
    // If guest mode or Firebase not enabled, use local storage
    if (isGuestMode || !isFirebaseEnabled || !currentAuthUser) {
      return loadFromStorage(key, defaultData);
    }
    
    // Try to load from Firestore first, fallback to local storage
    try {
      const firestoreData = await loadFromFirestore(key);
      if (firestoreData !== null) {
        // Cache in local storage
        const storageKey = getUserKey(key);
        window[storageKey + '_data'] = JSON.stringify(firestoreData);
        return firestoreData;
      }
    } catch (error) {
      console.warn(`Failed to load ${key} from Firestore, using local storage:`, error);
    }
    
    // Fallback to local storage
    return loadFromStorage(key, defaultData);
    
  } catch (error) {
    console.error('Error loading data:', error);
    return defaultData;
  }
}

async function loadFromFirestore(key) {
  if (!currentAuthUser || !db) return null;
  
  try {
    const userId = currentAuthUser.uid;
    const docRef = db.collection('users').doc(userId);
    
    switch (key) {
      case 'transactions':
        const txSnapshot = await docRef.collection('transactions').get();
        return txSnapshot.docs.map(doc => doc.data());
        
      case 'accounts':
        const accSnapshot = await docRef.collection('accounts').get();
        return accSnapshot.docs.map(doc => doc.data());
        
      case 'expenseCategories':
        const expDoc = await docRef.collection('categories').doc('expense').get();
        return expDoc.exists ? expDoc.data().categories : null;
        
      case 'incomeCategories':
        const incDoc = await docRef.collection('categories').doc('income').get();
        return incDoc.exists ? incDoc.data().categories : null;
        
      case 'accountTypes':
        const typesDoc = await docRef.collection('accountTypes').doc('types').get();
        return typesDoc.exists ? typesDoc.data().types : null;
        
      case 'settings':
        const settingsDoc = await docRef.collection('settings').doc('preferences').get();
        return settingsDoc.exists ? settingsDoc.data() : null;
        
      default:
        return null;
    }
  } catch (error) {
    console.error(`Error loading ${key} from Firestore:`, error);
    throw error;
  }
}

// Load all user data from cloud
async function loadUserDataFromCloud() {
  if (isGuestMode || !isFirebaseEnabled || !currentAuthUser) {
    // Initialize with sample data if needed
    initializeData();
    return;
  }
  
  try {
    setSyncStatus('syncing');
    
    // Load all data types
    const dataTypes = ['transactions', 'accounts', 'expenseCategories', 'incomeCategories', 'accountTypes', 'settings'];
    let hasAnyData = false;
    
    for (const dataType of dataTypes) {
      try {
        const data = await loadFromFirestore(dataType);
        if (data !== null) {
          // Save to local storage as cache
          const storageKey = getUserKey(dataType);
          window[storageKey + '_data'] = JSON.stringify(data);
          hasAnyData = true;
        }
      } catch (error) {
        console.warn(`Failed to load ${dataType}:`, error);
      }
    }
    
    // If no data found in cloud, initialize with sample data
    if (!hasAnyData) {
      console.log('No cloud data found, initializing with sample data');
      initializeData();
    }
    
    setSyncStatus('synced');
    
  } catch (error) {
    console.error('Error loading user data from cloud:', error);
    setSyncStatus('error');
    // Fallback to sample data
    initializeData();
  }
}

// Migration Functions
async function checkForLocalDataToMigrate() {
  // Check if there's existing local data that could be migrated
  const localTransactions = window.transactions_data;
  const localAccounts = window.accounts_data;
  
  return localTransactions || localAccounts;
}

// Placeholder for migration prompt - implemented in settings
function showMigrationPrompt() {
  // Migration will be available in settings screen
  return Promise.resolve(false);
}

async function migrateData() {
  if (isGuestMode || !isFirebaseEnabled || !currentAuthUser) {
    showToast('Sign in first to migrate data to cloud', 'error');
    return;
  }
  
  try {
    setSyncStatus('syncing');
    showToast('Migrating data to cloud...', 'info');
    
    // Get all local data (from default keys, not user-specific)
    const dataToMigrate = {
      transactions: window.transactions_data ? JSON.parse(window.transactions_data) : null,
      accounts: window.accounts_data ? JSON.parse(window.accounts_data) : null,
      expenseCategories: window.expenseCategories_data ? JSON.parse(window.expenseCategories_data) : null,
      incomeCategories: window.incomeCategories_data ? JSON.parse(window.incomeCategories_data) : null,
      accountTypes: window.accountTypes_data ? JSON.parse(window.accountTypes_data) : null,
      settings: window.settings_data ? JSON.parse(window.settings_data) : null
    };
    
    // Save each data type to Firestore
    for (const [key, data] of Object.entries(dataToMigrate)) {
      if (data) {
        await saveToFirestore(key, data);
        // Also update local storage with user-specific key
        await saveToStorage(key, data);
      }
    }
    
    setSyncStatus('synced');
    showToast('Data migrated successfully!');
    
    // Refresh the current screen
    switchScreen(currentScreen);
    
  } catch (error) {
    console.error('Migration error:', error);
    showToast('Failed to migrate data', 'error');
    setSyncStatus('error');
  }
}

// Initialize data
function initializeData() {
  const existingSettings = loadFromStorage('settings');
  if (!existingSettings || existingSettings.firstLaunch) {
    // First launch - initialize with sample data
    saveToStorage('accounts', sampleData.accounts);
    saveToStorage('expenseCategories', sampleData.expenseCategories);
    saveToStorage('incomeCategories', sampleData.incomeCategories);
    saveToStorage('transactions', sampleData.transactions);
    saveToStorage('accountTypes', [
      { id: 'type1', name: 'Bank Account', icon: '🏦', color: '#8B4513' },
      { id: 'type2', name: 'Credit Card', icon: '💳', color: '#DC143C' },
      { id: 'type3', name: 'Cash', icon: '💵', color: '#4CAF50' },
      { id: 'type4', name: 'Investment', icon: '📈', color: '#1E88E5' },
      { id: 'type5', name: 'Digital Wallet', icon: '📱', color: '#9C27B0' }
    ]);
    saveToStorage('settings', { ...sampleData.settings, firstLaunch: false });
  }
}

// Initialize data for authenticated user
function initializeUserData() {
  if (!currentUser) return;
  
  const existingSettings = loadFromStorage('settings');
  if (!existingSettings || existingSettings.firstLaunch) {
    // First launch for this user - initialize with sample data
    saveToStorage('accounts', sampleData.accounts);
    saveToStorage('expenseCategories', sampleData.expenseCategories);
    saveToStorage('incomeCategories', sampleData.incomeCategories);
    saveToStorage('transactions', sampleData.transactions);
    saveToStorage('accountTypes', [
      { id: 'type1', name: 'Bank Account', icon: '🏦', color: '#8B4513' },
      { id: 'type2', name: 'Credit Card', icon: '💳', color: '#DC143C' },
      { id: 'type3', name: 'Cash', icon: '💵', color: '#4CAF50' },
      { id: 'type4', name: 'Investment', icon: '📈', color: '#1E88E5' },
      { id: 'type5', name: 'Digital Wallet', icon: '📱', color: '#9C27B0' }
    ]);
    saveToStorage('settings', { ...sampleData.settings, firstLaunch: false });
  }
}

// Profile management
function toggleProfileDropdown() {
  const dropdown = document.getElementById('user-dropdown');
  dropdown.classList.toggle('show');
}

function openSetNameModal() {
  document.getElementById('profile-name').value = currentUser.name === 'Guest User' ? '' : currentUser.name;
  showModal('set-name-modal');
  closeProfileDropdown();
}

function closeProfileDropdown() {
  document.getElementById('user-dropdown').classList.remove('show');
}

function saveUserName(name) {
  const profiles = loadFromStorage('profiles', []);
  const initials = name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase();
  
  // Update current user
  currentUser.name = name;
  currentUser.initials = initials;
  
  // Update profiles list
  const profileIndex = profiles.findIndex(p => p.id === currentUser.id);
  if (profileIndex >= 0) {
    profiles[profileIndex] = currentUser;
  } else {
    profiles.push(currentUser);
  }
  
  saveToStorage('profiles', profiles);
  saveToStorage('currentProfileId', currentUser.id);
  
  updateUserProfileUI();
  closeModal('set-name-modal');
  showToast('Name updated successfully');
}

function switchToProfile(profileId) {
  const profiles = loadFromStorage('profiles', []);
  const profile = profiles.find(p => p.id === profileId);
  
  if (profile) {
    currentUser = profile;
    saveToStorage('currentProfileId', profileId);
    updateUserProfileUI();
    
    // Reload current screen with new user data
    switchScreen(currentScreen);
    
    showToast(`Switched to ${profile.name}`);
  }
}

function openAddProfileModal() {
  editingProfile = null;
  document.getElementById('profile-modal-title').textContent = 'Add Profile';
  document.getElementById('add-profile-form').reset();
  document.querySelector('input[name="profileColor"]:checked').checked = true;
  showModal('add-profile-modal');
}

function editProfile(profileId) {
  const profiles = loadFromStorage('profiles', []);
  editingProfile = profiles.find(p => p.id === profileId);
  
  if (!editingProfile) return;
  
  document.getElementById('profile-modal-title').textContent = 'Edit Profile';
  document.getElementById('new-profile-name').value = editingProfile.name;
  
  // Set color selection
  const colorRadio = document.querySelector(`input[name="profileColor"][value="${editingProfile.color}"]`);
  if (colorRadio) colorRadio.checked = true;
  
  showModal('add-profile-modal');
}

function deleteProfile(profileId) {
  if (profileId === 'default') {
    showToast('Cannot delete the default profile', 'error');
    return;
  }
  
  if (profileId === currentUser.id) {
    showToast('Cannot delete the currently active profile', 'error');
    return;
  }
  
  showConfirmDialog(
    'Delete Profile',
    'Are you sure you want to delete this profile? All associated data will be permanently lost.',
    () => {
      const profiles = loadFromStorage('profiles', []);
      const filteredProfiles = profiles.filter(p => p.id !== profileId);
      saveToStorage('profiles', filteredProfiles);
      
      // Clear profile data
      const keysToDelete = ['accounts', 'transactions', 'expenseCategories', 'incomeCategories', 'settings', 'accountTypes'];
      keysToDelete.forEach(key => {
        const storageKey = `user_${profileId}_${key}`;
        window[storageKey + '_data'] = undefined;
      });
      
      loadProfiles();
      showToast('Profile deleted successfully');
    }
  );
}

function saveProfile(formData) {
  const profiles = loadFromStorage('profiles', []);
  
  const profile = {
    id: editingProfile ? editingProfile.id : generateId('user'),
    name: formData.name,
    initials: formData.name.split(' ').map(n => n.charAt(0)).join('').substring(0, 2).toUpperCase(),
    color: formData.color
  };
  
  if (editingProfile) {
    const index = profiles.findIndex(p => p.id === editingProfile.id);
    profiles[index] = profile;
    
    // Update current user if editing current profile
    if (currentUser.id === editingProfile.id) {
      currentUser = profile;
      updateUserProfileUI();
    }
  } else {
    profiles.push(profile);
  }
  
  saveToStorage('profiles', profiles);
  closeModal('add-profile-modal');
  loadProfiles();
  
  showToast(editingProfile ? 'Profile updated successfully' : 'Profile created successfully');
}

function loadProfiles() {
  const profiles = loadFromStorage('profiles', []);
  const container = document.getElementById('profiles-list');
  
  container.innerHTML = profiles.map(profile => createProfileHTML(profile)).join('');
}

function createProfileHTML(profile) {
  const isActive = profile.id === currentUser.id;
  const canDelete = profile.id !== 'default' && profile.id !== currentUser.id;
  
  return `
    <div class="profile-item ${isActive ? 'active' : ''}" data-id="${profile.id}">
      <div class="profile-avatar" style="background: ${profile.color}">
        <span>${profile.initials}</span>
      </div>
      <div class="profile-info">
        <div class="profile-name">${profile.name}</div>
        <div class="profile-meta">${isActive ? 'Active' : 'Click to switch'}</div>
      </div>
      <div class="profile-actions">
        ${!isActive ? `<button class="profile-action-btn" onclick="switchToProfile('${profile.id}')" title="Switch to this profile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 12l2 2 4-4"></path>
            <circle cx="12" cy="12" r="10"></circle>
          </svg>
        </button>` : ''}
        <button class="profile-action-btn" onclick="editProfile('${profile.id}')" title="Edit profile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        ${canDelete ? `<button class="profile-action-btn delete" onclick="deleteProfile('${profile.id}')" title="Delete profile">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          </svg>
        </button>` : ''}
      </div>
    </div>
  `;
}

// Utility functions
function formatCurrency(amount) {
  const settings = loadFromStorage('settings', sampleData.settings);
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
  const formatted = formatter.format(Math.abs(amount));
  return formatted.replace('₹', settings.currency);
}

function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = Math.abs(now - date);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  if (diffDays === 1) return 'Today';
  if (diffDays === 2) return 'Yesterday';
  if (diffDays <= 7) return `${diffDays - 1} days ago`;
  
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });
}

function generateId(prefix = 'id') {
  return prefix + '_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
}

// Toast notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  const icon = type === 'success' ? '✓' : '⚠';
  toast.innerHTML = `
    <div class="toast-icon">${icon}</div>
    <div class="toast-message">${message}</div>
  `;
  
  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 10);
  
  // Remove toast after 3 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => container.removeChild(toast), 300);
  }, 3000);
}

// Navigation
function switchScreen(screenName) {
  // Update navigation
  document.querySelectorAll('.menu-item').forEach(item => {
    item.classList.remove('active');
    if (item.dataset.screen === screenName) {
      item.classList.add('active');
    }
  });
  
  // Update screens
  document.querySelectorAll('.screen').forEach(screen => {
    screen.classList.remove('active');
  });
  document.getElementById(`${screenName}-screen`).classList.add('active');
  
  // Update header
  const titles = {
    transactions: 'Transactions',
    analytics: 'Analytics',
    accounts: 'Accounts',
    settings: 'Settings'
  };
  document.getElementById('screen-title').textContent = titles[screenName];
  
  // Show/hide month navigation
  const monthNav = document.getElementById('month-nav');
  if (screenName === 'transactions') {
    monthNav.style.display = 'flex';
  } else {
    monthNav.style.display = 'none';
  }
  
  // Update transaction form colors based on type
  updateTransactionFormColors();
  
  // Show/hide FAB
  const fab = document.getElementById('fab');
  if (screenName === 'transactions') {
    fab.style.display = 'flex';
  } else {
    fab.style.display = 'none';
  }
  
  currentScreen = screenName;
  
  // Load screen data
  switch (screenName) {
    case 'transactions':
      loadTransactions();
      break;
    case 'analytics':
      loadAnalytics();
      break;
    case 'accounts':
      loadAccounts();
      break;
    case 'settings':
      loadSettings();
      loadAccountTypes();
      loadProfiles();
      break;
  }
}

// Month navigation
function navigateMonth(direction) {
  if (direction === 'prev') {
    currentMonth--;
    if (currentMonth < 0) {
      currentMonth = 11;
      currentYear--;
    }
  } else {
    currentMonth++;
    if (currentMonth > 11) {
      currentMonth = 0;
      currentYear++;
    }
  }
  
  updateMonthDisplay();
  loadTransactions();
}

function updateMonthDisplay() {
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  document.getElementById('current-month').textContent = 
    `${monthNames[currentMonth]} ${currentYear}`;
}

// Transactions with day grouping
function loadTransactions() {
  const transactions = loadFromStorage('transactions', []);
  const monthTransactions = transactions.filter(tx => {
    const txDate = new Date(tx.date);
    return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
  });
  
  // Sort by date (newest first)
  monthTransactions.sort((a, b) => new Date(b.date) - new Date(a.date));
  
  const container = document.getElementById('transactions-list');
  const emptyState = document.getElementById('empty-state');
  
  if (monthTransactions.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
  } else {
    emptyState.classList.add('hidden');
    container.innerHTML = createGroupedTransactionsHTML(monthTransactions);
    
    // Add touch event listeners for swipe
    container.querySelectorAll('.transaction-item').forEach(item => {
      addSwipeListeners(item);
    });
  }
  
  updateMonthlySummary(monthTransactions);
}

function createGroupedTransactionsHTML(transactions) {
  // Group transactions by day
  const groupedByDay = {};
  
  transactions.forEach(tx => {
    const date = tx.date;
    if (!groupedByDay[date]) {
      groupedByDay[date] = [];
    }
    groupedByDay[date].push(tx);
  });
  
  let html = '';
  
  Object.entries(groupedByDay).forEach(([date, dayTransactions]) => {
    // Calculate day totals
    let dayIncome = 0, dayExpense = 0;
    
    dayTransactions.forEach(tx => {
      if (tx.type === 'income') {
        dayIncome += tx.amount;
      } else if (tx.type === 'expense') {
        dayExpense += tx.amount;
      }
    });
    
    const dayNet = dayIncome - dayExpense;
    const dateObj = new Date(date);
    const isToday = dateObj.toDateString() === new Date().toDateString();
    const isYesterday = dateObj.toDateString() === new Date(Date.now() - 86400000).toDateString();
    
    let dateLabel = dateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });
    
    if (isToday) dateLabel = 'Today';
    else if (isYesterday) dateLabel = 'Yesterday';
    else {
      dateLabel = dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: dateObj.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined
      });
    }
    
    html += `
      <div class="day-group-card">
        <div class="day-header">
          <h3 class="day-date">${dateLabel}</h3>
          <div class="day-summary">
            <span class="day-income">+${formatCurrency(dayIncome)}</span>
            <span class="day-expense">-${formatCurrency(dayExpense)}</span>
            <span class="day-net ${dayNet >= 0 ? 'positive' : 'negative'}">${dayNet >= 0 ? '+' : ''}${formatCurrency(dayNet)}</span>
          </div>
        </div>
        <div class="day-transactions">
          ${dayTransactions.map(tx => createTransactionHTML(tx)).join('')}
        </div>
      </div>
    `;
  });
  
  return html;
}

function createTransactionHTML(transaction) {
  const categories = {
    ...loadFromStorage('expenseCategories', []).reduce((acc, cat) => ({ ...acc, [cat.id]: cat }), {}),
    ...loadFromStorage('incomeCategories', []).reduce((acc, cat) => ({ ...acc, [cat.id]: cat }), {})
  };
  
  const category = categories[transaction.category] || { name: transaction.categoryName || 'Unknown', icon: '❓', color: '#64748b' };
  const amountClass = transaction.type === 'income' ? 'income' : transaction.type === 'expense' ? 'expense' : 'transfer';
  const amountPrefix = transaction.type === 'income' ? '+' : '-';
  
  const recurringBadge = transaction.recurring && transaction.recurring !== 'none' 
    ? `<span class="recurring-badge">🔄</span>` 
    : '';
  
  const time = new Date(transaction.createdAt || transaction.date).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  return `
    <div class="transaction-item" data-id="${transaction.id}">
      <div class="transaction-header">
        <div class="transaction-category">
          <span class="category-icon">${category.icon}</span>
          <div class="transaction-info">
            <span class="category-name">${category.name}</span>
            <div class="transaction-description">${transaction.description}</div>
          </div>
        </div>
        <div class="transaction-right">
          <div class="transaction-amount ${amountClass}">
            ${amountPrefix}${formatCurrency(transaction.amount)}
            ${recurringBadge}
          </div>
          <div class="transaction-time">${time}</div>
        </div>
      </div>
      <div class="transaction-meta">
        <span class="transaction-account">${transaction.accountName}</span>
      </div>
      <div class="transaction-actions">
        <button class="action-btn edit" onclick="editTransaction('${transaction.id}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        <button class="action-btn delete" onclick="deleteTransaction('${transaction.id}')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function updateMonthlySummary(transactions) {
  let income = 0, expenses = 0;
  
  transactions.forEach(tx => {
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'expense') {
      expenses += tx.amount;
    }
  });
  
  const balance = income - expenses;
  
  document.getElementById('monthly-income').textContent = formatCurrency(income);
  document.getElementById('monthly-expenses').textContent = formatCurrency(expenses);
  document.getElementById('monthly-balance').textContent = formatCurrency(balance);
  
  // Update balance color
  const balanceElement = document.getElementById('monthly-balance');
  balanceElement.style.color = balance >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
}

// Swipe functionality
function addSwipeListeners(element) {
  let startX = 0;
  let currentX = 0;
  let isSwipe = false;
  
  element.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    isSwipe = true;
  }, { passive: true });
  
  element.addEventListener('touchmove', (e) => {
    if (!isSwipe) return;
    
    currentX = e.touches[0].clientX;
    const diffX = startX - currentX;
    
    if (diffX > 20) {
      element.classList.add('swipe-left');
    } else {
      element.classList.remove('swipe-left');
    }
  }, { passive: true });
  
  element.addEventListener('touchend', () => {
    isSwipe = false;
  }, { passive: true });
  
  // Click outside to close swipe
  document.addEventListener('click', (e) => {
    if (!element.contains(e.target)) {
      element.classList.remove('swipe-left');
    }
  });
}

// Transaction CRUD operations
function openAddTransactionModal() {
  editingTransaction = null;
  document.getElementById('transaction-modal-title').textContent = 'Add Transaction';
  document.getElementById('transaction-form').reset();
  document.getElementById('transaction-date').value = new Date().toISOString().split('T')[0];
  
  // Reset transaction type
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector('.type-btn[data-type="expense"]').classList.add('active');
  currentTransactionType = 'expense';
  
  // Reset recurring
  setRecurring('none');
  
  loadAccountsIntoSelect();
  loadCategoriesIntoSelect();
  updateTransactionTypeUI();
  updateTransactionFormColors();
  updateCurrencySymbols();
  showModal('transaction-modal');
}

function editTransaction(id) {
  const transactions = loadFromStorage('transactions', []);
  editingTransaction = transactions.find(tx => tx.id === id);
  
  if (!editingTransaction) return;
  
  document.getElementById('transaction-modal-title').textContent = 'Edit Transaction';
  
  // Set transaction type
  document.querySelectorAll('.type-btn').forEach(btn => btn.classList.remove('active'));
  document.querySelector(`.type-btn[data-type="${editingTransaction.type}"]`).classList.add('active');
  currentTransactionType = editingTransaction.type;
  
  // Fill form fields
  document.getElementById('transaction-amount').value = editingTransaction.amount;
  document.getElementById('transaction-account').value = editingTransaction.account;
  document.getElementById('transaction-category').value = editingTransaction.category;
  document.getElementById('transaction-date').value = editingTransaction.date;
  document.getElementById('transaction-description').value = editingTransaction.description || '';
  document.getElementById('transaction-recurring').value = editingTransaction.recurring || 'none';
  
  if (editingTransaction.toAccount) {
    document.getElementById('transaction-to-account').value = editingTransaction.toAccount;
  }
  
  loadAccountsIntoSelect();
  loadCategoriesIntoSelect();
  updateTransactionTypeUI();
  updateCurrencySymbols();
  showModal('transaction-modal');
}

function deleteTransaction(id) {
  showConfirmDialog(
    'Delete Transaction',
    'Are you sure you want to delete this transaction? This action cannot be undone.',
    () => {
      const transactions = loadFromStorage('transactions', []);
      const filteredTransactions = transactions.filter(tx => tx.id !== id);
      saveToStorage('transactions', filteredTransactions);
      loadTransactions();
      showToast('Transaction deleted successfully');
    }
  );
}

function saveTransaction(formData) {
  const transactions = loadFromStorage('transactions', []);
  const accounts = loadFromStorage('accounts', []);
  const categories = {
    ...loadFromStorage('expenseCategories', []).reduce((acc, cat) => ({ ...acc, [cat.id]: cat }), {}),
    ...loadFromStorage('incomeCategories', []).reduce((acc, cat) => ({ ...acc, [cat.id]: cat }), {})
  };
  
  const account = accounts.find(acc => acc.id === formData.account);
  const category = categories[formData.category];
  
  const transaction = {
    id: editingTransaction ? editingTransaction.id : generateId('tx'),
    date: formData.date,
    type: formData.type,
    amount: parseFloat(formData.amount),
    account: formData.account,
    accountName: account ? account.name : 'Unknown Account',
    category: formData.category,
    categoryName: category ? category.name : 'Unknown Category',
    description: formData.description,
    recurring: formData.recurring,
    createdAt: editingTransaction ? editingTransaction.createdAt : new Date().toISOString()
  };
  
  if (formData.type === 'transfer' && formData.toAccount) {
    const toAccount = accounts.find(acc => acc.id === formData.toAccount);
    transaction.toAccount = formData.toAccount;
    transaction.toAccountName = toAccount ? toAccount.name : 'Unknown Account';
  }
  
  if (editingTransaction) {
    const index = transactions.findIndex(tx => tx.id === editingTransaction.id);
    transactions[index] = transaction;
  } else {
    transactions.push(transaction);
  }
  
  saveToStorage('transactions', transactions);
  closeModal('transaction-modal');
  loadTransactions();
  showToast(editingTransaction ? 'Transaction updated successfully' : 'Transaction added successfully');
}

// Recurring transaction functions
function toggleRecurringDropdown() {
  const dropdown = document.getElementById('recurring-dropdown');
  const icon = document.getElementById('recurring-icon');
  
  recurringDropdownOpen = !recurringDropdownOpen;
  
  if (recurringDropdownOpen) {
    dropdown.classList.add('show');
  } else {
    dropdown.classList.remove('show');
  }
}

function setRecurring(frequency) {
  const hiddenInput = document.getElementById('transaction-recurring');
  const text = document.getElementById('recurring-text');
  const icon = document.getElementById('recurring-icon');
  
  hiddenInput.value = frequency;
  
  if (frequency === 'none') {
    icon.classList.remove('active');
    icon.title = 'Set recurring frequency';
  } else {
    icon.classList.add('active');
    icon.title = `Recurring: ${frequency.charAt(0).toUpperCase() + frequency.slice(1)}`;
  }
  
  toggleRecurringDropdown();
}

function updateTransactionFormColors() {
  const modalContent = document.querySelector('#transaction-modal .modal-content');
  const primaryBtn = document.querySelector('#transaction-modal .btn-primary');
  const modal = document.getElementById('transaction-modal');
  const modalHeader = modal.querySelector('.modal-header');
  
  if (!modalContent || !primaryBtn) return;
  
  let color = '#8B4513'; // Default brown
  let headerColor = color;
  
  switch (currentTransactionType) {
    case 'expense':
      color = '#D32F2F';
      headerColor = '#D32F2F';
      break;
    case 'income':
      color = '#1976D2';
      headerColor = '#1976D2';
      break;
    case 'transfer':
      color = '#616161';
      headerColor = '#616161';
      break;
  }
  
  modalContent.style.setProperty('--current-type-color', color);
  modal.setAttribute('data-type', currentTransactionType);
  
  // Update modal header background and save button
  if (modalHeader) {
    modalHeader.style.background = headerColor;
    modalHeader.style.color = 'white';
    modalHeader.style.borderRadius = 'var(--radius-xl) var(--radius-xl) 0 0';
    modalHeader.style.marginBottom = '0';
  }
}

function loadAccountsIntoSelect() {
  const accounts = loadFromStorage('accounts', []);
  const select = document.getElementById('transaction-account');
  const toSelect = document.getElementById('transaction-to-account');
  
  const options = accounts.map(account => 
    `<option value="${account.id}">${account.name}</option>`
  ).join('');
  
  select.innerHTML = options;
  toSelect.innerHTML = options;
}

function loadCategoriesIntoSelect() {
  const expenseCategories = loadFromStorage('expenseCategories', []);
  const incomeCategories = loadFromStorage('incomeCategories', []);
  const select = document.getElementById('transaction-category');
  
  let options = '';
  
  if (currentTransactionType === 'expense') {
    options = expenseCategories.map(cat => 
      `<option value="${cat.id}">${cat.name}</option>`
    ).join('');
  } else if (currentTransactionType === 'income') {
    options = incomeCategories.map(cat => 
      `<option value="${cat.id}">${cat.name}</option>`
    ).join('');
  } else {
    options = '<option value="transfer">Transfer</option>';
  }
  
  select.innerHTML = options;
}

function updateTransactionTypeUI() {
  const toAccountGroup = document.getElementById('to-account-group');
  const categoryGroup = document.querySelector('#transaction-category').parentElement;
  
  if (currentTransactionType === 'transfer') {
    toAccountGroup.style.display = 'block';
    categoryGroup.style.display = 'none';
  } else {
    toAccountGroup.style.display = 'none';
    categoryGroup.style.display = 'block';
  }
}

// Analytics
function loadAnalytics() {
  updateAnalyticsSummary();
  loadCharts();
}

function updateAnalyticsSummary() {
  const period = document.querySelector('.period-btn.active').dataset.period;
  const transactions = getTransactionsForPeriod(period);
  
  let income = 0, expenses = 0;
  const categoryTotals = {};
  
  transactions.forEach(tx => {
    if (tx.type === 'income') {
      income += tx.amount;
    } else if (tx.type === 'expense') {
      expenses += tx.amount;
      categoryTotals[tx.categoryName] = (categoryTotals[tx.categoryName] || 0) + tx.amount;
    }
  });
  
  const savings = income - expenses;
  const topCategory = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)[0];
  
  document.getElementById('analytics-income').textContent = formatCurrency(income);
  document.getElementById('analytics-expenses').textContent = formatCurrency(expenses);
  document.getElementById('analytics-savings').textContent = formatCurrency(savings);
  document.getElementById('top-category').textContent = topCategory ? topCategory[0] : '-';
  
  // Update savings color
  const savingsElement = document.getElementById('analytics-savings');
  savingsElement.style.color = savings >= 0 ? 'var(--color-income)' : 'var(--color-expense)';
}

function getTransactionsForPeriod(period) {
  const transactions = loadFromStorage('transactions', []);
  const now = new Date();
  
  return transactions.filter(tx => {
    const txDate = new Date(tx.date);
    
    if (period === 'month') {
      return txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear;
    } else if (period === 'year') {
      return txDate.getFullYear() === currentYear;
    }
    
    return true;
  });
}

function loadCharts() {
  loadCategoryChart();
  loadTrendChart();
}

function loadCategoryChart() {
  const ctx = document.getElementById('categoryChart').getContext('2d');
  const period = document.querySelector('.period-btn.active').dataset.period;
  const transactions = getTransactionsForPeriod(period)
    .filter(tx => tx.type === 'expense');
  
  const categoryData = {};
  const expenseCategories = loadFromStorage('expenseCategories', []);
  const categoryColors = {};
  
  expenseCategories.forEach(cat => {
    categoryColors[cat.name] = cat.color;
  });
  
  transactions.forEach(tx => {
    categoryData[tx.categoryName] = (categoryData[tx.categoryName] || 0) + tx.amount;
  });
  
  const labels = Object.keys(categoryData);
  const data = Object.values(categoryData);
  const colors = labels.map(label => categoryColors[label] || '#64748b');
  
  // Destroy existing chart if it exists
  if (window.categoryChartInstance) {
    window.categoryChartInstance.destroy();
  }
  
  window.categoryChartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: labels,
      datasets: [{
        data: data,
        backgroundColor: colors,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 15,
            font: {
              size: 12
            }
          }
        }
      }
    }
  });
}

function loadTrendChart() {
  const ctx = document.getElementById('trendChart').getContext('2d');
  const period = document.querySelector('.period-btn.active').dataset.period;
  const transactions = getTransactionsForPeriod(period);
  
  let labels = [];
  let incomeData = [];
  let expenseData = [];
  
  if (period === 'month') {
    // Group by days in the month
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    labels = Array.from({ length: daysInMonth }, (_, i) => (i + 1).toString());
    
    incomeData = new Array(daysInMonth).fill(0);
    expenseData = new Array(daysInMonth).fill(0);
    
    transactions.forEach(tx => {
      const day = new Date(tx.date).getDate() - 1;
      if (tx.type === 'income') {
        incomeData[day] += tx.amount;
      } else if (tx.type === 'expense') {
        expenseData[day] += tx.amount;
      }
    });
  } else {
    // Group by months in the year
    labels = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    incomeData = new Array(12).fill(0);
    expenseData = new Array(12).fill(0);
    
    transactions.forEach(tx => {
      const month = new Date(tx.date).getMonth();
      if (tx.type === 'income') {
        incomeData[month] += tx.amount;
      } else if (tx.type === 'expense') {
        expenseData[month] += tx.amount;
      }
    });
  }
  
  // Destroy existing chart if it exists
  if (window.trendChartInstance) {
    window.trendChartInstance.destroy();
  }
  
  window.trendChartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: [
        {
          label: 'Income',
          data: incomeData,
          borderColor: '#10b981',
          backgroundColor: 'rgba(16, 185, 129, 0.1)',
          tension: 0.4,
          fill: false
        },
        {
          label: 'Expenses',
          data: expenseData,
          borderColor: '#ef4444',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          tension: 0.4,
          fill: false
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            boxWidth: 12,
            padding: 15,
            font: {
              size: 12
            }
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true
        }
      }
    }
  });
}

// Accounts
function loadAccounts() {
  const accounts = loadFromStorage('accounts', []);
  const container = document.getElementById('accounts-list');
  
  // Group accounts by type
  const groupedAccounts = accounts.reduce((groups, account) => {
    const type = account.type;
    if (!groups[type]) groups[type] = [];
    groups[type].push(account);
    return groups;
  }, {});
  
  container.innerHTML = Object.entries(groupedAccounts)
    .map(([type, accounts]) => `
      <div class="account-group">
        <h4>${type}s</h4>
        ${accounts.map(account => createAccountHTML(account)).join('')}
      </div>
    `).join('');
  
  updateFinancialSummary(accounts);
}

function createAccountHTML(account) {
  const balanceClass = account.balance >= 0 ? 'positive' : 'negative';
  
  return `
    <div class="account-item" data-id="${account.id}" onclick="editAccount('${account.id}')">
      <div class="account-header">
        <div class="account-info">
          <h4>${account.name}</h4>
          <span class="account-type">${account.type}</span>
        </div>
        <div class="account-balance ${balanceClass}">
          ${formatCurrency(account.balance)}
        </div>
      </div>
    </div>
  `;
}

function updateFinancialSummary(accounts) {
  let totalAssets = 0;
  let totalLiabilities = 0;
  
  accounts.forEach(account => {
    if (account.includeInTotal) {
      if (account.balance >= 0) {
        totalAssets += account.balance;
      } else {
        totalLiabilities += Math.abs(account.balance);
      }
    }
  });
  
  const netWorth = totalAssets - totalLiabilities;
  
  document.getElementById('total-assets').textContent = formatCurrency(totalAssets);
  document.getElementById('total-liabilities').textContent = formatCurrency(totalLiabilities);
  document.getElementById('net-worth').textContent = formatCurrency(netWorth);
  
  // Update net worth color
  const netWorthElement = document.getElementById('net-worth');
  netWorthElement.style.color = netWorth >= 0 ? 'white' : '#F87171';
}

// Account CRUD operations
function openAddAccountModal() {
  editingAccount = null;
  document.getElementById('account-modal-title').textContent = 'Add Account';
  document.getElementById('account-form').reset();
  document.getElementById('account-include-total').checked = true;
  document.getElementById('credit-card-fields').style.display = 'none';
  loadAccountTypesIntoSelect();
  loadAccountTypesIntoSelect();
  updateCurrencySymbols();
  showModal('account-modal');
}

function editAccount(id) {
  const accounts = loadFromStorage('accounts', []);
  editingAccount = accounts.find(acc => acc.id === id);
  
  if (!editingAccount) return;
  
  document.getElementById('account-modal-title').textContent = 'Edit Account';
  document.getElementById('account-name').value = editingAccount.name;
  document.getElementById('account-type').value = editingAccount.type;
  document.getElementById('account-balance').value = editingAccount.balance;
  document.getElementById('account-include-total').checked = editingAccount.includeInTotal;
  
  if (editingAccount.type === 'Credit Card') {
    document.getElementById('credit-card-fields').style.display = 'block';
    document.getElementById('credit-limit').value = editingAccount.creditLimit || '';
    document.getElementById('billing-day').value = editingAccount.billingDay || '';
    document.getElementById('payment-day').value = editingAccount.paymentDay || '';
  } else {
    document.getElementById('credit-card-fields').style.display = 'none';
  }
  
  updateCurrencySymbols();
  showModal('account-modal');
}

function deleteAccount(id) {
  showConfirmDialog(
    'Delete Account',
    'Are you sure you want to delete this account? All associated transactions will also be deleted.',
    () => {
      const accounts = loadFromStorage('accounts', []);
      const transactions = loadFromStorage('transactions', []);
      
      const filteredAccounts = accounts.filter(acc => acc.id !== id);
      const filteredTransactions = transactions.filter(tx => tx.account !== id && tx.toAccount !== id);
      
      saveToStorage('accounts', filteredAccounts);
      saveToStorage('transactions', filteredTransactions);
      
      loadAccounts();
      if (currentScreen === 'transactions') {
        loadTransactions();
      }
      
      showToast('Account deleted successfully');
    }
  );
}

function saveAccount(formData) {
  const accounts = loadFromStorage('accounts', []);
  
  const account = {
    id: editingAccount ? editingAccount.id : generateId('acc'),
    name: formData.name,
    type: formData.type,
    balance: parseFloat(formData.balance),
    includeInTotal: formData.includeInTotal,
    createdAt: editingAccount ? editingAccount.createdAt : new Date().toISOString().split('T')[0]
  };
  
  if (formData.type === 'Credit Card') {
    account.creditLimit = parseFloat(formData.creditLimit) || 0;
    account.billingDay = parseInt(formData.billingDay) || 1;
    account.paymentDay = parseInt(formData.paymentDay) || 1;
  }
  
  if (editingAccount) {
    const index = accounts.findIndex(acc => acc.id === editingAccount.id);
    accounts[index] = account;
  } else {
    accounts.push(account);
  }
  
  saveToStorage('accounts', accounts);
  closeModal('account-modal');
  loadAccounts();
  showToast(editingAccount ? 'Account updated successfully' : 'Account added successfully');
}

// Settings
function loadSettings() {
  loadCategories();
  loadAccountTypes();
  loadAppSettings();
  
  // Add migration option if applicable
  const migrationHtml = showMigrationOption();
  if (migrationHtml) {
    const settingsScreen = document.getElementById('settings-screen');
    const firstSection = settingsScreen.querySelector('.settings-section');
    if (firstSection) {
      firstSection.insertAdjacentHTML('beforebegin', migrationHtml);
    }
  }
}

function loadCategories() {
  const expenseCategories = loadFromStorage('expenseCategories', []);
  const incomeCategories = loadFromStorage('incomeCategories', []);
  
  const expenseContainer = document.getElementById('expense-categories-list');
  const incomeContainer = document.getElementById('income-categories-list');
  
  expenseContainer.innerHTML = expenseCategories
    .map(category => createCategoryHTML(category, 'expense')).join('');
  
  incomeContainer.innerHTML = incomeCategories
    .map(category => createCategoryHTML(category, 'income')).join('');
}

function createCategoryHTML(category, type) {
  return `
    <div class="category-item" data-id="${category.id}" onclick="editCategory('${category.id}', '${type}')">
      <div class="category-color" style="background-color: ${category.color}"></div>
      <div class="category-info">
        <span>${category.icon} ${category.name}</span>
      </div>
    </div>
  `;
}

function loadAppSettings() {
  const settings = loadFromStorage('settings', sampleData.settings);
  
  document.getElementById('currency-select').value = settings.currency;
  document.getElementById('theme-toggle').checked = settings.theme === 'dark';
  
  applyTheme(settings.theme);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

// Category CRUD operations
function openAddCategoryModal(type) {
  editingCategory = null;
  currentCategoryType = type;
  
  document.getElementById('category-modal-title').textContent = 
    `Add ${type.charAt(0).toUpperCase() + type.slice(1)} Category`;
  
  document.getElementById('category-form').reset();
  document.getElementById('category-color').value = '#64748b';
  
  const budgetField = document.getElementById('budget-field');
  if (type === 'expense') {
    budgetField.style.display = 'block';
  } else {
    budgetField.style.display = 'none';
  }
  
  updateCurrencySymbols();
  showModal('category-modal');
}

function editCategory(id, type) {
  const categories = loadFromStorage(`${type}Categories`, []);
  editingCategory = categories.find(cat => cat.id === id);
  currentCategoryType = type;
  
  if (!editingCategory) return;
  
  document.getElementById('category-modal-title').textContent = 
    `Edit ${type.charAt(0).toUpperCase() + type.slice(1)} Category`;
  
  document.getElementById('category-name').value = editingCategory.name;
  document.getElementById('category-icon').value = editingCategory.icon || '';
  document.getElementById('category-color').value = editingCategory.color;
  
  const budgetField = document.getElementById('budget-field');
  if (type === 'expense') {
    budgetField.style.display = 'block';
    document.getElementById('category-budget').value = editingCategory.budget || '';
  } else {
    budgetField.style.display = 'none';
  }
  
  updateCurrencySymbols();
  showModal('category-modal');
}

function deleteCategory(id, type) {
  showConfirmDialog(
    'Delete Category',
    'Are you sure you want to delete this category? Transactions using this category will show as "Unknown Category".',
    () => {
      const categories = loadFromStorage(`${type}Categories`, []);
      const filteredCategories = categories.filter(cat => cat.id !== id);
      saveToStorage(`${type}Categories`, filteredCategories);
      loadCategories();
      showToast('Category deleted successfully');
    }
  );
}

function saveCategory(formData) {
  const categories = loadFromStorage(`${currentCategoryType}Categories`, []);
  
  const category = {
    id: editingCategory ? editingCategory.id : generateId(currentCategoryType === 'expense' ? 'exp' : 'inc'),
    name: formData.name,
    color: formData.color,
    icon: formData.icon || '📁'
  };
  
  if (currentCategoryType === 'expense' && formData.budget) {
    category.budget = parseFloat(formData.budget);
  }
  
  if (editingCategory) {
    const index = categories.findIndex(cat => cat.id === editingCategory.id);
    categories[index] = category;
  } else {
    categories.push(category);
  }
  
  saveToStorage(`${currentCategoryType}Categories`, categories);
  closeModal('category-modal');
  loadCategories();
  showToast(editingCategory ? 'Category updated successfully' : 'Category added successfully');
}

// Add migration to settings screen
function showMigrationOption() {
  if (isGuestMode || !isFirebaseEnabled || !currentAuthUser) {
    return '';
  }
  
  const hasLocalData = window.transactions_data || window.accounts_data;
  if (!hasLocalData) {
    return '';
  }
  
  return `
    <div class="settings-section">
      <h3>Data Migration</h3>
      <div class="migration-option">
        <p>Local data found. Import it to your cloud account?</p>
        <button class="btn btn-primary" onclick="migrateData()">Import Local Data</button>
      </div>
    </div>
  `;
}

// Data management
function exportData() {
  const data = {
    accounts: loadFromStorage('accounts', []),
    transactions: loadFromStorage('transactions', []),
    expenseCategories: loadFromStorage('expenseCategories', []),
    incomeCategories: loadFromStorage('incomeCategories', []),
    settings: loadFromStorage('settings', {}),
    exportDate: new Date().toISOString()
  };
  
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `expense-tracker-export-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('Data exported successfully');
}

function importData() {
  document.getElementById('import-file').click();
}

function handleFileImport(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      
      // Validate data structure
      if (!data.accounts || !data.transactions || !data.expenseCategories || !data.incomeCategories) {
        throw new Error('Invalid data format');
      }
      
      showConfirmDialog(
        'Import Data',
        'This will replace all existing data. Are you sure you want to continue?',
        () => {
          saveToStorage('accounts', data.accounts);
          saveToStorage('transactions', data.transactions);
          saveToStorage('expenseCategories', data.expenseCategories);
          saveToStorage('incomeCategories', data.incomeCategories);
          if (data.settings) {
            saveToStorage('settings', data.settings);
          }
          
          // Reload current screen
          switchScreen(currentScreen);
          showToast('Data imported successfully');
        }
      );
    } catch (error) {
      showToast('Failed to import data. Please check the file format.', 'error');
    }
  };
  
  reader.readAsText(file);
  event.target.value = ''; // Reset file input
}

function clearAllData() {
  showConfirmDialog(
    'Clear All Data',
    'This will permanently delete all your transactions, accounts, and categories. This action cannot be undone.',
    () => {
      // Clear all storage
      window.transactions_data = undefined;
      window.accounts_data = undefined;
      window.expenseCategories_data = undefined;
      window.incomeCategories_data = undefined;
      window.settings_data = undefined;
      
      // Reinitialize with sample data
      initializeData();
      switchScreen('transactions');
      showToast('All data cleared successfully');
    }
  );
}

// Modal functions
function showModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.add('show');
  modal.style.display = 'flex';
  
  // Focus first input
  const firstInput = modal.querySelector('input, select, textarea');
  if (firstInput) {
    setTimeout(() => firstInput.focus(), 100);
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 300);
}

// Confirmation dialog
function showConfirmDialog(title, message, callback) {
  document.getElementById('confirm-title').textContent = title;
  document.getElementById('confirm-message').textContent = message;
  confirmCallback = callback;
  showModal('confirm-dialog');
}

function closeConfirmDialog() {
  confirmCallback = null;
  closeModal('confirm-dialog');
}

function confirmAction() {
  if (confirmCallback) {
    confirmCallback();
    confirmCallback = null;
  }
  closeModal('confirm-dialog');
}

// Update currency symbols
function updateCurrencySymbols() {
  const settings = loadFromStorage('settings', sampleData.settings);
  document.querySelectorAll('.currency-symbol').forEach(symbol => {
    symbol.textContent = settings.currency;
  });
}

// Event listeners
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM Content Loaded - Initializing Firebase app');
  
  // Initialize Firebase first
  initializeFirebase();
  
  // Set up authentication event listeners
  setupAuthEventListeners();
  
  // Check online/offline status
  setupNetworkListeners();
  // Initialize data and UI after authentication is determined
  // This will be called from the auth state listener
  
  // Set up all global functions immediately
  setupGlobalFunctions();
  
  // If Firebase is not available, initialize with default user
  if (!isFirebaseEnabled) {
    initializeData();
    initializeDefaultUser();
    updateMonthDisplay();
    switchScreen('transactions');
  }
  
  // Navigation
  document.querySelectorAll('.menu-item').forEach(item => {
    item.addEventListener('click', () => {
      switchScreen(item.dataset.screen);
    });
  });
  
  // User profile dropdown - handled by onclick in HTML
  
  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!document.getElementById('user-profile').contains(e.target)) {
      closeProfileDropdown();
    }
  });
  
  // Month navigation
  document.getElementById('prev-month').addEventListener('click', () => navigateMonth('prev'));
  document.getElementById('next-month').addEventListener('click', () => navigateMonth('next'));
  
  // Transaction type selector
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentTransactionType = btn.dataset.type;
      loadCategoriesIntoSelect();
      updateTransactionTypeUI();
      updateTransactionFormColors();
    });
  });
  
  // Account type change
  document.getElementById('account-type').addEventListener('change', (e) => {
    const creditCardFields = document.getElementById('credit-card-fields');
    if (e.target.value === 'Credit Card') {
      creditCardFields.style.display = 'block';
    } else {
      creditCardFields.style.display = 'none';
    }
  });
  
  // Period selector
  document.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      updateAnalyticsSummary();
      loadCharts();
    });
  });
  
  // Settings
  document.getElementById('currency-select').addEventListener('change', (e) => {
    const settings = loadFromStorage('settings', sampleData.settings);
    settings.currency = e.target.value;
    saveToStorage('settings', settings);
    
    updateCurrencySymbols();
    if (currentScreen === 'transactions') {
      loadTransactions();
    } else if (currentScreen === 'accounts') {
      loadAccounts();
    } else if (currentScreen === 'analytics') {
      updateAnalyticsSummary();
    }
    
    showToast('Currency updated successfully');
  });
  
  document.getElementById('theme-toggle').addEventListener('change', (e) => {
    const settings = loadFromStorage('settings', sampleData.settings);
    settings.theme = e.target.checked ? 'dark' : 'light';
    saveToStorage('settings', settings);
    applyTheme(settings.theme);
    showToast('Theme updated successfully');
  });
  
  // Account type form submission
  document.getElementById('account-type-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name') || document.getElementById('account-type-name').value,
      icon: formData.get('icon') || document.getElementById('account-type-icon').value,
      color: formData.get('color') || document.getElementById('account-type-color').value
    };
    saveAccountType(data);
  });
  
  // Form submissions
  document.getElementById('transaction-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      type: currentTransactionType,
      amount: formData.get('amount') || document.getElementById('transaction-amount').value,
      account: formData.get('account') || document.getElementById('transaction-account').value,
      toAccount: formData.get('to-account') || document.getElementById('transaction-to-account').value,
      category: formData.get('category') || document.getElementById('transaction-category').value,
      date: formData.get('date') || document.getElementById('transaction-date').value,
      description: formData.get('description') || document.getElementById('transaction-description').value,
      recurring: formData.get('recurring') || document.getElementById('transaction-recurring').value
    };
    saveTransaction(data);
  });
  
  document.getElementById('account-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name') || document.getElementById('account-name').value,
      type: formData.get('type') || document.getElementById('account-type').value,
      balance: formData.get('balance') || document.getElementById('account-balance').value,
      includeInTotal: document.getElementById('account-include-total').checked,
      creditLimit: formData.get('credit-limit') || document.getElementById('credit-limit').value,
      billingDay: formData.get('billing-day') || document.getElementById('billing-day').value,
      paymentDay: formData.get('payment-day') || document.getElementById('payment-day').value
    };
    saveAccount(data);
  });
  
  document.getElementById('category-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: formData.get('name') || document.getElementById('category-name').value,
      icon: formData.get('icon') || document.getElementById('category-icon').value,
      color: formData.get('color') || document.getElementById('category-color').value,
      budget: formData.get('budget') || document.getElementById('category-budget').value
    };
    saveCategory(data);
  });
  
  // Profile management forms
  document.getElementById('set-name-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('profile-name').value.trim();
    if (name) {
      saveUserName(name);
    }
  });
  
  document.getElementById('add-profile-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
      name: document.getElementById('new-profile-name').value.trim(),
      color: formData.get('profileColor')
    };
    saveProfile(data);
  });
  
  // Close modals on outside click
  document.querySelectorAll('.modal').forEach(modal => {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal(modal.id);
      }
    });
  });
  
  // Close modals on escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const openModal = document.querySelector('.modal.show');
      if (openModal) {
        closeModal(openModal.id);
      }
    }
  });
  
  // Touch gestures for month navigation
  let touchStartX = 0;
  let touchEndX = 0;
  
  document.getElementById('main-content').addEventListener('touchstart', (e) => {
    if (currentScreen === 'transactions') {
      touchStartX = e.changedTouches[0].screenX;
    }
  }, { passive: true });
  
  document.getElementById('main-content').addEventListener('touchend', (e) => {
    if (currentScreen === 'transactions') {
      touchEndX = e.changedTouches[0].screenX;
      handleSwipe();
    }
  }, { passive: true });
  
  function handleSwipe() {
    const swipeThreshold = 100;
    const diff = touchStartX - touchEndX;
    
    if (Math.abs(diff) > swipeThreshold) {
      if (diff > 0) {
        // Swipe left - next month
        navigateMonth('next');
      } else {
        // Swipe right - previous month
        navigateMonth('prev');
      }
    }
  }
  
  // Load settings page data
  if (currentScreen === 'settings') {
    loadSettings();
    loadProfiles();
  }
});

// Setup authentication event listeners
function setupAuthEventListeners() {
  // Google Sign In
  const googleBtn = document.getElementById('google-signin-btn');
  if (googleBtn) {
    googleBtn.addEventListener('click', signInWithGoogle);
  }
  
  // Email Sign In
  const emailForm = document.getElementById('email-signin-form');
  if (emailForm) {
    emailForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signin-email').value;
      const password = document.getElementById('signin-password').value;
      signInWithEmail(email, password);
    });
  }
  
  // Email Sign Up
  const signupForm = document.getElementById('email-signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const email = document.getElementById('signup-email').value;
      const password = document.getElementById('signup-password').value;
      signUpWithEmail(email, password);
    });
  }
  
  // Guest Mode
  const guestBtn = document.getElementById('guest-mode-btn');
  if (guestBtn) {
    guestBtn.addEventListener('click', () => {
      showGuestMode();
    });
  }
  
  // Show/Hide Sign Up Form
  const showSignup = document.getElementById('show-signup');
  const showSignin = document.getElementById('show-signin');
  const signupFormEl = document.getElementById('signup-form');
  const emailFormEl = document.getElementById('email-signin-form');
  
  if (showSignup && signupFormEl && emailFormEl) {
    showSignup.addEventListener('click', (e) => {
      e.preventDefault();
      signupFormEl.classList.remove('hidden');
      emailFormEl.style.display = 'none';
    });
  }
  
  if (showSignin && signupFormEl && emailFormEl) {
    showSignin.addEventListener('click', (e) => {
      e.preventDefault();
      signupFormEl.classList.add('hidden');
      emailFormEl.style.display = 'flex';
    });
  }
}

// Setup network listeners for offline detection
function setupNetworkListeners() {
  window.addEventListener('online', () => {
    console.log('Back online');
    setSyncStatus('synced');
    hideOfflineBanner();
    
    // Attempt to sync any pending changes
    if (!isGuestMode && isFirebaseEnabled) {
      syncPendingChanges();
    }
  });
  
  window.addEventListener('offline', () => {
    console.log('Gone offline');
    setSyncStatus('offline');
    showOfflineBanner();
  });
}

function showOfflineBanner() {
  let banner = document.getElementById('offline-banner');
  if (!banner) {
    banner = document.createElement('div');
    banner.id = 'offline-banner';
    banner.className = 'offline-banner';
    banner.innerHTML = '⚠️ You are offline. Changes will sync when you reconnect.';
    document.body.appendChild(banner);
  }
  banner.classList.add('show');
}

function hideOfflineBanner() {
  const banner = document.getElementById('offline-banner');
  if (banner) {
    banner.classList.remove('show');
    setTimeout(() => banner.remove(), 300);
  }
}

async function syncPendingChanges() {
  // This would sync any changes made while offline
  // For now, just reload data from cloud
  try {
    await loadUserDataFromCloud();
    if (currentScreen === 'transactions') {
      loadTransactions();
    } else if (currentScreen === 'accounts') {
      loadAccounts();
    }
  } catch (error) {
    console.error('Error syncing pending changes:', error);
  }
}

// Setup all global functions
function setupGlobalFunctions() {
  // Modal functions
  window.showModal = showModal;
  window.closeModal = closeModal;
  
  // Transaction functions
  window.openAddTransactionModal = openAddTransactionModal;
  window.editTransaction = editTransaction;
  window.deleteTransaction = deleteTransaction;
  
  // Account functions
  window.openAddAccountModal = openAddAccountModal;
  window.editAccount = editAccount;
  window.deleteAccount = deleteAccount;
  
  // Category functions
  window.openAddCategoryModal = openAddCategoryModal;
  window.editCategory = editCategory;
  window.deleteCategory = deleteCategory;
  
  // Confirmation dialog
  window.showConfirmDialog = showConfirmDialog;
  window.closeConfirmDialog = closeConfirmDialog;
  window.confirmAction = confirmAction;
  
  // Data management
  window.exportData = exportData;
  window.importData = importData;
  window.handleFileImport = handleFileImport;
  window.clearAllData = clearAllData;
  
  // Profile functions
  window.toggleProfileDropdown = toggleProfileDropdown;
  window.openSetNameModal = openSetNameModal;
  window.switchToProfile = switchToProfile;
  window.openAddProfileModal = openAddProfileModal;
  window.editProfile = editProfile;
  window.deleteProfile = deleteProfile;
  
  // Recurring functions
  window.toggleRecurringDropdown = toggleRecurringDropdown;
  window.setRecurring = setRecurring;
  
  // Account type functions
  window.openAddAccountTypeModal = openAddAccountTypeModal;
  window.editAccountType = editAccountType;
  window.deleteAccountType = deleteAccountType;
  window.selectEmoji = selectEmoji;
  
  // Firebase functions
  window.signInWithGoogle = signInWithGoogle;
  window.signInWithEmail = signInWithEmail;
  window.signUpWithEmail = signUpWithEmail;
  window.signOut = signOut;
  window.migrateData = migrateData;
  
  console.log('All global functions bound to window');
}
// Account Types Management
function loadAccountTypes() {
  const accountTypes = loadFromStorage('accountTypes', []);
  const container = document.getElementById('account-types-list');
  
  container.innerHTML = accountTypes
    .map(type => createAccountTypeHTML(type))
    .join('');
}

function createAccountTypeHTML(type) {
  const isDefault = ['type1', 'type2', 'type3', 'type4', 'type5'].includes(type.id);
  
  return `
    <div class="account-type-item" data-id="${type.id}">
      <div class="account-type-color" style="background-color: ${type.color}"></div>
      <div class="account-type-info">
        <span>${type.icon} ${type.name}</span>
      </div>
      <div class="category-actions" style="display: flex; gap: var(--space-8);">
        <button class="profile-action-btn" onclick="editAccountType('${type.id}')" title="Edit account type">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
            <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
          </svg>
        </button>
        ${!isDefault ? `<button class="profile-action-btn delete" onclick="deleteAccountType('${type.id}')" title="Delete account type">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3,6 5,6 21,6"></polyline>
            <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
          </svg>
        </button>` : ''}
      </div>
    </div>
  `;
}

function openAddAccountTypeModal() {
  editingAccountType = null;
  document.getElementById('account-type-modal-title').textContent = 'Add Account Type';
  document.getElementById('account-type-form').reset();
  document.getElementById('account-type-color').value = '#8B4513';
  showModal('account-type-modal');
}

function editAccountType(id) {
  const accountTypes = loadFromStorage('accountTypes', []);
  editingAccountType = accountTypes.find(type => type.id === id);
  
  if (!editingAccountType) return;
  
  document.getElementById('account-type-modal-title').textContent = 'Edit Account Type';
  document.getElementById('account-type-name').value = editingAccountType.name;
  document.getElementById('account-type-icon').value = editingAccountType.icon;
  document.getElementById('account-type-color').value = editingAccountType.color;
  
  showModal('account-type-modal');
}

function saveAccountType(formData) {
  const accountTypes = loadFromStorage('accountTypes', []);
  
  const accountType = {
    id: editingAccountType ? editingAccountType.id : generateId('type'),
    name: formData.name,
    icon: formData.icon || '📁',
    color: formData.color
  };
  
  if (editingAccountType) {
    const index = accountTypes.findIndex(type => type.id === editingAccountType.id);
    accountTypes[index] = accountType;
  } else {
    accountTypes.push(accountType);
  }
  
  saveToStorage('accountTypes', accountTypes);
  closeModal('account-type-modal');
  loadAccountTypes();
  showToast(editingAccountType ? 'Account type updated successfully' : 'Account type added successfully');
}

function selectEmoji(emoji) {
  document.getElementById('account-type-icon').value = emoji;
}

// Close dropdowns when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.amount-input')) {
    document.getElementById('recurring-dropdown').classList.remove('show');
    recurringDropdownOpen = false;
  }
});

// Load account types into account form select
function loadAccountTypesIntoSelect() {
  const accountTypes = loadFromStorage('accountTypes', []);
  const select = document.getElementById('account-type');
  
  if (accountTypes.length === 0) {
    // Use default types if none exist
    select.innerHTML = `
      <option value="Bank Account">Bank Account</option>
      <option value="Credit Card">Credit Card</option>
      <option value="Cash">Cash</option>
      <option value="Investment">Investment</option>
    `;
  } else {
    const options = accountTypes.map(type => 
      `<option value="${type.name}">${type.icon} ${type.name}</option>`
    ).join('');
    select.innerHTML = options;
  }
}

// Delete account type
function deleteAccountType(id) {
  const isDefault = ['type1', 'type2', 'type3', 'type4', 'type5'].includes(id);
  
  if (isDefault) {
    showToast('Cannot delete default account types', 'error');
    return;
  }
  
  showConfirmDialog(
    'Delete Account Type',
    'Are you sure you want to delete this account type? Accounts using this type will need to be updated.',
    () => {
      const accountTypes = loadFromStorage('accountTypes', []);
      const filteredTypes = accountTypes.filter(type => type.id !== id);
      saveToStorage('accountTypes', filteredTypes);
      loadAccountTypes();
      showToast('Account type deleted successfully');
    }
  );
}
