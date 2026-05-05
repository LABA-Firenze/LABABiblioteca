import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

const UserManagement = () => {
 const [users, setUsers] = useState([]);
 const [loading, setLoading] = useState(true);
 const [creatingUser, setCreatingUser] = useState(false);
 const [error, setError] = useState(null);
 const [successMessage, setSuccessMessage] = useState(null);
 const [showAddModal, setShowAddModal] = useState(false);
 const [showEditModal, setShowEditModal] = useState(false);
 const [editingUser, setEditingUser] = useState(null);
const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
const [resetUser, setResetUser] = useState(null);
const [activeTab, setActiveTab] = useState('users');
const [showPenaltyModal, setShowPenaltyModal] = useState(false);
const [selectedUserForPenalty, setSelectedUserForPenalty] = useState(null);
const [userPenalties, setUserPenalties] = useState([]);
const [manualPenaltyStrikes, setManualPenaltyStrikes] = useState(1);
const [manualPenaltyMotivo, setManualPenaltyMotivo] = useState('');
const { token, user: currentUser } = useAuth();

const normalizeRole = (value) => (value || '').toString().trim().toLowerCase();

// Function to abbreviate course names
const abbreviateCourse = (courseName) => {
  if (!courseName) return '-';
  const courseAbbreviations = {
    'Cinema e Audiovisivi': 'CIN',
    'Fotografia': 'FOT', 
    'Graphic Design & Multimedia': 'GD',
    'Fashion Design': 'FD',
    'Pittura': 'PIT',
    'Interior Design': 'INT',
    'Design': 'DES',
    'Regia e Videomaking': 'REG'
  };
  
  return courseAbbreviations[courseName] || courseName;
};

const mapFetchedUser = (user) => {
  if (!user) return user;
  const normalizedRole = normalizeRole(user.ruolo);
  const email = (user.email || '').toLowerCase();
  const isSystemAdmin = user.id === -1 || email === 'admin';

  if (isSystemAdmin) {
    return { ...user, ruolo: 'admin' };
  }

  if (normalizedRole === 'admin' || normalizedRole === 'amministratore' || normalizedRole === 'supervisor') {
    return { ...user, ruolo: 'supervisor' };
  }

  if (normalizedRole === 'utente') {
    return { ...user, ruolo: 'user' };
  }

  if (!normalizedRole) {
    return { ...user, ruolo: 'user' };
  }

  return { ...user, ruolo: normalizedRole };
};

const getRoleBadge = (role) => {
  const normalized = normalizeRole(role);
  if (normalized === 'admin') {
    return { text: 'Amministratore', className: 'bg-red-100 text-red-800' };
  }
  if (normalized === 'supervisor') {
    return { text: 'Supervisore', className: 'bg-purple-100 text-purple-800' };
  }
  return { text: 'Utente', className: 'bg-teal-100 text-teal-800' };
};

const currentRole = useMemo(() => normalizeRole(currentUser?.ruolo), [currentUser]);
const isSystemAdmin = useMemo(() => currentUser?.id === -1 || currentRole === 'admin', [currentUser, currentRole]);
const isCurrentSupervisor = useMemo(() => currentRole === 'supervisor', [currentRole]);

const canDeleteUser = useMemo(() => {
  return (targetUser) => {
    if (!targetUser || targetUser.id === -1) return false;
    const targetRole = normalizeRole(targetUser?.ruolo);
    if (!currentUser) return false;
    if (isSystemAdmin) {
      return true;
    }
    if (isCurrentSupervisor) {
      return targetRole !== 'admin';
    }
    return false;
  };
}, [currentUser, isSystemAdmin, isCurrentSupervisor]);

const canManagePenalties = useMemo(() => {
  return (targetUser) => {
    if (!targetUser || targetUser.id === -1) return false;
    const targetRole = normalizeRole(targetUser?.ruolo);
    return targetRole === 'user';
  };
}, []);

 const [formData, setFormData] = useState({
 name: '',
 surname: '',
 email: '',
 matricola: '',
 corso_accademico: '',
 phone: '',
 password: '',
 ruolo: 'user'
 });

 const [resetData, setResetData] = useState({
 newPassword: '',
 confirmPassword: ''
 });

 const corsiAccademici = [
 'Cinema e Audiovisivi',
 'Design', 
 'Fashion Design',
 'Fotografia',
 'Graphic Design & Multimedia',
 'Interior Design',
 'Pittura',
 'Regia e Videomaking'
 ];

 const fetchUsers = useCallback(async () => {
   try {
     setLoading(true);
     const response = await fetch(`${API_BASE_URL}/api/auth/users`, {
       headers: {
         'Authorization': `Bearer ${token}`
       }
     });
     
     if (!response.ok) {
       throw new Error('Errore nel caricamento utenti');
     }
     
    const data = await response.json();
    setUsers(data || []);
   } catch (err) {
     setError(err.message);
   } finally {
     setLoading(false);
   }
 }, [token]);

 useEffect(() => {
 fetchUsers();
 }, [fetchUsers]);

const normalizedUsers = useMemo(() => (users || []).map(mapFetchedUser), [users]);

// Filter users based on active tab
const filteredUsers = useMemo(() => {
  if (activeTab === 'supervisors') {
    return normalizedUsers.filter(user => normalizeRole(user.ruolo) === 'supervisor');
  } else if (activeTab === 'admins') {
    return normalizedUsers.filter(user => normalizeRole(user.ruolo) === 'admin');
  } else {
    return normalizedUsers.filter(user => {
      const role = normalizeRole(user.ruolo);
      return role !== 'supervisor' && role !== 'admin';
    });
  }
}, [normalizedUsers, activeTab]);

const regularUsers = useMemo(() => normalizedUsers.filter(user => normalizeRole(user.ruolo) === 'user'), [normalizedUsers]);
const supervisorUsers = useMemo(() => normalizedUsers.filter(user => normalizeRole(user.ruolo) === 'supervisor'), [normalizedUsers]);
const adminUsers = useMemo(() => normalizedUsers.filter(user => normalizeRole(user.ruolo) === 'admin'), [normalizedUsers]);

 const handleInputChange = (e) => {
 const { name, value } = e.target;
 setFormData(prev => ({
 ...prev,
 [name]: value
 }));
 };

 const handleResetInputChange = (e) => {
 const { name, value } = e.target;
 setResetData(prev => ({
 ...prev,
 [name]: value
 }));
 };

 const handleSubmit = async (e) => {
 e.preventDefault();
 try {
 setError(null);
 setCreatingUser(true);
 
   const response = await fetch(`${API_BASE_URL}/api/users`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify(formData)
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Errore nella creazione utente');
 }

 await fetchUsers();
 setShowAddModal(false);
 setFormData({
 name: '',
 surname: '',
 email: '',
 matricola: '',
 corso_accademico: '',
 phone: '',
 password: '',
 ruolo: 'user'
 });
 } catch (err) {
 setError(err.message);
 } finally {
 setCreatingUser(false);
 }
 };

 const handlePasswordReset = async (e) => {
 e.preventDefault();
 if (resetData.newPassword !== resetData.confirmPassword) {
 setError('Le password non coincidono');
 return;
 }

 try {
 setError(null);
 
   const response = await fetch(`${API_BASE_URL}/api/auth/admin-reset-password`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify({ email: resetUser.email, newPassword: resetData.newPassword })
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Errore nel reset password');
 }

 setShowPasswordResetModal(false);
 setResetUser(null);
 setResetData({ newPassword: '', confirmPassword: '' });
 setError(null);
 setSuccessMessage(`Password resettata per ${resetUser.name} ${resetUser.surname}. L'utente può accedere con la nuova password.`);
 setTimeout(() => setSuccessMessage(null), 8000);
 } catch (err) {
 setError(err.message);
 }
 };

 const openPasswordReset = (user) => {
 setResetUser(user);
 setError(null);
 setSuccessMessage(null);
 setShowPasswordResetModal(true);
 };

 const openEditModal = (user) => {
 setEditingUser(user);
 setFormData({
 name: user.name,
 surname: user.surname,
 email: user.email,
 matricola: user.matricola,
 corso_accademico: user.corso_accademico || '',
phone: user.phone || '',
ruolo: user.ruolo || 'user'
 });
 setShowEditModal(true);
 };

 const handleEditSubmit = async (e) => {
 e.preventDefault();
 try {
 setError(null);
 
   const response = await fetch(`${API_BASE_URL}/api/users/${editingUser.id}`, {
 method: 'PUT',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify(formData)
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Errore nell\'aggiornamento utente');
 }

 await fetchUsers();
 setShowEditModal(false);
 setEditingUser(null);
 } catch (err) {
 setError(err.message);
 }
 };

const handleDeleteUser = async (userId) => {
if (!confirm('Sei sicuro di voler eliminare questo utente?')) {
return;
}

try {
   const response = await fetch(`${API_BASE_URL}/api/users/${userId}`, {
method: 'DELETE',
headers: {
'Authorization': `Bearer ${token}`
}
});

if (!response.ok) {
const errorData = await response.json();
throw new Error(errorData.error || 'Errore nell\'eliminazione utente');
}

await fetchUsers();
} catch (err) {
setError(err.message);
}
};

// Penalty management functions
const openPenaltyModal = async (user) => {
setSelectedUserForPenalty(user);
setShowPenaltyModal(true);
setManualPenaltyStrikes(1);
setManualPenaltyMotivo('');
await fetchUserPenalties(user.id);
};

const fetchUserPenalties = async (userId) => {
try {
   const response = await fetch(`${API_BASE_URL}/api/penalties/user/${userId}`, {
headers: { 'Authorization': `Bearer ${token}` }
});

if (response.ok) {
const data = await response.json();
setUserPenalties(data.penalties || []);
}
} catch (err) {
console.error('Errore nel caricamento penalità:', err);
}
};

const handleUnblockUser = async (userId, resetStrikes = false) => {
try {
   const response = await fetch(`${API_BASE_URL}/api/penalties/unblock-user`, {
method: 'POST',
headers: {
'Authorization': `Bearer ${token}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({ userId, resetStrikes })
});

if (!response.ok) {
const errorData = await response.json();
throw new Error(errorData.error || 'Errore nello sblocco utente');
}

await fetchUsers();
setShowPenaltyModal(false);
} catch (err) {
setError(err.message);
}
};

const handleAssignManualPenalty = async () => {
try {
if (!selectedUserForPenalty) {
setError('Nessun utente selezionato');
return;
}

if (!manualPenaltyStrikes || manualPenaltyStrikes < 1 || manualPenaltyStrikes > 3) {
setError('Il numero di strike deve essere tra 1 e 3');
return;
}

const currentStrikes = selectedUserForPenalty.penalty_strikes || 0;
const newTotal = currentStrikes + manualPenaltyStrikes;

if (newTotal > 3) {
const confirm = window.confirm(
`ATTENZIONE: L'utente ha attualmente ${currentStrikes} strike. Assegnando ${manualPenaltyStrikes} strike, l'utente avrà ${newTotal} strike (supera il limite di 3). Vuoi continuare?`
);
if (!confirm) return;
}

const response = await fetch(`${API_BASE_URL}/api/penalties/assign-manual`, {
method: 'POST',
headers: {
'Authorization': `Bearer ${token}`,
'Content-Type': 'application/json'
},
body: JSON.stringify({
userId: selectedUserForPenalty.id,
strikes: manualPenaltyStrikes,
motivo: manualPenaltyMotivo || undefined
})
});

if (!response.ok) {
const errorData = await response.json();
throw new Error(errorData.error || errorData.details || 'Errore nell\'assegnazione penalità');
}

const data = await response.json();
alert(data.message || 'Penalità assegnata con successo');

// Reset form
setManualPenaltyStrikes(1);
setManualPenaltyMotivo('');

// Refresh user data and penalties
await fetchUsers();
await fetchUserPenalties(selectedUserForPenalty.id);
// Aggiorna anche selectedUserForPenalty per riflettere i nuovi strike
const updatedUser = await fetch(`${API_BASE_URL}/api/auth/users`, {
headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(users => users.find(u => u.id === selectedUserForPenalty.id));
if (updatedUser) {
setSelectedUserForPenalty(updatedUser);
}
} catch (err) {
setError(err.message);
}
};

const handleRemovePenalty = async (penaltyId) => {
try {
if (!selectedUserForPenalty) {
setError('Nessun utente selezionato');
return;
}

if (!window.confirm('Sei sicuro di voler rimuovere questa penalità? Gli strike verranno sottratti dal totale dell\'utente.')) {
return;
}

const response = await fetch(`${API_BASE_URL}/api/penalties/${penaltyId}`, {
method: 'DELETE',
headers: {
'Authorization': `Bearer ${token}`,
'Content-Type': 'application/json'
}
});

if (!response.ok) {
const errorData = await response.json();
throw new Error(errorData.error || errorData.details || 'Errore nella rimozione penalità');
}

const data = await response.json();
alert(data.message || 'Penalità rimossa con successo');

// Refresh data
await fetchUsers();
await fetchUserPenalties(selectedUserForPenalty.id);
// Aggiorna anche selectedUserForPenalty
const updatedUser = await fetch(`${API_BASE_URL}/api/auth/users`, {
headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json()).then(users => users.find(u => u.id === selectedUserForPenalty.id));
if (updatedUser) {
setSelectedUserForPenalty(updatedUser);
}
} catch (err) {
setError(err.message);
}
};

 if (loading) {
 return (
 <div className="flex items-center justify-center h-64">
 <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
 <span className="ml-2 text-gray-600">Caricamento utenti...</span>
 </div>
 );
 }

return (
  <div className="min-h-screen bg-gray-50">
    {/* Header */}
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8 mx-4 sm:mx-6 lg:mx-8">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Gestione Utenti</h1>
          <p className="text-gray-600 text-lg">Gestisci gli utenti del sistema</p>
        </div>
        <div className="flex items-center">
          <button
            onClick={() => setShowAddModal(true)}
            className="group bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:from-teal-600 hover:to-teal-700 hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center"
          >
            <svg className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Nuovo Utente</span>
          </button>
        </div>
      </div>
    </div>

    <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto space-y-6">

 {/* Error Message */}
 {successMessage && (
   <div className="bg-green-50 border border-green-200 text-green-800 px-4 py-3 rounded-lg mb-4">
     {successMessage}
   </div>
 )}
{error && (
   <div className="bg-red-50 /20 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
     {error}
   </div>
 )}

    {/* Tabs */}
    <div className="border-b border-gray-200 mb-8">
      <nav className="flex space-x-8">
        <button
          onClick={() => setActiveTab('users')}
          className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'users'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
            <span>Utenti</span>
            <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full font-medium">
              {regularUsers.length}
            </span>
          </div>
        </button>
        
        <button
          onClick={() => setActiveTab('supervisors')}
          className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'supervisors'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.031 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            <span>Supervisori</span>
            <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full font-medium">
              {supervisorUsers.length}
            </span>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('admins')}
          className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
            activeTab === 'admins'
              ? 'border-teal-500 text-teal-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
          }`}
        >
          <div className="flex items-center space-x-2">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 7v10a4 4 0 004 4h10a4 4 0 004-4V7M16 3v4M8 3v4m-5 4h18" />
            </svg>
            <span>Amministratori</span>
            <span className="bg-teal-100 text-teal-800 text-xs px-2 py-1 rounded-full font-medium">
              {adminUsers.length}
            </span>
          </div>
        </button>
      </nav>
    </div>

    {/* Desktop Table View */}
    <div className="hidden lg:block bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="overflow-x-auto shadow-sm ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 ">
          <thead className="bg-gradient-to-r from-gray-50 to-gray-100 ">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Nome
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Email
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Corso
              </th>
              <th className="px-6 py-4 text-left text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Ruolo
              </th>
              <th className="px-6 py-4 text-center text-xs font-semibold text-gray-700 uppercase tracking-wider">
                Azioni
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200 ">
            {filteredUsers.length === 0 ? (
              <tr>
                <td colSpan="5" className="px-6 py-12 text-center">
                  <div className="flex flex-col items-center">
                    <svg className="w-12 h-12 text-gray-400 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">
                      Nessun {activeTab === 'supervisors' ? 'supervisore' : activeTab === 'admins' ? 'amministratore' : 'utente'} trovato
                    </h3>
                    <p className="text-gray-500">
                      {activeTab === 'supervisors' 
                        ? 'Non ci sono supervisori nel sistema.' 
                        : activeTab === 'admins'
                          ? 'Non ci sono amministratori nel sistema.'
                          : 'Non ci sono utenti registrati.'
                      }
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredUsers.map((user, index) => (
              <tr key={user.id} className={`hover:bg-gray-50 transition-colors duration-150 ${index % 2 === 0 ? 'bg-white ' : 'bg-gray-50 '}`}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <div className="w-8 h-8 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-sm">
                      {user.name.charAt(0)}{user.surname.charAt(0)}
                    </div>
                    <div className="ml-3">
                      <div className="text-sm font-medium text-gray-900 ">
                        {user.name} {user.surname}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 ">
                  {user.email}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  {user.corso_accademico ? (
                    <span 
                      className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200"
                      title={user.corso_accademico}
                    >
                      {abbreviateCourse(user.corso_accademico)}
                    </span>
                  ) : (
                    <span className="text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {normalizeRole(user.ruolo) === 'admin' ? (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                      Amministratore
                    </span>
                  ) : normalizeRole(user.ruolo) === 'supervisor' ? (
                    <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-purple-100 text-purple-800">
                      Supervisore
                    </span>
                  ) : (
                    <span className="text-xs text-gray-500">-</span>
                  )}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-center">
                  <div className="flex flex-col sm:flex-row gap-2 justify-center items-center">
                    <button
                      onClick={() => openEditModal(user)}
                      className="inline-flex items-center px-3 py-2 text-xs font-medium text-teal-700 bg-teal-100 rounded-lg hover:bg-teal-200 hover:shadow-md transition-all duration-200 hover:scale-105"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Modifica
                    </button>
                    <button
                      onClick={() => openPasswordReset(user)}
                      className="inline-flex items-center px-3 py-2 text-xs font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 hover:shadow-md transition-all duration-200 hover:scale-105"
                    >
                      <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                      Reset
                    </button>
                    {canManagePenalties(user) && (
                      <button
                        onClick={() => openPenaltyModal(user)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors duration-200"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        Penalità
                      </button>
                    )}
                    {canDeleteUser(user) && (
                      <button
                        onClick={() => handleDeleteUser(user.id)}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors duration-200"
                      >
                        <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                        Elimina
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            )))}
          </tbody>
        </table>
      </div>
    </div>

    {/* Mobile Card View */}
    <div className="lg:hidden space-y-4">
      {filteredUsers.length === 0 ? (
        <div className="bg-white rounded-lg shadow-lg border border-gray-200 p-8 text-center">
          <svg className="w-12 h-12 text-gray-400 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <h3 className="text-lg font-medium text-gray-900 mb-1">
            Nessun {activeTab === 'supervisors' ? 'supervisore' : activeTab === 'admins' ? 'amministratore' : 'utente'} trovato
          </h3>
          <p className="text-gray-500">
            {activeTab === 'supervisors' 
              ? 'Non ci sono supervisori nel sistema.' 
              : activeTab === 'admins'
                ? 'Non ci sono amministratori nel sistema.'
                : 'Non ci sono utenti registrati.'
            }
          </p>
        </div>
      ) : (
        filteredUsers.map((user) => (
        <div key={user.id} className="bg-white rounded-lg shadow-lg border border-gray-200 p-4">
          {/* User Header */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-gradient-to-r from-teal-500 to-teal-600 rounded-full flex items-center justify-center text-white font-semibold text-lg">
                {user.name.charAt(0)}{user.surname.charAt(0)}
              </div>
              <div className="ml-3">
                <div className="text-lg font-semibold text-gray-900">
                  {user.name} {user.surname}
                </div>
                <div className="text-sm text-gray-500">
                  {user.email}
                </div>
              </div>
            </div>
            {(() => {
              const badge = getRoleBadge(user.ruolo);
              return (
                <span className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${badge.className}`}>
                  {badge.text}
                </span>
              );
            })()}
          </div>

          {/* User Details */}
          <div className="space-y-2 mb-4">
            <div className="flex justify-between">
              <span className="text-sm font-medium text-gray-600">Matricola:</span>
              <span className="text-sm text-gray-900">{user.matricola}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-600">Corso:</span>
              {user.corso_accademico ? (
                <span 
                  className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 border border-gray-200"
                  title={user.corso_accademico}
                >
                  {abbreviateCourse(user.corso_accademico)}
                </span>
              ) : (
                <span className="text-sm text-gray-900">-</span>
              )}
            </div>
            {user.phone && (
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Telefono:</span>
                <span className="text-sm text-gray-900">{user.phone}</span>
              </div>
            )}
            {normalizeRole(user.ruolo) === 'user' && (
              <div className="flex justify-between">
                <span className="text-sm font-medium text-gray-600">Penalità:</span>
                <div className="flex items-center gap-2">
                  {user.penalty_strikes > 0 && (
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      user.is_blocked ? 'bg-red-100 text-red-800' :
                      user.penalty_strikes >= 2 ? 'bg-orange-100 text-orange-800' :
                      'bg-yellow-100 text-yellow-800'
                    }`}>
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                      {user.penalty_strikes} Strike
                    </span>
                  )}
                  {user.is_blocked && (
                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                      <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
                      </svg>
                      BLOCCATO
                    </span>
                  )}
                  {user.penalty_strikes === 0 && !user.is_blocked && (
                    <span className="text-xs text-gray-500">Nessuna penalità</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Actions - 2x2 Grid Layout */}
          <div className="grid grid-cols-2 gap-2">
            {/* Row 1: Modifica + Reset */}
            <button
              onClick={() => openEditModal(user)}
              className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-teal-700 bg-teal-100 rounded-lg hover:bg-teal-200 hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Modifica
            </button>
            <button
              onClick={() => openPasswordReset(user)}
              className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-orange-700 bg-orange-100 rounded-lg hover:bg-orange-200 hover:shadow-md transition-all duration-200 hover:scale-105"
            >
              <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
              Reset
            </button>
            
            {/* Row 2: Penalità + Elimina (depending on ruolo) */}
            {canManagePenalties(user) && (
              <button
                onClick={() => openPenaltyModal(user)}
                className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-purple-700 bg-purple-100 rounded-md hover:bg-purple-200 transition-colors duration-200"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                Penalità
              </button>
            )}
            {canDeleteUser(user) && (
              <button
                onClick={() => handleDeleteUser(user.id)}
                className="inline-flex items-center justify-center px-3 py-2 text-xs font-medium text-red-700 bg-red-100 rounded-md hover:bg-red-200 transition-colors duration-200"
              >
                <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Elimina
              </button>
            )}
            
            {/* For admin users, only show Modifica + Reset in full width when non-admin viewer */}
            {normalizeRole(user.ruolo) === 'admin' && !isSystemAdmin && (
              <div className="col-span-2 text-center">
                <span className="text-xs text-gray-500 italic">
                  Solo l'amministratore di sistema può eliminare questo account
                </span>
              </div>
            )}
          </div>
        </div>
      )))}
    </div>

 {/* Add User Modal */}
 {showAddModal && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
 <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
 <div className="p-6">
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-lg font-semibold text-gray-900 ">Nuovo Utente</h3>
 <button
 onClick={() => setShowAddModal(false)}
 className="text-gray-400 hover:text-gray-600 "
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <form onSubmit={handleSubmit} className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Nome *
 </label>
 <input
 type="text"
 name="name"
 required
 value={formData.name}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Cognome *
 </label>
 <input
 type="text"
 name="surname"
 required
 value={formData.surname}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Email *
 </label>
 <input
 type="email"
 name="email"
 required
 value={formData.email}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Matricola *
 </label>
 <input
 type="text"
 name="matricola"
 required
 value={formData.matricola}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Telefono
 </label>
 <input
 type="tel"
 name="phone"
 value={formData.phone}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Corso Accademico
 </label>
 <select
 name="corso_accademico"
 value={formData.corso_accademico}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 >
 <option value="">Seleziona corso</option>
 {corsiAccademici.map(corso => (
 <option key={corso} value={corso}>{corso}</option>
 ))}
 </select>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Password *
 </label>
 <input
 type="password"
 name="password"
 required
 value={formData.password}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Ruolo *
 </label>
 <select
 name="ruolo"
 value={formData.ruolo}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400"
 >
 <option value="user">Utente</option>
 <option value="supervisor">Supervisore</option>
 </select>
 <p className="text-xs text-gray-500 mt-1">
 ⚠️ I supervisori hanno accesso avanzato al sistema
 </p>
 </div>

 <div className="flex justify-end space-x-3 pt-4">
 <button
 type="button"
 onClick={() => setShowAddModal(false)}
 className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
 >
 Annulla
 </button>
 <button
 type="submit"
 disabled={creatingUser}
 className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200"
 >
 {creatingUser ? 'Creazione...' : 'Crea Utente'}
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 )}

 {/* Edit User Modal */}
 {showEditModal && editingUser && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
 <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
 <div className="p-6">
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-lg font-semibold text-gray-900 ">
 Modifica Utente - {editingUser.name} {editingUser.surname}
 </h3>
 <button
 onClick={() => setShowEditModal(false)}
 className="text-gray-400 hover:text-gray-600 "
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <form onSubmit={handleEditSubmit} className="space-y-4">
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Nome *
 </label>
 <input
 type="text"
 name="name"
 required
 value={formData.name}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Cognome *
 </label>
 <input
 type="text"
 name="surname"
 required
 value={formData.surname}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Email *
 </label>
 <input
 type="email"
 name="email"
 required
 value={formData.email}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Matricola *
 </label>
 <input
 type="text"
 name="matricola"
 required
 value={formData.matricola}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Telefono
 </label>
 <input
 type="tel"
 name="phone"
 value={formData.phone}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Corso Accademico
 </label>
 <select
 name="corso_accademico"
 value={formData.corso_accademico}
 onChange={handleInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 >
 <option value="">Seleziona corso</option>
 {corsiAccademici.map(corso => (
 <option key={corso} value={corso}>{corso}</option>
 ))}
 </select>
 </div>

  <div>
  <label className="block text-sm font-medium text-gray-700 mb-2">
  Ruolo *
  </label>
  <select
  name="ruolo"
  value={formData.ruolo}
  onChange={handleInputChange}
  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
  disabled={normalizeRole(editingUser?.ruolo) === 'admin'}
  >
  <option value="user">Utente</option>
  <option value="supervisor">Supervisore</option>
  </select>
  {normalizeRole(editingUser?.ruolo) === 'admin' ? (
  <p className="text-xs text-gray-500 mt-1">
  Il ruolo dell'amministratore di sistema non può essere modificato
  </p>
  ) : (
  <p className="text-xs text-gray-500 mt-1">
  ⚠️ I supervisori hanno accesso avanzato al sistema
  </p>
  )}
  </div>


 <div className="flex justify-end space-x-3 pt-4">
 <button
 type="button"
 onClick={() => setShowEditModal(false)}
 className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
 >
 Annulla
 </button>
 <button
 type="submit"
 className="px-4 py-2 bg-gradient-to-r from-teal-500 to-teal-600 text-white rounded-lg hover:from-teal-600 hover:to-teal-700 transition-all duration-200"
 >
 Salva Modifiche
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
 )}

 {/* Password Reset Modal */}
 {showPasswordResetModal && resetUser && (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
 <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
 <div className="p-6">
 <div className="flex justify-between items-center mb-4">
 <h3 className="text-lg font-semibold text-gray-900 ">
 Reset Password - {resetUser.name} {resetUser.surname}
 </h3>
 <button
 onClick={() => setShowPasswordResetModal(false)}
 className="text-gray-400 hover:text-gray-600 "
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 <form onSubmit={handlePasswordReset} className="space-y-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Nuova Password *
 </label>
 <input
 type="password"
 name="newPassword"
 required
 value={resetData.newPassword}
 onChange={handleResetInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>

 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Conferma Password *
 </label>
 <input
 type="password"
 name="confirmPassword"
 required
 value={resetData.confirmPassword}
 onChange={handleResetInputChange}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 "
 />
 </div>

 <div className="flex justify-end space-x-3 pt-4">
 <button
 type="button"
 onClick={() => setShowPasswordResetModal(false)}
 className="px-4 py-2 text-gray-700 bg-gray-200 rounded-lg hover:bg-gray-300 transition-colors"
 >
 Annulla
 </button>
 <button
 type="submit"
 className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white rounded-lg hover:from-orange-600 hover:to-red-600 transition-all duration-200"
 >
 Reset Password
 </button>
 </div>
 </form>
 </div>
 </div>
 </div>
)}

{/* Penalty Management Modal */}
{showPenaltyModal && selectedUserForPenalty && (
<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
<div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
<div className="flex items-center justify-between p-6 border-b border-gray-200">
<div className="flex items-center">
<div className="flex-shrink-0 w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
<svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
</svg>
</div>
<div className="ml-4">
<h3 className="text-lg font-semibold text-gray-900">Gestione Penalità</h3>
<p className="text-sm text-gray-600">{selectedUserForPenalty.name} {selectedUserForPenalty.surname}</p>
</div>
</div>
<button
onClick={() => setShowPenaltyModal(false)}
className="text-gray-400 hover:text-gray-600 transition-colors"
>
<svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
</svg>
</button>
</div>

<div className="p-6">
{/* User Status */}
<div className="mb-6 p-4 bg-gray-50 rounded-lg">
<div className="flex items-center justify-between mb-2">
<span className="text-sm font-medium text-gray-700">Stato Attuale:</span>
<div className="flex items-center gap-2">
{selectedUserForPenalty.penalty_strikes > 0 && (
<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
selectedUserForPenalty.is_blocked ? 'bg-red-100 text-red-800' :
selectedUserForPenalty.penalty_strikes >= 2 ? 'bg-orange-100 text-orange-800' :
'bg-yellow-100 text-yellow-800'
}`}>
<svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
<path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
</svg>
{selectedUserForPenalty.penalty_strikes} Strike
</span>
)}
{selectedUserForPenalty.is_blocked && (
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
<svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
<path fillRule="evenodd" d="M13.477 14.89A6 6 0 015.11 6.524l8.367 8.368zm1.414-1.414L6.524 5.11a6 6 0 018.367 8.367zM18 10a8 8 0 11-16 0 8 8 0 0116 0z" clipRule="evenodd" />
</svg>
BLOCCATO
</span>
)}
{selectedUserForPenalty.penalty_strikes === 0 && !selectedUserForPenalty.is_blocked && (
<span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
<svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
<path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
</svg>
Nessuna Penalità
</span>
)}
</div>
</div>
{selectedUserForPenalty.is_blocked && (
<p className="text-sm text-gray-600">
<strong>Motivo blocco:</strong> {selectedUserForPenalty.blocked_reason || 'Non specificato'}
</p>
)}
</div>

{/* Penalties History */}
<div className="mb-6">
<h4 className="text-md font-semibold text-gray-900 mb-3">Storico Penalità</h4>
{userPenalties.length === 0 ? (
<div className="text-center py-8">
<svg className="w-12 h-12 text-gray-400 mb-4 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
</svg>
<p className="text-gray-500">Nessuna penalità registrata</p>
</div>
) : (
<div className="space-y-3 max-h-64 overflow-y-auto">
{userPenalties.map((penalty) => (
<div key={penalty.id} className="bg-white border border-gray-200 rounded-lg p-4">
<div className="flex items-start justify-between mb-2">
<div className="flex-1">
<p className="font-medium text-gray-900">
{penalty.articolo_nome || (penalty.tipo === 'manuale' ? 'Penalità Manuale' : 'Penalità')}
</p>
<p className="text-sm text-gray-600">{penalty.motivo || 'Nessun motivo specificato'}</p>
</div>
<div className="flex items-center gap-2">
<span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
penalty.strike_assegnati >= 2 ? 'bg-red-100 text-red-800' :
penalty.strike_assegnati === 1 ? 'bg-orange-100 text-orange-800' :
'bg-yellow-100 text-yellow-800'
}`}>
{penalty.strike_assegnati} Strike
</span>
<button
onClick={() => handleRemovePenalty(penalty.id)}
className="p-1 text-red-600 hover:text-red-800 hover:bg-red-50 rounded transition-colors"
title="Rimuovi penalità"
>
<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
</svg>
</button>
</div>
</div>
<div className="text-xs text-gray-500 flex items-center justify-between">
<span>
{penalty.tipo === 'manuale' ? 'Penalità Manuale' : `Ritardo: ${penalty.giorni_ritardo} giorni`}
</span>
<span>{new Date(penalty.created_at).toLocaleDateString('it-IT')}</span>
</div>
{penalty.created_by_name && (
<div className="text-xs text-gray-500 mt-1">
Assegnata da: {penalty.created_by_name} {penalty.created_by_surname}
</div>
)}
</div>
))}
</div>
)}
</div>

{/* Assign Manual Penalty */}
{!selectedUserForPenalty.is_blocked && (
<div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
<h4 className="text-md font-semibold text-blue-900 mb-3">Assegna Penalità Manuale</h4>
<div className="space-y-3">
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Numero di Strike (1-3)
</label>
<select
value={manualPenaltyStrikes}
onChange={(e) => setManualPenaltyStrikes(parseInt(e.target.value))}
className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
>
<option value={1}>1 Strike</option>
<option value={2}>2 Strike</option>
<option value={3}>3 Strike</option>
</select>
<p className="text-xs text-gray-500 mt-1">
Strike attuali: {selectedUserForPenalty.penalty_strikes || 0} / 3
{selectedUserForPenalty.penalty_strikes + manualPenaltyStrikes > 3 && (
<span className="text-red-600 font-semibold ml-2">
⚠️ Supererà il limite di 3 strike!
</span>
)}
</p>
</div>
<div>
<label className="block text-sm font-medium text-gray-700 mb-1">
Motivo (opzionale)
</label>
<textarea
value={manualPenaltyMotivo}
onChange={(e) => setManualPenaltyMotivo(e.target.value)}
placeholder="Inserisci il motivo della penalità..."
rows={3}
className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
/>
</div>
<button
onClick={handleAssignManualPenalty}
className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
>
Assegna Penalità
</button>
</div>
</div>
)}

{/* Actions */}
{selectedUserForPenalty.is_blocked && (
<div className="bg-red-50 border border-red-200 rounded-lg p-4">
<h4 className="text-md font-semibold text-red-900 mb-3">Azioni di Sblocco</h4>
<div className="space-y-2">
<button
onClick={() => handleUnblockUser(selectedUserForPenalty.id, false)}
className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
>
Sblocca Utente (Mantieni Strike)
</button>
<button
onClick={() => handleUnblockUser(selectedUserForPenalty.id, true)}
className="w-full px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
>
Sblocca Utente e Azzera Strike
</button>
</div>
<p className="text-xs text-red-700 mt-2">
⚠️ Dopo lo sblocco, l'utente potrà nuovamente effettuare richieste di prestito.
</p>
</div>
)}
</div>

<div className="flex justify-end p-6 border-t border-gray-200 bg-gray-50 rounded-b-lg">
<button
onClick={() => setShowPenaltyModal(false)}
className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors font-medium"
>
Chiudi
</button>
</div>
</div>
</div>
)}
    </div>
  </div>
);
};

export default UserManagement;



