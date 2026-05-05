import { createContext, useContext, useEffect, useMemo, useState } from "react";
import axios from "axios";

const AuthContext = createContext(null);
export const useAuth = () => useContext(AuthContext);

const KEY = "laba_auth_token_v2";

export default function AuthProvider({ children }) {
 // Load persisted token once
 const [token, setToken] = useState(() => localStorage.getItem(KEY));
 const [user, setUser] = useState(null);
 const [authLoading, setAuthLoading] = useState(!!localStorage.getItem(KEY)); // Loading se c'è un token da verificare

 const isAuthenticated = !!token;
 const role = (user?.ruolo || user?.role || '').toLowerCase();
 const isSupervisor = role === 'supervisor';
 const isAdmin = !!(user && (role === 'admin' || isSupervisor));
 const roleLabel = user?.id === -1 || role === 'admin'
   ? 'Amministratore'
   : isSupervisor
     ? 'Supervisore'
     : 'Utente';

 // Axios instance with Authorization header when token is present
 const api = useMemo(() => {
 const inst = axios.create();
 inst.interceptors.request.use((cfg) => {
 if (token) cfg.headers.Authorization = `Bearer ${token}`;
 return cfg;
 });
 return inst;
 }, [token]);

 // Bootstrap: on token change, fetch /me (includes Authorization header via interceptor)
 useEffect(() => {
 let cancelled = false;
 async function loadMe() {
 if (!token) { 
 setUser(null); 
 setAuthLoading(false);
 return; 
 }
 setAuthLoading(true);
 try {
 const { data } = await api.get(`${import.meta.env.VITE_API_BASE_URL}/api/auth/me`);
 const u = data?.user || data || null; // tolerate both formats
 if (!cancelled) {
 setUser(u);
 setAuthLoading(false);
 }
 } catch (e) {
 // Logout only when token is actually invalid/forbidden.
 // Do not clear session for transient network/server errors (e.g. quick repeated refresh).
 const status = e?.response?.status;
 console.warn("/api/auth/me failed", status, e?.message);
 if (status === 401 || status === 403) {
 localStorage.removeItem(KEY);
 if (!cancelled) {
 setToken(null);
 setUser(null);
 setAuthLoading(false);
 }
 } else if (!cancelled) {
 setAuthLoading(false);
 }
 }
 }
 loadMe();
 return () => { cancelled = true; };
 }, [token, api]);

 // Login
 const login = async (identifier, password) => {
 try {
 const { data } = await api.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/login`, { 
 email: identifier, 
 username: identifier, 
 password 
 });
 const tok = data?.token;
 const u = data?.user || null;
 if (!tok || !u) throw new Error("Risposta login non valida");
 localStorage.setItem(KEY, tok);
 setToken(tok);
 setUser(u);
 return true;
 } catch (error) {
 const errorMessage = error.response?.data?.error || error.message || "Errore durante il login";
 throw new Error(errorMessage);
 }
 };

 // Register
 const register = async ({ name, surname, email, password, matricola, phone, ruolo, corso_accademico }) => {
 try {
 const payload = { name, surname, email, password, matricola, phone, ruolo, corso_accademico };
 const { data } = await api.post(`${import.meta.env.VITE_API_BASE_URL}/api/auth/register`, payload);
 const tok = data?.token;
 const u = data?.user || null;
 if (!tok || !u) throw new Error("Risposta registrazione non valida");
 localStorage.setItem(KEY, tok);
 setToken(tok);
 setUser(u);
 return true;
 } catch (error) {
 const errorMessage = error.response?.data?.error || error.message || "Errore durante la registrazione";
 throw new Error(errorMessage);
 }
 };

 const logout = () => {
 localStorage.removeItem(KEY);
 setToken(null);
 setUser(null);
 };

 // Expose helpers
 return (
 <AuthContext.Provider value={{ token, user, isAuthenticated, isAdmin, isSupervisor, role, roleLabel, api, login, register, logout, authLoading }}>
 {children}
 </AuthContext.Provider>
 );
}