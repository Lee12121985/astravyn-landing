import { db } from '../js/firebase-config.js';
import { requireAdmin } from '../js/auth.js';
import { collection, getDocs } from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

requireAdmin(); // block non-admin

const tabs = document.querySelectorAll('.sidebar button');
const sections = document.querySelectorAll('.tab');

tabs.forEach(btn => {
	btn.onclick = () => {
		sections.forEach(s => s.classList.remove('active'));
		document.getElementById(btn.dataset.tab).classList.add('active');
	};
});

// KPI COUNTS
async function loadCounts() {
	document.getElementById('totalUsers').innerText = (await getDocs(collection(db, 'users'))).size;
	document.getElementById('totalProfiles').innerText = (await getDocs(collection(db, 'datingProfiles'))).size;
	document.getElementById('totalLikes').innerText = (await getDocs(collection(db, 'likes'))).size;
	document.getElementById('totalConnections').innerText = (await getDocs(collection(db, 'connections'))).size;
}

// PROFILES TABLE
async function loadProfiles() {
	const snap = await getDocs(collection(db, 'datingProfiles'));
	const body = document.getElementById('profilesBody');
	if (!body) return;
	body.innerHTML = '';
	snap.forEach(d => {
		const p = d.data();
		body.innerHTML += `<tr>
<td>${p.displayName || '-'}</td>
<td>${p.gender || '-'}</td>
<td>${p.age || '-'}</td>
<td>${p.location || '-'}</td>
<td>${p.isVisible}</td>
</tr>`;
	});
}

// LIKES TABLE
async function loadLikes() {
	const snap = await getDocs(collection(db, 'likes'));
	const body = document.getElementById('likesBody');
	if (!body) return;
	body.innerHTML = '';
	snap.forEach(d => {
		const l = d.data();
		body.innerHTML += `<tr>
<td>${l.fromUserId}</td>
<td>${l.toUserId}</td>
<td>${l.status}</td>
<td>${l.timestamp?.toDate?.().toLocaleString() || ''}</td>
</tr>`;
	});
}

// CONNECTIONS TABLE
async function loadConnections() {
	const snap = await getDocs(collection(db, 'connections'));
	const body = document.getElementById('connectionsBody');
	if (!body) return;
	body.innerHTML = '';
	snap.forEach(d => {
		const c = d.data();
		body.innerHTML += `<tr>
<td>${c.userA || ''}</td>
<td>${c.userB || ''}</td>
<td>${c.status || ''}</td>
</tr>`;
	});
}

// initialize on load
document.addEventListener('DOMContentLoaded', () => {
	loadCounts();
	loadProfiles();
	loadLikes();
	loadConnections();
});