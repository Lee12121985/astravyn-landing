// dating/user-context.js
// Populates top-right nav avatar + name from Firebase auth + profiles
import { auth, db } from '../js/firebase-config.js';
import { onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js';
import { collection, query, where, getDocs, doc, getDoc } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const el = id => document.getElementById(id);

// helper: find profile by uid (tries doc id == uid first, then uid field)
async function findProfileForUid(uid) {
  try {
    const snap = await getDoc(doc(db, 'datingProfiles', uid));
    if (snap.exists()) return { id: snap.id, data: snap.data() };
  } catch (e) {
    // ignore
  }

  try {
    const q = query(collection(db, 'datingProfiles'), where('uid', '==', uid));
    const snap = await getDocs(q);
    if (!snap.empty) {
      const d = snap.docs[0];
      return { id: d.id, data: d.data() };
    }
  } catch (e) {
    console.warn('findProfileForUid failed', e);
  }
  return null;
}

function setNavUser(displayName, photoURL, gender) {
  const avatarImgWrap = el('nav-avatar-photo');
  const avatarImg = el('nav-avatar-img');
  const avatarInitial = el('nav-avatar-initial');
  const nameEl = el('nav-avatar-name');

  if (photoURL) {
    avatarImg.src = photoURL;
    avatarImgWrap.style.display = '';
    avatarInitial.style.display = 'none';
  } else {
    avatarImgWrap.style.display = 'none';
    avatarInitial.style.display = '';
    avatarInitial.innerHTML = (displayName || 'U').charAt(0).toUpperCase(); /* use innerHTML for safety or textContent */
    avatarInitial.textContent = (displayName || 'U').charAt(0).toUpperCase();

    // Remove old inline background
    avatarInitial.style.background = '';
    avatarInitial.className = 'nav-avatar-initial'; // reset

    if (gender === 'male') avatarInitial.classList.add('avatar-male');
    else if (gender === 'female') avatarInitial.classList.add('avatar-female');
    else avatarInitial.classList.add('avatar-default');
  }

  nameEl.textContent = displayName || 'You';
}

// subscribe to auth changes
onAuthStateChanged(auth, async user => {
  const initial = el('nav-avatar-initial');
  const nameEl = el('nav-avatar-name');

  if (!user) {
    // Loop protection: check if we just came from login
    const lastRedirect = sessionStorage.getItem('redirect_to_login');
    const now = Date.now();
    if (lastRedirect && (now - parseInt(lastRedirect, 10) < 2000)) {
      console.error('Redirect loop detected! Stopping redirect to login.');
      document.body.innerHTML = '<div style="color:white;text-align:center;padding:50px;"><h2>Session Error</h2><p>Infinite redirect loop detected. Please clear your cache or sign in again.</p><a href="../login/index.html" onclick="sessionStorage.clear()">Go to Login</a></div>';
      return;
    }

    // not signed in: redirect to login
    // We are in /dating/, so login is at ../login/index.html
    sessionStorage.setItem('redirect_to_login', Date.now());
    window.location.href = '../login/index.html';
    return;
  }
  // Clear the flag if we are successfully authenticated
  sessionStorage.removeItem('redirect_to_login');

  // show email/name from auth immediately
  const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'You');
  setNavUser(displayName, null, null);

  // try to find profile doc and use its photoURL / gender / nicer displayName
  try {
    const found = await findProfileForUid(user.uid);
    if (found && found.data) {
      const data = found.data;
      const betterName = data.displayName || displayName;
      const photoURL = data.photoURL || '';
      const gender = (data.gender || '').toLowerCase();
      setNavUser(betterName, photoURL, gender);
    }
  } catch (err) {
    console.warn('user-context: failed to populate profile', err);
  }
});
