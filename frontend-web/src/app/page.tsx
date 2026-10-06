'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const [isLogin, setIsLogin] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    try {
      const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
      const body = isLogin ? { email, password } : { email, password, name };

      const apiBase = process.env.NEXT_PUBLIC_API_URL || '';
      const response = await fetch(`${apiBase}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.message || `${isLogin ? 'Login' : 'Registration'} failed`);
        return;
      }

      setSuccess(true);
      
      if (isLogin) {
        localStorage.setItem('token', data.token);
        if (data.user?.name) {
          localStorage.setItem('userName', data.user.name);
        } else if (data.user?.email) {
          localStorage.setItem('userName', data.user.email.split('@')[0]);
        }
        
        setTimeout(() => {
          router.push('/dashboard');
        }, 800);
      } else {
        setTimeout(() => {
          setSuccess(false);
          setIsLogin(true);
          setPassword('');
        }, 1500);
      }
      
    } catch (err) {
      setError('Network error. Is the gateway running?');
    }
  };

  return (
    <main className="flex-center" style={{ minHeight: '100vh', padding: '2rem' }}>
      <div className="glass-card" style={{ maxWidth: '400px', width: '100%' }}>
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{ 
            width: '64px', height: '64px', borderRadius: '50%', margin: '0 auto 1rem',
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '2rem'
          }}>
            🌊
          </div>
          <h1>StreamX</h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.5rem' }}>
            {isLogin ? 'Sign in to your account' : 'Create a new account'}
          </p>
        </div>

        {error && (
          <div style={{ background: 'rgba(255, 0, 51, 0.1)', color: 'var(--error)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid var(--error)' }}>
            {error}
          </div>
        )}

        {success && (
          <div style={{ background: 'rgba(0, 255, 136, 0.1)', color: '#00ff88', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', border: '1px solid #00ff88' }}>
            {isLogin ? 'Login Successful! Redirecting...' : 'Account created! Switching to login...'}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {!isLogin && (
            <div className="form-group">
              <label className="form-label" htmlFor="name">Full Name</label>
              <input 
                type="text" 
                id="name"
                className="form-input" 
                placeholder="John Doe" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!isLogin}
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <input 
              type="email" 
              id="email"
              className="form-input" 
              placeholder="you@example.com" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Password</label>
            <input 
              type="password" 
              id="password"
              className="form-input" 
              placeholder="••••••••" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn-primary">
            {isLogin ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <div style={{ marginTop: '2rem', textAlign: 'center', borderTop: '1px solid var(--glass-border)', paddingTop: '1.5rem' }}>
          <p>
            {isLogin ? "New to StreamX? " : "Already have an account? "}
            <button 
              className="link" 
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: 0 }}
              onClick={() => {
                setIsLogin(!isLogin);
                setError('');
                setSuccess(false);
              }}
            >
              {isLogin ? 'Create an Account' : 'Sign In'}
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
