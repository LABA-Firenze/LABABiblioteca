import React, { useState, useEffect, useCallback } from "react";
import { useAuth } from "../auth/AuthContext";
import StepInventoryModal from "./StepInventoryModal";
import QuickRequestModal from "./QuickRequestModal";
import { DashboardSkeleton } from "./SkeletonLoader";

const Dashboard = ({ onNavigate }) => {
  const [stats, setStats] = useState({
    inventory: 0,
    requests: 0,
    reports: 0,
    activeLoans: 0,
    availableItems: 0,
    lowStockItems: 0,
    lowStockWithDates: [],
  });
  const [recentRequests, setRecentRequests] = useState([]);
  const [recentReports, setRecentReports] = useState([]);
  const [alerts, setAlerts] = useState({
    prestiti_scaduti: [],
    scadenze_oggi: [],
    scadenze_domani: [],
    totale_avvisi: 0,
  });
  const [passwordResetRequests, setPasswordResetRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCatalogTypePicker, setShowCatalogTypePicker] = useState(false);
  const [selectedCatalogType, setSelectedCatalogType] = useState("libri");
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [showPasswordResetModal, setShowPasswordResetModal] = useState(false);
  const [selectedPasswordRequest, setSelectedPasswordRequest] = useState(null);
  const { token, isAdmin, isSupervisor, roleLabel } = useAuth();

  // Helper function to calculate time ago
  const getTimeAgo = (dateString) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return "Ora";
    if (diffInMinutes < 60) return `${diffInMinutes} minuti fa`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} ore fa`;
    return `${Math.floor(diffInMinutes / 1440)} giorni fa`;
  };

  // Helper function to safely format dates
  const formatDate = (dateString) => {
    if (!dateString) return "Data non specificata";
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return "Data non valida";
      return date.toLocaleDateString("it-IT");
    } catch (error) {
      return "Data non valida";
    }
  };

  // Handle password reset
  const handlePasswordReset = async (email, newPassword) => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_BASE_URL}/api/auth/admin-reset-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ email, newPassword }),
        },
      );

      if (response.ok) {
        alert("Password aggiornata con successo!");
        setShowPasswordResetModal(false);
        setSelectedPasswordRequest(null);
        fetchDashboardData(); // Refresh data
      } else {
        const error = await response.json();
        alert(`Errore: ${error.error}`);
      }
    } catch (error) {
      console.error("Errore reset password:", error);
      alert("Errore durante l'aggiornamento della password");
    }
  };

  // Fetch dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const catalogTypes = ["libri", "tesi", "cataloghi"];
      const buildCatalogUrl = (baseUrl, type) => `${baseUrl}${baseUrl.includes("?") ? "&" : "?"}tipo_catalogo=${type}`;

      const inventoryPromises = catalogTypes.map((type) =>
        fetch(buildCatalogUrl(`${import.meta.env.VITE_API_BASE_URL}/api/inventario`, type), {
          headers: { Authorization: `Bearer ${token}` },
        })
      );

      const promises = [
        Promise.all(inventoryPromises),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/segnalazioni`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/prestiti?all=1`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ];

      // Requests (admin only, NOT supervisor)
      if (isAdmin && !isSupervisor) {
        promises.push(
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/richieste?all=1`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      // Alerts
      if (isAdmin) {
        promises.push(
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/avvisi`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
      } else {
        promises.push(
          fetch(`${import.meta.env.VITE_API_BASE_URL}/api/avvisi/utente`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        );
      }

      // Password reset requests (admin only, NOT supervisor)
      if (isAdmin && !isSupervisor) {
        promises.push(
          fetch(
            `${import.meta.env.VITE_API_BASE_URL}/api/auth/password-reset-requests`,
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          )
        );
      } else {
        promises.push(Promise.resolve(null));
      }

      const [
        inventoryRes,
        reportsRes,
        prestitiRes,
        requestsRes,
        alertsRes,
        passwordResetRes,
      ] = await Promise.all(promises);

      if (!Array.isArray(inventoryRes) || inventoryRes.some((res) => !res.ok))
        throw new Error("Errore nel caricamento inventario");
      if (!reportsRes.ok)
        throw new Error("Errore nel caricamento segnalazioni");
      if (!prestitiRes.ok) throw new Error("Errore nel caricamento prestiti");
      if (requestsRes && !requestsRes.ok) throw new Error("Errore nel caricamento richieste");
      if (!alertsRes.ok) throw new Error("Errore nel caricamento avvisi");

      const inventoryDatasets = await Promise.all(inventoryRes.map((res) => res.json()));
      const inventoryData = inventoryDatasets.flat();
      const reportsData = await reportsRes.json();
      const prestitiData = await prestitiRes.json();
      const requestsData = requestsRes ? await requestsRes.json() : [];
      const alertsData = await alertsRes.json();

      // Calcola statistiche corrette
      const activeLoans = prestitiData.filter(
        (p) => p.stato === "attivo",
      ).length;
      // Conta le UNITÀ disponibili totali, non gli articoli
      // Assicuriamoci che unita_disponibili sia un numero
      const availableItems = inventoryData.reduce((total, item) => {
        const unita = Number(item.unita_disponibili) || 0;
        return total + unita;
      }, 0);

      setStats({
        inventory: inventoryData.length,
        requests: requestsData.length,
        reports: reportsData.length,
        activeLoans: activeLoans,
        availableItems: availableItems,
        lowStockItems: 0,
        lowStockWithDates: [],
      });

      setAlerts(alertsData);

      // Handle password reset requests for admin
      if (isAdmin && passwordResetRes) {
        const passwordResetData = await passwordResetRes.json();
        setPasswordResetRequests(passwordResetData);
      }

      console.log("Dashboard - requestsData:", requestsData);
      setRecentRequests((requestsData || []).slice(0, 5));
      setRecentReports(reportsData.slice(0, 5));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [token, isAdmin]);

  useEffect(() => {
    // Aspetta che token sia disponibile prima di caricare i dati
    if (token) {
      fetchDashboardData();
    }
  }, [token, isAdmin, fetchDashboardData]);

  if (loading) {
    return <DashboardSkeleton />;
  }

  return (
    <div className="min-h-screen bg-gray-50 space-y-6">
      {/* Header */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Dashboard {roleLabel}
            </h1>
            <p className="text-gray-600 text-lg">
              Panoramica del sistema di gestione biblioteca
            </p>
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Libri
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.inventory}
              </p>
              <p className="text-sm text-gray-500">Elementi totali</p>
            </div>
            <div className="w-12 h-12 bg-teal-100 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-teal-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Richieste
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.requests}
              </p>
              <p className="text-sm text-gray-500">Richieste di prestito</p>
            </div>
            <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-amber-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 mb-1">
                Segnalazioni
              </p>
              <p className="text-3xl font-bold text-gray-900">
                {stats.reports}
              </p>
              <p className="text-sm text-gray-500">Segnalazioni attive</p>
            </div>
            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section - Redesigned */}
      {alerts.totale_avvisi > 0 && (
        <div className="bg-white rounded-xl shadow-lg border border-red-200 overflow-hidden">
          <div className="bg-gradient-to-r from-red-500 to-red-600 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center mr-4">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">
                    Avvisi Importanti
                  </h2>
                  <p className="text-red-100 text-sm">
                    Attenzione richiesta per questi elementi
                  </p>
                </div>
              </div>
              <div className="bg-white/20 backdrop-blur-sm rounded-full px-4 py-2">
                <span className="text-white font-bold text-lg">
                  {alerts.totale_avvisi}
                </span>
                <span className="text-red-100 ml-1">avvisi</span>
              </div>
            </div>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">

              {/* Prestiti Scaduti */}
              {alerts.prestiti_scaduti.length > 0 && (
                <div
                  className="bg-orange-50 border border-orange-200 rounded-lg p-4 cursor-pointer hover:bg-orange-100 transition-colors"
                  onClick={() =>
                    setSelectedAlert({
                      type: "ritardi",
                      data: alerts.prestiti_scaduti,
                    })
                  }
                >
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-orange-800">
                      Ritardi ({alerts.prestiti_scaduti.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {alerts.prestiti_scaduti.slice(0, 3).map((prestito) => (
                      <div
                        key={prestito.id}
                        className="bg-white rounded-lg p-3 border border-orange-200"
                      >
                        <div className="font-semibold text-gray-900 text-sm">
                          {prestito.utente_nome_reale && prestito.utente_cognome
                            ? `${prestito.utente_nome_reale} ${prestito.utente_cognome}`
                            : prestito.utente_nome}
                        </div>
                        <div className="text-orange-600 font-medium text-xs mt-1">
                          {Math.floor(prestito.giorni_ritardo)} giorni di
                          ritardo
                        </div>
                      </div>
                    ))}
                    {alerts.prestiti_scaduti.length > 3 && (
                      <div className="text-center text-orange-600 text-sm font-medium">
                        +{alerts.prestiti_scaduti.length - 3} altri prestiti...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scadenze Oggi */}
              {alerts.scadenze_oggi.length > 0 && (
                <div
                  className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 cursor-pointer hover:bg-yellow-100 transition-colors"
                  onClick={() =>
                    setSelectedAlert({
                      type: "oggi",
                      data: alerts.scadenze_oggi,
                    })
                  }
                >
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 bg-yellow-500 rounded-full flex items-center justify-center mr-3">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-yellow-800">
                      Scadenze Oggi ({alerts.scadenze_oggi.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {alerts.scadenze_oggi.slice(0, 3).map((prestito) => (
                      <div
                        key={prestito.id}
                        className="bg-white rounded-lg p-3 border border-yellow-200"
                      >
                        <div className="font-semibold text-gray-900 text-sm">
                          {prestito.utente_nome_reale && prestito.utente_cognome
                            ? `${prestito.utente_nome_reale} ${prestito.utente_cognome}`
                            : prestito.utente_nome}
                        </div>
                        <div className="text-yellow-600 font-medium text-xs mt-1">
                          {prestito.oggetto_nome}
                        </div>
                      </div>
                    ))}
                    {alerts.scadenze_oggi.length > 3 && (
                      <div className="text-center text-yellow-600 text-sm font-medium">
                        +{alerts.scadenze_oggi.length - 3} altri prestiti...
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Scadenze Domani */}
              {alerts.scadenze_domani.length > 0 && (
                <div
                  className="bg-red-50 border border-red-200 rounded-lg p-4 cursor-pointer hover:bg-red-100 transition-colors"
                  onClick={() =>
                    setSelectedAlert({
                      type: "domani",
                      data: alerts.scadenze_domani,
                    })
                  }
                >
                  <div className="flex items-center mb-3">
                    <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center mr-3">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <h3 className="text-lg font-bold text-red-800">
                      In scadenza domani: ({alerts.scadenze_domani.length})
                    </h3>
                  </div>
                  <div className="space-y-2">
                    {alerts.scadenze_domani.slice(0, 3).map((prestito) => (
                      <div
                        key={prestito.id}
                        className="bg-white rounded-lg p-3 border border-red-200"
                      >
                        <div className="font-semibold text-gray-900 text-sm">
                          {prestito.utente_nome_reale && prestito.utente_cognome
                            ? `${prestito.utente_nome_reale} ${prestito.utente_cognome}`
                            : prestito.utente_nome}
                        </div>
                        <div className="text-red-600 font-medium text-xs mt-1">
                          {prestito.oggetto_nome}
                        </div>
                      </div>
                    ))}
                    {alerts.scadenze_domani.length > 3 && (
                      <div className="text-center text-red-600 text-sm font-medium">
                        +{alerts.scadenze_domani.length - 3} altri prestiti...
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Quick Actions */}
      {isAdmin && (
        <div className="bg-white rounded-2xl shadow-lg p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Azioni Rapide
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div
              onClick={() => setShowCatalogTypePicker(true)}
              className="group bg-gradient-to-br from-teal-50 to-teal-100 rounded-2xl p-6 border border-teal-200 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-teal-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 4v16m8-8H4"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Aggiungi Elemento
                </h3>
              </div>
              <p className="text-gray-600">
                Scegli se aggiungere un libro, una tesi o un catalogo
              </p>
            </div>

            <div
              onClick={() => {
                const pendingCount = recentRequests.filter(r => r.stato === 'in_attesa').length;
                if (pendingCount > 0 && onNavigate) {
                  onNavigate("prestiti", { initialTab: 'pending' });
                } else if (onNavigate) {
                  onNavigate("prestiti");
                }
              }}
              className="group bg-gradient-to-br from-amber-50 to-amber-100 rounded-2xl p-6 border border-amber-200 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-amber-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Gestisci Richieste
                </h3>
              </div>
              <p className="text-gray-600">
                Visualizza e gestisci le richieste di prestito
              </p>
            </div>

            <div
              onClick={() => onNavigate("riparazioni")}
              className="group bg-gradient-to-br from-orange-50 to-orange-100 rounded-2xl p-6 border border-orange-200 hover:shadow-xl hover:scale-105 transition-all duration-300 cursor-pointer"
            >
              <div className="flex items-center mb-4">
                <div className="w-12 h-12 bg-orange-500 rounded-xl flex items-center justify-center mr-4 group-hover:scale-110 transition-transform duration-300">
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-bold text-gray-900">
                  Gestisci Segnalazioni
                </h3>
              </div>
              <p className="text-gray-600">
                Visualizza e gestisci le segnalazioni
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Requests Section - Moved to bottom */}
      {isAdmin && passwordResetRequests.length > 0 && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center">
              <div className="w-10 h-10 bg-orange-500 rounded-full flex items-center justify-center mr-3">
                <svg
                  className="icon text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
              </div>
              Richieste Reset Password
            </h2>
            <span className="status-badge bg-orange-100 text-orange-800">
              {passwordResetRequests.length} richieste
            </span>
          </div>

          <div className="space-y-3">
            {passwordResetRequests.map((request) => (
              <div
                key={request.id}
                className="flex items-center justify-between p-4 bg-orange-50 rounded-lg border border-orange-200"
              >
                <div className="flex items-center">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3">
                    {request.user_name ? request.user_name.charAt(0) : "?"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">
                      {request.user_name && request.user_surname
                        ? `${request.user_name} ${request.user_surname}`
                        : "Utente sconosciuto"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {request.user_email ||
                        request.email ||
                        "Email non disponibile"}
                    </p>
                    <p className="text-xs text-gray-500">
                      Richiesto: {formatDate(request.requested_at)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedPasswordRequest(request);
                    setShowPasswordResetModal(true);
                  }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors text-sm"
                >
                  Gestisci
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pending Requests Alert */}
      {recentRequests.filter(r => r.stato === 'in_attesa').length > 0 && (
        <div 
          className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 cursor-pointer hover:bg-yellow-100 transition-colors mb-6"
          onClick={() => {
            if (onNavigate) {
              onNavigate('prestiti', { initialTab: 'pending' });
            }
          }}
        >
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                {recentRequests.filter(r => r.stato === 'in_attesa').length} {recentRequests.filter(r => r.stato === 'in_attesa').length === 1 ? 'richiesta in attesa' : 'richieste in attesa'} di approvazione
              </h3>
              <p className="text-sm text-yellow-700 mt-1">
                Ci sono prestiti che necessitano della tua attenzione per essere approvati o rifiutati.
              </p>
            </div>
            <div className="ml-auto">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  if (onNavigate) {
                    onNavigate('prestiti', { initialTab: 'pending' });
                  }
                }}
                className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md text-sm font-medium hover:bg-yellow-200 transition-colors"
              >
                Visualizza
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Requests */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Richieste Recenti
            </h2>
            <span className="bg-amber-100 text-amber-800 text-sm font-medium px-3 py-1 rounded-full">
              {recentRequests.length} richieste
            </span>
          </div>
          <div className="space-y-3">
            {recentRequests.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">
                  Nessuna richiesta recente
                </p>
              </div>
            ) : (
              recentRequests.map((request, index) => (
                <div
                  key={index}
                  className={`flex items-center py-4 px-4 rounded-xl transition-all duration-200 ${request.stato === "in_attesa"
                    ? "bg-amber-50 border border-amber-200 hover:bg-amber-100 hover:shadow-md cursor-pointer"
                    : "bg-gray-50 border border-gray-200 hover:bg-gray-100"
                    }`}
                  onClick={() =>
                    request.stato === "in_attesa" && setSelectedRequest(request)
                  }
                >
                  <div
                    className={`w-3 h-3 rounded-full mr-4 ${request.stato === "in_attesa"
                      ? "bg-amber-500"
                      : request.stato === "approvata"
                        ? "bg-teal-500"
                        : "bg-red-500"
                      }`}
                  ></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {request.articolo_nome ||
                        request.oggetto_nome ||
                        "Oggetto sconosciuto"}
                    </p>
                    <p className="text-sm text-gray-600">
                      {request.name || request.utente_nome || ""}{" "}
                      {request.surname || request.utente_cognome || ""}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${request.stato === "in_attesa"
                        ? "bg-yellow-100 text-yellow-800"
                        : request.stato === "approvata"
                          ? "bg-teal-100 text-teal-800"
                          : "bg-red-100 text-red-800"
                        }`}
                    >
                      {request.stato === "in_attesa"
                        ? "In Attesa"
                        : request.stato === "approvata"
                          ? "Approvata"
                          : "Rifiutata"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Reports */}
        <div className="bg-white rounded-2xl shadow-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">
              Segnalazioni Recenti
            </h2>
            <span className="bg-red-100 text-red-800 text-sm font-medium px-3 py-1 rounded-full">
              {recentReports.length} segnalazioni
            </span>
          </div>
          <div className="space-y-3">
            {recentReports.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <svg
                    className="w-8 h-8 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                    />
                  </svg>
                </div>
                <p className="text-gray-500 font-medium">
                  Nessuna segnalazione recente
                </p>
              </div>
            ) : (
              recentReports.map((report, index) => (
                <div
                  key={index}
                  className="flex items-center py-4 px-4 rounded-xl bg-red-50 border border-red-200 hover:bg-red-100 hover:shadow-md cursor-pointer transition-all duration-200"
                >
                  <div className="w-3 h-3 bg-red-500 rounded-full mr-4"></div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {report.tipo}: {report.messaggio}
                    </p>
                    <p className="text-sm text-gray-600">
                      {formatDate(report.created_at)}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${report.stato === "aperta"
                        ? "bg-yellow-100 text-yellow-800"
                        : "bg-teal-100 text-teal-800"
                        }`}
                    >
                      {report.stato === "aperta" ? "Aperta" : "Chiusa"}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div className="alert-card alert-danger">
          <div className="flex items-center">
            <svg
              className="icon text-red-500 mr-3"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <p className="text-red-800 ">{error}</p>
          </div>
        </div>
      )}

      {/* Alert Details Modal */}
      {selectedAlert && (
        <div className="modal-overlay" onClick={() => setSelectedAlert(null)}>
          <div
            className="modal-content max-w-3xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="text-xl font-bold text-primary">
                {false && selectedAlert.type === "scorte"
                  ? "Scorte Basse"
                  : selectedAlert.type === "ritardi"
                    ? "Prestiti in Ritardo"
                    : selectedAlert.type === "oggi"
                      ? "Scadenze Oggi"
                      : "In scadenza domani:"}
              </h2>
              <button
                onClick={() => setSelectedAlert(null)}
                className="text-muted hover:text-primary"
              >
                <svg
                  className="icon"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="space-y-3">
                {selectedAlert.data.map((item, index) => (
                  <div key={index} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium text-primary">
                          {false && selectedAlert.type === "scorte"
                            ? item.nome
                            : item.utente_nome_reale && item.utente_cognome
                              ? `${item.utente_nome_reale} ${item.utente_cognome}`
                              : item.utente_nome}
                        </h3>
                        <p className="text-sm text-secondary">
                          {false && selectedAlert.type === "scorte"
                            ? `${item.reason} - Disponibili: ${item.unita_disponibili || 0}/${item.quantita_totale}${item.loanedPercentage ? ` (${Math.round(item.loanedPercentage)}% in prestito)` : ""}`
                            : selectedAlert.type === "ritardi"
                              ? `${item.oggetto_nome} - ${Math.floor(item.giorni_ritardo)} giorni di ritardo`
                              : item.oggetto_nome}
                        </p>
                        {false && selectedAlert.type === "scorte" &&
                          item.firstReturnDate && (
                            <p className="text-xs text-muted mt-1">
                              Primo ritorno:{" "}
                              {item.firstReturnDate.toLocaleDateString("it-IT")}
                            </p>
                          )}
                      </div>
                      {false && selectedAlert.type === "scorte" && (
                        <button
                          onClick={() => {
                            setSelectedAlert(null);
                            onNavigate && onNavigate("catalogo");
                          }}
                          className="btn-primary btn-small"
                        >
                          Gestisci
                        </button>
                      )}
                      {selectedAlert.type === "ritardi" && (
                        <button
                          onClick={() => {
                            setSelectedAlert(null);
                            onNavigate && onNavigate("prestiti");
                          }}
                          className="btn-danger btn-small"
                        >
                          Gestisci Ritardo
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="modal-footer">
              <button
                onClick={() => setSelectedAlert(null)}
                className="btn-secondary"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Inventory Modal */}
      <StepInventoryModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onSuccess={() => {
          fetchDashboardData();
          setShowAddModal(false);
        }}
        catalogType={selectedCatalogType}
      />

      {/* Catalog Type Picker Modal */}
      {showCatalogTypePicker && (
        <div
          className="modal-overlay"
          onClick={() => setShowCatalogTypePicker(false)}
        >
          <div
            className="modal-content max-w-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <h2 className="text-xl font-bold text-primary">
                Seleziona tipo di materiale
              </h2>
              <button
                onClick={() => setShowCatalogTypePicker(false)}
                className="text-muted hover:text-primary"
              >
                <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="modal-body">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatalogType("libri");
                    setShowCatalogTypePicker(false);
                    setShowAddModal(true);
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
                >
                  <p className="font-semibold text-gray-900">Libro</p>
                  <p className="text-sm text-gray-600 mt-1">Sezione libri</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatalogType("tesi");
                    setShowCatalogTypePicker(false);
                    setShowAddModal(true);
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
                >
                  <p className="font-semibold text-gray-900">Tesi</p>
                  <p className="text-sm text-gray-600 mt-1">Sezione tesi di laurea</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatalogType("cataloghi");
                    setShowCatalogTypePicker(false);
                    setShowAddModal(true);
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
                >
                  <p className="font-semibold text-gray-900">Cataloghi</p>
                  <p className="text-sm text-gray-600 mt-1">Sezione cataloghi/riviste</p>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCatalogType("riviste");
                    setShowCatalogTypePicker(false);
                    setShowAddModal(true);
                  }}
                  className="p-4 rounded-xl border border-gray-200 hover:border-teal-400 hover:bg-teal-50 transition-all text-left"
                >
                  <p className="font-semibold text-gray-900">Rivista</p>
                  <p className="text-sm text-gray-600 mt-1">Sezione riviste</p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Quick Request Modal */}
      <QuickRequestModal
        isOpen={!!selectedRequest}
        onClose={() => setSelectedRequest(null)}
        request={selectedRequest}
        onSuccess={() => {
          fetchDashboardData();
          setSelectedRequest(null);
        }}
      />

      {/* Password Reset Modal */}
      {showPasswordResetModal && selectedPasswordRequest && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full mx-4">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                Reset Password
              </h3>
              <button
                onClick={() => {
                  setShowPasswordResetModal(false);
                  setSelectedPasswordRequest(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <div className="mb-4">
                <p className="text-sm text-gray-600 mb-2">Utente:</p>
                <p className="font-medium text-gray-900">
                  {selectedPasswordRequest.user_name &&
                    selectedPasswordRequest.user_surname
                    ? `${selectedPasswordRequest.user_name} ${selectedPasswordRequest.user_surname}`
                    : "Nome non disponibile"}
                </p>
                <p className="text-sm text-gray-600">
                  {selectedPasswordRequest.user_email ||
                    selectedPasswordRequest.email}
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nuova Password
                </label>
                <input
                  type="password"
                  id="newPassword"
                  className="block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400"
                  placeholder="Inserisci nuova password"
                  required
                />
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowPasswordResetModal(false);
                    setSelectedPasswordRequest(null);
                  }}
                  className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                >
                  Annulla
                </button>
                <button
                  onClick={() => {
                    const newPassword =
                      document.getElementById("newPassword").value;
                    if (newPassword) {
                      handlePasswordReset(
                        selectedPasswordRequest.email,
                        newPassword,
                      );
                    } else {
                      alert("Inserisci una nuova password");
                    }
                  }}
                  className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                >
                  Aggiorna Password
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Stat Card Component
function StatCard({ title, value, description }) {
  const iconMap = {
    Libri: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
        />
      </svg>
    ),
    Richieste: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h8a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
        />
      </svg>
    ),
    Segnalazioni: (
      <svg
        className="w-6 h-6"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
        />
      </svg>
    ),
  };

  const colorMap = {
    Libri: "bg-gradient-to-br from-teal-100 to-teal-200 ",
    Richieste: "bg-gradient-to-br from-amber-100 to-amber-200 ",
    Segnalazioni: "bg-gradient-to-br from-orange-100 to-orange-200 ",
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 hover:scale-105 transition-transform p-6">
      <div className="flex items-center">
        <div
          className={`w-12 h-12 ${colorMap[title]} rounded-lg flex items-center justify-center ${title === "Libri"
            ? "text-teal-600"
            : title === "Richieste"
              ? "text-amber-600"
              : title === "Segnalazioni"
                ? "text-orange-600"
                : "text-gray-600"
            } shadow-lg`}
        >
          {iconMap[title]}
        </div>
        <div className="ml-4">
          <p className="text-sm font-medium text-gray-700">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
      <p className="text-xs text-gray-500 mt-2">{description}</p>
    </div>
  );
}

// Quick Action Button Component
function QuickActionButton({
  title,
  description,
  icon,
  onClick,
  color = "blue",
}) {
  const colorClasses = {
    blue: "bg-gradient-to-br from-teal-500 to-teal-600",
    green: "bg-gradient-to-br from-teal-500 to-teal-600",
    orange: "bg-gradient-to-br from-orange-500 to-orange-600",
    purple: "bg-gradient-to-br from-purple-500 to-purple-600",
  };

  return (
    <button
      onClick={onClick}
      className="card card-clickable text-left w-full hover:scale-105 transition-transform"
    >
      <div className="flex items-center">
        <div
          className={`w-12 h-12 ${colorClasses[color]} rounded-lg flex items-center justify-center text-white mr-4 shadow-lg`}
        >
          {icon}
        </div>
        <div>
          <p className="font-semibold text-primary">{title}</p>
          <p className="text-sm text-secondary">{description}</p>
        </div>
      </div>
    </button>
  );
}

export default Dashboard;
