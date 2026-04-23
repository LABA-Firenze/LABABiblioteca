import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';

/** Anni accademici 2010/2011 … 2029/2030 (valore salvato: "YYYY/YYYY+1") */
const ACCADEMIC_YEAR_VALUES = (() => {
  const out = [];
  for (let y = 2010; y <= 2029; y++) out.push(`${y}/${y + 1}`);
  return out;
})();

function firstAssignedCourseFromItem(item) {
  const raw = item?.corsi_assegnati;
  if (Array.isArray(raw) && raw.length) return String(raw[0] || '').trim();
  if (typeof raw === 'string' && raw.trim()) return raw.split(',')[0].trim();
  return '';
}

/** Allinea valori DB tipo "A.A. 2024/2025" al valore select YYYY/YYYY+1 */
function normalizeAcademicYearValue(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m = s.match(/(\d{4})\/(\d{4})/);
  return m ? `${m[1]}/${m[2]}` : s;
}

const StepInventoryModal = ({ isOpen, onClose, onSuccess, editingItem = null, catalogType = 'libri' }) => {
  const [step, setStep] = useState(1); // 1: Basic Info, 2: Dati pubblicazione, 3: Tipo Utilizzo, 4: Categoria, 5: Codici Univoci
 const [courses, setCourses] = useState([]);
 const [loading, setLoading] = useState(false);
 const [error, setError] = useState(null);
 const [unitsLoading, setUnitsLoading] = useState(false); // in modifica: attesa caricamento unità/codici
 const prefillUnitaRef = useRef([]); // codici precompilati in modifica (per non perderli se la risposta API arriva prima del setState)
 const step5FetchedRef = useRef(false); // fetch unità allo step 5 già fatto per questa apertura

  const [formData, setFormData] = useState({
    nome: '',
    quantita_totale: 1,
    scaffale: '',
    autore: '',
    relatore: '',
    anno_accademico: '',
    luogo_pubblicazione: '',
    casa_editrice: '',
    tipo_prestito: 'solo_esterno',
    location: '',
    corso_accademico: '',
    unita: []
  });
 
 const { token } = useAuth();

const catalogLabels = {
  libri: {
    singular: 'Libro',
    newTitle: 'Nuovo Libro',
    editTitle: 'Modifica Libro',
    baseInfoTitle: 'Informazioni base del libro',
    titlePlaceholder: 'Titolo del libro',
    authorLabel: 'Autore *',
    authorPlaceholder: "Nome e cognome dell'autore"
  },
  tesi: {
    singular: 'Tesi',
    newTitle: 'Nuova Tesi',
    editTitle: 'Modifica Tesi',
    baseInfoTitle: 'Informazioni base della tesi',
    titlePlaceholder: 'Titolo della tesi',
    authorLabel: 'Alunno *',
    authorPlaceholder: "Nome e cognome dell'alunno"
  },
  cataloghi: {
    singular: 'Catalogo',
    newTitle: 'Nuovo Catalogo',
    editTitle: 'Modifica Catalogo',
    baseInfoTitle: 'Informazioni base del catalogo',
    titlePlaceholder: 'Titolo del catalogo',
    authorLabel: 'Autore / Curatore *',
    authorPlaceholder: 'Nome autore o curatore'
  },
  riviste: {
    singular: 'Rivista',
    newTitle: 'Nuova Rivista',
    editTitle: 'Modifica Rivista',
    baseInfoTitle: 'Informazioni base della rivista',
    titlePlaceholder: 'Titolo della rivista',
    authorLabel: 'Autore / Curatore *',
    authorPlaceholder: 'Nome autore o curatore'
  }
};
const currentCatalog = catalogLabels[catalogType] || catalogLabels.libri;

 // Fetch data when modal opens
 useEffect(() => {
 if (isOpen) {
 fetchCourses();
 if (editingItem) {
 // Carica dati per la modifica; precompila i codici univoci da editingItem.unita_codici (dal catalogo)
        const unitaPrecompilate = (editingItem.unita_codici && editingItem.unita_codici.length > 0)
          ? editingItem.unita_codici.map(codice => ({ codice_univoco: codice || '', note: '', stato: undefined }))
          : [];
        prefillUnitaRef.current = unitaPrecompilate;
        setFormData({
          nome: editingItem.nome || '',
          quantita_totale: editingItem.quantita_totale || 1,
          scaffale: editingItem.posizione || '',
          autore: editingItem.autore || '',
          relatore: editingItem.relatore || '',
          anno_accademico: normalizeAcademicYearValue(editingItem.anno_accademico),
          luogo_pubblicazione: editingItem.luogo_pubblicazione || '',
          casa_editrice: editingItem.casa_editrice || '',
          tipo_prestito: editingItem.tipo_prestito || 'solo_esterno',
          location: editingItem.location || '',
          corso_accademico: firstAssignedCourseFromItem(editingItem),
          unita: unitaPrecompilate
        });
 step5FetchedRef.current = false;
 setUnitsLoading(true);
 fetchExistingUnits(editingItem.id);
 } else {
 // Solo per nuovo oggetto, resetta il form
      setFormData({
        nome: '',
        quantita_totale: 1,
        scaffale: '',
        autore: '',
        relatore: '',
        anno_accademico: '',
        luogo_pubblicazione: '',
        casa_editrice: '',
        tipo_prestito: 'solo_esterno',
        location: '',
        corso_accademico: '',
        unita: []
      });
 setStep(1);
 setError(null);
 setUnitsLoading(false);
 }
} else if (!isOpen) {
 setStep(1);
 setError(null);
 setUnitsLoading(false);
 step5FetchedRef.current = false;
}
 }, [isOpen, editingItem]);

 // In modifica, allo step 5: se unita è ancora vuoto richiedi le unità dal backend (precompilano i codici)
 useEffect(() => {
   if (!isOpen || !editingItem || step !== 5 || unitsLoading || step5FetchedRef.current) return;
   const hasAnyCode = formData.unita.some(u => u.codice_univoco && u.codice_univoco.trim() !== '');
   if (formData.unita.length > 0 && hasAnyCode) return;
   step5FetchedRef.current = true;
   setUnitsLoading(true);
   fetchExistingUnits(editingItem.id);
 }, [isOpen, editingItem, step, formData.unita.length, unitsLoading]);

 // Fetch existing units for editing
const withCatalogType = (url) => `${url}${url.includes('?') ? '&' : '?'}tipo_catalogo=${encodeURIComponent(catalogType)}`;

const fetchExistingUnits = async (itemId) => {
 try {
const response = await fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/${itemId}/units`), {
 headers: { 'Authorization': `Bearer ${token}` }
 });
 if (response.ok) {
 const units = await response.json();
 const unitaFromApi = units.map(unit => ({
   codice_univoco: unit.codice_univoco || '',
   note: unit.note || '',
   stato: unit.stato
 }));
 const hasCodici = unitaFromApi.some(u => u.codice_univoco && u.codice_univoco.trim() !== '');
 setFormData(prev => {
   const unitaToSet = (unitaFromApi.length > 0 && hasCodici)
     ? unitaFromApi
     : (prefillUnitaRef.current.length > 0 ? prefillUnitaRef.current : prev.unita);
   return { ...prev, unita: unitaToSet };
 });
 }
} catch (err) {
 console.error('Errore caricamento unità:', err);
 setFormData(prev => ({
   ...prev,
   unita: prefillUnitaRef.current.length > 0 ? prefillUnitaRef.current : prev.unita
 }));
} finally {
 setUnitsLoading(false);
}
};

 const fetchCourses = async () => {
 try {
    const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/corsi`, {
 headers: { 'Authorization': `Bearer ${token}` }
 });
 if (response.ok) {
 const data = await response.json();
 setCourses(data);
 }
 } catch (err) {
 console.error('Errore caricamento corsi:', err);
 }
 };

 // Generate unit codes - create empty slots for manual input
 const generateUnitCodes = (quantity) => {
 const units = [];
 for (let i = 1; i <= quantity; i++) {
 units.push({
 codice_univoco: '',
 note: ''
 });
 }
 return units;
 };

// Handle quantity change
const handleQuantityChange = (quantity) => {
  // Permetti al campo di essere vuoto temporaneamente
  if (quantity === '' || quantity === null || quantity === undefined) {
    setFormData(prev => ({
      ...prev,
      quantita_totale: ''
    }));
    return;
  }
  
  const parsedQuantity = parseInt(quantity);
  if (isNaN(parsedQuantity) || parsedQuantity < 1) {
    return; // Non aggiornare se non è un numero valido
  }
  
  const newQuantity = Math.max(1, parsedQuantity);
  
  // Se stiamo modificando un articolo esistente, non rigenerare i codici
  if (editingItem) {
    setFormData(prev => ({
      ...prev,
      quantita_totale: newQuantity
    }));
  } else {
    // Solo per nuovi articoli, genera i codici
    const units = generateUnitCodes(newQuantity);
    setFormData(prev => ({
      ...prev,
      quantita_totale: newQuantity,
      unita: units
    }));
  }
};

 // Handle unit code change
 const handleUnitCodeChange = (index, newCode) => {
 const updatedUnits = [...formData.unita];
 updatedUnits[index].codice_univoco = newCode;
 setFormData(prev => ({
 ...prev,
 unita: updatedUnits
 }));
 };

const handleSubmit = async () => {
  if (!formData.nome || !formData.quantita_totale || formData.quantita_totale <= 0 || formData.unita.length === 0) {
    setError('Compila tutti i campi obbligatori');
    return;
  }
  if (!String(formData.autore || '').trim()) {
    setError("L'alunno è obbligatorio");
    return;
  }
  if (catalogType === 'tesi') {
    if (!String(formData.relatore || '').trim()) {
      setError('Il relatore è obbligatorio');
      return;
    }
    if (!String(formData.anno_accademico || '').trim()) {
      setError("L'anno accademico è obbligatorio");
      return;
    }
  }
  const isTesi = catalogType === 'tesi';
  const corsoSel = isTesi ? String(formData.corso_accademico || '').trim() : '';
  if (isTesi && !corsoSel) {
    setError('Per la tesi indica il corso accademico di riferimento (solo quel corso, non tutti).');
    return;
  }
  if (editingItem && unitsLoading) {
    setError('Attendere il caricamento dei codici univoci.');
    return;
  }
  // In modifica i codici vuoti sono inviati uguale: il backend conserva i valori esistenti

 try {
 setLoading(true);
 const method = editingItem ? 'PUT' : 'POST';
 const url = editingItem ? withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/${editingItem.id}`) : withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario`);
 
  const categoriaMadreValue = isTesi ? corsoSel : '';

  // Prepara i dati per l'invio - pulisci i valori vuoti
  const submitData = {
    ...formData,
    posizione: formData.scaffale || null, // Mappa scaffale a posizione per il backend
    categoria_madre: categoriaMadreValue,
    categoria_id: null,
    autore: formData.autore || null,
    relatore: catalogType === 'tesi' ? (formData.relatore || null) : null,
    anno_accademico: catalogType === 'tesi' ? (formData.anno_accademico || null) : null,
    luogo_pubblicazione: catalogType === 'tesi' ? (formData.luogo_pubblicazione || null) : null,
    data_pubblicazione: null,
    casa_editrice: catalogType === 'tesi' ? null : (formData.casa_editrice || null),
    fondo: null,
    settore: null,
    location: formData.location || null,
    corsi_assegnati: isTesi ? [corsoSel] : [],
    tipo_catalogo: catalogType
  };

  // Rimuovi i campi che non servono al backend
  delete submitData.scaffale;
  delete submitData.corso_accademico;

 const response = await fetch(url, {
 method,
 headers: {
 'Content-Type': 'application/json',
 'Authorization': `Bearer ${token}`
 },
 body: JSON.stringify(submitData)
 });

 if (!response.ok) {
 const errorData = await response.json();
 throw new Error(errorData.error || 'Errore nel salvataggio');
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
 setStep(1);
 setError(null);
 onClose();
 };

const getStepTitle = () => {
  const step2Title = catalogType === 'tesi' ? 'Dati tesi' : 'Casa editrice';
  switch (step) {
    case 1: return 'Informazioni Base';
    case 2: return step2Title;
    case 3: return 'Tipo di Utilizzo';
    case 4: return catalogType === 'tesi' ? 'Corso accademico (tesi)' : 'Corsi accademici';
    case 5: return 'Codici Univoci';
    default: return 'Nuovo Elemento';
  }
};

const canProceed = () => {
  switch (step) {
    case 1: return Boolean(
      formData.nome?.trim()
      && formData.quantita_totale
      && formData.quantita_totale > 0
      && String(formData.autore || '').trim()
    );
    case 2: {
      if (catalogType === 'tesi') {
        return Boolean(
          String(formData.relatore || '').trim()
          && String(formData.anno_accademico || '').trim()
        );
      }
      return true;
    }
    case 3: return true; // Tipo di utilizzo sempre selezionabile
    case 4: {
      if (catalogType !== 'tesi') return true;
      return Boolean(String(formData.corso_accademico || '').trim());
    }
    case 5:
      if (formData.unita.length === 0) return false;
      // In modifica: codici vuoti sono ok (il backend conserva quelli esistenti)
      if (editingItem) {
        return formData.unita.every(u => !u.codice_univoco || (u.codice_univoco.length <= 6 && /^[A-Za-z0-9]+$/.test(u.codice_univoco)));
      }
      return formData.unita.every(u => u.codice_univoco && u.codice_univoco.length <= 6 && /^[A-Za-z0-9]+$/.test(u.codice_univoco));
    default: return false;
  }
};

 if (!isOpen) return null;

return (
  <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
    <div className="modal-content h-[90vh] flex flex-col" style={{ maxWidth: '56rem', width: '95vw' }} onClick={(e) => e.stopPropagation()}>
      <div className="modal-header">
 <div>
 <h2 className="text-lg font-semibold text-primary">
{editingItem ? currentCatalog.editTitle : currentCatalog.newTitle}
 </h2>
 <p className="text-xs text-secondary mt-1">
   {getStepTitle()} (Passo {step} di 5)
 </p>
 </div>
 <button
 onClick={handleClose}
 className="text-muted hover:text-primary"
 >
 <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
 </svg>
 </button>
      </div>
 
      {/* Progress Bar */}
      <div className="px-6 py-4 border-b border-gray-200">
 <div className="flex items-center justify-center">
 <div className="flex items-center space-x-4">
 {[
   { num: 1, label: 'Info Base', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
   { num: 2, label: 'Descrizione', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg> },
   { num: 3, label: 'Tipo Utilizzo', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg> },
   { num: 4, label: catalogType === 'tesi' ? 'Corso tesi' : 'Tutti i corsi', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
   { num: 5, label: 'Codici Unità', icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" /></svg> }
 ].map((stepData, index) => (
 <React.Fragment key={stepData.num}>
 <div className="flex flex-col items-center">
 <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium transition-all duration-300 ${
 stepData.num <= step 
 ? 'bg-teal-600 text-white shadow-lg scale-110' 
 : 'bg-gray-200 text-gray-500'
 }`}>
 {stepData.num <= step ? stepData.icon : stepData.num}
 </div>
 <span className={`text-xs mt-2 font-medium ${
 stepData.num <= step ? 'text-teal-600' : 'text-gray-500'
 }`}>
 {stepData.label}
 </span>
 </div>
 {index < 4 && (
 <div className={`w-16 h-1 mx-2 rounded transition-all duration-300 ${
 stepData.num < step 
 ? 'bg-teal-600' 
 : 'bg-gray-200'
 }`} />
 )}
 </React.Fragment>
 ))}
      </div>
      </div>
      </div>

      <div className="modal-body flex-1 overflow-y-auto">
 {/* Step 1: Basic Info */}
 {step === 1 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-primary mb-4">
{currentCatalog.baseInfoTitle}
 </h3>
 
 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 <div className="form-group">
 <label className="form-label">Titolo *</label>
 <input
 type="text"
 required
 value={formData.nome}
 onChange={(e) => {
   const newName = e.target.value;
   setFormData(prev => ({ ...prev, nome: newName }));
   if (newName && formData.quantita_totale && formData.quantita_totale > 0) {
     const units = generateUnitCodes(formData.quantita_totale);
     setFormData(prev => ({ ...prev, unita: units }));
   }
 }}
 className="input-field"
placeholder={currentCatalog.titlePlaceholder}
 />
 </div>

 <div className="form-group">
 <label className="form-label">Quantità *</label>
 <input
 type="number"
 min="1"
 required
 value={formData.quantita_totale}
 onChange={(e) => handleQuantityChange(e.target.value)}
 className="input-field"
 />
 </div>

                <div className="form-group">
                  <label className="form-label">Scaffale</label>
                  <input
                    type="text"
                    value={formData.scaffale}
                    onChange={(e) => setFormData(prev => ({ ...prev, scaffale: e.target.value }))}
                    className="input-field"
                    placeholder="Es. A1, B2, C3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">{currentCatalog.authorLabel}</label>
                  <input
                    type="text"
                    value={formData.autore}
                    onChange={(e) => setFormData(prev => ({ ...prev, autore: e.target.value }))}
                    className="input-field"
                    placeholder={currentCatalog.authorPlaceholder}
                  />
                </div>


 </div>
 </div>
 )}

 {/* Step 2: tesi = relatore, anno, luogo; altri tipi = solo casa editrice */}
 {step === 2 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-primary mb-4">
  {catalogType === 'tesi' ? 'Dati tesi' : 'Dettaglio editoriale'}
 </h3>
 
 <div className="space-y-4">
  {catalogType === 'tesi' ? (
    <>
      <div className="form-group">
        <label className="form-label">Relatore *</label>
        <input
          type="text"
          value={formData.relatore}
          onChange={(e) => setFormData(prev => ({ ...prev, relatore: e.target.value }))}
          className="input-field"
          placeholder="Nome del relatore"
        />
      </div>
      <div className="form-group">
        <label className="form-label">Anno accademico *</label>
        <select
          value={ACCADEMIC_YEAR_VALUES.includes(formData.anno_accademico) ? formData.anno_accademico : ''}
          onChange={(e) => setFormData(prev => ({ ...prev, anno_accademico: e.target.value }))}
          className="select-field"
        >
          <option value="">Seleziona anno accademico</option>
          {ACCADEMIC_YEAR_VALUES.map((y) => (
            <option key={y} value={y}>A.A. {y}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label className="form-label">Luogo</label>
        <input
          type="text"
          value={formData.luogo_pubblicazione}
          onChange={(e) => setFormData(prev => ({ ...prev, luogo_pubblicazione: e.target.value }))}
          className="input-field"
          placeholder="Es. Firenze, sede di discussione"
        />
      </div>
    </>
  ) : (
    <div className="form-group">
      <label className="form-label">Casa Editrice</label>
      <input
        type="text"
        value={formData.casa_editrice}
        onChange={(e) => setFormData(prev => ({ ...prev, casa_editrice: e.target.value }))}
        className="input-field"
        placeholder="Es. Mondadori, Einaudi, Feltrinelli"
      />
    </div>
  )}
 </div>
 </div>
 )}

{/* Step 3: Tipo di Utilizzo */}
{step === 3 && (
<div className="space-y-6">
<h3 className="text-lg font-semibold text-primary mb-4">
Tipo di Utilizzo
</h3>

<div className="form-group">
  <label className="form-label">Seleziona il tipo di utilizzo</label>
  <div className="space-y-2">
    <label className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:bg-gray-50">
      <input
        type="radio"
        name="tipo_prestito"
        value="solo_esterno"
        checked={formData.tipo_prestito === 'solo_esterno'}
        onChange={(e) => setFormData(prev => ({ ...prev, tipo_prestito: e.target.value }))}
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
        name="tipo_prestito"
        value="solo_interno"
        checked={formData.tipo_prestito === 'solo_interno'}
        onChange={(e) => setFormData(prev => ({ ...prev, tipo_prestito: e.target.value }))}
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
        name="tipo_prestito"
        value="entrambi"
        checked={formData.tipo_prestito === 'entrambi'}
        onChange={(e) => setFormData(prev => ({ ...prev, tipo_prestito: e.target.value }))}
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

<div className="form-group mt-6">
  <label className="form-label">Posizione</label>
  <select
    value={formData.location}
    onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
    className="select-field"
  >
    <option value="">Seleziona posizione</option>
    <option value="Piazza di Badia a Ripoli">Piazza di Badia a Ripoli</option>
    <option value="Via de' Vecchietti">Via de' Vecchietti</option>
  </select>
  <p className="text-xs text-gray-500 mt-1">Seleziona la sede fisica dove si trova il libro</p>
</div>
</div>
)}

{/* Step 4: tesi = un solo corso; altri tipi = tutti i corsi (solo informativo) */}
{step === 4 && (
 <div className="space-y-6">
 <h3 className="text-lg font-semibold text-primary mb-4">
   {catalogType === 'tesi' ? 'Corso accademico della tesi' : 'Disponibilità per corso'}
 </h3>

        {catalogType === 'tesi' ? (
          <div className="form-group">
            <label className="form-label">Corso accademico *</label>
            <select
              value={formData.corso_accademico}
              onChange={(e) => setFormData(prev => ({ ...prev, corso_accademico: e.target.value }))}
              className="select-field"
            >
              <option value="">Seleziona il corso della tesi</option>
              {courses.map((course) => {
                const nome = course.nome || course.corso || course;
                return (
                  <option key={nome} value={nome}>{nome}</option>
                );
              })}
            </select>
            <p className="text-xs text-gray-600 mt-2">
              La tesi è associata <strong>solo</strong> al corso che scegli qui (non a tutti i corsi).
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-teal-200 bg-teal-50 p-5 text-sm text-teal-900">
            <p className="font-medium text-teal-950 mb-2">Libri, cataloghi e riviste</p>
            <p>
              Questo materiale viene reso disponibile <strong>automaticamente a tutti i corsi</strong> accademici presenti in anagrafica.
            </p>
            <p className="mt-3 text-teal-800">
              Le <strong>tesi di laurea</strong> seguono una regola diversa: sono visibili <strong>solo</strong> al corso che selezioni nel modale tesi.
            </p>
          </div>
        )}

 </div>
 )}

{/* Step 5: Unit Codes */}
{step === 5 && (
 <div className="space-y-4">
 <h3 className="text-lg font-semibold text-primary mb-4">
 Codici Univoci per: <span className="text-brand-primary">{formData.nome}</span>
 </h3>

 {editingItem && unitsLoading ? (
   <div className="flex items-center justify-center py-12 text-gray-500">
     <svg className="animate-spin h-8 w-8 text-teal-600 mr-2" fill="none" viewBox="0 0 24 24"> <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /> <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /> </svg>
     Caricamento codici univoci...
   </div>
 ) : (
 <>
 <div className="card bg-tertiary mb-4">
 <h4 className="font-medium text-primary mb-2">Riepilogo</h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><strong>Titolo:</strong> {formData.nome}</div>
                  <div><strong>Quantità:</strong> {formData.quantita_totale}</div>
                  <div><strong>Alunno:</strong> {formData.autore || '—'}</div>
                  <div><strong>Scaffale:</strong> {formData.scaffale || '—'}</div>
                  <div className="col-span-2">
                    <strong>{catalogType === 'tesi' ? 'Corso accademico (tesi)' : 'Corsi'}:</strong>{' '}
                    {catalogType === 'tesi' ? (formData.corso_accademico || '—') : 'Tutti i corsi (assegnazione automatica)'}
                  </div>
                  {catalogType === 'tesi' ? (
                    <>
                      <div><strong>Relatore:</strong> {formData.relatore || '—'}</div>
                      <div><strong>Anno accademico:</strong> {formData.anno_accademico ? `A.A. ${formData.anno_accademico}` : '—'}</div>
                      <div className="col-span-2"><strong>Luogo:</strong> {formData.luogo_pubblicazione || '—'}</div>
                    </>
                  ) : (
                    <div className="col-span-2"><strong>Casa Editrice:</strong> {formData.casa_editrice || '—'}</div>
                  )}
                </div>
 </div>

 <div className="form-group">
 <label className="form-label">Codice Univoco *</label>
 <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
 <div className="space-y-2">
 {formData.unita.map((unit, index) => (
 <div key={index} className="flex items-center space-x-2 p-2 bg-white rounded border border-gray-200 hover:border-teal-300 transition-colors">
 <div className="flex-shrink-0 w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-xs font-medium">
 {index + 1}
 </div>
 <div className="flex-1">
 <input
 type="text"
 value={unit.codice_univoco}
 onChange={(e) => {
   const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
   handleUnitCodeChange(index, value);
 }}
 className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400 font-mono"
 placeholder="Es. AA1234"
 maxLength={6}
 />
 {unit.codice_univoco && (unit.codice_univoco.length > 6 || !/^[A-Z0-9]+$/.test(unit.codice_univoco)) && (
   <p className="text-xs text-red-600 mt-1">Massimo 6 caratteri alfanumerici</p>
 )}
 </div>
 <div className="flex-shrink-0 flex items-center space-x-2">
 {editingItem && unit.stato && (
 <span className={`text-xs px-2 py-1 rounded ${
 unit.stato === 'disponibile' ? 'bg-teal-100 text-teal-800' :
 unit.stato === 'in_prestito' ? 'bg-teal-100 text-teal-800' :
 unit.stato === 'in_riparazione' ? 'bg-orange-100 text-orange-800' :
 'bg-gray-100 text-gray-800'
 }`}>
 {unit.stato}
 </span>
 )}
 <span className="text-xs text-gray-500 bg-gray-100 px-1 py-0.5 rounded">
 {(unit.codice_univoco || '').length}/6
 </span>
 </div>
 </div>
 ))}
</div>
</div>
</div>
</>
)}
</div>
)}
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

      <div className="modal-footer flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
 <button
 onClick={() => step > 1 ? setStep(step - 1) : handleClose()}
 className="btn-secondary"
 >
 {step > 1 ? 'Indietro' : 'Annulla'}
 </button>
 
 <div className="flex space-x-3">
 {step < 5 ? (
 <button
 onClick={() => {
   if (canProceed()) {
     if (step === 1 && formData.nome && formData.quantita_totale && formData.quantita_totale > 0) {
       const units = generateUnitCodes(formData.quantita_totale);
       setFormData(prev => ({ ...prev, unita: units }));
     }
     if (step === 4 && editingItem && formData.unita.length === 0 && formData.quantita_totale > 0) {
       setFormData(prev => ({ ...prev, unita: generateUnitCodes(prev.quantita_totale) }));
     }
     setStep(step + 1);
   }
 }}
 disabled={!canProceed()}
 className="btn-primary"
 >
 Avanti
 </button>
 ) : (
 <button
 onClick={handleSubmit}
 disabled={loading || !canProceed()}
 className="btn-success"
 >
 {loading ? 'Creazione...' : (editingItem ? 'Aggiorna Elemento' : 'Crea Elemento')}
 </button>
 )}
      </div>
      </div>
    </div>
  </div>
);
};

export default StepInventoryModal;
