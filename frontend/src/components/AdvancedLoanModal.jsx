import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';

const AdvancedLoanModal = ({ isOpen, onClose, onSuccess }) => {
 const [step, setStep] = useState(1); // 1: Tipo materiale, 2: Seleziona materiale, 3: Seleziona utente, 4: Seleziona unità, 5: Tipo utilizzo, 6: Date
 const [catalogType, setCatalogType] = useState('libri');
 const [inventory, setInventory] = useState([]);
 const [users, setUsers] = useState([]);
 const [selectedItem, setSelectedItem] = useState(null);
 const [selectedUser, setSelectedUser] = useState(null);
 const [selectedUnits, setSelectedUnits] = useState([]);
 const [availableUnits, setAvailableUnits] = useState([]);
 const [dateRange, setDateRange] = useState({ 
 dal: new Date().toISOString().split('T')[0], 
 al: '' 
 });
 const [manualUser, setManualUser] = useState({
 name: '',
 surname: '',
 email: '',
 matricola: '',
 phone: '',
 corso_accademico: ''
 });
 const [isManualUser, setIsManualUser] = useState(false);
 const [tipoUtilizzo, setTipoUtilizzo] = useState('');
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 const { token } = useAuth();
 const withCatalogType = (url) => `${url}${url.includes('?') ? '&' : '?'}tipo_catalogo=${encodeURIComponent(catalogType)}`;

 // Fetch data when modal opens
 useEffect(() => {
 if (isOpen) {
 fetchInventory();
 fetchUsers();
 }
 }, [isOpen]);

 // Auto-set end date for internal use when reaching step 5
 useEffect(() => {
if (step === 6 && dateRange.dal && !dateRange.al) {
   if (selectedItem?.tipo_prestito === 'solo_interno' || 
       (selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo === 'interno')) {
     setDateRange(prev => ({ ...prev, al: prev.dal }));
   }
 }
 }, [step, dateRange.dal, selectedItem?.tipo_prestito, tipoUtilizzo]);

const fetchInventory = async () => {
  try {
    const response = await fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario`), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setInventory(data.filter(item => item.stato_effettivo === 'disponibile'));
    }
  } catch (err) {
    console.error('Errore caricamento inventario:', err);
  }
};

const fetchUsers = async () => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/users`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      // Filtra solo gli utenti normali (non admin) per i prestiti
      const regularUsers = data.filter(user => user.ruolo !== 'admin');
      setUsers(regularUsers);
    }
  } catch (err) {
    console.error('Errore caricamento utenti:', err);
  }
};

const fetchAvailableUnits = async (itemId) => {
  try {
    const response = await fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/${itemId}/disponibili`), {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (response.ok) {
      const data = await response.json();
      setAvailableUnits(data);
    } else {
      console.error('Errore nel caricamento unità disponibili:', response.status);
      setAvailableUnits([]);
    }
  } catch (err) {
    console.error('Errore caricamento unità:', err);
    setAvailableUnits([]);
  }
};

 const handleItemSelect = (item) => {
 setSelectedItem(item);
 fetchAvailableUnits(item.id);
 setStep(3);
 };

 const handleUserSelect = (user) => {
 setSelectedUser(user);
 setIsManualUser(false);
 setStep(4);
 };

 const handleManualUser = () => {
 setIsManualUser(true);
 setSelectedUser(null);
 setStep(4);
 };

 const handleUnitToggle = (unit) => {
 setSelectedUnits(prev => 
 prev.find(u => u.id === unit.id)
 ? prev.filter(u => u.id !== unit.id)
 : [...prev, unit]
 );
 };

// handleUnitsSelected removed - navigation now handled by footer buttons

 const handleCreateLoan = async () => {
 if (!selectedItem || (!selectedUser && !isManualUser) || selectedUnits.length === 0 || !dateRange.dal || !dateRange.al) {
 setError('Compila tutti i campi obbligatori');
 return;
 }

 // Validazione per oggetti "entrambi"
 if (selectedItem.tipo_prestito === 'entrambi' && !tipoUtilizzo) {
   setError('Seleziona il tipo di utilizzo');
   return;
 }

 try {
 setLoading(true);
 
 let userId = selectedUser?.id;
 
 // Create manual user if needed
 if (isManualUser) {
 const userResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/auth/register`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify({
 ...manualUser,
 password: 'temp_password_' + Date.now() // Temporary password
 })
 });
 
 if (!userResponse.ok) {
 const errorData = await userResponse.json();
 throw new Error(errorData.error || 'Errore nella creazione utente');
 }
 
 const userData = await userResponse.json();
 userId = userData.user.id;
 }

// Create loan
const loanResponse = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/prestiti`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
body: JSON.stringify({
  inventario_id: selectedItem.id,
  chi: selectedUser ? `${selectedUser.name} ${selectedUser.surname}` : `${manualUser.name} ${manualUser.surname}`,
  data_uscita: dateRange.dal,
  data_rientro: dateRange.al,
  unita_ids: selectedUnits.map(u => u.id),
  tipo_utilizzo: selectedItem.tipo_prestito === 'entrambi' ? tipoUtilizzo : null,
  tipo_catalogo: catalogType,
  note: `Prestito diretto - ${selectedUnits.length} unità`
})
 });

 if (!loanResponse.ok) {
 const errorData = await loanResponse.json();
 throw new Error(errorData.error || 'Errore nella creazione prestito');
 }

 onSuccess();
 handleClose();
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 };

 const handleClose = () => {
 setStep(1);
 setSelectedItem(null);
 setSelectedUser(null);
 setSelectedUnits([]);
 setAvailableUnits([]);
 setDateRange({ 
 dal: new Date().toISOString().split('T')[0], 
 al: '' 
 });
setCatalogType('libri');
 setManualUser({
 name: '',
 surname: '',
 email: '',
 matricola: '',
 phone: '',
 corso_accademico: ''
 });
 setIsManualUser(false);
 setTipoUtilizzo('');
 setError(null);
 onClose();
 };

 const getStepTitle = () => {
 switch (step) {
    case 1: return 'Tipo Materiale';
 case 2: return 'Seleziona Materiale';
 case 3: return 'Seleziona Utente';
 case 4: return 'Seleziona Unità';
 case 5: return 'Tipo Utilizzo';
 case 6: return 'Date Prestito';
 default: return 'Nuovo Prestito';
 }
 };

 if (!isOpen) return null;

 return (
 <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
 <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
 <div className="p-6 border-b ">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-xl font-bold text-gray-900 ">
 + Nuovo Prestito
 </h2>
 <p className="text-sm text-gray-600 mt-1">
 {getStepTitle()} (Passo {step} di 6)
 </p>
 </div>
 <button
 onClick={handleClose}
 className="text-gray-400 hover:text-gray-600 "
 >
 <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>
 
 {/* Progress Bar */}
 <div className="mt-4">
 <div className="flex items-center">
 {[1, 2, 3, 4, 5, 6].map((s) => (
 <React.Fragment key={s}>
 <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
 s <= step 
 ? 'bg-teal-600 text-white' 
 : 'bg-gray-200 text-gray-600 '
 }`}>
 {s}
 </div>
 {s < 6 && (
 <div className={`flex-1 h-1 mx-2 ${
 s < step 
 ? 'bg-teal-600' 
 : 'bg-gray-200 '
 }`} />
 )}
 </React.Fragment>
 ))}
 </div>
 </div>
 </div>

 <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
 {/* Step 1: Select Catalog Type */}
 {step === 1 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-gray-800 ">
                Seleziona il tipo di materiale
 </h3>
<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
  <button
    onClick={() => {
      setCatalogType('libri');
      setSelectedItem(null);
      setSelectedUnits([]);
      setAvailableUnits([]);
      fetchInventory();
      setStep(2);
    }}
    className="p-4 border border-gray-300 rounded-lg hover:bg-teal-50 text-left transition-colors"
  >
    <p className="font-semibold text-gray-900">Libro</p>
    <p className="text-sm text-gray-600">Sezione libri</p>
  </button>
  <button
    onClick={() => {
      setCatalogType('tesi');
      setSelectedItem(null);
      setSelectedUnits([]);
      setAvailableUnits([]);
      fetchInventory();
      setStep(2);
    }}
    className="p-4 border border-gray-300 rounded-lg hover:bg-teal-50 text-left transition-colors"
  >
    <p className="font-semibold text-gray-900">Tesi</p>
    <p className="text-sm text-gray-600">Tesi di laurea</p>
  </button>
  <button
    onClick={() => {
      setCatalogType('cataloghi');
      setSelectedItem(null);
      setSelectedUnits([]);
      setAvailableUnits([]);
      fetchInventory();
      setStep(2);
    }}
    className="p-4 border border-gray-300 rounded-lg hover:bg-teal-50 text-left transition-colors"
  >
    <p className="font-semibold text-gray-900">Cataloghi/Riviste</p>
    <p className="text-sm text-gray-600">Cataloghi e riviste</p>
  </button>
  <button
    onClick={() => {
      setCatalogType('riviste');
      setSelectedItem(null);
      setSelectedUnits([]);
      setAvailableUnits([]);
      fetchInventory();
      setStep(2);
    }}
    className="p-4 border border-gray-300 rounded-lg hover:bg-teal-50 text-left transition-colors"
  >
    <p className="font-semibold text-gray-900">Rivista</p>
    <p className="text-sm text-gray-600">Sezione riviste</p>
  </button>
 </div>
</div>
 )}

 {/* Step 2: Select Item */}
 {step === 2 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-gray-800 ">
                Seleziona il materiale da prestare
 </h3>
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
 {inventory.map(item => (
 <div
 key={item.id}
 onClick={() => handleItemSelect(item)}
 className="p-4 border border-gray-300 rounded-lg hover:bg-teal-50 cursor-pointer transition-colors"
 >
                <h4 className="font-semibold text-gray-900 ">{item.nome}</h4>
                <p className="text-sm text-gray-600 ">
                  Disponibili: {item.unita_disponibili || 0}/{item.quantita_totale || 1}
                </p>
                {item.scaffale && (
                  <p className="text-sm text-gray-500 ">📍 {item.scaffale}</p>
                )}
                {(item.autore || item.casa_editrice) && (
                  <div className="mt-2 space-y-1">
                    {item.autore && (
                      <p className="text-xs text-gray-600"><span className="font-medium">Autore:</span> {item.autore}</p>
                    )}
                    {item.casa_editrice && (
                      <p className="text-xs text-gray-600"><span className="font-medium">Casa Editrice:</span> {item.casa_editrice}</p>
                    )}
                  </div>
                )}
 </div>
 ))}
 </div>
 </div>
 )}

 {/* Step 3: Select User */}
 {step === 3 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-gray-800 ">
 Seleziona l'utente per: <span className="text-teal-600">{selectedItem?.nome}</span>
 </h3>
 
 <div className="flex space-x-4 mb-6">
 <button
 onClick={() => setIsManualUser(false)}
 className={`px-4 py-2 rounded-lg ${
 !isManualUser 
 ? 'bg-teal-600 text-white' 
 : 'bg-gray-200 text-gray-700 '
 }`}
 >
 Utente Registrato
 </button>
 <button
 onClick={() => setIsManualUser(true)}
 className={`px-4 py-2 rounded-lg ${
 isManualUser 
 ? 'bg-teal-600 text-white' 
 : 'bg-gray-200 text-gray-700 '
 }`}
 >
 Nuovo Utente
 </button>
 </div>

 {!isManualUser ? (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-96 overflow-y-auto">
 {users.map(user => (
 <div
 key={user.id}
 onClick={() => handleUserSelect(user)}
 className="p-4 border border-gray-300 rounded-lg hover:bg-teal-50 cursor-pointer transition-colors"
 >
 <h4 className="font-semibold text-gray-900 ">
 {user.name} {user.surname}
 </h4>
 <p className="text-sm text-gray-600 ">{user.email}</p>
 <p className="text-sm text-gray-500 ">
 {user.corso_accademico} • {user.matricola}
 </p>
 </div>
 ))}
 </div>
 ) : (
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <input
 type="text"
 placeholder="Nome *"
 value={manualUser.name}
 onChange={(e) => setManualUser(prev => ({ ...prev, name: e.target.value }))}
 className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 "
 />
 <input
 type="text"
 placeholder="Cognome *"
 value={manualUser.surname}
 onChange={(e) => setManualUser(prev => ({ ...prev, surname: e.target.value }))}
 className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 "
 />
 <input
 type="email"
 placeholder="Email (nome.cognome@labafirenze.com) *"
 value={manualUser.email}
 onChange={(e) => setManualUser(prev => ({ ...prev, email: e.target.value }))}
 className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 "
 />
 <input
 type="text"
 placeholder="Matricola *"
 value={manualUser.matricola}
 onChange={(e) => setManualUser(prev => ({ ...prev, matricola: e.target.value }))}
 className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 "
 />
 <input
 type="tel"
 placeholder="Telefono"
 value={manualUser.phone}
 onChange={(e) => setManualUser(prev => ({ ...prev, phone: e.target.value }))}
 className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 "
 />
 <select
 value={manualUser.corso_accademico}
 onChange={(e) => setManualUser(prev => ({ ...prev, corso_accademico: e.target.value }))}
 className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 "
 >
 <option value="">Seleziona corso *</option>
 <option value="Graphic Design & Multimedia">Graphic Design & Multimedia</option>
 <option value="Regia e Videomaking">Regia e Videomaking</option>
 <option value="Fashion Design">Fashion Design</option>
 <option value="Pittura">Pittura</option>
 <option value="Design">Design</option>
 <option value="Fotografia">Fotografia</option>
 <option value="Interior Design">Interior Design</option>
 <option value="Cinema e Audiovisivi">Cinema e Audiovisivi</option>
 </select>
 </div>
 )}
 </div>
 )}

 {/* Step 4: Select Units */}
 {step === 4 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-gray-800 ">
 Seleziona le unità di: <span className="text-teal-600">{selectedItem?.nome}</span>
 </h3>
 <p className="text-sm text-gray-600 ">
 Utente: <span className="font-medium">
 {selectedUser ? `${selectedUser.name} ${selectedUser.surname}` : `${manualUser.name} ${manualUser.surname}`}
 </span>
 </p>
 
 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
 {availableUnits.map(unit => (
 <div
 key={unit.id}
 onClick={() => handleUnitToggle(unit)}
 className={`p-4 border rounded-lg cursor-pointer transition-colors ${
 selectedUnits.find(u => u.id === unit.id)
 ? 'border-teal-500 bg-teal-50 '
 : 'border-gray-300 hover:bg-gray-50 '
 }`}
 >
 <div className="flex items-center justify-between">
 <span className="font-medium text-gray-900 ">
 {unit.codice_univoco}
 </span>
 {selectedUnits.find(u => u.id === unit.id) && (
 <svg className="w-5 h-5 text-teal-600" fill="currentColor" viewBox="0 0 20 20">
 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
 </svg>
 )}
 </div>
 {unit.note && (
 <p className="text-sm text-gray-500 mt-1">{unit.note}</p>
 )}
 </div>
 ))}
 </div>
 
 <p className="text-sm text-gray-600 ">
 Selezionate: {selectedUnits.length} unità
 </p>

    {/* Actions removed - using footer buttons */}
 </div>
 )}

 {/* Step 5: Tipo Utilizzo (solo per oggetti "entrambi") */}
 {step === 5 && selectedItem && selectedItem.tipo_prestito === 'entrambi' && (
   <div className="space-y-4">
     <div className="flex items-center justify-between mb-4">
       <div>
         <h3 className="text-lg font-medium text-gray-900">Scegli il tipo di utilizzo</h3>
         <p className="text-sm text-gray-600">
           Materiale: <strong>{selectedItem.nome}</strong> - Unità: <strong>{selectedUnits.map(u => u.codice_univoco).join(', ')}</strong>
         </p>
       </div>
       <button
         type="button"
        onClick={() => setStep(4)}
         className="text-teal-600 hover:text-teal-800 text-sm"
       >
         ← Cambia Unità
       </button>
     </div>

     <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
       <div className="flex items-center mb-3">
         <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
           <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
         </svg>
         <div>
           <h4 className="text-sm font-medium text-amber-800">Come intendi utilizzare questo materiale?</h4>
           <p className="text-xs text-amber-700 mt-1">
             Questo materiale può essere utilizzato sia internamente che esternamente. Scegli come intendi utilizzarlo.
           </p>
         </div>
       </div>
       
       <div className="space-y-3">
         <label className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
           <input
             type="radio"
             name="tipo_utilizzo_admin"
             value="interno"
             checked={tipoUtilizzo === 'interno'}
             onChange={(e) => setTipoUtilizzo(e.target.value)}
             className="w-5 h-5 text-amber-600 border-amber-300 focus:ring-amber-500"
           />
           <div className="flex-1">
             <div className="flex items-center space-x-2">
               <span className="text-lg">🏠</span>
               <span className="text-sm font-medium text-amber-900">Uso Interno</span>
             </div>
             <p className="text-xs text-amber-700 mt-1">
               Utilizzo all'interno dell'accademia (stesso giorno di inizio e fine)
             </p>
           </div>
         </label>
         
         <label className="flex items-center space-x-3 p-4 bg-white rounded-lg border border-amber-200 cursor-pointer hover:bg-amber-50 transition-colors">
           <input
             type="radio"
             name="tipo_utilizzo_admin"
             value="esterno"
             checked={tipoUtilizzo === 'esterno'}
             onChange={(e) => setTipoUtilizzo(e.target.value)}
             className="w-5 h-5 text-amber-600 border-amber-300 focus:ring-amber-500"
           />
           <div className="flex-1">
             <div className="flex items-center space-x-2">
               <span className="text-lg">📅</span>
               <span className="text-sm font-medium text-amber-900">Prestito Esterno</span>
             </div>
             <p className="text-xs text-amber-700 mt-1">
               Prestito per più giorni, può essere portato fuori dall'accademia
             </p>
           </div>
         </label>
       </div>
     </div>

    {/* Actions removed - using footer buttons */}
   </div>
 )}

 {/* Step 6: Date Range */}
 {step === 6 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-gray-800 ">
 Date del prestito
 </h3>
 
 <div className="bg-gray-50 rounded-lg p-4 mb-6">
 <h4 className="font-medium text-gray-900 mb-2">Riepilogo:</h4>
 <p><strong>Oggetto:</strong> {selectedItem?.nome}</p>
 <p><strong>Utente:</strong> {selectedUser ? `${selectedUser.name} ${selectedUser.surname}` : `${manualUser.name} ${manualUser.surname}`}</p>
 <p><strong>Unità:</strong> {selectedUnits.length} ({selectedUnits.map(u => u.codice_univoco).join(', ')})</p>
 {selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo && (
   <p><strong>Tipo Utilizzo:</strong> {tipoUtilizzo === 'interno' ? '🏠 Uso Interno' : '📅 Prestito Esterno'}</p>
 )}
 </div>

 {/* Info Tipo Prestito */}
 {selectedItem?.tipo_prestito === 'solo_interno' && (
   <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 mb-4">
     <div className="flex items-center">
       <svg className="w-5 h-5 text-orange-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
         <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
       </svg>
       <div>
         <h4 className="text-sm font-medium text-orange-800">Solo per uso interno</h4>
         <p className="text-xs text-orange-700 mt-1">
           Solo per uso interno<br />Da restituire a fine utilizzo
         </p>
       </div>
     </div>
   </div>
 )}

 {/* Info Tipo Utilizzo per oggetti "entrambi" */}
 {selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo && (
   <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
     <div className="flex items-center">
       <svg className="w-5 h-5 text-amber-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
         <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
       </svg>
       <div>
         <h4 className="text-sm font-medium text-amber-800">
           Tipo di utilizzo selezionato: {tipoUtilizzo === 'interno' ? '🏠 Uso Interno' : '📅 Prestito Esterno'}
         </h4>
         <p className="text-xs text-amber-700 mt-1">
           {tipoUtilizzo === 'interno' 
             ? 'Utilizzo all\'interno dell\'accademia (stesso giorno di inizio e fine)'
             : 'Prestito per più giorni, può essere portato fuori dall\'accademia'
           }
         </p>
       </div>
     </div>
   </div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Data Inizio *
 </label>
 <input
 type="date"
 value={dateRange.dal}
 onChange={(e) => {
 const newDal = e.target.value;
 const today = new Date().toISOString().split('T')[0];
 if (newDal < today) {
 setError('La data di inizio non può essere nel passato');
 return;
 }
 setError(null);
 setDateRange(prev => ({ 
   ...prev, 
   dal: newDal,
   // Se è uso interno, imposta automaticamente la data di fine
   al: (selectedItem?.tipo_prestito === 'solo_interno' || 
        (selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo === 'interno')) 
       ? newDal : prev.al
 }));
 }}
 min={new Date().toISOString().split('T')[0]}
 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-gray-400 "
 />
 </div>
 <div>
 <label className="block text-sm font-medium text-gray-700 mb-2">
 Data Fine *
 {(selectedItem?.tipo_prestito === 'solo_interno' || 
   (selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo === 'interno')) && (
   <span className="text-xs text-orange-600 ml-2">(Automatica per uso interno)</span>
 )}
 </label>
 <input
 type="date"
 value={(selectedItem?.tipo_prestito === 'solo_interno' || 
        (selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo === 'interno')) 
       ? dateRange.dal : dateRange.al}
 onChange={(e) => {
   const newAl = e.target.value;
   if (newAl < dateRange.dal) {
     setError('La data di fine non può essere prima della data di inizio');
     return;
   }
   setError(null);
   setDateRange(prev => ({ ...prev, al: newAl }));
 }}
 required
 disabled={selectedItem?.tipo_prestito === 'solo_interno' || 
          (selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo === 'interno')}
 min={dateRange.dal || new Date().toISOString().split('T')[0]}
 className={`w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 ${
   (selectedItem?.tipo_prestito === 'solo_interno' || 
    (selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo === 'interno')) 
   ? 'bg-gray-100 cursor-not-allowed' : ''
 }`}
 />
 </div>
 </div>
 </div>
 )}

 {error && (
 <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-4">
 <p className="text-red-800 text-sm">{error}</p>
 </div>
 )}
 </div>

 <div className="flex justify-between items-center p-6 border-t ">
      <button
        onClick={() => {
          if (step === 6 && selectedItem?.tipo_prestito === 'entrambi') {
            setStep(5); // Torna al tipo utilizzo
          } else if (step === 5 && selectedItem?.tipo_prestito === 'entrambi') {
            setStep(4); // Torna alla selezione unità
          } else if (step > 1) {
            setStep(step - 1);
          } else {
            handleClose();
          }
        }}
        className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 "
      >
        {step > 1 ? 'Indietro' : 'Annulla'}
      </button>
 
    <div className="flex space-x-3">
      {step < 6 ? (
        <button
          onClick={() => {
            if (step === 2 && !selectedItem) return;
            if (step === 3 && !selectedUser && !isManualUser) return;
            if (step === 3 && isManualUser && (!manualUser.name || !manualUser.surname || !manualUser.email || !manualUser.matricola || !manualUser.corso_accademico)) return;
            if (step === 4 && selectedUnits.length === 0) return;
            if (step === 5 && selectedItem?.tipo_prestito === 'entrambi' && !tipoUtilizzo) return;
            
            // Smart navigation: Step 4 -> Step 5 (for "entrambi") or Step 6 (for others)
            if (step === 4) {
              if (selectedItem?.tipo_prestito === 'entrambi') {
                setStep(5);
              } else {
                setStep(6);
              }
            } else {
              setStep(step + 1);
            }
          }}
          disabled={
            (step === 2 && !selectedItem) ||
            (step === 3 && !selectedUser && !isManualUser) ||
            (step === 3 && isManualUser && (!manualUser.name || !manualUser.surname || !manualUser.email || !manualUser.matricola || !manualUser.corso_accademico)) ||
            (step === 4 && selectedUnits.length === 0) ||
            (step === 5 && selectedItem?.tipo_prestito === 'entrambi' && !tipoUtilizzo)
          }
          className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Avanti
        </button>
 ) : (
 <button
 onClick={handleCreateLoan}
 disabled={loading || !dateRange.dal || (!dateRange.al && !(selectedItem?.tipo_prestito === 'solo_interno' || (selectedItem?.tipo_prestito === 'entrambi' && tipoUtilizzo === 'interno')))}
 className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed"
 >
 {loading ? 'Creazione...' : 'Crea Prestito'}
 </button>
 )}
 </div>
 </div>
 </div>
 </div>
 );
};

export default AdvancedLoanModal;
