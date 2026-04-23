import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthContext';

const ACCADEMIC_YEAR_VALUES = (() => {
  const out = [];
  for (let y = 2010; y <= 2029; y++) out.push(`${y}/${y + 1}`);
  return out;
})();

function normalizeAcademicYearValue(val) {
  if (!val) return '';
  const s = String(val).trim();
  const m = s.match(/(\d{4})\/(\d{4})/);
  return m ? `${m[1]}/${m[2]}` : s;
}

function firstAssignedCourseFromItem(item) {
  const raw = item?.corsi_assegnati;
  if (Array.isArray(raw) && raw.length) return String(raw[0] || '').trim();
  if (typeof raw === 'string' && raw.trim()) return raw.split(',')[0].trim();
  return '';
}

const ThesisInventoryModal = ({ isOpen, onClose, onSuccess, editingItem = null }) => {
  const [step, setStep] = useState(1);
  const [courses, setCourses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [unitsLoading, setUnitsLoading] = useState(false);
  const prefillUnitaRef = useRef([]);
  const step5FetchedRef = useRef(false);
  const { token } = useAuth();

  const [formData, setFormData] = useState({
    nome: '',
    quantita_totale: 1,
    scaffale: '',
    autore: '',
    relatore: '',
    anno_accademico: '',
    luogo_pubblicazione: '',
    tipo_prestito: 'solo_esterno',
    location: '',
    corso_accademico: '',
    unita: []
  });

  const withCatalogType = (url) => `${url}${url.includes('?') ? '&' : '?'}tipo_catalogo=tesi`;

  const generateUnitCodes = (quantity) => {
    const units = [];
    for (let i = 1; i <= quantity; i++) units.push({ codice_univoco: '', note: '' });
    return units;
  };

  const fetchCourses = async () => {
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/corsi`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) setCourses(await response.json());
    } catch (err) {
      console.error('Errore caricamento corsi:', err);
    }
  };

  const fetchExistingUnits = async (itemId) => {
    try {
      const response = await fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/${itemId}/units`), {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.ok) {
        const units = await response.json();
        const unitaFromApi = units.map((unit) => ({
          codice_univoco: unit.codice_univoco || '',
          note: unit.note || '',
          stato: unit.stato
        }));
        const hasCodici = unitaFromApi.some((u) => u.codice_univoco && u.codice_univoco.trim() !== '');
        setFormData((prev) => ({
          ...prev,
          unita: (unitaFromApi.length > 0 && hasCodici)
            ? unitaFromApi
            : (prefillUnitaRef.current.length > 0 ? prefillUnitaRef.current : prev.unita)
        }));
      }
    } catch (err) {
      console.error('Errore caricamento unità:', err);
      setFormData((prev) => ({
        ...prev,
        unita: prefillUnitaRef.current.length > 0 ? prefillUnitaRef.current : prev.unita
      }));
    } finally {
      setUnitsLoading(false);
    }
  };

  useEffect(() => {
    if (!isOpen) {
      setStep(1);
      setError(null);
      setUnitsLoading(false);
      step5FetchedRef.current = false;
      return;
    }

    fetchCourses();
    if (editingItem) {
      const unitaPrecompilate = (editingItem.unita_codici && editingItem.unita_codici.length > 0)
        ? editingItem.unita_codici.map((codice) => ({ codice_univoco: codice || '', note: '', stato: undefined }))
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
        tipo_prestito: editingItem.tipo_prestito || 'solo_esterno',
        location: editingItem.location || '',
        corso_accademico: firstAssignedCourseFromItem(editingItem),
        unita: unitaPrecompilate
      });
      step5FetchedRef.current = false;
      setUnitsLoading(true);
      fetchExistingUnits(editingItem.id);
    } else {
      setFormData({
        nome: '',
        quantita_totale: 1,
        scaffale: '',
        autore: '',
        relatore: '',
        anno_accademico: '',
        luogo_pubblicazione: '',
        tipo_prestito: 'solo_esterno',
        location: '',
        corso_accademico: '',
        unita: []
      });
    }
  }, [isOpen, editingItem]);

  useEffect(() => {
    if (!isOpen || !editingItem || step !== 5 || unitsLoading || step5FetchedRef.current) return;
    const hasAnyCode = formData.unita.some((u) => u.codice_univoco && u.codice_univoco.trim() !== '');
    if (formData.unita.length > 0 && hasAnyCode) return;
    step5FetchedRef.current = true;
    setUnitsLoading(true);
    fetchExistingUnits(editingItem.id);
  }, [isOpen, editingItem, step, formData.unita.length, unitsLoading]);

  const handleQuantityChange = (quantity) => {
    if (quantity === '' || quantity === null || quantity === undefined) {
      setFormData((prev) => ({ ...prev, quantita_totale: '' }));
      return;
    }
    const parsedQuantity = parseInt(quantity, 10);
    if (isNaN(parsedQuantity) || parsedQuantity < 1) return;
    const newQuantity = Math.max(1, parsedQuantity);

    if (editingItem) {
      setFormData((prev) => ({ ...prev, quantita_totale: newQuantity }));
    } else {
      setFormData((prev) => ({
        ...prev,
        quantita_totale: newQuantity,
        unita: generateUnitCodes(newQuantity)
      }));
    }
  };

  const handleUnitCodeChange = (index, newCode) => {
    const updatedUnits = [...formData.unita];
    updatedUnits[index].codice_univoco = newCode;
    setFormData((prev) => ({ ...prev, unita: updatedUnits }));
  };

  const canProceed = () => {
    switch (step) {
      case 1:
        return Boolean(formData.nome?.trim() && formData.quantita_totale > 0 && String(formData.autore || '').trim());
      case 2:
        return Boolean(String(formData.relatore || '').trim() && String(formData.anno_accademico || '').trim());
      case 3:
        return true;
      case 4:
        return Boolean(String(formData.corso_accademico || '').trim());
      case 5:
        if (formData.unita.length === 0) return false;
        if (editingItem) {
          return formData.unita.every((u) => !u.codice_univoco || (u.codice_univoco.length <= 6 && /^[A-Za-z0-9]+$/.test(u.codice_univoco)));
        }
        return formData.unita.every((u) => u.codice_univoco && u.codice_univoco.length <= 6 && /^[A-Za-z0-9]+$/.test(u.codice_univoco));
      default:
        return false;
    }
  };

  const handleSubmit = async () => {
    if (!canProceed()) {
      setError('Compila tutti i campi obbligatori');
      return;
    }
    if (editingItem && unitsLoading) {
      setError('Attendere il caricamento dei codici univoci.');
      return;
    }

    try {
      setLoading(true);
      const method = editingItem ? 'PUT' : 'POST';
      const url = editingItem
        ? withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/${editingItem.id}`)
        : withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario`);

      const submitData = {
        ...formData,
        posizione: formData.scaffale || null,
        categoria_madre: String(formData.corso_accademico || '').trim(),
        categoria_id: null,
        autore: formData.autore || null,
        relatore: formData.relatore || null,
        anno_accademico: formData.anno_accademico || null,
        luogo_pubblicazione: formData.luogo_pubblicazione || null,
        data_pubblicazione: null,
        casa_editrice: null,
        fondo: null,
        settore: null,
        location: formData.location || null,
        corsi_assegnati: [String(formData.corso_accademico || '').trim()],
        tipo_catalogo: 'tesi'
      };
      delete submitData.scaffale;
      delete submitData.corso_accademico;

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(submitData)
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Errore nel salvataggio');
      }

      onSuccess?.();
      onClose?.();
      setStep(1);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setStep(1);
    setError(null);
    onClose?.();
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={(e) => e.target === e.currentTarget && handleClose()}>
      <div className="modal-content h-[90vh] flex flex-col" style={{ maxWidth: '56rem', width: '95vw' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2 className="text-lg font-semibold text-primary">{editingItem ? 'Modifica Tesi' : 'Nuova Tesi'}</h2>
            <p className="text-xs text-secondary mt-1">Passo {step} di 5</p>
          </div>
          <button onClick={handleClose} className="text-muted hover:text-primary">✕</button>
        </div>

        <div className="modal-body flex-1 overflow-y-auto">
          {step === 1 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">Informazioni base della tesi</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="form-group">
                  <label className="form-label">Titolo *</label>
                  <input type="text" value={formData.nome} onChange={(e) => setFormData((p) => ({ ...p, nome: e.target.value }))} className="input-field" placeholder="Titolo della tesi" />
                </div>
                <div className="form-group">
                  <label className="form-label">Quantità *</label>
                  <input type="number" min="1" value={formData.quantita_totale} onChange={(e) => handleQuantityChange(e.target.value)} className="input-field" />
                </div>
                <div className="form-group">
                  <label className="form-label">Scaffale</label>
                  <input type="text" value={formData.scaffale} onChange={(e) => setFormData((p) => ({ ...p, scaffale: e.target.value }))} className="input-field" />
                </div>
                <div className="form-group">
                  <label className="form-label">Alunno *</label>
                  <input type="text" value={formData.autore} onChange={(e) => setFormData((p) => ({ ...p, autore: e.target.value }))} className="input-field" placeholder="Nome e cognome dell'alunno" />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">Dati tesi</h3>
              <div className="form-group">
                <label className="form-label">Relatore *</label>
                <input type="text" value={formData.relatore} onChange={(e) => setFormData((p) => ({ ...p, relatore: e.target.value }))} className="input-field" />
              </div>
              <div className="form-group">
                <label className="form-label">Anno accademico *</label>
                <select value={ACCADEMIC_YEAR_VALUES.includes(formData.anno_accademico) ? formData.anno_accademico : ''} onChange={(e) => setFormData((p) => ({ ...p, anno_accademico: e.target.value }))} className="select-field">
                  <option value="">Seleziona anno accademico</option>
                  {ACCADEMIC_YEAR_VALUES.map((y) => (
                    <option key={y} value={y}>A.A. {y}</option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Luogo</label>
                <input type="text" value={formData.luogo_pubblicazione} onChange={(e) => setFormData((p) => ({ ...p, luogo_pubblicazione: e.target.value }))} className="input-field" />
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">Tipo di utilizzo</h3>
              <div className="space-y-2">
                {[
                  ['solo_esterno', 'Uso esterno'],
                  ['solo_interno', 'Uso interno'],
                  ['entrambi', 'Entrambi']
                ].map(([value, label]) => (
                  <label key={value} className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200 cursor-pointer">
                    <input type="radio" name="tipo_prestito_tesi" value={value} checked={formData.tipo_prestito === value} onChange={(e) => setFormData((p) => ({ ...p, tipo_prestito: e.target.value }))} />
                    <span className="text-sm font-medium text-gray-900">{label}</span>
                  </label>
                ))}
              </div>
              <div className="form-group">
                <label className="form-label">Posizione</label>
                <select value={formData.location} onChange={(e) => setFormData((p) => ({ ...p, location: e.target.value }))} className="select-field">
                  <option value="">Seleziona posizione</option>
                  <option value="Piazza di Badia a Ripoli">Piazza di Badia a Ripoli</option>
                  <option value="Via de' Vecchietti">Via de' Vecchietti</option>
                </select>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">Corso accademico della tesi</h3>
              <div className="form-group">
                <label className="form-label">Corso accademico *</label>
                <select value={formData.corso_accademico} onChange={(e) => setFormData((p) => ({ ...p, corso_accademico: e.target.value }))} className="select-field">
                  <option value="">Seleziona il corso della tesi</option>
                  {courses.map((course) => {
                    const nome = course.nome || course.corso || course;
                    return <option key={nome} value={nome}>{nome}</option>;
                  })}
                </select>
              </div>
            </div>
          )}

          {step === 5 && (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-primary mb-4">Codici univoci tesi</h3>
              {editingItem && unitsLoading ? (
                <div className="py-10 text-center text-gray-500">Caricamento codici univoci...</div>
              ) : (
                <div className="space-y-2">
                  {formData.unita.map((unit, index) => (
                    <div key={index} className="flex items-center gap-2 p-2 bg-white rounded border border-gray-200">
                      <div className="w-6 h-6 bg-teal-100 text-teal-600 rounded-full flex items-center justify-center text-xs font-medium">{index + 1}</div>
                      <input
                        type="text"
                        value={unit.codice_univoco}
                        onChange={(e) => {
                          const value = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
                          handleUnitCodeChange(index, value);
                        }}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm font-mono"
                        placeholder="Es. TS1234"
                        maxLength={6}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {error && <div className="px-6 pb-2 text-sm text-red-700">{error}</div>}

        <div className="modal-footer flex-shrink-0 border-t border-gray-200 bg-white px-6 py-4">
          <button onClick={() => (step > 1 ? setStep(step - 1) : handleClose())} className="btn-secondary">
            {step > 1 ? 'Indietro' : 'Annulla'}
          </button>
          {step < 5 ? (
            <button
              onClick={() => {
                if (!canProceed()) return;
                if (step === 1 && formData.nome && formData.quantita_totale > 0) {
                  setFormData((prev) => ({ ...prev, unita: generateUnitCodes(prev.quantita_totale) }));
                }
                if (step === 4 && editingItem && formData.unita.length === 0 && formData.quantita_totale > 0) {
                  setFormData((prev) => ({ ...prev, unita: generateUnitCodes(prev.quantita_totale) }));
                }
                setStep(step + 1);
              }}
              disabled={!canProceed()}
              className="btn-primary"
            >
              Avanti
            </button>
          ) : (
            <button onClick={handleSubmit} disabled={loading || !canProceed()} className="btn-success">
              {loading ? 'Salvataggio...' : editingItem ? 'Aggiorna Tesi' : 'Crea Tesi'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThesisInventoryModal;
