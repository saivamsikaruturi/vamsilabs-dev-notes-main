// ==========================================================================
// FIREBASE AUTH — Google, Microsoft, Email/Password
// ==========================================================================

// Firebase config — replace with your Firebase project config
const firebaseConfig = {
  apiKey: "AIzaSyD2ujDMyYdflcyig4KvaAVX3jzUJZ7-WNc",
  authDomain: "vamsilabs-a5121.firebaseapp.com",
  projectId: "vamsilabs-a5121",
  storageBucket: "vamsilabs-a5121.firebasestorage.app",
  messagingSenderId: "568445266148",
  appId: "1:568445266148:web:1901724c2d72b915e924f1",
  measurementId: "G-JYEF7NZ22B"
};

let app, auth, db, analytics;
let currentUser = null;

// Initialize Firebase (lazy load)
function initFirebase() {
  if (app) return Promise.resolve();

  return new Promise((resolve, reject) => {
    // Load Firebase SDK from CDN
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics-compat.js'
    ];

    let loaded = 0;
    scripts.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loaded++;
        if (loaded === scripts.length) {
          app = firebase.initializeApp(firebaseConfig);
          auth = firebase.auth();
          db = firebase.firestore();
          analytics = firebase.analytics();
          setupAuthListener();
          resolve();
        }
      };
      script.onerror = reject;
      document.head.appendChild(script);
    });
  });
}

// Auth state listener
function setupAuthListener() {
  auth.onAuthStateChanged(user => {
    currentUser = user;
    updateUI(user);
    if (user) {
      trackPageView(user);
      recordLogin(user);
      loadProgress();
    } else {
      progressCache.clear();
      progressLoaded = false;
      renderProgressUI();
    }
  });
}

// Update UI based on auth state
function updateUI(user) {
  const authSection = document.getElementById('auth-section');
  const userProfile = document.getElementById('user-profile');

  if (authSection) {
    authSection.style.display = user ? 'none' : 'block';
  }

  if (userProfile) {
    userProfile.style.display = user ? 'block' : 'none';
  }

  if (user) {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const email = document.getElementById('user-email-display');

    if (avatar) avatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=D4682A&color=fff`;
    if (name) name.textContent = user.displayName || 'User';
    if (email) email.textContent = user.email;
  }
}

// Sign in with Google
async function signInWithGoogle() {
  try {
    await initFirebase();
    const provider = new firebase.auth.GoogleAuthProvider();
    await auth.signInWithPopup(provider);
  } catch (error) {
    showAuthError(error.message);
  }
}

// Sign in with Microsoft
async function signInWithMicrosoft() {
  try {
    await initFirebase();
    const provider = new firebase.auth.OAuthProvider('microsoft.com');
    provider.setCustomParameters({ prompt: 'select_account' });
    await auth.signInWithPopup(provider);
  } catch (error) {
    showAuthError(error.message);
  }
}

// Toggle email form
function toggleEmailForm() {
  const form = document.getElementById('email-form');
  if (form) {
    form.style.display = form.style.display === 'none' ? 'flex' : 'none';
  }
}

// Sign in with email/password
async function signInWithEmail() {
  try {
    await initFirebase();
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    if (!email || !password) {
      showAuthError('Please enter both email and password');
      return;
    }

    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      showAuthError('No account found. Click "Sign Up" to create one.');
    } else if (error.code === 'auth/wrong-password') {
      showAuthError('Incorrect password.');
    } else {
      showAuthError(error.message);
    }
  }
}

// Sign up with email/password
async function signUpWithEmail() {
  try {
    await initFirebase();
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;

    if (!email || !password) {
      showAuthError('Please enter both email and password');
      return;
    }

    if (password.length < 6) {
      showAuthError('Password must be at least 6 characters');
      return;
    }

    await auth.createUserWithEmailAndPassword(email, password);
  } catch (error) {
    if (error.code === 'auth/email-already-in-use') {
      showAuthError('Account already exists. Try signing in.');
    } else {
      showAuthError(error.message);
    }
  }
}

// Sign out
async function signOut() {
  try {
    await initFirebase();
    await auth.signOut();
  } catch (error) {
    console.error('Sign out error:', error);
  }
}

// Show error message
function showAuthError(message) {
  const form = document.getElementById('email-form');
  const existing = document.querySelector('.vtn-auth-error');
  if (existing) existing.remove();

  const error = document.createElement('div');
  error.className = 'vtn-auth-error';
  error.style.cssText = 'color: #C53030; font-size: 0.8rem; text-align: center; margin-top: 0.5rem; padding: 0.5rem; background: #FFF5F5; border-radius: 4px;';
  error.textContent = message;

  const authCard = document.querySelector('.vtn-auth-card');
  if (authCard) authCard.appendChild(error);

  setTimeout(() => error.remove(), 5000);
}

// ==========================================================================
// ANALYTICS & METRICS
// ==========================================================================

// Track page view
function trackPageView(user) {
  if (!db || !user) return;

  const pageData = {
    userId: user.uid,
    email: user.email,
    page: window.location.pathname,
    title: document.title,
    timestamp: firebase.firestore.FieldValue.serverTimestamp(),
    userAgent: navigator.userAgent,
    referrer: document.referrer
  };

  db.collection('pageViews').add(pageData).catch(() => {});
}

// Record login
function recordLogin(user) {
  if (!db || !user) return;

  db.collection('users').doc(user.uid).set({
    email: user.email,
    displayName: user.displayName || '',
    photoURL: user.photoURL || '',
    lastLogin: firebase.firestore.FieldValue.serverTimestamp(),
    provider: user.providerData[0]?.providerId || 'unknown'
  }, { merge: true }).catch(() => {});
}

// Track time on page
let pageStartTime = Date.now();
window.addEventListener('beforeunload', () => {
  if (!db || !currentUser) return;
  const timeSpent = Math.round((Date.now() - pageStartTime) / 1000);

  db.collection('engagement').add({
    userId: currentUser.uid,
    page: window.location.pathname,
    timeSpentSeconds: timeSpent,
    timestamp: firebase.firestore.FieldValue.serverTimestamp()
  }).catch(() => {});
});

// Initialize auth on page load (check if user already logged in)
document.addEventListener('DOMContentLoaded', () => {
  initFirebase().then(() => {
    loadProgress();
  }).catch(() => {});
});

// ==========================================================================
// PROGRESS TRACKING
// ==========================================================================

const LEARNING_PATHS = {
  "faang-prep": {
    name: "FAANG Interview Prep",
    pages: [
      "/java/oops/",
      "/java/Collections/",
      "/springboot/introduction/",
      "/microservices/microservices/",
      "/designpatterns/dp/"
    ]
  },
  "spring-boot-mastery": {
    name: "Spring Boot Mastery",
    pages: [
      "/springboot/SpringIOC/",
      "/springboot/spring-data-jpa/",
      "/springboot/transactions/",
      "/springboot/security/",
      "/springboot/testing/"
    ]
  },
  "microservices-architect": {
    name: "Microservices Architect",
    pages: [
      "/microservices/design-principles/",
      "/microservices/InterServiceCommunication/",
      "/microservices/resilience-patterns/",
      "/microservices/deployment-strategies/",
      "/microservices/logging-monitoring/"
    ]
  }
};

let progressCache = new Map();
let progressLoaded = false;

function pageSlug(path) {
  return path.replace(/^\/|\/$/g, '').replace(/\//g, '__');
}

function currentPagePath() {
  let path = window.location.pathname;
  if (!path.endsWith('/')) path += '/';
  return path;
}

async function loadProgress() {
  if (!currentUser || !db) return;
  try {
    const snap = await db.collection('users').doc(currentUser.uid)
      .collection('progress').get();
    progressCache.clear();
    snap.forEach(doc => {
      progressCache.set(doc.data().page, doc.data());
    });
    progressLoaded = true;
    renderProgressUI();
  } catch (e) {}
}

function isComplete(path) {
  let normalized = path;
  if (!normalized.endsWith('/')) normalized += '/';
  return progressCache.has(normalized);
}

async function markPageComplete(path) {
  if (!currentUser || !db) return;
  let normalized = path || currentPagePath();
  if (!normalized.endsWith('/')) normalized += '/';

  const slug = pageSlug(normalized);
  const pathId = findLearningPath(normalized);
  const data = {
    page: normalized,
    title: document.title.replace(' - Vamsi Tech Notes', ''),
    learningPath: pathId,
    completedAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  progressCache.set(normalized, data);
  renderProgressUI();

  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('progress').doc(slug).set(data);
  } catch (e) {}
}

async function unmarkPageComplete(path) {
  if (!currentUser || !db) return;
  let normalized = path || currentPagePath();
  if (!normalized.endsWith('/')) normalized += '/';

  const slug = pageSlug(normalized);
  progressCache.delete(normalized);
  renderProgressUI();

  try {
    await db.collection('users').doc(currentUser.uid)
      .collection('progress').doc(slug).delete();
  } catch (e) {}
}

function toggleMarkComplete() {
  const path = currentPagePath();
  if (isComplete(path)) {
    unmarkPageComplete(path);
  } else {
    markPageComplete(path);
  }
}

function findLearningPath(pagePath) {
  for (const [id, lp] of Object.entries(LEARNING_PATHS)) {
    if (lp.pages.includes(pagePath)) return id;
  }
  return null;
}

function renderProgressUI() {
  renderMarkCompleteButton();
  renderPathProgress();
  renderSidebarCheckmarks();
}

function renderMarkCompleteButton() {
  const btn = document.getElementById('mark-complete-btn');
  const wrapper = document.getElementById('mark-complete-wrapper');
  if (!wrapper) return;

  const path = currentPagePath();
  const isHomepage = path === '/' || path === '/index.html';
  if (!currentUser || isHomepage) {
    wrapper.style.display = 'none';
    return;
  }

  wrapper.style.display = 'flex';
  const completed = isComplete(path);

  if (btn) {
    btn.className = completed
      ? 'vtn-mark-btn vtn-mark-btn--done'
      : 'vtn-mark-btn';
    btn.innerHTML = completed
      ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Completed'
      : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/></svg> Mark as Complete';
  }
}

function renderPathProgress() {
  const pathCards = document.querySelectorAll('[data-path]');
  pathCards.forEach(card => {
    const pathId = card.dataset.path;
    const lp = LEARNING_PATHS[pathId];
    if (!lp) return;

    const completed = lp.pages.filter(p => isComplete(p)).length;
    const total = lp.pages.length;
    const pct = Math.round((completed / total) * 100);

    let bar = card.querySelector('.vtn-path-progress');
    if (!bar) return;

    if (!currentUser || !progressLoaded) {
      bar.style.display = 'none';
      return;
    }

    bar.style.display = 'flex';
    const fill = bar.querySelector('.vtn-path-progress-fill');
    const label = bar.querySelector('.vtn-path-progress-label');
    if (fill) fill.style.width = pct + '%';
    if (label) label.textContent = completed + '/' + total + ' complete';

    // Mark completed step links
    const links = card.querySelectorAll('.vtn-path-steps a');
    links.forEach(link => {
      const href = link.getAttribute('href');
      if (!href) return;
      let fullPath = href.startsWith('/') ? href : '/' + href;
      if (!fullPath.endsWith('/')) fullPath += '/';
      link.classList.toggle('vtn-step-done', isComplete(fullPath));
    });
  });
}

function renderSidebarCheckmarks() {
  if (!currentUser || !progressLoaded) return;
  document.querySelectorAll('.md-nav__link').forEach(link => {
    const href = link.getAttribute('href');
    if (!href || href.startsWith('#')) return;
    let fullPath = href;
    if (!fullPath.startsWith('/')) {
      try {
        fullPath = new URL(href, window.location.origin).pathname;
      } catch (e) { return; }
    }
    if (!fullPath.endsWith('/')) fullPath += '/';
    link.toggleAttribute('data-completed', isComplete(fullPath));
  });
}
