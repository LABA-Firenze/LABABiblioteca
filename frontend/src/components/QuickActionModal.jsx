import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';

const QuickActionModal = ({ isOpen, onClose, action, onSuccess, catalogType = 'libri' }) => {
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 const [formData, setFormData] = useState({
   nome: '',
   quantita_totale: 1,
   scaffale: '',
   categoria_id: '',
   note: '',
   tipo_prestito: 'solo_esterno'
 });
 const { token } = useAuth();

 const handleSubmit = async (e) => {
 e.preventDefault();
 if (!formData.nome) {
 setError('Il nome è obbligatorio');
 return;
 }

 try {
 setLoading(true);
 setError(null);

 // Generate unit codes
 const units = [];
 for (let i = 1; i <= formData.quantita_totale; i++) {
 const code = `${formData.nome.toUpperCase().replace(/\s+/g, '')}_${String(i).padStart(3, '0')}`;
 units.push({ codice_univoco: code, note: '' });
 }

 const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/inventario?tipo_catalogo=${catalogType}`, {
 method: 'POST',
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify({
 ...formData,
  tipo_catalogo: catalogType,
 unita: units
 })
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Errore nella creazione');
 }

 onSuccess && onSuccess();
 handleClose();
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 };

 const handleClose = () => {
   setFormData({
     nome: '',
     quantita_totale: 1,
     scaffale: '',
     categoria_id: '',
     note: '',
     tipo_prestito: 'solo_esterno'
   });
   setError(null);
   onClose();
 };

 if (!isOpen) return null;

 return (
 <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
 <div className="modal-content max-w-2xl" onClick={(e) => e.stopPropagation()}>
 <div className="modal-header">
 <h2 className="text-xl font-bold text-primary">
 {action === 'add-inventory' && 'Aggiungi Elemento Rapido'}
 {action === 'manage-requests' && 'Gestisci Richieste'}
 {action === 'manage-repairs' && 'Gestisci Segnalazioni'}
 {!['add-inventory', 'manage-requests', 'manage-repairs'].includes(action) && 'Azione Rapida'}
 </h2>
 <button
 onClick={handleClose}
 className="text-muted hover:text-primary"
 >
 <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
 </div>

 {action === 'add-inventory' ? (
 <div className="modal-body">
 <form onSubmit={handleSubmit}>
 {/* Progress Bar */}
 <div className="flex items-center justify-center mb-8">
 {[
 { num: 1, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
 { num: 2, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
 { num: 3, icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a1.994 1.994 0 01-1.414.586H7a4 4 0 01-4-4V7a4 4 0 014-4z" /></svg> }
 ].map((stepData, index) => (
 <React.Fragment key={stepData.num}>
 <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium transition-all ${
 stepData.num <= 1
 ? 'bg-brand-primary text-white shadow-lg'
 : 'bg-tertiary text-muted'
 }`}>
 {stepData.num <= 1 ? stepData.icon : stepData.num}
 </div>
 {index < 2 && (
 <div className={`flex-1 h-1 mx-3 rounded transition-all ${
 stepData.num < 1
 ? 'bg-brand-primary'
 : 'bg-tertiary'
 }`} />
 )}
 </React.Fragment>
 ))}
 </div>

 {/* Step 1: Basic Info */}
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
 <div className="w-8 h-8 bg-brand-primary text-white rounded-full flex items-center justify-center">
 <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
 </svg>
 </div>
 Informazioni Base
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div>
 <label className="block text-sm font-medium text-primary mb-2">
 Nome Elemento *
 </label>
 <input
 type="text"
 value={formData.nome}
 onChange={(e) => setFormData({...formData, nome: e.target.value})}
 className="input-field"
 placeholder="Inserisci nome elemento"
 required
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-primary mb-2">
 Quantità *
 </label>
 <input
 type="number"
 value={formData.quantita_totale}
 onChange={(e) => setFormData({...formData, quantita_totale: parseInt(e.target.value) || 1})}
 className="input-field"
 min="1"
 required
 />
 </div>
 </div>
 
 <div>
 <label className="block text-sm font-medium text-primary mb-2">
 Scaffale
 </label>
 <input
 type="text"
 value={formData.scaffale}
 onChange={(e) => setFormData({...formData, scaffale: e.target.value})}
 className="input-field"
 placeholder="Inserisci scaffale"
 />
 </div>
 
 <div>
 <label className="block text-sm font-medium text-primary mb-2">
   Note
 </label>
 <textarea
   value={formData.note}
   onChange={(e) => setFormData({...formData, note: e.target.value})}
   className="input-field"
   rows="3"
   placeholder="Note aggiuntive"
 />
 </div>

 <div className="md:col-span-2">
   <label className="block text-sm font-medium text-primary mb-2">
     Tipo di Utilizzo
   </label>
   <div className="space-y-2">
     <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
       <input
         type="radio"
         name="tipo_prestito_quick"
         value="solo_esterno"
         checked={formData.tipo_prestito === 'solo_esterno'}
         onChange={(e) => setFormData({...formData, tipo_prestito: e.target.value})}
         className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
       />
       <div>
         <span className="text-sm font-medium text-gray-900">📅 Uso Esterno</span>
         <p className="text-xs text-gray-600">Prestito per più giorni, può essere portato fuori dall'accademia</p>
       </div>
     </label>
     
     <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
       <input
         type="radio"
         name="tipo_prestito_quick"
         value="solo_interno"
         checked={formData.tipo_prestito === 'solo_interno'}
         onChange={(e) => setFormData({...formData, tipo_prestito: e.target.value})}
         className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
       />
       <div>
         <span className="text-sm font-medium text-gray-900">🏠 Uso Interno</span>
         <p className="text-xs text-gray-600">Solo per uso interno<br />Da restituire a fine utilizzo</p>
       </div>
     </label>
     
     <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
       <input
         type="radio"
         name="tipo_prestito_quick"
         value="entrambi"
         checked={formData.tipo_prestito === 'entrambi'}
         onChange={(e) => setFormData({...formData, tipo_prestito: e.target.value})}
         className="w-4 h-4 text-teal-600 border-gray-300 focus:ring-teal-500"
       />
       <div>
         <span className="text-sm font-medium text-gray-900">🔄 Entrambi</span>
         <p className="text-xs text-gray-600">L'utente sceglie se utilizzarlo internamente o esternamente</p>
       </div>
     </label>
   </div>
   <div className="mt-2 p-3 bg-teal-50 rounded-lg border border-teal-200">
     <p className="text-xs text-teal-700">
       {formData.tipo_prestito === 'solo_esterno' && (
         <>📅 <strong>Solo Prestito Esterno:</strong> Gli studenti possono richiedere prestiti per più giorni e portare l'oggetto fuori dall'accademia</>
       )}
       {formData.tipo_prestito === 'solo_interno' && (
         <>🏠 <strong>Solo Uso Interno:</strong> Gli studenti sono autorizzati all'uso interno all'accademia (stesso giorno)</>
       )}
       {formData.tipo_prestito === 'entrambi' && (
         <>🔄 <strong>Entrambi:</strong> Gli studenti possono scegliere se utilizzare l'oggetto internamente (stesso giorno) o esternamente (multi-giorno)</>
       )}
     </p>
   </div>
 </div>
 </div>

 {error && (
 <div className="alert-card alert-danger mt-4">
 <div className="flex items-center">
 <svg className="icon text-red-500 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
 </svg>
 <p className="text-red-800 ">{error}</p>
 </div>
 </div>
 )}

 <div className="flex gap-3 pt-6 border-t border-border-primary">
 <button
 type="button"
 onClick={handleClose}
 className="btn-secondary flex-1"
 >
 Annulla
 </button>
 <button
 type="submit"
 disabled={loading}
 className="btn-primary flex-1"
 >
 {loading ? 'Creazione...' : 'Crea Elemento'}
 </button>
 </div>
 </form>
 </div>
 ) : (
 <div className="modal-body">
 <div className="text-center py-8">
 {action === 'manage-requests' && (
 <div className="space-y-4">
 <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-600 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="icon-lg text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
 </svg>
 </div>
 <h3 className="text-lg font-semibold text-primary mb-2">Gestione Richieste</h3>
 <p className="text-secondary mb-4">Visualizza e gestisci tutte le richieste di prestito in attesa di approvazione.</p>
 
 {/* Lista richieste in attesa */}
 <div className="space-y-2 max-h-60 overflow-y-auto">
 <div className="card p-3 hover:bg-tertiary transition-colors">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium text-primary">Mario Rossi</p>
                <p className="text-sm text-secondary">Storia del Cinema Italiano</p>
 </div>
 <div className="flex gap-2">
 <button className="btn-success btn-small">Approva</button>
 <button className="btn-danger btn-small">Rifiuta</button>
 </div>
 </div>
 </div>
 <div className="card p-3 hover:bg-tertiary transition-colors">
 <div className="flex items-center justify-between">
 <div>
 <p className="font-medium text-primary">Giulia Bianchi</p>
 <p className="text-sm text-secondary">Laptop Dell</p>
 </div>
 <div className="flex gap-2">
 <button className="btn-success btn-small">Approva</button>
 <button className="btn-danger btn-small">Rifiuta</button>
 </div>
 </div>
 </div>
 </div>
 
 <button
 onClick={() => {
 window.location.href = '/prestiti';
 handleClose();
 }}
 className="btn-primary w-full"
 >
 Vai a Prestiti Completi
 </button>
 </div>
 )}
 
 {action === 'manage-repairs' && (
 <div className="space-y-4">
 <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
 <svg className="icon-lg text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
 </div>
        <h3 className="text-lg font-semibold text-primary mb-2">Gestione Segnalazioni</h3>
        <p className="text-secondary mb-4">Visualizza e gestisci tutte le segnalazioni in corso e completate.</p>
 
 {/* Lista riparazioni */}
 <div className="space-y-2 max-h-60 overflow-y-auto">
 <div className="text-center py-8 text-secondary">
 <svg className="w-12 h-12 mx-auto mb-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
 </svg>
            <p>Nessuna segnalazione in corso</p>
            <p className="text-sm text-muted">Le segnalazioni appariranno qui quando saranno create</p>
 </div>
 </div>
 
 <button
 onClick={() => {
 window.location.href = '/riparazioni';
 handleClose();
 }}
 className="btn-primary w-full"
 >
            Vai a Segnalazioni Complete
 </button>
 </div>
 )}
 </div>
 </div>
 )}
 </div>
 </div>
 );
};

export default QuickActionModal;
