import React, { useState, useEffect } from "react";
import { LayoutDashboard, BookOpen, Newspaper, ArrowLeftRight, AlertTriangle, Users, Monitor, Bell, Menu, X, LogOut } from "lucide-react";
import AuthProvider, { useAuth } from "./auth/AuthContext";
import { NotificationProvider } from "./components/NotificationSystem.jsx";
import DesktopNotificationManager from "./components/DesktopNotificationManager.jsx";
import NotificationManager from "./components/NotificationManager.jsx";
// import { ThemeProvider, useTheme } from "./contexts/ThemeContext.jsx";
import { useRealtimeNotifications } from "./hooks/useRealtimeNotifications.js";
import Login from "./auth/Login";

import Dashboard from "./components/Dashboard.jsx";
import UserDashboard from "./components/UserDashboard.jsx";
import BookInventory from "./components/BookInventory.jsx";
import ThesisInventory from "./components/ThesisInventory.jsx";
import MagazineInventory from "./components/MagazineInventory.jsx";
import Loans from "./components/Loans.jsx";
import Repairs from "./components/Repairs.jsx";
import Statistics from "./components/Statistics.jsx";
import AdvancedStats from "./components/AdvancedStats.jsx";
import SystemStatus from "./components/SystemStatus.jsx";
import UserManagement from "./components/UserManagement.jsx";
import NotificationsPanel from "./components/NotificationsPanel.jsx";
import Footer from "./components/Footer.jsx";
import UserArea from "./user/UserArea.jsx";
import MobileMenu from "./components/MobileMenu.jsx";

// App principale con design moderno
function AppInner() {
  const BLOCKED_SECTIONS = new Set(['cataloghi']);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectedRequestFromNotification, setSelectedRequestFromNotification] = useState(null);

  // Admin sidebar items for mobile menu (Lucide icons)
  const iconClass = "w-5 h-5";
  const adminSidebarItems = [
    { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard className={iconClass} /> },
    { id: 'inventario', label: 'Libri', icon: <BookOpen className={iconClass} /> },
    { id: 'tesi-laurea', label: 'Tesi', icon: <BookOpen className={iconClass} /> },
    { id: 'riviste', label: 'Riviste', icon: <Newspaper className={iconClass} /> },
    { id: 'prestiti', label: 'Prestiti', icon: <ArrowLeftRight className={iconClass} /> },
    { id: 'riparazioni', label: 'Segnalazioni', icon: <AlertTriangle className={iconClass} /> },
    { id: 'utenti', label: 'Utenti', icon: <Users className={iconClass} /> },
    { id: 'sistema', label: 'Stato del Sistema', icon: <Monitor className={iconClass} /> }
  ];

  const [notifications, setNotifications] = useState([]);
  const { isAdmin, isSupervisor, user, logout, token, authLoading } = useAuth();
  // const { isDark, toggleTheme } = useTheme();

  // Hook per notifiche in tempo reale
  useRealtimeNotifications();

  // Fetch real notifications
  const fetchNotifications = async () => {
    if (!token) return;

    try {
      // Load recent requests and alerts
      const promises = [
        // Only fetch requests if admin AND NOT supervisor
        (isAdmin && !isSupervisor)
          ? fetch(`${import.meta.env.VITE_API_BASE_URL}/api/richieste?all=1`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
          : Promise.resolve(null),
        fetch(`${import.meta.env.VITE_API_BASE_URL}/api/avvisi`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
      ];

      const [requestsRes, alertsRes] = await Promise.all(promises);

      if ((!requestsRes || requestsRes.ok) && alertsRes.ok) {
        const [requestsData, alertsData] = await Promise.all([
          requestsRes ? requestsRes.json() : [],
          alertsRes.json()
        ]);

        // Generate real notifications
        const realNotifications = [];
        let notificationId = 1;

        // New pending requests (last 24 hours)
        const pendingRequests = requestsData.filter(req =>
          req.stato === 'in_attesa' &&
          new Date(req.created_at) > new Date(Date.now() - 24 * 60 * 60 * 1000)
        );

        pendingRequests.forEach(request => {
          realNotifications.push({
            id: notificationId++,
            title: 'Nuova Richiesta',
            message: `${request.utente_nome} ${request.utente_cognome} ha richiesto ${request.oggetto_nome}`,
            time: getTimeAgo(request.created_at),
            isRead: false,
            type: 'info',
            data: { type: 'request', id: request.id, requestData: request }
          });
        });

        // Overdue loans
        if (alertsData.prestiti_scaduti) {
          alertsData.prestiti_scaduti.forEach(loan => {
            realNotifications.push({
              id: notificationId++,
              title: 'Prestito Scaduto',
              message: `${loan.oggetto_nome} di ${loan.utente_nome} è scaduto`,
              time: getTimeAgo(loan.data_rientro),
              isRead: false,
              type: 'warning',
              data: { type: 'loan', id: loan.id, loanData: loan }
            });
          });
        }

        // Scorte basse rimosse - i libri sono sempre massimo 1 o 2 articoli

        setNotifications(realNotifications);
      }
    } catch (error) {
      console.error('Errore nel caricamento notifiche:', error);
    }
  };

  // Helper function for time ago
  const getTimeAgo = (dateString) => {
    if (!dateString) return 'Ora';
    const now = new Date();
    const date = new Date(dateString);
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));

    if (diffInMinutes < 1) return 'Ora';
    if (diffInMinutes < 60) return `${diffInMinutes} min fa`;

    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} ore fa`;

    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays} giorni fa`;
  };

  // Load notifications on component mount and token change
  useEffect(() => {
    if (token && isAdmin) {
      fetchNotifications();
      // Refresh every 5 minutes
      const interval = setInterval(fetchNotifications, 5 * 60 * 1000);
      return () => clearInterval(interval);
    }
  }, [token, isAdmin]);

  // Listener per navigazione dal footer
  useEffect(() => {
    const handleNavigateToSystem = () => {
      console.log('Admin: Received navigateToSystemAdmin event');
      setTab('sistema');
    };

    window.addEventListener('navigateToSystemAdmin', handleNavigateToSystem);

    return () => {
      window.removeEventListener('navigateToSystemAdmin', handleNavigateToSystem);
    };
  }, []);

  // Funzioni per gestire le notifiche
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleMarkAsRead = (id) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === id ? { ...notif, isRead: true } : notif
      )
    );
  };

  const handleDeleteNotification = (id) => {
    setNotifications(prev => prev.filter(notif => notif.id !== id));
  };

  const handleNotificationClick = (notification) => {
    if (notification.data) {
      switch (notification.data.type) {
        case 'request':
          // Navigate to loans page and show request details
          setTab('prestiti');
          setSelectedRequestFromNotification(notification.data);
          setNotificationsOpen(false);
          break;
        case 'loan':
          // Navigate to loans page and show loan details
          setTab('prestiti');
          setNotificationsOpen(false);
          break;
        case 'inventory':
          // Navigate to inventory page
          setTab('inventario');
          setNotificationsOpen(false);
          break;
        default:
          break;
      }
    }
    // Mark as read
    handleMarkAsRead(notification.id);
  };

  // Gestione URL per la navigazione
  const getCurrentTab = () => {
    const path = window.location.pathname;
    if (path === '/' || path === '/dashboard') return 'dashboard';
    if (path === '/inventario') return 'inventario';
    if (path === '/tesi-laurea') return 'tesi-laurea';
    if (path === '/cataloghi') return 'dashboard';
    if (path === '/riviste') return 'riviste';
    if (path === '/prestiti') return 'prestiti';
    if (path === '/riparazioni') return 'riparazioni';
    if (path === '/utenti') return 'utenti';
    if (path === '/statistiche') return 'statistiche';
    if (path === '/sistema') return 'sistema';
    if (path === '/utente') return 'utente';
    return 'dashboard';
  };

  const [tab, setTab] = useState(getCurrentTab());
  const [loansInitialTab, setLoansInitialTab] = useState(null);

  // Funzione per cambiare tab e aggiornare URL
  const handleTabChange = (newTab, options = {}) => {
    const targetTab = BLOCKED_SECTIONS.has(newTab) ? 'dashboard' : newTab;
    setTab(targetTab);
    const path = targetTab === 'dashboard' ? '/' : `/${targetTab}`;
    window.history.pushState({}, '', path);
    
    // Se ci sono opzioni per il tab prestiti, salva il tab iniziale
    if (newTab === 'prestiti' && options.initialTab) {
      setLoansInitialTab(options.initialTab);
    }
  };

  // Chiudi sidebar su resize
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Gestione popstate per il back/forward del browser
  useEffect(() => {
    const handlePopState = () => {
      setTab(getCurrentTab());
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);


  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar Mobile */}
      <div className={`fixed inset-0 z-50 lg:hidden ${sidebarOpen ? 'block' : 'hidden'}`}>
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setSidebarOpen(false)}></div>
        <div className="relative flex flex-col w-64 h-full bg-white shadow-xl border-r border-gray-200">
          <div className="flex items-center justify-between p-4 border-b">
            <div
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleTabChange('dashboard')}
            >
              <img src="/logoSito.svg" alt="LABA Logo" className="h-8 w-auto" />
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              className="p-2 rounded-lg hover:bg-gray-100"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          <nav className="flex-1 p-4 space-y-2">
            {isAdmin ? (
              <>
                <NavButton icon={<LayoutDashboard className="w-5 h-5" />} label="Dashboard" tab="dashboard" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<BookOpen className="w-5 h-5" />} label="Libri" tab="inventario" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<BookOpen className="w-5 h-5" />} label="Tesi" tab="tesi-laurea" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<Newspaper className="w-5 h-5" />} label="Riviste" tab="riviste" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<ArrowLeftRight className="w-5 h-5" />} label="Prestiti" tab="prestiti" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<AlertTriangle className="w-5 h-5" />} label="Segnalazioni" tab="riparazioni" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<Users className="w-5 h-5" />} label="Gestione Utenti" tab="utenti" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<Monitor className="w-5 h-5" />} label="Stato del Sistema" tab="sistema" currentTab={tab} onClick={handleTabChange} />
              </>
            ) : (
              <NavButton icon={<Users className="w-5 h-5" />} label="Area Utente" tab="utente" currentTab={tab} onClick={setTab} />
            )}
          </nav>
          <UserBadge />
        </div>
      </div>

      {/* Sidebar Desktop - Only for Admin, Completely hidden on mobile */}
      {/* Mostra sempre la sidebar durante il loading per evitare flash, poi nascondi se non admin */}
      {(!authLoading && isAdmin) || (authLoading && token) ? (
        <div className="sidebar-desktop hidden lg:flex lg:flex-col lg:w-64 bg-white sidebar border-r border-gray-200">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => handleTabChange('dashboard')}
            >
              <img src="/logoSito.svg" alt="LABA Logo" className="h-12 w-auto" />
            </div>
            {/* Theme toggle removed */}
          </div>

          <nav className="flex-1 p-4 space-y-2">
            {authLoading ? (
              // Skeleton per la sidebar durante il loading
              <>
                {[...Array(6)].map((_, i) => (
                  <div key={i} className="h-12 bg-gray-200 rounded-lg animate-pulse mb-2"></div>
                ))}
              </>
            ) : (
              <>
                <NavButton icon={<LayoutDashboard className="icon" />} label="Dashboard" tab="dashboard" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<BookOpen className="icon" />} label="Libri" tab="inventario" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<BookOpen className="icon" />} label="Tesi" tab="tesi-laurea" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<Newspaper className="icon" />} label="Riviste" tab="riviste" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<ArrowLeftRight className="icon" />} label="Prestiti" tab="prestiti" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<AlertTriangle className="icon" />} label="Segnalazioni" tab="riparazioni" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<Users className="icon" />} label="Gestione Utenti" tab="utenti" currentTab={tab} onClick={handleTabChange} />
                <NavButton icon={<Monitor className="icon" />} label="Stato del Sistema" tab="sistema" currentTab={tab} onClick={handleTabChange} />
                {/* Statistiche nascoste - non richieste per biblioteca */}
                {/* <NavButton 
icon={<svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>} 
label="Statistiche" 
tab="statistiche" 
currentTab={tab} 
onClick={handleTabChange} 
/> */}
              </>
            )}
          </nav>
          <UserBadge />
        </div>
      ) : null}

      {/* Main Content */}
      <div className="flex-1 flex flex-col min-h-screen lg:ml-64">
        {/* Top Bar Mobile */}
        <div className="lg:hidden header px-4 py-3 flex items-center justify-between">
          <div
            className="cursor-pointer hover:opacity-80 transition-opacity"
            onClick={() => handleTabChange('dashboard')}
          >
            <img src="/logoSito.svg" alt="LABA Logo" className="h-8 w-auto" />
          </div>
          <div className="flex items-center space-x-2">
            {/* Notification Bell */}
            <button
              onClick={() => setNotificationsOpen(true)}
              className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Bell className="w-6 h-6 text-gray-600" />
              {notifications.filter(n => !n.isRead).length > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {notifications.filter(n => !n.isRead).length}
                </span>
              )}
            </button>
            {/* Hamburger Menu */}
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 ease-in-out hover:scale-105"
            >
              <Menu className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Top Bar Desktop - For Users */}
        {!isAdmin && (
          <div className="hidden lg:block bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
              </div>
              <div className="flex items-center space-x-4">
                {/* Notifications Bell */}
                <button
                  onClick={() => setNotificationsOpen(true)}
                  className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <Bell className="w-6 h-6 text-gray-600" />
                  {/* Notification Badge */}
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium animate-pulse">
                      {unreadCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Content Area */}
        {isAdmin ? (
          <div className="flex-1 flex flex-col">
            {/* Top Bar Desktop - For Admin */}
            <div className="hidden lg:block bg-white border-b border-gray-200 px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                </div>
                <div className="flex items-center space-x-4">
                  {/* Notifications Bell */}
                  <button
                    onClick={() => setNotificationsOpen(true)}
                    className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    <Bell className="w-6 h-6 text-gray-600" />
                    {/* Notification Badge */}
                    {unreadCount > 0 && (
                      <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-medium animate-pulse">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <main className="flex-1 p-4 lg:p-6 main-content">
              <div className="max-w-7xl mx-auto">
                {tab === 'dashboard' && <Dashboard onNavigate={handleTabChange} />}
                {tab === 'inventario' && <BookInventory />}
                {tab === 'tesi-laurea' && <ThesisInventory />}
                {tab === 'riviste' && <MagazineInventory />}
                {tab === 'prestiti' && <Loans 
                  selectedRequestFromNotification={selectedRequestFromNotification} 
                  onRequestHandled={() => setSelectedRequestFromNotification(null)}
                  initialTab={loansInitialTab}
                  onTabSet={() => setLoansInitialTab(null)}
                />}
                {tab === 'riparazioni' && <Repairs />}
                {tab === 'utenti' && <UserManagement />}
                {/* Statistiche nascoste - non richieste per biblioteca */}
                {/* {tab === 'statistiche' && <Statistics />} */}
                {tab === 'sistema' && <SystemStatus />}
              </div>
            </main>

            {/* Footer - Hidden when mobile menu is open */}
            {!mobileMenuOpen && <Footer onSystemClick={() => setTab('sistema')} />}
          </div>
        ) : (
          <UserArea />
        )}

        {/* Notifications Panel */}
        <NotificationsPanel
          isOpen={notificationsOpen}
          onClose={() => setNotificationsOpen(false)}
          notifications={notifications}
          onMarkAsRead={handleMarkAsRead}
          onDelete={handleDeleteNotification}
          onClick={handleNotificationClick}
        />

        {/* Mobile Menu for Admin */}
        {isAdmin && (
          <MobileMenu
            isOpen={mobileMenuOpen}
            onClose={() => setMobileMenuOpen(false)}
            sidebarItems={adminSidebarItems}
            activeView={tab}
            onNavigate={handleTabChange}
            user={user}
            logout={logout}
          />
        )}

        {/* <NotificationManager /> */}
      </div>
    </div>
  );
}

// Componente per i pulsanti di navigazione
function NavButton({ icon, label, tab, currentTab, onClick }) {
  const isActive = currentTab === tab;
  return (
    <button
      type="button"
      onClick={(e) => {
        onClick(tab);
        e.currentTarget.blur(); // evita il bordo nero di focus al click
        // Chiudi sidebar mobile dopo la selezione
        if (window.innerWidth < 1024) {
          setTimeout(() => {
            const event = new Event('resize');
            window.dispatchEvent(event);
          }, 100);
        }
      }}
      className={`nav-button ${isActive ? 'active' : ''}`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// Badge utente
function UserBadge() {
  const { user, logout, roleLabel } = useAuth();
  if (!user) return null;

  const initials = (user.name?.[0] || "?") + (user.surname?.[0] || "");

  return (
    <div className="p-4 border-t border-gray-200 user-badge">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#033157' }}>
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {user.name} {user.surname}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {roleLabel} • {user.email}
          </p>
        </div>
      </div>
      <button
        onClick={logout}
        className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 ease border border-gray-200 "
      >
        <LogOut className="w-4 h-4 mr-2" />
        Esci
      </button>
    </div>
  );
}

function Gate() {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Login branding="LABA – Biblioteca" />;
  return <AppInner />;
}

export default function App() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  );
}