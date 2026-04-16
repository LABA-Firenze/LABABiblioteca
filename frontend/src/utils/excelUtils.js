import * as XLSX from 'xlsx';

const getApiBase = () => import.meta.env?.VITE_API_BASE_URL || '';

// Export inventario to Excel - ora gestito dal backend
export const exportInventoryToExcel = async (token, catalogType = 'libri') => {
  try {
    const response = await fetch(`${getApiBase()}/api/excel/inventario/export?tipo_catalogo=${encodeURIComponent(catalogType)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Errore durante l\'export Excel');
    }

    // Scarica il file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'inventario_laba.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Errore export Excel:', error);
    throw error;
  }
};

// Export richieste to Excel
export const exportRequestsToExcel = (requests, filename = 'richieste_laba.xlsx') => {
  const data = requests.map(request => ({
    'ID': request.id,
    'Oggetto': request.oggetto_nome,
    'Utente': `${request.utente_nome} ${request.utente_cognome}`,
    'Email': request.utente_email,
    'Corso': request.utente_corso,
    'Dal': new Date(request.dal).toLocaleDateString('it-IT'),
    'Al': new Date(request.al).toLocaleDateString('it-IT'),
    'Stato': request.stato === 'in_attesa' ? 'In Attesa' :
             request.stato === 'approvata' ? 'Approvata' : 'Rifiutata',
    'Note': request.note || '',
    'Data Richiesta': new Date(request.created_at).toLocaleDateString('it-IT')
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  
  const colWidths = [
    { wch: 5 },   // ID
    { wch: 25 },  // Oggetto
    { wch: 20 },  // Utente
    { wch: 25 },  // Email
    { wch: 20 },  // Corso
    { wch: 12 },  // Dal
    { wch: 12 },  // Al
    { wch: 12 },  // Stato
    { wch: 30 },  // Note
    { wch: 15 }   // Data Richiesta
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Richieste');
  XLSX.writeFile(wb, filename);
};

// Export segnalazioni to Excel
export const exportRepairsToExcel = (repairs, filename = 'segnalazioni_laba.xlsx') => {
  const data = repairs.map(repair => ({
    'ID': repair.id,
    'Materiale': repair.oggetto_nome || 'N/A',
    'Descrizione': repair.descrizione,
    'Stato': repair.stato === 'in_corso' ? 'In Corso' :
             repair.stato === 'completata' ? 'Completata' : 'Annullata',
    'Data Inizio': repair.data_inizio ? new Date(repair.data_inizio).toLocaleDateString('it-IT') : '',
    'Data Fine': repair.data_fine ? new Date(repair.data_fine).toLocaleDateString('it-IT') : '',
    'Costo (€)': repair.costo || '',
    'Note': repair.note || '',
    'Data Creazione': new Date(repair.created_at).toLocaleDateString('it-IT')
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  
  const colWidths = [
    { wch: 5 },   // ID
    { wch: 25 },  // Elemento
    { wch: 40 },  // Descrizione
    { wch: 12 },  // Stato
    { wch: 12 },  // Data Inizio
    { wch: 12 },  // Data Fine
    { wch: 10 },  // Costo
    { wch: 30 },  // Note
    { wch: 15 }   // Data Creazione
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Segnalazioni');
  XLSX.writeFile(wb, filename);
};

// Generate template for inventory import - ora gestito dal backend
export const generateInventoryTemplate = async (token, catalogType = 'libri') => {
  try {
    const response = await fetch(`${getApiBase()}/api/excel/inventario/template?tipo_catalogo=${encodeURIComponent(catalogType)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error('Errore durante la generazione del template');
    }

    // Scarica il file
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'template_inventario_laba.xlsx';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Errore generazione template:', error);
    throw error;
  }
};

// Import inventory from Excel - ora gestito dal backend
export const importInventoryFromExcel = async (file, token, catalogType = 'libri') => {
  try {
    // Verifica che il file sia valido
    if (!file || !(file instanceof File) && !(file instanceof Blob)) {
      throw new Error('File non valido');
    }

    console.log('File ricevuto:', file.name, file.size, file.type);

    // Converti il file in base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => {
        console.error('Errore FileReader:', error);
        reject(error);
      };
      reader.readAsDataURL(file);
    });

    const response = await fetch(`${getApiBase()}/api/excel/inventario/import?tipo_catalogo=${encodeURIComponent(catalogType)}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        fileData: base64
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || 'Errore durante l\'import Excel');
    }

    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Errore import Excel:', error);
    throw error;
  }
};

// Export segnalazioni to Excel
export const exportReportsToExcel = (reports, filename = 'segnalazioni_laba.xlsx') => {
  const data = reports.map(report => ({
    'ID': report.id,
    'Tipo': report.tipo,
    'Oggetto': report.oggetto_nome || 'N/A',
    'Messaggio': report.messaggio,
    'Stato': report.stato === 'aperta' ? 'Aperta' : 'Chiusa',
    'Utente': `${report.utente_nome} ${report.utente_cognome}`,
    'Email': report.utente_email,
    'Data Segnalazione': new Date(report.created_at).toLocaleDateString('it-IT')
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  
  const colWidths = [
    { wch: 5 },   // ID
    { wch: 15 },  // Tipo
    { wch: 25 },  // Oggetto
    { wch: 40 },  // Messaggio
    { wch: 12 },  // Stato
    { wch: 20 },  // Utente
    { wch: 25 },  // Email
    { wch: 15 }   // Data Segnalazione
  ];
  ws['!cols'] = colWidths;

  XLSX.utils.book_append_sheet(wb, ws, 'Segnalazioni');
  XLSX.writeFile(wb, filename);
};


