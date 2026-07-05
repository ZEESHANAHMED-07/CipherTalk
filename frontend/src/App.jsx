import React from 'react';
import { useAuth } from './context/AuthContext';
import Auth from './pages/Auth';
import Chat from './pages/Chat';

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="gradient-bg min-h-screen flex flex-col justify-center items-center">
        <div className="relative flex items-center justify-center mb-6">
          <div className="absolute w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin glow-primary"></div>
          <div className="text-2xl">🔒</div>
        </div>
        <h1 className="text-xl font-bold tracking-wider gradient-text animate-pulse">CIPHERTALK</h1>
        <p className="text-gray-400 text-sm mt-2 font-mono">Initializing Zero-Knowledge Engine...</p>
      </div>
    );
  }

  return (
    <div className="gradient-bg min-h-screen">
      {user ? <Chat /> : <Auth />}
    </div>
  );
}

export default App;
