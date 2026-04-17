import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import NewRequestModal from './NewRequestModal';
import { ItemListSkeleton } from './SkeletonLoader';

const MyLoans = () => {
  const [loans, setLoans] = useState([]);
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showNewRequestModal, setShowNewRequestModal] = useState(false);
  const [showCatalogTypePicker, setShowCatalogTypePicker] = useState(false);
  const [selectedCatalogType, setSelectedCatalogType] = useState('libri');
  const [activeTab, setActiveTab] = useState('active');
  const { token, user } = useAuth();

  // Fetch user's loans and requests
  const fetchData = async () => {
    try {
      setLoading(true);
      const [loansRes, requestsRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/prestiti/mie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/richieste/mie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      if (!loansRes.ok) throw new Error('Errore nel caricamento prestiti');
      if (!requestsRes.ok) throw new Error('Errore nel caricamento richieste');

      const [loansData, requestsData] = await Promise.all([
        loansRes.json(),
        requestsRes.json()
      ]);

      setLoans(loansData);
      setRequests(requestsData);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'attivo': return 'bg-teal-100 text-teal-800';
      case 'scaduto': return 'bg-red-100 text-red-800';
      case 'restituito': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status) => {
    switch (status) {
      case 'attivo': return 'Attivo';
      case 'scaduto': return 'Scaduto';
      case 'restituito': return 'Restituito';
      default: return status;
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Non specificata';
    try {
      return new Date(dateString).toLocaleDateString('it-IT');
    } catch (error) {
      return 'Data non valida';
    }
  };

  if (loading) {
    return <ItemListSkeleton count={4} />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">I Miei Prestiti</h1>
            <p className="text-gray-600">Gestisci i tuoi prestiti attivi e richiedi nuovi articoli</p>
          </div>
          <button
            onClick={() => setShowCatalogTypePicker(true)}
            className="btn-primary hover-lift flex items-center space-x-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            <span>Nuova Richiesta</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-teal-100 rounded-lg">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Prestiti Attivi</p>
              <p className="text-2xl font-bold text-gray-900">
                {loans.filter(loan => loan.stato === 'attivo').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-teal-100 rounded-lg">
              <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Prestiti Completati</p>
              <p className="text-2xl font-bold text-gray-900">
                {loans.filter(loan => loan.stato === 'restituito').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-yellow-100 rounded-lg">
              <svg className="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">In Approvazione</p>
              <p className="text-2xl font-bold text-gray-900">
                {requests.filter(req => req.stato === 'in_attesa').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <div className="p-2 bg-red-100 rounded-lg">
              <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Rifiutati</p>
              <p className="text-2xl font-bold text-gray-900">
                {requests.filter(req => req.stato === 'rifiutata').length}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6">
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'active'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Prestiti Attivi ({loans.filter(loan => loan.stato === 'attivo').length})
            </button>
            <button
              onClick={() => setActiveTab('completed')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'completed'
                  ? 'border-teal-500 text-teal-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Prestiti Completati ({loans.filter(loan => loan.stato === 'restituito').length})
            </button>
            <button
              onClick={() => setActiveTab('pending')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'pending'
                  ? 'border-yellow-500 text-yellow-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              In Approvazione ({requests.filter(req => req.stato === 'in_attesa').length})
            </button>
            <button
              onClick={() => setActiveTab('rejected')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'rejected'
                  ? 'border-red-500 text-red-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Rifiutati ({requests.filter(req => req.stato === 'rifiutata').length})
            </button>
          </nav>
        </div>
      </div>

      {/* Content based on active tab */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tab Content */}
        {activeTab === 'active' && (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Prestiti Attivi</h2>
            </div>
            {loans.filter(loan => loan.stato === 'attivo').length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun prestito attivo</h3>
                <p className="mt-1 text-sm text-gray-500">Non hai prestiti attivi al momento.</p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCatalogTypePicker(true)}
                    className="btn-primary hover-lift"
                  >
                    Crea una nuova richiesta
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {loans.filter(loan => loan.stato === 'attivo').map((loan) => (
                  <div key={loan.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-medium text-gray-900">{loan.articolo_nome}</h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(loan.stato)}`}>
                            {getStatusText(loan.stato)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Uscita: {formatDate(loan.data_uscita)}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Rientro: {formatDate(loan.data_rientro)}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span>Quantità: {loan.quantita}</span>
                          </div>
                        </div>
                        {loan.note && (
                          <p className="mt-2 text-sm text-gray-600">{loan.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'completed' && (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Prestiti Completati</h2>
            </div>
            {loans.filter(loan => loan.stato === 'restituito').length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessun prestito completato</h3>
                <p className="mt-1 text-sm text-gray-500">Non hai ancora prestiti approvati o completati.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {loans.filter(loan => loan.stato === 'restituito').map((loan) => (
                  <div key={loan.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-medium text-gray-900">{loan.articolo_nome}</h3>
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(loan.stato)}`}>
                            {getStatusText(loan.stato)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Uscita: {formatDate(loan.data_uscita)}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Rientro: {formatDate(loan.data_rientro)}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                            </svg>
                            <span>Quantità: {loan.quantita}</span>
                          </div>
                        </div>
                        {loan.note && (
                          <p className="mt-2 text-sm text-gray-600">{loan.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'pending' && (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Richieste in Approvazione</h2>
            </div>
            {requests.filter(req => req.stato === 'in_attesa').length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna richiesta in attesa</h3>
                <p className="mt-1 text-sm text-gray-500">Non hai richieste in attesa di approvazione.</p>
                <div className="mt-6">
                  <button
                    onClick={() => setShowCatalogTypePicker(true)}
                    className="btn-primary hover-lift"
                  >
                    Crea una nuova richiesta
                  </button>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {requests.filter(req => req.stato === 'in_attesa').map((request) => (
                  <div key={request.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-medium text-gray-900">{request.oggetto_nome || request.articolo_nome}</h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                            In Attesa
                          </span>
                        </div>
                        <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Richiesta: {formatDate(request.created_at)}</span>
                          </div>
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Dal: {formatDate(request.dal)} - Al: {formatDate(request.al)}</span>
                          </div>
                        </div>
                        {request.note && (
                          <p className="mt-2 text-sm text-gray-600">{request.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'rejected' && (
          <>
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Richieste Rifiutate</h2>
            </div>
            {requests.filter(req => req.stato === 'rifiutata').length === 0 ? (
              <div className="text-center py-12">
                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <h3 className="mt-2 text-sm font-medium text-gray-900">Nessuna richiesta rifiutata</h3>
                <p className="mt-1 text-sm text-gray-500">Non hai richieste che sono state rifiutate.</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-200">
                {requests.filter(req => req.stato === 'rifiutata').map((request) => (
                  <div key={request.id} className="px-6 py-4 hover:bg-gray-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3">
                          <h3 className="text-sm font-medium text-gray-900">{request.oggetto_nome || request.articolo_nome}</h3>
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Rifiutata
                          </span>
                        </div>
                        <div className="mt-2 flex items-center space-x-6 text-sm text-gray-500">
                          <div className="flex items-center">
                            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                            </svg>
                            <span>Richiesta: {formatDate(request.created_at)}</span>
                          </div>
                          {request.motivo_rifiuto && (
                            <div className="flex items-center">
                              <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span>Motivo: {request.motivo_rifiuto}</span>
                            </div>
                          )}
                        </div>
                        {request.note && (
                          <p className="mt-2 text-sm text-gray-600">Note: {request.note}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* New Request Modal */}
      {showNewRequestModal && (
        <NewRequestModal
          isOpen={showNewRequestModal}
          onClose={() => setShowNewRequestModal(false)}
          catalogType={selectedCatalogType}
          onSuccess={() => {
            setShowNewRequestModal(false);
            fetchData();
          }}
        />
      )}

      {showCatalogTypePicker && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-xl w-full">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">Seleziona tipo di materiale</h3>
              <button
                onClick={() => setShowCatalogTypePicker(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogType('libri');
                  setShowCatalogTypePicker(false);
                  setShowNewRequestModal(true);
                }}
                className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
              >
                <p className="font-semibold text-gray-900">Libro</p>
                <p className="text-sm text-gray-600 mt-1">Sezione libri</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogType('tesi');
                  setShowCatalogTypePicker(false);
                  setShowNewRequestModal(true);
                }}
                className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
              >
                <p className="font-semibold text-gray-900">Tesi</p>
                <p className="text-sm text-gray-600 mt-1">Sezione tesi di laurea</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogType('cataloghi');
                  setShowCatalogTypePicker(false);
                  setShowNewRequestModal(true);
                }}
                className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
              >
                <p className="font-semibold text-gray-900">Cataloghi/Riviste</p>
                <p className="text-sm text-gray-600 mt-1">Sezione cataloghi e riviste</p>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MyLoans;
