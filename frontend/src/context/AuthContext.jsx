import React, { createContext, useContext, useEffect, useState } from 'react';
import axios from 'axios';
import { supabase, supabaseConfigured } from '../api/supabase';

const AuthContext = createContext({});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:8000/api/v1';

  useEffect(() => {
    // If Supabase is not configured, skip auth setup and just mark loading done
    if (!supabaseConfigured || !supabase) {
      setLoading(false);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId) => {
    try {
      const res = await axios.get(`${API_BASE}/profiles/${userId}`);
      setProfile(res.data);
    } catch (err) {
      if (err.response && err.response.status === 404) {
        setProfile(null);
      } else {
        console.error('Error fetching profile:', err);
      }
    } finally {
      setLoading(false);
    }
  };

  const loginWithGoogle = async () => {
    if (!supabase) {
      alert('Supabase is not configured yet. Please add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to your frontend/.env file.');
      return;
    }
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    });
  };

  const logout = async () => {
    if (supabase) await supabase.auth.signOut();
    setProfile(null);
    setUser(null);
    setSession(null);
  };

  const refreshProfile = async () => {
    if (user) await fetchProfile(user.id);
  };

  return (
    <AuthContext.Provider value={{
      user, session, profile, loading,
      loginWithGoogle, logout, refreshProfile,
      API_BASE,
      supabaseConfigured
    }}>
      {children}
    </AuthContext.Provider>
  );
};
