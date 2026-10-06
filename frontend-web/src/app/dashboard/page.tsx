'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function Dashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meetings, setMeetings] = useState<any[]>([]);
  
  const [newMeetingTitle, setNewMeetingTitle] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowedEmails, setAllowedEmails] = useState('');
  
  const [error, setError] = useState('');

  const apiBase = process.env.NEXT_PUBLIC_API_URL || '';

  const fetchMeetings = async (token: string) => {
    try {
      const res = await fetch(`${apiBase}/api/meetings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMeetings(data);
      }
    } catch (err) {
      console.error('Failed to fetch meetings', err);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.push('/');
    } else {
      setLoading(false);
      fetchMeetings(token);
    }
  }, [router]);

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!newMeetingTitle.trim()) {
      setError('Please enter a meeting title');
      return;
    }

    if (isPrivate && !allowedEmails.trim()) {
      setError('Please provide at least one email for private streams');
      return;
    }

    const token = localStorage.getItem('token');
    try {
      const res = await fetch(`${apiBase}/api/meetings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ 
          title: newMeetingTitle,
          isPrivate,
          allowedEmails 
        }),
      });

      if (!res.ok) throw new Error('Failed to create meeting');

      setNewMeetingTitle('');
      setIsPrivate(false);
      setAllowedEmails('');
      fetchMeetings(token as string);
    } catch (err) {
      setError('Error creating meeting');
    }
  };

  if (loading) {
    return <main className="flex-center" style={{ minHeight: '100vh' }}>Loading...</main>;
  }

  return (
    <main style={{ padding: '2rem', minHeight: '100vh', maxWidth: '1200px', margin: '0 auto' }}>
      <header style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        paddingBottom: '1.5rem',
        borderBottom: '1px solid var(--glass-border)',
        marginBottom: '2.5rem'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div style={{ 
            width: '40px', height: '40px', borderRadius: '50%', 
            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>🌊</div>
          <h2>StreamX Dashboard</h2>
        </div>
        
        <button 
          className="btn-social" 
          style={{ width: 'auto', padding: '0 1rem', borderRadius: '8px' }}
          onClick={() => {
            localStorage.removeItem('token');
            router.push('/');
          }}
        >
          Logout
        </button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
        
        {/* Left Column: Create Meeting */}
        <div className="glass-card" style={{ padding: '2rem', height: 'fit-content' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Create a Live Stream</h3>
          
          <form onSubmit={handleCreateMeeting}>
            {error && <div style={{ color: 'var(--error)', marginBottom: '1rem', fontSize: '0.85rem' }}>{error}</div>}
            
            <div className="form-group">
              <label className="form-label" htmlFor="title">Stream Title</label>
              <input 
                type="text" 
                id="title"
                className="form-input" 
                placeholder="e.g. Weekly Tech Sync" 
                value={newMeetingTitle}
                onChange={(e) => setNewMeetingTitle(e.target.value)}
              />
            </div>

            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '1rem' }}>
              <input 
                type="checkbox" 
                id="isPrivate" 
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
                style={{ width: '18px', height: '18px' }}
              />
              <label htmlFor="isPrivate" style={{ margin: 0, fontSize: '0.9rem' }}>Make stream private</label>
            </div>

            {isPrivate && (
              <div className="form-group" style={{ marginTop: '1rem' }}>
                <label className="form-label" htmlFor="emails">Allowed Emails (comma separated)</label>
                <textarea 
                  id="emails"
                  className="form-input" 
                  placeholder="alice@wave.com, bob@wave.com" 
                  value={allowedEmails}
                  onChange={(e) => setAllowedEmails(e.target.value)}
                  style={{ minHeight: '60px', resize: 'vertical' }}
                />
              </div>
            )}

            <button type="submit" className="btn-primary" style={{ marginTop: '1.5rem' }}>
              Schedule Stream
            </button>
          </form>
        </div>

        {/* Right Column: List Meetings */}
        <div className="glass-card" style={{ padding: '2rem' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Available Streams</h3>
          
          {meetings.length === 0 ? (
            <p style={{ textAlign: 'center', padding: '2rem 0' }}>No streams found. Create one on the left!</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {meetings.map((meeting) => (
                <div key={meeting.id} style={{ 
                  background: 'var(--input-bg)', 
                  border: '1px solid var(--glass-border)',
                  borderRadius: '12px',
                  padding: '1.25rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <h4 style={{ fontSize: '1.1rem', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {meeting.title}
                      {meeting.isPrivate && <span style={{ fontSize: '0.7rem', background: 'rgba(255,255,255,0.1)', padding: '0.2rem 0.5rem', borderRadius: '4px' }}>🔒 Private</span>}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Status: <span style={{ color: meeting.status === 'LIVE' ? '#00ff88' : '#4cc9f0' }}>{meeting.status}</span>
                    </p>
                  </div>
                  <button 
                    className="btn-primary" 
                    style={{ width: 'auto', padding: '0.6rem 1.25rem' }}
                    onClick={() => router.push(`/room/${meeting.id}`)}
                  >
                    Join Room
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}
