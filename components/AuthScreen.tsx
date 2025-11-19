import React, { useState } from 'react';
import { loginUser, registerUser } from '../services/firebase';
import { SparklesIcon, Spinner } from './Icons';

export const AuthScreen: React.FC = () => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (isRegistering) {
        await registerUser(email, password);
      } else {
        await loginUser(email, password);
      }
    } catch (err: any) {
      console.error("Error auth:", err);
      let msg = "Ocurrió un error.";
      if (err.code === 'auth/invalid-credential') msg = "Credenciales incorrectas.";
      if (err.code === 'auth/email-already-in-use') msg = "El correo ya está registrado.";
      if (err.code === 'auth/weak-password') msg = "La contraseña debe tener al menos 6 caracteres.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-brand-primary p-4 relative overflow-hidden">
      {/* Background Decoration */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 opacity-20 pointer-events-none">
         <div className="absolute -top-24 -left-24 w-96 h-96 bg-blue-600 rounded-full blur-[100px]"></div>
         <div className="absolute top-1/2 right-0 w-64 h-64 bg-violet-600 rounded-full blur-[100px]"></div>
      </div>

      <div className="bg-brand-secondary/50 p-8 rounded-xl shadow-2xl border border-brand-secondary w-full max-w-md z-10 backdrop-blur-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-violet-600 rounded-xl mb-4 shadow-lg">
            <SparklesIcon className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">Nova<span className="text-brand-accent">Scribe</span></h1>
          <p className="text-brand-text-secondary">
            {isRegistering ? "Crea tu cuenta de escritor" : "Bienvenido de nuevo, autor"}
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-3 rounded-lg mb-6 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Correo Electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all"
              placeholder="nombre@ejemplo.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-brand-text-secondary mb-1">Contraseña</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-3 text-white focus:ring-2 focus:ring-brand-accent focus:border-transparent outline-none transition-all"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-brand-accent hover:bg-sky-500 text-white font-bold py-3 rounded-lg transition-all transform hover:scale-[1.02] active:scale-95 flex justify-center items-center shadow-lg shadow-sky-500/20"
          >
            {loading ? (
              <Spinner className="h-5 w-5 text-white" />
            ) : (
              isRegistering ? "Registrarse" : "Iniciar Sesión"
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsRegistering(!isRegistering); setError(''); }}
            className="text-sm text-brand-text-secondary hover:text-white transition-colors"
          >
            {isRegistering ? "¿Ya tienes cuenta? Inicia Sesión" : "¿No tienes cuenta? Regístrate"}
          </button>
        </div>
      </div>
    </div>
  );
};