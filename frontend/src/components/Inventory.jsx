import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { MoreVertical, Download, Upload, Loader2, Plus, Tag, Search, AlertCircle, Package, CheckCircle, AlertTriangle, ChevronDown, Check, ChevronRight, ArrowUp, ArrowDown, X, Filter, QrCode, Pencil, Trash2, Info } from 'lucide-react';
import { 
 exportInventoryToExcel, 
 generateInventoryTemplate, 
 importInventoryFromExcel 
} from '../utils/excelUtils';
import StepInventoryModal from './StepInventoryModal';
import QRCodeGenerator from './QRCodeGenerator';
import { TableSkeleton } from './SkeletonLoader';
import AdvancedFilters from './AdvancedFilters';

const Inventory = ({ catalogType = 'libri' }) => {
 const [inventory, setInventory] = useState([]);
 const [categories, setCategories] = useState([]);
 const [courses, setCourses] = useState([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState(null);
 const [showAddModal, setShowAddModal] = useState(false);
 const [editingItem, setEditingItem] = useState(null);
 const [searchTerm, setSearchTerm] = useState('');
 const [qrCodeItem, setQrCodeItem] = useState(null);
 const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
 const [savedFilters, setSavedFilters] = useState([]);
 const [currentFilters, setCurrentFilters] = useState({});
  const [showCategoryManager, setShowCategoryManager] = useState(false);
  const [newCategory, setNewCategory] = useState({ nome: '' });
  const [expandedItems, setExpandedItems] = useState(new Set());
  const [showDeleteCategoryModal, setShowDeleteCategoryModal] = useState(false);
  const [categoryToDelete, setCategoryToDelete] = useState(null);
  const [itemsUsingCategory, setItemsUsingCategory] = useState([]);
  const [editingCategory, setEditingCategory] = useState(null);
  const [editCategoryName, setEditCategoryName] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [selectedLocationFilter, setSelectedLocationFilter] = useState('');
  const [showLocationDropdown, setShowLocationDropdown] = useState(false);
  const [selectedCourse, setSelectedCourse] = useState('');
  const [sortOrder, setSortOrder] = useState('asc'); // 'asc' or 'desc' per ordinamento ID
 const [viewMode, setViewMode] = useState('list'); // only list view
 const [showUnitDetailModal, setShowUnitDetailModal] = useState(false);
 const [selectedUnit, setSelectedUnit] = useState(null);
  const [unitLoanDetails, setUnitLoanDetails] = useState(null);
  const [loans, setLoans] = useState([]);
  const [itemUnits, setItemUnits] = useState({}); // Cache per le unità degli oggetti
  const [showDeleteWarningModal, setShowDeleteWarningModal] = useState(false);
  const [deleteWarningMessage, setDeleteWarningMessage] = useState('');
  const [exportLoading, setExportLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [showExportImportMenu, setShowExportImportMenu] = useState(false);
  const importFileInputRef = React.useRef(null);
 
 // New item form state
 const [newItem, setNewItem] = useState({
 nome: '',
 categoria_id: '',
 autore: '',
 luogo_pubblicazione: '',
 data_pubblicazione: null,
 casa_editrice: '',
 fondo: '',
 settore: '',
 quantita_totale: 1,
 scaffale: '',
 unita: []
 });
 
  const { isAdmin, token } = useAuth();

  // Function to abbreviate course names
  const abbreviateCourse = (courseName) => {
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

  const catalogMeta = {
    libri: {
      title: 'Libri',
      subtitle: 'Gestisci e monitora tutti i libri della biblioteca',
      newItemLabel: 'Nuovo Articolo'
    },
    tesi: {
      title: 'Tesi di laurea',
      subtitle: 'Gestisci e monitora tutte le tesi di laurea',
      newItemLabel: 'Nuova Tesi'
    },
    cataloghi: {
      title: 'Cataloghi',
      subtitle: 'Gestisci e monitora tutti i cataloghi',
      newItemLabel: 'Nuovo Catalogo'
    },
    riviste: {
      title: 'Riviste',
      subtitle: 'Gestisci e monitora tutte le riviste',
      newItemLabel: 'Nuova Rivista'
    }
  };
  const currentCatalog = catalogMeta[catalogType] || catalogMeta.libri;
  const withCatalogType = (url) => `${url}${url.includes('?') ? '&' : '?'}tipo_catalogo=${encodeURIComponent(catalogType)}`;

  // Handle unit click to show loan details
 const handleUnitClick = async (unit) => {
   if (unit.stato !== 'prestato') return; // Only show details for loaned units
   
   try {
      const response = await fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/prestiti/unit/${unit.id}`), {
       headers: { 'Authorization': `Bearer ${token}` }
     });
     
     if (response.ok) {
       const loanDetails = await response.json();
       setSelectedUnit(unit);
       setUnitLoanDetails(loanDetails);
       setShowUnitDetailModal(true);
     }
   } catch (error) {
     console.error('Error fetching unit loan details:', error);
   }
 };

 // Fetch inventory data
const fetchInventory = async () => {
 try {
 setLoading(true);
const [inventoryRes, loansRes, unitCodesRes] = await Promise.all([
        fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario`), {
 headers: { 'Authorization': `Bearer ${token}` }
 }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/prestiti?all=1`, {
 headers: { 'Authorization': `Bearer ${token}` }
}),
        fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/unit-codes`), {
headers: { 'Authorization': `Bearer ${token}` }
 })
 ]);
 
 if (!inventoryRes.ok) throw new Error('Errore nel caricamento inventario');
 if (!loansRes.ok) throw new Error('Errore nel caricamento prestiti');
if (!unitCodesRes.ok) throw new Error('Errore nel caricamento codici unità');
 
const [inventoryData, loansData, unitCodesData] = await Promise.all([
 inventoryRes.json(),
loansRes.json(),
unitCodesRes.json()
 ]);

const unitCodesMap = (unitCodesData || []).reduce((acc, row) => {
  acc[row.inventario_id] = row.unita_codici || [];
  return acc;
}, {});

const inventoryWithUnits = (inventoryData || []).map((item) => ({
  ...item,
  unita_codici: unitCodesMap[item.id] || []
}));
 
 setInventory(inventoryWithUnits);
 setLoans(loansData);
 } catch (err) {
 setError(err.message);
 } finally {
 setLoading(false);
 }
 };

 // Fetch categories
 const fetchCategories = async () => {
 try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/categorie-semplici`, {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 });
 
 if (!response.ok) throw new Error('Errore nel caricamento settori');
 
 const data = await response.json();
 setCategories(data);
 } catch (err) {
      console.error('Errore settori:', err);
 }
 };

 // Fetch courses
 const fetchCourses = async () => {
 try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/corsi`, {
 headers: {
 'Authorization': `Bearer ${token}`
 }
 });
 
 if (!response.ok) throw new Error('Errore nel caricamento corsi');
 
 const data = await response.json();
 setCourses(data);
 } catch (err) {
 console.error('Errore corsi:', err);
 }
 };

  // Fetch units for a specific item
  const fetchItemUnits = async (itemId) => {
    try {
      const response = await fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/${itemId}/units`), {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Errore nel caricamento unità');

      const data = await response.json();
      return data;
    } catch (err) {
      console.error('Errore unità:', err);
      return [];
 }
 };

 useEffect(() => {
 fetchInventory();
 fetchCategories();
 fetchCourses();
  }, []);

  // Ogni elemento inventario è una card (nomi duplicati ammessi, identificazione tramite ID univoco)
  const groupedInventory = inventory.map(item => ({
    ...item,
    quantita_totale: item.quantita_totale || 1,
    hasMultipleUnits: (item.quantita_totale || 1) > 1,
    unita_codici: item.unita_codici || [],
    unita: [{
      id: item.id,
      stato: item.stato_effettivo,
      quantita: item.quantita_totale || 1
    }]
  }));

  // Filter inventory based on search term and category
  const filteredInventory = groupedInventory.filter(item => {
    // Search term filter - cerca anche nei codice_univoco delle unità
    const matchesSearch = !searchTerm || (
      item.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (item.autore && item.autore.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.relatore && item.relatore.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.anno_accademico && item.anno_accademico.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (item.casa_editrice && item.casa_editrice.toLowerCase().includes(searchTerm.toLowerCase())) ||
      item.categoria_nome?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoria_madre?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.categoria_figlia?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.id.toString().includes(searchTerm) ||
      (item.unita_codici && item.unita_codici.some(codice => 
        codice && codice.toLowerCase().includes(searchTerm.toLowerCase())
      ))
    );

    // Category filter (only for admin) - usa il nome della categoria semplice
    const matchesCategory = !selectedCategoryFilter || !isAdmin || (
      selectedCategoryFilter === (item.categoria_figlia || item.categoria_nome?.split(' - ')[1])
    );

    // Location filter
    const matchesLocation = !selectedLocationFilter || (
      item.location === selectedLocationFilter
    );

    return matchesSearch && matchesCategory && matchesLocation;
  }).sort((a, b) => {
    // Ordina per ID numerico
    const idA = parseInt(a.id) || 0;
    const idB = parseInt(b.id) || 0;
    return sortOrder === 'asc' ? idA - idB : idB - idA;
  });

  // Scorte basse rimosse - i libri sono sempre massimo 1 o 2 articoli

  // Toggle expanded state for items with multiple units
  const toggleExpanded = async (itemId) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(itemId)) {
      newExpanded.delete(itemId);
    } else {
      newExpanded.add(itemId);
      // Carica le unità se non sono già in cache
      if (!itemUnits[itemId]) {
        const units = await fetchItemUnits(itemId);
        setItemUnits(prev => ({
          ...prev,
          [itemId]: units
        }));
      }
    }
    setExpandedItems(newExpanded);
  };

  // Get status color class
  const getStatusColor = (status) => {
    switch (status) {
      case 'disponibile':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'in_prestito':
        return 'bg-teal-100 text-teal-800 border-teal-200';
      case 'in_riparazione':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'perso':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  // Get status text
  const getStatusText = (status) => {
    switch (status) {
      case 'disponibile':
        return 'Disponibile';
      case 'in_prestito':
        return 'In Prestito';
      case 'in_riparazione':
        return 'In Segnalazione';
      case 'perso':
        return 'Perso';
      default:
        return status;
    }
  };

  // Handle edit item
  const handleEditItem = (item) => {
    setEditingItem(item);
 };

 // Handle delete item
 const handleDeleteItem = async (itemId) => {
    if (!window.confirm('Sei sicuro di voler eliminare questo articolo?')) return;

 try {
      const response = await fetch(withCatalogType(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/${itemId}`), {
 method: 'DELETE',
 headers: {
 'Authorization': `Bearer ${token}`
 }
 });

 if (!response.ok) {
        const errorData = await response.json();
        // Mostra modal di avviso invece di errore generico
        setDeleteWarningMessage(errorData.error || 'Errore nell\'eliminazione');
        setShowDeleteWarningModal(true);
        return;
      }

      await fetchInventory();
    } catch (err) {
      setDeleteWarningMessage(err.message);
      setShowDeleteWarningModal(true);
    }
  };

  // Handle export
  const handleExport = async () => {
    try {
      await exportInventoryToExcel(token, catalogType);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle import
  const handleImportExcel = async (file) => {
    if (!file) return;
    try {
      setImportLoading(true);
      setError(null);
      const result = await importInventoryFromExcel(file, token, catalogType);
      console.log('Import result:', result);
      await fetchInventory();
      alert(`Import completato: ${result.success}/${result.total} elementi processati`);
      if (result.errors && result.errors.length > 0) {
        console.warn('Import errors:', result.errors);
        alert(`Errori durante l'import:\n${result.errors.join('\n')}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setImportLoading(false);
      if (importFileInputRef.current) importFileInputRef.current.value = '';
    }
  };

  const handleImportClick = () => importFileInputRef.current?.click();
  const onImportFileChange = (e) => { const f = e.target.files?.[0]; if (f) handleImportExcel(f); };

  // Handle template
  const handleTemplate = async () => {
    try {
      await generateInventoryTemplate(token, catalogType);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle add category
  const handleAddCategory = async () => {
    if (!newCategory.nome.trim()) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/categorie-semplici`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newCategory)
      });

      if (!response.ok) throw new Error('Errore nella creazione categoria');

      setNewCategory({ nome: '' });
      await fetchCategories();
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle delete category
  const handleDeleteCategory = (categoryId) => {
    // Trova la categoria da eliminare
    const category = categories.find(cat => cat.id === categoryId);
    if (!category) return;

    // Controlla se la categoria è in uso
    const itemsUsing = inventory.filter(item => 
      item.categoria_id === categoryId || 
      item.categoria_nome === category.nome
    );

    setCategoryToDelete(category);
    setItemsUsingCategory(itemsUsing);
    setShowDeleteCategoryModal(true);
  };

  // Confirm delete category
  const confirmDeleteCategory = async () => {
    if (!categoryToDelete) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/categorie-semplici/${categoryToDelete.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) throw new Error('Errore nell\'eliminazione categoria');

      await fetchCategories();
      await fetchInventory(); // Ricarica l'inventario per aggiornare i settori
      
      // Chiudi il modal
      setShowDeleteCategoryModal(false);
      setCategoryToDelete(null);
      setItemsUsingCategory([]);
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle edit category
  const handleEditCategory = (category) => {
    setEditingCategory(category);
    setEditCategoryName(category.nome);
  };

  // Cancel edit category
  const cancelEditCategory = () => {
    setEditingCategory(null);
    setEditCategoryName('');
  };

  // Save edited category
  const saveEditCategory = async () => {
    if (!editingCategory || !editCategoryName.trim()) return;
    
    try {
      const response = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/categorie-semplici/${editingCategory.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ nome: editCategoryName.trim() })
      });

      if (!response.ok) throw new Error('Errore nella modifica categoria');

      await fetchCategories();
      await fetchInventory(); // Ricarica l'inventario per aggiornare i settori
      
      // Reset editing state
      setEditingCategory(null);
      setEditCategoryName('');
    } catch (err) {
      setError(err.message);
    }
  };

  // Handle apply filters
  const handleApplyFilters = (filters) => {
    setCurrentFilters(filters);
    // Apply filters logic here
  };

  // Handle save filter
  const handleSaveFilter = (filterName, filters) => {
    const newFilter = { id: Date.now(), name: filterName, filters };
    setSavedFilters([...savedFilters, newFilter]);
  };

  // Handle delete filter
  const handleDeleteFilter = (filterId) => {
    setSavedFilters(savedFilters.filter(f => f.id !== filterId));
  };

 if (loading) {
 return <TableSkeleton rows={10} cols={8} />;
 }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex items-center">
          <AlertCircle className="w-5 h-5 text-red-500 mr-3" />
          <p className="text-red-800 ">{error}</p>
        </div>
 </div>
 );
 }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8 mx-4 sm:mx-6 lg:mx-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{currentCatalog.title}</h1>
            <p className="text-gray-600 text-lg">{currentCatalog.subtitle}</p>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="px-4 sm:px-6 lg:px-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Totale Articoli</p>
                <p className="text-3xl font-bold text-gray-900">{inventory.length}</p>
                <p className="text-sm text-gray-500">Elenco libri completo</p>
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Materiali Totali</p>
                <p className="text-3xl font-bold text-gray-900">
                  {inventory.reduce((total, item) => total + (item.quantita_totale || 0), 0)}
                </p>
                <p className="text-sm text-gray-500">Unità disponibili</p>
              </div>
              <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-teal-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">In Segnalazione</p>
                <p className="text-3xl font-bold text-gray-900">
                  {inventory.filter(item => item.stato_effettivo === 'in_riparazione').length}
                </p>
                <p className="text-sm text-gray-500">Articoli in manutenzione</p>
              </div>
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-6 h-6 text-orange-600" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        {/* Action Bar */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
            <div className="flex-1">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentCatalog.title}</h2>
              <p className="text-gray-600 text-lg">{currentCatalog.subtitle}</p>
            </div>
            
            <div className="flex flex-wrap gap-4 items-center">
              <button
                onClick={() => setShowAddModal(true)}
                className="group bg-gradient-to-r from-teal-500 to-teal-600 text-white px-6 py-3 rounded-xl font-medium hover:from-teal-600 hover:to-teal-700 hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center"
              >
                <Plus className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                <span>{currentCatalog.newItemLabel}</span>
              </button>
              
              <button
                onClick={() => setShowCategoryManager(true)}
                className="group bg-white text-gray-700 px-6 py-3 rounded-xl font-medium border border-gray-300 hover:bg-gray-50 hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center"
              >
                <Tag className="w-5 h-5 mr-2 group-hover:scale-110 transition-transform duration-300" />
                <span>Gestisci Settori</span>
              </button>

              <input
                ref={importFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={onImportFileChange}
                className="hidden"
              />

              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowExportImportMenu(!showExportImportMenu)}
                  className="group bg-white text-gray-700 px-6 py-3 rounded-xl font-medium border border-gray-300 hover:bg-gray-50 hover:shadow-lg transition-all duration-300 hover:scale-105 flex items-center"
                  title="Esporta o importa catalogo"
                  aria-haspopup="true"
                  aria-expanded={showExportImportMenu}
                >
                  <MoreVertical className="w-5 h-5" />
                </button>
                {showExportImportMenu && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setShowExportImportMenu(false)} aria-hidden="true" />
                    <div className="absolute right-0 mt-1 w-52 bg-white border border-gray-200 rounded-xl shadow-lg py-1 z-20">
                      <button
                        type="button"
                        onClick={() => { setShowExportImportMenu(false); handleExport(); }}
                        disabled={exportLoading}
                        className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60"
                      >
                        {exportLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Download className="w-5 h-5" />}
                        <span>Esporta catalogo</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => { setShowExportImportMenu(false); handleImportClick(); }}
                        disabled={importLoading}
                        className="w-full px-4 py-3 text-left text-gray-700 hover:bg-gray-50 flex items-center gap-2 disabled:opacity-60"
                      >
                        {importLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />}
                        <span>Importa catalogo</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
              
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-end gap-6">
            {/* Search */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-2">Cerca elementi</label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Cerca per titolo, autore, casa editrice, ID..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-12 pr-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200"
                />
              </div>
            </div>

            {/* Category Filter - Only for Admin */}
            {isAdmin && (
              <div className="w-full lg:w-64">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filtra per Categoria</label>
                <div className="relative">
                  <button
                    onClick={() => {
                      setShowCategoryDropdown(!showCategoryDropdown);
                      setShowLocationDropdown(false); // Chiudi location dropdown se aperto
                    }}
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-white text-left flex items-center justify-between hover:bg-gray-50"
                  >
                    <span className={selectedCategoryFilter ? 'text-gray-900' : 'text-gray-500'}>
                      {selectedCategoryFilter || 'Tutti i settori'}
                    </span>
                    <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {showCategoryDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-auto">
                      <div className="py-1">
                        <button
                          onClick={() => {
                            setSelectedCategoryFilter('');
                            setShowCategoryDropdown(false);
                          }}
                          className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors duration-200 flex items-center justify-between ${
                            !selectedCategoryFilter ? 'bg-teal-50 text-teal-700' : 'text-gray-900'
                          }`}
                        >
                          <span>Tutti i settori</span>
                          {!selectedCategoryFilter && (
                            <Check className="w-4 h-4 text-teal-600" />
                          )}
                        </button>
                        {categories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              setSelectedCategoryFilter(cat.nome);
                              setShowCategoryDropdown(false);
                            }}
                            className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors duration-200 flex items-center justify-between ${
                              selectedCategoryFilter === cat.nome ? 'bg-teal-50 text-teal-700' : 'text-gray-900'
                            }`}
                          >
                            <span>{cat.nome}</span>
                            {selectedCategoryFilter === cat.nome && (
                              <Check className="w-4 h-4 text-teal-600" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Location Filter */}
            <div className="w-full lg:w-64">
              <label className="block text-sm font-medium text-gray-700 mb-2">Filtra per Posizione</label>
              <div className="relative">
                <button
                  onClick={() => {
                    setShowLocationDropdown(!showLocationDropdown);
                    setShowCategoryDropdown(false); // Chiudi category dropdown se aperto
                  }}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-white text-left flex items-center justify-between hover:bg-gray-50"
                >
                  <span className={selectedLocationFilter ? 'text-gray-900' : 'text-gray-500'}>
                    {selectedLocationFilter || 'Tutte le posizioni'}
                  </span>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform duration-200 ${showLocationDropdown ? 'rotate-180' : ''}`} />
                </button>
                
                {showLocationDropdown && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-xl shadow-lg max-h-60 overflow-auto">
                    <div className="py-1">
                      <button
                        onClick={() => {
                          setSelectedLocationFilter('');
                          setShowLocationDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors duration-200 flex items-center justify-between ${
                          !selectedLocationFilter ? 'bg-teal-50 text-teal-700' : 'text-gray-900'
                        }`}
                      >
                        <span>Tutte le posizioni</span>
                        {!selectedLocationFilter && (
                          <Check className="w-4 h-4 text-teal-600" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLocationFilter('Piazza di Badia a Ripoli');
                          setShowLocationDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors duration-200 flex items-center justify-between ${
                          selectedLocationFilter === 'Piazza di Badia a Ripoli' ? 'bg-teal-50 text-teal-700' : 'text-gray-900'
                        }`}
                      >
                        <span>Piazza di Badia a Ripoli</span>
                        {selectedLocationFilter === 'Piazza di Badia a Ripoli' && (
                          <Check className="w-4 h-4 text-teal-600" />
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setSelectedLocationFilter("Via de' Vecchietti");
                          setShowLocationDropdown(false);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-teal-50 transition-colors duration-200 flex items-center justify-between ${
                          selectedLocationFilter === "Via de' Vecchietti" ? 'bg-teal-50 text-teal-700' : 'text-gray-900'
                        }`}
                      >
                        <span>Via de' Vecchietti</span>
                        {selectedLocationFilter === "Via de' Vecchietti" && (
                          <Check className="w-4 h-4 text-teal-600" />
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Sort Order - Ordina per ID */}
            <div className="w-full lg:w-auto flex items-end">
              <button
                onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                className="px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:border-teal-500 transition-all duration-200 bg-white hover:bg-gray-50 flex items-center justify-center"
                title={sortOrder === 'asc' ? 'Ordina decrescente (103 → 101)' : 'Ordina crescente (101 → 103)'}
              >
                {sortOrder === 'asc' ? (
                  <ArrowUp className="w-5 h-5 text-gray-600" />
                ) : (
                  <ArrowDown className="w-5 h-5 text-gray-600" />
                )}
              </button>
            </div>

            {/* Clear Filters Button - Only show if filters are active */}
            {(searchTerm || selectedCategoryFilter || selectedLocationFilter) && (
              <div className="flex items-end">
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategoryFilter('');
                    setSelectedLocationFilter('');
                  }}
                  className="px-4 py-3 text-gray-600 hover:text-gray-800 border border-gray-300 rounded-xl hover:bg-gray-50 transition-all duration-200 flex items-center gap-2 hover:scale-105"
                  title="Cancella filtri"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden sm:inline">Cancella</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Results Counter */}
        {(searchTerm || selectedCategoryFilter || selectedLocationFilter) && (
          <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Filter className="w-5 h-5 text-teal-600 mr-2" />
                <span className="text-teal-800 font-medium">
                  {filteredInventory.length} {filteredInventory.length === 1 ? 'risultato trovato' : 'risultati trovati'}
                  {selectedCategoryFilter && ` nella categoria "${selectedCategoryFilter}"`}
                  {selectedLocationFilter && ` nella posizione "${selectedLocationFilter}"`}
                </span>
              </div>
              {filteredInventory.length === 0 && (
                <span className="text-teal-600 text-sm">Prova a modificare i filtri</span>
              )}
            </div>
          </div>
        )}

        {/* Inventory Cards */}
        <div className="space-y-4">
          {filteredInventory.length === 0 ? (
            <div className="bg-gray-50 rounded-xl p-12 text-center">
              <Package className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">Nessun articolo trovato</h3>
              <p className="text-gray-600 mb-4">
                {searchTerm && (selectedCategoryFilter || selectedLocationFilter)
                  ? `Nessun articolo corrisponde alla ricerca "${searchTerm}"${selectedCategoryFilter ? ` nella categoria "${selectedCategoryFilter}"` : ''}${selectedLocationFilter ? ` nella posizione "${selectedLocationFilter}"` : ''}`
                  : searchTerm 
                    ? `Nessun articolo corrisponde alla ricerca "${searchTerm}"`
                    : selectedCategoryFilter || selectedLocationFilter
                      ? `Nessun articolo${selectedCategoryFilter ? ` nella categoria "${selectedCategoryFilter}"` : ''}${selectedLocationFilter ? ` nella posizione "${selectedLocationFilter}"` : ''}`
                      : "Nessun articolo disponibile"
                }
              </p>
              {(searchTerm || selectedCategoryFilter || selectedLocationFilter) && (
                <button
                  onClick={() => {
                    setSearchTerm('');
                    setSelectedCategoryFilter('');
                    setSelectedLocationFilter('');
                  }}
                  className="btn-secondary"
                >
                  Cancella filtri
                </button>
              )}
            </div>
          ) : (
            filteredInventory.map((item) => (
            <div key={item.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow duration-200">
              {/* Card Header */}
              <div className="p-6 border-b border-gray-100">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
 <div className="flex items-center">
 {item.hasMultipleUnits && (
 <button
 onClick={() => toggleExpanded(item.id)}
                          className="mr-3 p-1 hover:bg-gray-100 rounded transition-colors"
 title={expandedItems.has(item.id) ? "Chiudi dettagli" : "Mostra dettagli"}
 >
 <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${expandedItems.has(item.id) ? 'rotate-90' : ''}`} />
 </button>
 )}
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
 {item.nome}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          {(item.unita_codici && item.unita_codici.length > 0) ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                              ID: {item.unita_codici.join(', ')}
                            </span>
                          ) : item.id != null ? (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                              ID: {item.id}
                            </span>
                          ) : null}
                          {item.hasMultipleUnits && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-teal-100 text-teal-800">
                              {item.quantita_totale} unità
                            </span>
                          )}
                        </div>
                      </div>
 </div>
                  {/* Dati pubblicazione */}
                  {(item.luogo_pubblicazione || item.data_pubblicazione || item.casa_editrice || item.relatore || item.anno_accademico || item.fondo || item.settore || item.location) && (
                    <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
                      {item.location && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Posizione:</span> {item.location}</p>
                      )}
                      {item.data_pubblicazione && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Anno:</span> {item.data_pubblicazione}</p>
                      )}
                      {catalogType !== 'tesi' && item.casa_editrice && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Casa Editrice:</span> {item.casa_editrice}</p>
                      )}
                      {catalogType === 'tesi' && item.relatore && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Relatore:</span> {item.relatore}</p>
                      )}
                      {catalogType === 'tesi' && item.anno_accademico && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Anno accademico:</span> {item.anno_accademico}</p>
                      )}
                      {item.fondo && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Fondo:</span> {item.fondo}</p>
                      )}
                      {item.luogo_pubblicazione && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Luogo:</span> {item.luogo_pubblicazione}</p>
                      )}
                      {item.settore && (
                        <p className="text-sm text-gray-600"><span className="font-medium">Settore:</span> {item.settore}</p>
                      )}
                    </div>
                  )}
 </div>
                  
                  {/* Status Badge */}
         <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
           item.tipo_prestito === 'solo_interno' 
             ? 'bg-orange-100 text-orange-800 border-orange-200' 
             : item.tipo_prestito === 'solo_esterno'
             ? 'bg-orange-100 text-orange-800 border-orange-200'
             : item.tipo_prestito === 'entrambi'
             ? 'bg-orange-100 text-orange-800 border-orange-200'
             : getStatusColor(item.stato_effettivo)
         }`}>
           {item.tipo_prestito === 'solo_interno' 
             ? 'Solo Interno' 
             : item.tipo_prestito === 'solo_esterno'
             ? 'Solo Esterno'
             : item.tipo_prestito === 'entrambi'
             ? 'Interno ed Esterno'
             : getStatusText(item.stato_effettivo)}
         </span>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {/* Settore (ex Categoria) */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Settore</label>
                    <p className="text-sm text-gray-900 mt-1">
                      {item.categoria_figlia || 
                       (item.categoria_nome ? item.categoria_nome.split(' - ')[1] : null) || 
                       'Nessuna'}
                    </p>
                  </div>

                  {/* Fondo */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Fondo</label>
                    <p className="text-sm text-gray-900 mt-1">{item.fondo || 'N/A'}</p>
                  </div>

                  {/* Quantity */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Quantità</label>
                    <p className="text-lg font-semibold text-gray-900 mt-1">{item.quantita_totale}</p>
                  </div>

                  {/* Shelf */}
                  <div>
                    <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scaffale</label>
                    <p className="text-sm text-gray-900 mt-1">{item.posizione || 'N/A'}</p>
                  </div>

                </div>
              </div>

              {/* Card Footer - Actions */}
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-100">
                <div className="flex items-center justify-between">
 <div className="flex space-x-2">
 <button
 onClick={() => setQrCodeItem(item)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500"
 title="Genera QR Code"
 >
                      <QrCode className="w-4 h-4 mr-1" />
                      QR Code
                      </button>
                      <button
                        onClick={() => handleEditItem(item)}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-yellow-500"
 title="Modifica articolo"
 >
                      <Pencil className="w-4 h-4 mr-1" />
                      Modifica
 </button>
                  </div>
 <button
 onClick={() => handleDeleteItem(item.id)}
                    className="text-red-600 hover:text-red-900 p-2 rounded hover:bg-red-50 transition-colors"
 title="Elimina articolo"
 >
 <Trash2 className="w-4 h-4" />
 </button>
 </div>
              </div>

              {/* Expanded Units Section */}
              {item.hasMultipleUnits && expandedItems.has(item.id) && (
                <div className="border-t border-gray-200 bg-gray-50 p-6">
                  <h4 className="text-sm font-medium text-gray-700 mb-4">
                    Unità individuali ({itemUnits[item.id]?.length || 0}):
                  </h4>
                  {!itemUnits[item.id] ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-teal-600"></div>
                      <span className="ml-2 text-gray-600">Caricamento unità...</span>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-3 overflow-x-auto pb-2">
{itemUnits[item.id]?.map((unit, index) => {
                      // Determina il colore della pillola in base allo stato
                      const getStatusPillColor = (stato) => {
                        switch (stato) {
                          case 'disponibile':
                            return 'bg-teal-100 text-teal-800 border-teal-200';
                          case 'prestato':
                            return 'bg-teal-100 text-teal-800 border-teal-200';
                          case 'riservato':
                            return 'bg-yellow-100 text-yellow-800 border-yellow-200';
                          case 'in_riparazione':
                            return 'bg-orange-100 text-orange-800 border-orange-200';
                          case 'perso':
                            return 'bg-red-100 text-red-800 border-red-200';
                          default:
                            return 'bg-gray-100 text-gray-800 border-gray-200';
                        }
                      };

                      const getStatusText = (stato) => {
                        switch (stato) {
                          case 'disponibile':
                            return 'Disponibile';
                          case 'prestato':
                            return 'In Prestito';
                          case 'riservato':
                            return 'Riservato';
                          case 'in_riparazione':
                            return 'In Segnalazione';
                          case 'perso':
                            return 'Perso';
                          default:
                            return stato || 'Disponibile';
                        }
                      };

                      return (
                        <div 
                          key={unit.id} 
                          className={`bg-white p-3 rounded-lg border border-gray-200 hover:shadow-sm transition-shadow flex-shrink-0 min-w-[120px] ${
                            unit.stato === 'prestato' ? 'cursor-pointer hover:border-teal-500' : ''
                          }`}
                          onClick={() => handleUnitClick(unit)}
                        >
                          <div className="text-center">
                            <div className="text-xs font-medium text-gray-900 mb-2 truncate" title={unit.codice_univoco || unit.id}>
                              {unit.codice_univoco || unit.id}
                              {unit.stato === 'prestato' && (
                                <Info className="w-3 h-3 inline-block ml-1 text-teal-500" />
                              )}
                            </div>
                            <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium border ${getStatusPillColor(unit.stato)}`}>
                              {getStatusText(unit.stato)}
                            </span>
                            {unit.note && (
                              <div className="text-xs text-gray-500 mt-2 truncate" title={unit.note}>
                                {unit.note}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))
          )}
        </div>

        {/* QR Code Modal */}
        {qrCodeItem && (
          <div className="modal-overlay" onClick={() => setQrCodeItem(null)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="text-xl font-bold text-primary">QR Code - {qrCodeItem.nome}</h2>
                <button
                  onClick={() => setQrCodeItem(null)}
                  className="text-muted hover:text-primary"
                >
                  <X className="icon w-5 h-5" />
                </button>
 </div>
              <div className="modal-body">
                <QRCodeGenerator item={qrCodeItem} embedded={true} />
 </div>
 </div>
 </div>
        )}

        {/* Category Manager Modal */}
        {showCategoryManager && (
          <div className="modal-overlay" onClick={() => setShowCategoryManager(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h2 className="text-xl font-bold text-primary">Gestione Settori</h2>
 <button
                  onClick={() => setShowCategoryManager(false)}
                  className="text-muted hover:text-primary"
 >
                  <X className="icon w-5 h-5" />
 </button>
 </div>
              <div className="modal-body">
                <div className="space-y-4">
                  <div>
                    <label className="form-label">Nuovo Settore</label>
                    <input
                      type="text"
                      value={newCategory.nome}
                      onChange={(e) => setNewCategory({...newCategory, nome: e.target.value})}
                      className="input-field"
                      placeholder="Nome settore..."
                    />
                    <button
                      onClick={handleAddCategory}
                      className="btn-primary mt-2"
                    >
                      Aggiungi Settore
                    </button>
 </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-3">Settori Esistenti</h3>
                    <div className="space-y-2">
                      {categories.map(cat => (
                        <div key={cat.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                          {editingCategory && editingCategory.id === cat.id ? (
                            <div className="flex-1 flex items-center space-x-2">
                              <input
                                type="text"
                                value={editCategoryName}
                                onChange={(e) => setEditCategoryName(e.target.value)}
                                className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                                placeholder="Nome categoria..."
                                autoFocus
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') saveEditCategory();
                                  if (e.key === 'Escape') cancelEditCategory();
                                }}
                              />
                              <button
                                onClick={saveEditCategory}
                                className="text-teal-600 hover:text-teal-800 p-1"
                                title="Salva"
                              >
                                <Check className="w-4 h-4" />
                              </button>
                              <button
                                onClick={cancelEditCategory}
                                className="text-gray-600 hover:text-gray-800 p-1"
                                title="Annulla"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <>
                              <span className="text-sm font-medium">{cat.nome}</span>
                              <div className="flex items-center space-x-2">
                                <button
                                  onClick={() => handleEditCategory(cat)}
                                  className="text-teal-600 hover:text-teal-800 p-1"
                                  title="Modifica categoria"
                                >
                                  <Pencil className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDeleteCategory(cat.id)}
                                  className="text-red-600 hover:text-red-800 p-1"
                                  title="Elimina categoria"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
 </div>
 </div>
 )}

        {/* Advanced Filters Modal */}
 {showAdvancedFilters && (
 <AdvancedFilters
 isOpen={showAdvancedFilters}
 onClose={() => setShowAdvancedFilters(false)}
            onApply={handleApplyFilters}
 savedFilters={savedFilters}
            onSaveFilter={handleSaveFilter}
            onDeleteFilter={handleDeleteFilter}
 categories={categories}
 courses={courses}
 />
 )}

        {/* Step Inventory Modal */}
        <StepInventoryModal
          isOpen={showAddModal || !!editingItem}
          onClose={() => {
            setShowAddModal(false);
            setEditingItem(null);
          }}
          onSuccess={() => {
            fetchInventory();
            setShowAddModal(false);
            setEditingItem(null);
          }}
          editingItem={editingItem}
          categories={categories}
          courses={courses}
          catalogType={catalogType}
        />

        {/* Unit Loan Details Modal */}
        {showUnitDetailModal && selectedUnit && unitLoanDetails && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-900">Dettagli Prestito</h2>
                <button
                  onClick={() => {
                    setShowUnitDetailModal(false);
                    setSelectedUnit(null);
                    setUnitLoanDetails(null);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Unità</label>
                    <p className="text-lg font-semibold text-gray-900">{selectedUnit.codice_univoco}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Chi ha preso</label>
                    <p className="text-gray-900">{unitLoanDetails.chi}</p>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Email</label>
                    <p className="text-gray-600">{unitLoanDetails.utente_email}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data Uscita</label>
                      <p className="text-gray-900">{new Date(unitLoanDetails.data_uscita).toLocaleDateString('it-IT')}</p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Data Rientro</label>
                      <p className="text-gray-900">{new Date(unitLoanDetails.data_rientro).toLocaleDateString('it-IT')}</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Stato</label>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      unitLoanDetails.stato === 'attivo' ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-800'
                    }`}>
                      {unitLoanDetails.stato === 'attivo' ? 'Attivo' : 'Restituito'}
                    </span>
                  </div>
                  
                  {unitLoanDetails.note && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700">Note</label>
                      <p className="text-gray-600">{unitLoanDetails.note}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Category Confirmation Modal - Outside of other modals */}
        {showDeleteCategoryModal && categoryToDelete && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4" style={{zIndex: 999999}}>
            <div className="bg-white rounded-lg shadow-xl max-w-lg w-full" style={{zIndex: 1000000}}>
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <div className="flex items-center">
                  <div className="flex-shrink-0 w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6 text-red-600" />
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-semibold text-gray-900">Elimina Categoria</h3>
                    <p className="text-sm text-gray-600">Questa azione non può essere annullata</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowDeleteCategoryModal(false);
                    setCategoryToDelete(null);
                    setItemsUsingCategory([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>
              
              <div className="p-6">
                {itemsUsingCategory.length > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start">
                        <div className="flex-shrink-0">
                          <AlertTriangle className="w-5 h-5 text-amber-400" />
                        </div>
                        <div className="ml-3">
                          <h4 className="text-sm font-medium text-amber-800">Attenzione</h4>
                          <p className="text-sm text-amber-700 mt-1">
                            Il settore "{categoryToDelete.nome}" è utilizzato da {itemsUsingCategory.length} elemento/i del catalogo.
                            Eliminando questo settore, tutti gli elementi verranno spostati in "Nessun settore".
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div>
                      <h5 className="text-sm font-medium text-gray-900 mb-2">Elementi che utilizzano questa categoria:</h5>
                      <div className="bg-gray-50 rounded-lg p-3 max-h-32 overflow-y-auto">
                        <ul className="space-y-1">
                          {itemsUsingCategory.map(item => (
                            <li key={item.id} className="text-sm text-gray-700">
                              • {item.nome}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-600">
                    Sei sicuro di voler eliminare la categoria "{categoryToDelete.nome}"?
                  </p>
                )}
                
                <div className="flex justify-end space-x-3 mt-6">
                  <button
                    onClick={() => {
                      setShowDeleteCategoryModal(false);
                      setCategoryToDelete(null);
                      setItemsUsingCategory([]);
                    }}
                    className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    onClick={confirmDeleteCategory}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    {itemsUsingCategory.length > 0 ? 'Elimina e Sposta' : 'Elimina'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal di Avviso Eliminazione */}
        {showDeleteWarningModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
              <div className="p-6">
                <div className="flex items-center mb-4">
                  <div className="flex-shrink-0">
                    <AlertTriangle className="w-8 h-8 text-red-600" />
                  </div>
                  <div className="ml-3">
                    <h3 className="text-lg font-medium text-gray-900">Impossibile Eliminare</h3>
                  </div>
                </div>
                
                <div className="mb-6">
                  <p className="text-sm text-gray-600">{deleteWarningMessage}</p>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={() => {
                      setShowDeleteWarningModal(false);
                      setDeleteWarningMessage('');
                    }}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
                  >
                    Ho Capito
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
 </div>
 );
};

export default Inventory;