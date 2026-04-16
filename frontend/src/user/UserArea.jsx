import React, { useState, useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import UserDashboard from '../components/UserDashboard';
import MyLoans from '../components/MyLoans';
import AvailableItems from '../components/AvailableItems';
import ReportFault from '../components/ReportFault';
import SystemStatus from '../components/SystemStatus.jsx';
import Footer from '../components/Footer';
import MobileMenu from '../components/MobileMenu';

// UserBadge Component (simplified to avoid overlap)
function UserBadge() {
  const { user, logout, roleLabel } = useAuth();
  if (!user) return null;
  
  const initials = (user.name?.[0] || "?") + (user.surname?.[0] || "");
  
  return (
    <div className="p-4 border-t border-gray-200 user-badge">
      <div className="flex items-center space-x-3 mb-3">
        <div className="w-10 h-10 bg-gradient-to-r from-teal-600 to-teal-700 rounded-full flex items-center justify-center">
          <span className="text-white font-semibold text-sm">{initials}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-800 truncate">
            {user.name} {user.surname}
          </p>
          <p className="text-xs text-gray-500 truncate">
            {roleLabel}
          </p>
        </div>
      </div>
      <button 
        onClick={logout}
        className="w-full flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all duration-200 ease border border-gray-200"
      >
        <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
        </svg>
        Esci
      </button>
    </div>
  );
}

const UserArea = () => {
  const [activeView, setActiveView] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, logout } = useAuth();


  const sidebarItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: (
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
      )
    },
    {
      id: 'my-loans',
      label: 'I Miei Prestiti',
      icon: (
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      id: 'available-items',
      label: 'Catalogo',
      icon: (
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
        </svg>
      )
    },
    {
      id: 'available-items-thesis',
      label: 'Tesi di laurea',
      icon: (
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 14l9-5-9-5-9 5 9 5z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 12v4.5c0 1.2 2.2 2.5 5 2.5s5-1.3 5-2.5V12" />
        </svg>
      )
    },
    {
      id: 'available-items-catalogs',
      label: 'Cataloghi',
      icon: (
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 4h9a2 2 0 012 2v12a2 2 0 01-2 2H6z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8h11M6 12h11M6 16h11" />
        </svg>
      )
    },
    {
      id: 'available-items-magazines',
      label: 'Riviste',
      icon: (
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 5h10a2 2 0 012 2v12H5V7a2 2 0 012-2z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 9h6M9 13h6M9 17h4" />
        </svg>
      )
    },
    {
      id: 'report-fault',
      label: 'Segnala Guasto',
      icon: (
        <svg className="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
        </svg>
      )
    }
  ];

  // Navigation to system status removed - only admin can access

  const renderActiveView = () => {
    switch (activeView) {
      case 'dashboard':
        return <UserDashboard />;
      case 'my-loans':
        return <MyLoans />;
      case 'available-items':
        return <AvailableItems catalogType="libri" />;
      case 'available-items-thesis':
        return <AvailableItems catalogType="tesi" />;
      case 'available-items-catalogs':
        return <AvailableItems catalogType="cataloghi" />;
      case 'available-items-magazines':
        return <AvailableItems catalogType="riviste" />;
      case 'report-fault':
        return <ReportFault />;
      default:
        return <UserDashboard />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex">
        {/* Mobile Header */}
        <div className="lg:hidden fixed top-0 left-0 right-0 bg-white border-b border-gray-200 px-4 py-3 z-30">
          <div className="flex items-center justify-between">
            <div 
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setActiveView('dashboard')}
            >
              <img src="/logoSito.svg" alt="LABA Logo" className="h-8 w-auto" />
            </div>
            <div className="flex items-center space-x-2">
              {/* Notification Bell */}
              <button
                className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
                {/* Badge for unread notifications - placeholder for future implementation */}
              </button>
              {/* Hamburger Menu */}
              <button
                onClick={() => setMobileMenuOpen(true)}
                className="p-2 rounded-lg hover:bg-gray-100 transition-all duration-200 ease-in-out hover:scale-105"
              >
                <svg className="w-6 h-6 transition-transform duration-200 ease-in-out" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar Desktop - Completely hidden on mobile */}
        <div className="sidebar-desktop hidden lg:flex lg:flex-col lg:w-64 bg-white sidebar border-r border-gray-200">
          <div className="flex items-center justify-between p-6 border-b border-gray-200">
            <div 
              className="flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              onClick={() => setActiveView('dashboard')}
            >
              <img src="/logoSito.svg" alt="LABA Logo" className="h-12 w-auto" />
            </div>
          </div>
          
          <nav className="flex-1 p-4 space-y-2">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`nav-button ${activeView === item.id ? 'active' : ''}`}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          
          <UserBadge />
        </div>

        {/* Main Content Area with Footer */}
        <div className="flex-1 flex flex-col">
          <main className="flex-1 pt-16 lg:pt-0">
            {renderActiveView()}
          </main>
          
          {/* Footer - Hidden when mobile menu is open */}
          {!mobileMenuOpen && <Footer onSystemClick={() => setActiveView('sistema')} />}
        </div>

        {/* Mobile Menu */}
        <MobileMenu
          isOpen={mobileMenuOpen}
          onClose={() => setMobileMenuOpen(false)}
          sidebarItems={sidebarItems}
          activeView={activeView}
          onNavigate={setActiveView}
          user={user}
          logout={logout}
        />
    </div>
  );
};

export default UserArea;