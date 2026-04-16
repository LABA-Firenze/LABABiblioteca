import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../auth/AuthContext';
import NewRequestModal from './NewRequestModal';
import ReportBugModal from './ReportBugModal';
import { UserDashboardSkeleton } from './SkeletonLoader';

const UserDashboard = () => {
  const [stats, setStats] = useState({
    availableItems: 0,
    myRequests: 0,
    myReports: 0,
    myLoans: 0
  });
  const [recentData, setRecentData] = useState({
    activeLoans: [],
    recentRequests: [],
    recentReports: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [userPenalties, setUserPenalties] = useState({
    strikes: 0,
    isBlocked: false,
    blockedReason: null,
    penalties: []
  });
  const [showQuickRequestModal, setShowQuickRequestModal] = useState(false);
  const [showCatalogTypePicker, setShowCatalogTypePicker] = useState(false);
  const [selectedCatalogType, setSelectedCatalogType] = useState('libri');
  const [showRequestDetailModal, setShowRequestDetailModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReportFaultModal, setShowReportFaultModal] = useState(false);
  const [welcomeSectionDismissed, setWelcomeSectionDismissed] = useState(false);
  const { token, user } = useAuth();

  // Load welcome section dismissed state from localStorage
  useEffect(() => {
    if (user?.id) {
      const dismissed = localStorage.getItem(`welcome_dismissed_${user.id}`);
      if (dismissed === 'true') {
        setWelcomeSectionDismissed(true);
      }
    }
  }, [user?.id]);

  // Hide welcome section if user has active loans
  useEffect(() => {
    if (recentData.activeLoans.length > 0) {
      setWelcomeSectionDismissed(true);
      if (user?.id) {
        localStorage.setItem(`welcome_dismissed_${user.id}`, 'true');
      }
    }
  }, [recentData.activeLoans.length, user?.id]);

  const handleDismissWelcome = () => {
    setWelcomeSectionDismissed(true);
    if (user?.id) {
      localStorage.setItem(`welcome_dismissed_${user.id}`, 'true');
    }
  };

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all data in parallel
      const [inventoryRes, requestsRes, reportsRes, loansRes, penaltiesRes] = await Promise.all([
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/inventario/disponibili`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/richieste/mie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/segnalazioni/mie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/prestiti/mie`, {
          headers: { 'Authorization': `Bearer ${token}` }
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/penalties/user/${user.id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ]);

      // Process inventory data
      if (inventoryRes.ok) {
        const inventoryData = await inventoryRes.json();
        // Conta le UNITÀ disponibili totali, non gli articoli
        // Assicuriamoci che unita_disponibili sia un numero
        const totalAvailableUnits = inventoryData.reduce((total, item) => {
          const unita = Number(item.unita_disponibili) || 0;
          return total + unita;
        }, 0);
        setStats(prev => ({ ...prev, availableItems: totalAvailableUnits }));
      }

      // Process requests data
      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setStats(prev => ({ ...prev, myRequests: requestsData.length }));
        setRecentData(prev => ({ ...prev, recentRequests: requestsData.slice(0, 3) }));
      }

      // Process reports data
      if (reportsRes.ok) {
        const reportsData = await reportsRes.json();
        setStats(prev => ({ ...prev, myReports: reportsData.length }));
        setRecentData(prev => ({ ...prev, recentReports: reportsData.slice(0, 3) }));
      }

      // Process loans data
      if (loansRes.ok) {
        const loansData = await loansRes.json();
        const activeLoans = loansData.filter(loan => loan.stato === 'attivo');
        setStats(prev => ({ ...prev, myLoans: activeLoans.length }));
        setRecentData(prev => ({ ...prev, activeLoans: activeLoans.slice(0, 3) }));
      }

      // Process penalties data
      if (penaltiesRes.ok) {
        const penaltiesData = await penaltiesRes.json();
        setUserPenalties({
          strikes: penaltiesData.userInfo?.penalty_strikes || 0,
          isBlocked: penaltiesData.userInfo?.is_blocked || false,
          blockedReason: penaltiesData.userInfo?.blocked_reason || null,
          penalties: penaltiesData.penalties || []
        });
      }

    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Errore nel caricamento dei dati');
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    // Aspetta che token e user siano disponibili prima di caricare i dati
    if (token && user) {
      fetchData();
    }
  }, [token, user, fetchData]);

  // Helper function to safely format dates
  const formatDate = (dateString) => {
    if (!dateString) return 'Data non specificata';
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Data non valida';
      return date.toLocaleDateString('it-IT');
    } catch (error) {
      return 'Data non valida';
    }
  };

  const handleRequestClick = (request) => {
    setSelectedRequest(request);
    setShowRequestDetailModal(true);
  };

  if (loading) {
    return <UserDashboardSkeleton />;
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Benvenuto, {user?.name} {user?.surname}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard title="Articoli Disponibili" value={stats.availableItems} />
        <StatCard title="Le Mie Richieste" value={stats.myRequests} />
        <StatCard title="Le Mie Segnalazioni" value={stats.myReports} />
        <StatCard title="I Miei Prestiti" value={stats.myLoans} />
      </div>

      {/* Welcome/Info Section for new users */}
      {recentData.activeLoans.length === 0 && !welcomeSectionDismissed && (
        <div className="mb-8 bg-gradient-to-r from-teal-50 to-teal-100 rounded-lg shadow-sm border border-teal-200 p-6 relative">
          <button
            onClick={handleDismissWelcome}
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Chiudi"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-start">
            <div className="flex-shrink-0">
              <svg className="w-8 h-8 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-4 flex-1 pr-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Benvenuto nella Biblioteca LABA!</h3>
              <p className="text-sm text-gray-700 mb-4">
                Inizia a richiedere i libri per il tuo corso. Ecco come funziona:
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="bg-white rounded-lg p-4 border border-teal-100">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm mr-2">1</div>
                    <h4 className="font-semibold text-gray-900">Sfoglia</h4>
                  </div>
                  <p className="text-xs text-gray-600">Vai su "Articoli Disponibili" per vedere libri, cataloghi, riviste, tesi e progetti disponibili per il tuo corso.</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-teal-100">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm mr-2">2</div>
                    <h4 className="font-semibold text-gray-900">Richiedi</h4>
                  </div>
                  <p className="text-xs text-gray-600">Clicca su "Richiedi" per selezionare l'ID specifico e le date di utilizzo.</p>
                </div>
                <div className="bg-white rounded-lg p-4 border border-teal-100">
                  <div className="flex items-center mb-2">
                    <div className="w-8 h-8 bg-teal-100 rounded-full flex items-center justify-center text-teal-600 font-bold text-sm mr-2">3</div>
                    <h4 className="font-semibold text-gray-900">Ritira</h4>
                  </div>
                  <p className="text-xs text-gray-600">Una volta approvata, potrai ritirare il libro presso la Biblioteca.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Azioni Rapide</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => setShowCatalogTypePicker(true)}
            className="btn-primary hover-lift flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
            Nuova Richiesta
          </button>
          <button
            onClick={() => setShowReportFaultModal(true)}
            className="btn-secondary hover-lift flex items-center justify-center"
          >
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            Segnala Problema
          </button>
        </div>
      </div>

      {/* Penalty Warning */}
      {(userPenalties.strikes > 0 || userPenalties.isBlocked) && (
        <div className={`rounded-lg shadow-sm border p-6 mb-8 ${
          userPenalties.isBlocked ? 'bg-red-50 border-red-200' :
          userPenalties.strikes >= 2 ? 'bg-orange-50 border-orange-200' :
          'bg-yellow-50 border-yellow-200'
        }`}>
          <div className="flex items-start">
            <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              userPenalties.isBlocked ? 'bg-red-100' :
              userPenalties.strikes >= 2 ? 'bg-orange-100' :
              'bg-yellow-100'
            }`}>
              <svg className={`w-5 h-5 ${
                userPenalties.isBlocked ? 'text-red-600' :
                userPenalties.strikes >= 2 ? 'text-orange-600' :
                'text-yellow-600'
              }`} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-4 flex-1">
              <h3 className={`text-lg font-semibold ${
                userPenalties.isBlocked ? 'text-red-900' :
                userPenalties.strikes >= 2 ? 'text-orange-900' :
                'text-yellow-900'
              }`}>
                {userPenalties.isBlocked ? '🚫 Account Bloccato' :
                 userPenalties.strikes >= 2 ? '⚠️ Attenzione Penalità' :
                 '⚠️ Penalità Ricevute'}
              </h3>
              <div className={`mt-2 text-sm ${
                userPenalties.isBlocked ? 'text-red-800' :
                userPenalties.strikes >= 2 ? 'text-orange-800' :
                'text-yellow-800'
              }`}>
                {userPenalties.isBlocked ? (
                  <div className="space-y-2">
                    <p className="font-medium">Non puoi effettuare nuove richieste di prestito.</p>
                    <p><strong>Motivo:</strong> {userPenalties.blockedReason}</p>
                    <p><strong>Penalità accumulate:</strong> {userPenalties.strikes} strike</p>
                    <div className="mt-3 p-3 bg-red-100 rounded-lg">
                      <p className="font-medium text-red-900">Per sbloccare il tuo account:</p>
                      <p className="text-red-800">Recati di persona presso l'ufficio amministrativo per discutere della situazione.</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p>Hai accumulato <strong>{userPenalties.strikes} strike</strong> per ritardi nella restituzione.</p>
                    {userPenalties.strikes >= 2 && (
                      <div className="mt-2 p-3 bg-orange-100 rounded-lg">
                        <p className="font-medium text-orange-900">⚠️ Un altro ritardo comporterà il blocco automatico dell'account!</p>
                        <p className="text-orange-800">Assicurati di restituire i futuri prestiti entro la data stabilita.</p>
                      </div>
                    )}
                    {userPenalties.penalties.length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer font-medium hover:underline">
                          Visualizza storico penalità ({userPenalties.penalties.length})
                        </summary>
                        <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
                          {userPenalties.penalties.slice(0, 3).map((penalty, index) => (
                            <div key={index} className="text-xs bg-white bg-opacity-50 rounded p-2">
                              <div className="flex justify-between items-center">
                                <span className="font-medium">{penalty.articolo_nome}</span>
                                <span className="text-red-600">{penalty.strike_assegnati} strike</span>
                              </div>
                              <div className="text-gray-600 mt-1">
                                {penalty.giorni_ritardo} giorni di ritardo • {new Date(penalty.created_at).toLocaleDateString('it-IT')}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Active Loans */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Prestiti Attivi
          </h3>
          {recentData.activeLoans.length > 0 ? (
            <div className="space-y-3">
              {recentData.activeLoans.map((loan, index) => (
                <div key={index} className="flex items-center justify-between p-3 bg-teal-50 rounded-lg border border-teal-200 shadow-md shadow-green-100/30">
                  <div>
                    <p className="font-medium text-gray-900">{loan.articolo_nome || loan.oggetto_nome || 'Oggetto'}</p>
                    <p className="text-sm text-gray-600">Scadenza: {formatDate(loan.data_rientro || loan.data_fine)}</p>
                  </div>
                  <span className="px-2 py-1 text-xs font-medium bg-teal-100 text-teal-800 rounded-full">
                    Attivo
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-500">Nessun prestito attivo al momento</p>
              <p className="text-xs text-gray-400 mt-1">I tuoi prestiti attivi appariranno qui</p>
            </div>
          )}
        </div>

        {/* Recent Requests */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Richieste Recenti
          </h3>
          {recentData.recentRequests.length > 0 ? (
            <div className="space-y-3">
              {recentData.recentRequests.map((request, index) => {
                const getRequestStyles = (stato) => {
                  switch(stato) {
                    case 'in_attesa':
                    case 'pending':
                      return {
                        cardBg: 'bg-yellow-50 border-yellow-200 shadow-yellow-100/30',
                        pillBg: 'bg-yellow-100',
                        pillText: 'text-yellow-800'
                      };
                    case 'approvata':
                      return {
                        cardBg: 'bg-teal-50 border-teal-200 shadow-green-100/30',
                        pillBg: 'bg-teal-100',
                        pillText: 'text-teal-800'
                      };
                    case 'rifiutata':
                      return {
                        cardBg: 'bg-red-50 border-red-200 shadow-red-100/30',
                        pillBg: 'bg-red-100',
                        pillText: 'text-red-800'
                      };
                    default:
                      return {
                        cardBg: 'bg-gray-50 border-gray-200',
                        pillBg: 'bg-gray-100',
                        pillText: 'text-gray-800'
                      };
                  }
                };
                
                const styles = getRequestStyles(request.stato);
                
                return (
                  <div 
                    key={index} 
                    onClick={() => handleRequestClick(request)}
                    className={`flex items-center justify-between p-3 rounded-lg hover:shadow-md cursor-pointer transition-all duration-200 hover:scale-[1.02] border ${styles.cardBg}`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{request.oggetto_nome || request.articolo_nome || 'Oggetto'}</p>
                      <p className="text-sm text-gray-600">
                        {request.stato === 'approvata' && request.dal && request.al ? (
                          <span>Uscita: {formatDate(request.dal)} - Rientro: {formatDate(request.al)}</span>
                        ) : (
                          <span>{formatDate(request.created_at)}</span>
                        )}
                      </p>
                    </div>
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles.pillBg} ${styles.pillText}`}>
                      {request.stato === 'approvata' ? 'Approvata' :
                       request.stato === 'in_attesa' || request.stato === 'pending' ? 'In Attesa' : 'Rifiutata'}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-sm text-gray-500">Nessuna richiesta recente</p>
              <p className="text-xs text-gray-400 mt-1">Le tue richieste appariranno qui</p>
              <button
                onClick={() => setShowQuickRequestModal(true)}
                className="mt-4 text-sm text-teal-600 hover:text-teal-800 font-medium"
              >
                Crea la tua prima richiesta →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showQuickRequestModal && (
        <NewRequestModal
          isOpen={showQuickRequestModal}
          onClose={() => setShowQuickRequestModal(false)}
          catalogType={selectedCatalogType}
          onSuccess={() => {
            setShowQuickRequestModal(false);
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
                  setShowQuickRequestModal(true);
                }}
                className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
              >
                <p className="font-semibold text-gray-900">Libro</p>
                <p className="text-sm text-gray-600 mt-1">Catalogo principale</p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedCatalogType('tesi');
                  setShowCatalogTypePicker(false);
                  setShowQuickRequestModal(true);
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
                  setShowQuickRequestModal(true);
                }}
                className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
              >
                <p className="font-semibold text-gray-900">Catalogo</p>
                <p className="text-sm text-gray-600 mt-1">Sezione cataloghi/riviste</p>
              </button>
            </div>
          </div>
        </div>
      )}

      {showReportFaultModal && (
        <ReportBugModal
          isOpen={showReportFaultModal}
          onClose={() => setShowReportFaultModal(false)}
          onSuccess={() => {
            setShowReportFaultModal(false);
            fetchData();
          }}
        />
      )}
    </div>
  );
};

// Stat Card Component (same as admin dashboard)
function StatCard({ title, value }) {
  const iconMap = {
    'Articoli Disponibili': (
      <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
      </svg>
    ),
    'Le Mie Richieste': (
      <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    'Le Mie Segnalazioni': (
      <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    ),
    'I Miei Prestiti': (
      <svg className="icon-lg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    )
  };

  const colorMap = {
    'Articoli Disponibili': 'bg-teal-100',
    'Le Mie Richieste': 'bg-teal-100',
    'Le Mie Segnalazioni': 'bg-red-100',
    'I Miei Prestiti': 'bg-yellow-100'
  };

  return (
    <div className="kpi-card bg-white rounded-lg shadow-sm border border-gray-200 hover:scale-105 transition-transform">
      <div className="flex items-center w-full">
        <div className={`w-12 h-12 ${colorMap[title]} rounded-lg flex items-center justify-center ${
          title === 'Articoli Disponibili' ? 'text-teal-600' :
          title === 'Le Mie Richieste' ? 'text-teal-600' :
          title === 'Le Mie Segnalazioni' ? 'text-red-600' :
          title === 'I Miei Prestiti' ? 'text-yellow-600' : 'text-gray-600'
        }`}>
          {iconMap[title]}
        </div>
        <div className="ml-4 flex-1 min-w-0">
          <p className="kpi-label text-gray-600 font-semibold">{title}</p>
          <p className="kpi-value text-gray-900">{typeof value === 'number' ? value : parseInt(value) || 0}</p>
        </div>
      </div>
    </div>
  );
}

export default UserDashboard;