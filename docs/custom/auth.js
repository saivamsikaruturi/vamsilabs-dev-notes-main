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

  // Check if Firebase SDK is already loaded (e.g. from instant navigation)
  if (typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0) {
    app = firebase.apps[0];
    auth = firebase.auth();
    db = firebase.firestore();
    analytics = firebase.analytics();
    setupAuthListener();
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    // Load Firebase SDK from CDN
    const scripts = [
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore-compat.js',
      'https://www.gstatic.com/firebasejs/10.12.0/firebase-analytics-compat.js'
    ];

    // Don't re-add scripts if already present
    const existingScripts = Array.from(document.querySelectorAll('script[src]')).map(s => s.src);
    const toLoad = scripts.filter(src => !existingScripts.includes(src));

    if (toLoad.length === 0 && typeof firebase !== 'undefined') {
      app = firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      db = firebase.firestore();
      analytics = firebase.analytics();
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
      setupAuthListener();
      resolve();
      return;
    }

    let loaded = 0;
    const total = toLoad.length || 1;
    toLoad.forEach(src => {
      const script = document.createElement('script');
      script.src = src;
      script.onload = () => {
        loaded++;
        if (loaded === total) {
          app = firebase.initializeApp(firebaseConfig);
          auth = firebase.auth();
          db = firebase.firestore();
          analytics = firebase.analytics();
          auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
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

// Admin emails
var ADMIN_EMAILS = ['krishnavamsikaruturi8@gmail.com'];

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

  // Show/hide admin link
  const adminLink = document.getElementById('admin-link');
  if (adminLink) {
    adminLink.style.display = (user && ADMIN_EMAILS.includes(user.email)) ? 'block' : 'none';
  }

  if (user) {
    const avatar = document.getElementById('user-avatar');
    const name = document.getElementById('user-name');
    const email = document.getElementById('user-email-display');

    if (avatar) avatar.src = user.photoURL || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.displayName || user.email)}&background=B45309&color=fff`;
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
const LOCAL_STORAGE_KEY = 'vtn-progress';

function pageSlug(path) {
  return path.replace(/^\/|\/$/g, '').replace(/\//g, '__');
}

function currentPagePath() {
  let path = window.location.pathname;
  if (!path.endsWith('/')) path += '/';
  return path;
}

// Load from localStorage (works without sign-in)
function loadLocalProgress() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (stored) {
      const entries = JSON.parse(stored);
      entries.forEach(e => progressCache.set(e.page, e));
    }
  } catch (e) {}
  progressLoaded = true;
  renderProgressUI();
}

// Save to localStorage
function saveLocalProgress() {
  try {
    const entries = Array.from(progressCache.values());
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {}
}

async function loadProgress() {
  // Always load local first
  loadLocalProgress();

  // If signed in, also sync from Firebase
  if (!currentUser || !db) return;
  try {
    const snap = await db.collection('users').doc(currentUser.uid)
      .collection('progress').get();
    snap.forEach(doc => {
      progressCache.set(doc.data().page, doc.data());
    });
    // Merge back to local storage
    saveLocalProgress();
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
  saveLocalProgress();
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
  saveLocalProgress();
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
  renderProgressDashboard();
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

// ==========================================================================
// PROGRESS DASHBOARD
// ==========================================================================

const TOPIC_SECTIONS = {
  "Java Foundations": [
    "/java/ecosystem/", "/java/JavaBasics/", "/java/AccessModifiers/", "/java/Constructors/",
    "/java/thisandSuper/", "/java/Strings/", "/java/WrapperClasses/", "/java/Enums/",
    "/java/Generics/", "/java/Annotations/", "/java/Reflection/", "/java/DynamicProxy/", "/java/Regex/"
  ],
  "Java OOP & Core": [
    "/java/oops/", "/java/Interfaces/", "/java/InnerClasses/", "/java/EqualsHashCode/",
    "/java/ImmutableClasses/", "/java/DesignPrinciples/", "/java/ExceptionHandling/",
    "/java/Serialization/", "/java/Cloning/", "/java/FileHandling/", "/java/NIO/",
    "/java/Networking/", "/java/JDBC/"
  ],
  "JVM & Memory": [
    "/java/Jvm/", "/java/ClassLoaders/", "/java/GarbageCollection/",
    "/java/JVMTuning/", "/java/MemoryLeaks/"
  ],
  "Java Concurrency": [
    "/java/MultiThreading/", "/java/Executors/", "/java/JavaMemoryModel/",
    "/java/Locks/", "/java/VolatileAtomics/", "/java/CompletableFuture/",
    "/java/ConcurrentCollections/", "/java/ConcurrencyPatterns/", "/java/deadlocks/",
    "/java/ReactiveStreams/"
  ],
  "Collections & FP": [
    "/java/Collections/", "/java/ComparableComparator/", "/java/DiffCollections/",
    "/java/FunctionalProgramming/", "/stream-api/streamapi/"
  ],
  "Java Versions": [
    "/java/Java8/", "/java/DateTime/", "/java/java11/", "/java/Java17/", "/java/ModernJava/"
  ],
  "Spring Boot": [
    "/springboot/introduction/", "/springboot/AutoConfiguration/", "/springboot/Annotations/",
    "/springboot/SpringIOC/", "/springboot/TypesOfDi/", "/springboot/bean-lifecycle/",
    "/springboot/aop/", "/springboot/design-patterns/", "/springboot/spring-data-jpa/",
    "/springboot/transactions/", "/springboot/validation/", "/springboot/restapibestpractices/",
    "/springboot/exceptionhandling/", "/springboot/profiles/", "/springboot/caching/",
    "/springboot/events/", "/springboot/webflux/", "/springboot/async/",
    "/springboot/security/", "/springboot/database-migrations/", "/springboot/actuator/",
    "/springboot/testing/", "/springboot/SpringBoot3/"
  ],
  "Microservices": [
    "/microservices/microservices/", "/microservices/design-principles/",
    "/microservices/InterServiceCommunication/", "/microservices/grpc/",
    "/microservices/AsyncCommunicationUsingKafka/", "/microservices/event-driven/",
    "/microservices/APIGATEWAY/", "/microservices/api-gateway-patterns/",
    "/microservices/api-versioning/", "/microservices/ServiceDiscovery/",
    "/microservices/CircuitBreaker/", "/microservices/resilience-patterns/",
    "/microservices/SagaDesignPattern/", "/microservices/distributed-transactions/",
    "/microservices/data-management/", "/microservices/config-management/",
    "/microservices/service-mesh/", "/microservices/deployment-strategies/",
    "/microservices/logging-monitoring/", "/microservices/Observability/",
    "/microservices/containerization/", "/microservices/testing-microservices/",
    "/microservices/security-microservices/"
  ],
  "Design Patterns": [
    "/designpatterns/dp/",
    "/designpatterns/creationalDesignPatterns/CreationalDesignPatterns/",
    "/designpatterns/creationalDesignPatterns/singletondesignpattern/",
    "/designpatterns/creationalDesignPatterns/FactoryDesignPattern/",
    "/designpatterns/creationalDesignPatterns/AbstractFactoryDesignPattern/",
    "/designpatterns/creationalDesignPatterns/BuilderDesignPattern/",
    "/designpatterns/creationalDesignPatterns/PrototypeDesignPattern/",
    "/designpatterns/structuralDesignPatterns/flyweightdesignpattern/",
    "/designpatterns/structuralDesignPatterns/facadedesignpattern/",
    "/designpatterns/structuralDesignPatterns/DecoratorDesignPattern/",
    "/designpatterns/structuralDesignPatterns/Proxydesignpattern/",
    "/designpatterns/structuralDesignPatterns/CompositeDesignPattern/",
    "/designpatterns/structuralDesignPatterns/AdapterDesignPattern/",
    "/designpatterns/structuralDesignPatterns/BridgeDesignPattern/",
    "/designpatterns/behaviouralDesignPatterns/ObserverDesignPattern/",
    "/designpatterns/behaviouralDesignPatterns/StrategyDp/",
    "/designpatterns/behaviouralDesignPatterns/CommandDp/",
    "/designpatterns/behaviouralDesignPatterns/Iterator/",
    "/designpatterns/behaviouralDesignPatterns/StateDp/",
    "/designpatterns/behaviouralDesignPatterns/TemplateDp/",
    "/designpatterns/behaviouralDesignPatterns/ChainOfResponsibilityDesignPattern/",
    "/designpatterns/behaviouralDesignPatterns/MediatorDp/",
    "/designpatterns/behaviouralDesignPatterns/MementoDp/",
    "/designpatterns/behaviouralDesignPatterns/VisitorDp/",
    "/designpatterns/behaviouralDesignPatterns/Interpreter/"
  ],
  "System Design": [
    "/https/", "/capTheorem/", "/consistenthashing/", "/distributedlocks/",
    "/ratelimiting/", "/loadbalancer/", "/distributedCaching/", "/redis/",
    "/sqlvsnosql/", "/apidesign/apidesign/", "/graphql/graphql/"
  ],
  "Interview Prep": [
    "/interview/java-core/", "/interview/java-strings/", "/interview/java-collections/",
    "/interview/java-multithreading/", "/interview/java8-features/",
    "/interview/spring-boot/", "/interview/hibernate-jpa/", "/interview/microservices/",
    "/interview/sql/", "/interview/system-design/", "/interview/design-patterns/",
    "/interview/rest-api/"
  ],
  "DevOps & Cloud": [
    "/devops/devops/", "/devops/linux/", "/devops/docker/", "/devops/kubernetes/",
    "/devops/ansible/", "/devops/aws/", "/cicd/cicd/"
  ],
  "Data & Security": [
    "/databases/sql/", "/postgresql/postgresql/", "/databases/neo4j/",
    "/kafka-messaging/kafka/", "/security/Oauth/", "/security/JWT/", "/junit/junit/"
  ]
};

function renderProgressDashboard() {
  const dashboard = document.getElementById('progress-dashboard');
  if (!dashboard) return;

  if (!currentUser) {
    dashboard.style.display = 'none';
    return;
  }

  dashboard.style.display = 'block';

  let totalTopics = 0;
  let totalCompleted = 0;
  const sectionData = [];

  for (const [name, pages] of Object.entries(TOPIC_SECTIONS)) {
    const completed = pages.filter(p => isComplete(p)).length;
    totalTopics += pages.length;
    totalCompleted += completed;
    sectionData.push({ name, completed, total: pages.length });
  }

  const pct = totalTopics > 0 ? Math.round((totalCompleted / totalTopics) * 100) : 0;

  // Update ring
  const ringFill = document.getElementById('dashboard-ring-fill');
  if (ringFill) {
    const offset = 264 - (264 * pct / 100);
    ringFill.style.strokeDashoffset = offset;
  }

  const pctEl = document.getElementById('dashboard-pct');
  if (pctEl) pctEl.textContent = pct + '%';

  const summaryEl = document.getElementById('dashboard-summary-text');
  if (summaryEl) {
    summaryEl.textContent = totalCompleted + ' of ' + totalTopics + ' topics completed';
  }

  // Streak / encouragement
  const streakEl = document.getElementById('dashboard-streak');
  if (streakEl) {
    if (totalCompleted === 0) {
      streakEl.textContent = 'Start marking topics complete to track progress!';
    } else if (pct < 25) {
      streakEl.textContent = 'Great start! Keep going.';
    } else if (pct < 50) {
      streakEl.textContent = 'Almost halfway there!';
    } else if (pct < 75) {
      streakEl.textContent = 'Over halfway — strong progress!';
    } else if (pct < 100) {
      streakEl.textContent = 'Almost done — finish strong!';
    } else {
      streakEl.textContent = 'All topics complete! You\'re interview-ready.';
    }
  }

  // Render section bars
  const sectionsEl = document.getElementById('dashboard-sections');
  if (sectionsEl) {
    sectionsEl.innerHTML = sectionData.map(s => {
      const sPct = s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0;
      return `<div class="vtn-section-progress">
        <div class="vtn-section-progress-header">
          <span class="vtn-section-progress-name">${s.name}</span>
          <span class="vtn-section-progress-count">${s.completed}/${s.total}</span>
        </div>
        <div class="vtn-section-progress-bar">
          <div class="vtn-section-progress-bar-fill" data-pct="${sPct}" style="width:${sPct}%"></div>
        </div>
      </div>`;
    }).join('');
  }
}

// Initialize progress and dashboard on page load (works without Firebase)
function initProgressAndDashboard() {
  if (!progressLoaded) {
    loadLocalProgress();
  }
  renderProgressDashboard();
  renderMarkCompleteButton();
}

// Multiple hooks to ensure it runs
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initProgressAndDashboard);
} else {
  initProgressAndDashboard();
}

// For MkDocs Material instant navigation (SPA-like page transitions)
if (typeof document$ !== 'undefined') {
  document$.subscribe(() => {
    setTimeout(initProgressAndDashboard, 50);
  });
} else {
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(initProgressAndDashboard, 100);
    }
  }).observe(document.body, { childList: true, subtree: true });
}
