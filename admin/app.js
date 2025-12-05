import { db } from '../js/firebase-config.js';
import { requireAdmin } from '../js/auth.js';
import {
    collection, getDocs, doc, updateDoc, deleteDoc, query, orderBy
} from 'https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js';

const content = document.getElementById('content');

async function init() {
    try {
        await requireAdmin();
        loadUsers();
    } catch (error) {
        console.error(error);
        // requireAdmin handles redirect
    }
}

async function loadUsers() {
    content.innerHTML = '<div class="loading">Loading users...</div>';

    try {
        const q = query(collection(db, "users"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);

        if (snapshot.empty) {
            content.innerHTML = '<p>No users found.</p>';
            return;
        }

        let html = `
            <table>
                <thead>
                    <tr>
                        <th>Email</th>
                        <th>Role</th>
                        <th>Status</th>
                        <th>Joined</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        snapshot.forEach(docSnap => {
            const user = docSnap.data();
            const created = user.createdAt ? new Date(user.createdAt.seconds * 1000).toLocaleDateString() : 'N/A';

            html += `
                <tr>
                    <td>
                        <div style="font-weight:600">${user.displayName || 'No Name'}</div>
                        <div style="font-size:12px; color:#6b7280">${user.email}</div>
                    </td>
                    <td>
                        <span class="badge ${user.role === 'admin' ? 'badge-admin' : 'badge-user'}">${user.role}</span>
                    </td>
                    <td>
                        <span class="badge ${user.isBlocked ? 'badge-blocked' : 'badge-active'}">
                            ${user.isBlocked ? 'Blocked' : 'Active'}
                        </span>
                    </td>
                    <td>${created}</td>
                    <td>
                        <button onclick="window.toggleBlock('${user.uid}', ${user.isBlocked})">
                            ${user.isBlocked ? 'Unblock' : 'Block'}
                        </button>
                        <button onclick="window.toggleRole('${user.uid}', '${user.role}')">
                            ${user.role === 'admin' ? 'Demote' : 'Make Admin'}
                        </button>
                        <button class="btn-danger" onclick="window.deleteUser('${user.uid}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        content.innerHTML = html;

    } catch (error) {
        console.error("Error loading users:", error);
        content.innerHTML = `<p style="color:red">Error loading users: ${error.message}</p>`;
    }
}

// Expose functions to window for onclick handlers
window.toggleBlock = async (uid, currentStatus) => {
    if (!confirm(`Are you sure you want to ${currentStatus ? 'unblock' : 'block'} this user?`)) return;
    try {
        await updateDoc(doc(db, "users", uid), { isBlocked: !currentStatus });
        loadUsers();
    } catch (e) { alert(e.message); }
};

window.toggleRole = async (uid, currentRole) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    if (!confirm(`Change role to ${newRole}?`)) return;
    try {
        await updateDoc(doc(db, "users", uid), { role: newRole });
        loadUsers();
    } catch (e) { alert(e.message); }
};

window.deleteUser = async (uid) => {
    if (!confirm('Are you sure? This will delete the user data from Firestore. The Auth account will remain but they will be effectively blocked.')) return;
    try {
        await deleteDoc(doc(db, "users", uid));
        // Also try to delete profile
        try { await deleteDoc(doc(db, "profiles", uid)); } catch (e) { }
        loadUsers();
    } catch (e) { alert(e.message); }
};

init();
