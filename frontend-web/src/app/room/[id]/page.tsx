'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import io, { Socket } from 'socket.io-client';

export default function Room() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.id as string;
  
  const [hasJoined, setHasJoined] = useState(false);
  const [cameraError, setCameraError] = useState('');
  
  const [chatMessage, setChatMessage] = useState('');
  const [messages, setMessages] = useState<{sender: string, text: string}[]>([]);
  
  const [userName, setUserName] = useState('StreamX User');
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  
  const [connectedPeers, setConnectedPeers] = useState<{ id: string, name: string, stream: MediaStream | null }[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const peerNamesRef = useRef<Map<string, string>>(new Map());

  // 1. Preview Camera on Mount
  useEffect(() => {
    const token = localStorage.getItem('token');
    const storedName = localStorage.getItem('userName');
    if (storedName) setUserName(storedName);
    
    if (!token) {
      router.push('/');
      return;
    }

    const initCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
      } catch (err) {
        console.warn('Camera access blocked or not available', err);
        setCameraError('Camera access blocked (requires HTTPS or localhost). You will join as a viewer.');
      }
    };

    initCamera();

    return () => {
      localStreamRef.current?.getTracks().forEach(track => track.stop());
    };
  }, [router]);

  // 2. Join Room Logic
  const handleJoinRoom = () => {
    setHasJoined(true);
    setMessages([{ sender: 'System', text: 'Welcome to the live stream room!' }]);
    
    if (cameraError) {
      setMessages(prev => [...prev, { sender: 'System', text: cameraError }]);
    }

    const socketUrl = process.env.NEXT_PUBLIC_SIGNALING_URL || (typeof window !== 'undefined' ? window.location.origin : '');
    const socket = io(socketUrl, {
      path: '/socket.io',
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('user-joined', async ({ userId, name }) => {
      setMessages(prev => [...prev, { sender: 'System', text: `${name || 'A peer'} joined the room.` }]);
      peerNamesRef.current.set(userId, name || 'Unknown');
      addPeerToState(userId, name || 'Unknown');

      const pc = createPeerConnection(userId);
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc-offer', userId, { sdp: offer, name: userName });
      } catch (e) {
        console.error("Failed to create offer for new user", e);
      }
    });

    socket.on('existing-users', (users: { userId: string, name: string }[]) => {
      users.forEach((u) => {
        peerNamesRef.current.set(u.userId, u.name);
        addPeerToState(u.userId, u.name);
        createPeerConnection(u.userId);
      });
    });

    socket.on('user-left', ({ userId }) => {
      const peerName = peerNamesRef.current.get(userId) || 'A peer';
      setMessages(prev => [...prev, { sender: 'System', text: `${peerName} left the room.` }]);
      removePeerFromState(userId);
      const pc = peersRef.current.get(userId);
      if (pc) {
        pc.close();
        peersRef.current.delete(userId);
      }
    });

    socket.on('webrtc-offer', async ({ senderId, offer: payload }) => {
      const peerName = payload.name || 'Unknown';
      peerNamesRef.current.set(senderId, peerName);
      addPeerToState(senderId, peerName);

      const pc = createPeerConnection(senderId);
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('webrtc-answer', senderId, answer);
      } catch (e) {
        console.error("Failed to process offer", e);
      }
    });

    socket.on('webrtc-answer', async ({ senderId, answer }) => {
      const pc = peersRef.current.get(senderId);
      if (pc) {
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(answer));
        } catch (e) {
          console.error("Failed to process answer", e);
        }
      }
    });

    socket.on('webrtc-ice-candidate', async ({ senderId, candidate }) => {
      const pc = peersRef.current.get(senderId);
      if (pc && candidate) {
        try {
          await pc.addIceCandidate(new RTCIceCandidate(candidate));
        } catch (e) {
          console.error('Error adding ice candidate', e);
        }
      }
    });

    socket.on('receive-message', (message: { sender: string, text: string }) => {
      setMessages(prev => [...prev, message]);
    });

    // Announce ourselves
    socket.emit('join-room', roomId, { name: userName });
  };

  // Re-attach local stream when room becomes active
  useEffect(() => {
    if (hasJoined && localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current;
    }
  }, [hasJoined]);

  // 3. Cleanup on Unmount
  useEffect(() => {
    return () => {
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      peerNamesRef.current.clear();
      socketRef.current?.disconnect();
    };
  }, []);

  const addPeerToState = (id: string, name: string) => {
    setConnectedPeers(prev => {
      if (prev.find(p => p.id === id)) return prev;
      return [...prev, { id, name, stream: null }];
    });
  };

  const removePeerFromState = (id: string) => {
    setConnectedPeers(prev => prev.filter(p => p.id !== id));
  };

  const updatePeerStream = (id: string, stream: MediaStream) => {
    setConnectedPeers(prev => prev.map(p => p.id === id ? { ...p, stream } : p));
  };

  const createPeerConnection = (targetId: string) => {
    if (peersRef.current.has(targetId)) {
      return peersRef.current.get(targetId)!;
    }

    const pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' }
      ]
    });

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('webrtc-ice-candidate', targetId, event.candidate);
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams && event.streams[0] ? event.streams[0] : new MediaStream([event.track]);
      updatePeerStream(targetId, stream);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'disconnected' || pc.connectionState === 'failed' || pc.connectionState === 'closed') {
        removePeerFromState(targetId);
        peersRef.current.delete(targetId);
      }
    };

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    } else {
      pc.addTransceiver('video', { direction: 'recvonly' });
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    peersRef.current.set(targetId, pc);
    return pc;
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || !socketRef.current) return;
    const message = { sender: 'You', text: chatMessage };
    setMessages(prev => [...prev, message]);
    socketRef.current.emit('send-message', roomId, { sender: userName, text: chatMessage });
    setChatMessage('');
  };

  const toggleMic = () => {
    if (!localStreamRef.current) {
      alert('Your browser blocked microphone access because you are not on localhost or HTTPS. You are in Viewer Mode.');
      return;
    }
    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = !audioTrack.enabled;
      setIsMuted(!audioTrack.enabled);
    }
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) {
      alert('Your browser blocked camera access because you are not on localhost or HTTPS. You are in Viewer Mode.');
      return;
    }
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      setIsVideoOff(!videoTrack.enabled);
    }
  };

  const RemotePeer = ({ peer }: { peer: { id: string, name: string, stream: MediaStream | null } }) => {
    const ref = useRef<HTMLVideoElement>(null);
    useEffect(() => {
      if (ref.current && peer.stream) ref.current.srcObject = peer.stream;
    }, [peer.stream]);

    return (
      <div className="glass-card" style={{ background: 'rgba(0,0,0,0.8)', borderRadius: '16px', overflow: 'hidden', minHeight: '300px', position: 'relative' }}>
        {peer.stream ? (
          <video ref={ref} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
            No video from {peer.name}
          </div>
        )}
        <div style={{ position: 'absolute', bottom: '1rem', left: '1rem', background: 'rgba(0,0,0,0.6)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
          {peer.name}
        </div>
      </div>
    );
  };

  // Preview Screen
  if (!hasJoined) {
    return (
      <main className="flex-center" style={{ minHeight: '100vh', flexDirection: 'column', gap: '2rem' }}>
        <h2 style={{ fontSize: '2rem' }}>Ready to join the room?</h2>
        
        <div className="glass-card" style={{ width: '640px', height: '480px', background: '#000', position: 'relative', overflow: 'hidden', borderRadius: '16px' }}>
          <video 
            ref={localVideoRef} 
            autoPlay 
            muted 
            playsInline 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
          {cameraError && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.8)', padding: '2rem', textAlign: 'center' }}>
              <p style={{ color: 'var(--error)' }}>{cameraError}</p>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '1rem' }}>
          <button className="btn-social" onClick={() => router.push('/dashboard')}>Cancel</button>
          <button className="btn-primary" onClick={handleJoinRoom} style={{ padding: '0.8rem 3rem', fontSize: '1.2rem' }}>Join Room</button>
        </div>
      </main>
    );
  }

  // Active Room Screen
  return (
    <main style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <header style={{ 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '1rem 2rem', borderBottom: '1px solid var(--glass-border)',
        background: 'var(--glass-bg)', zIndex: 10
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button className="btn-social" style={{ width: '40px', height: '40px', fontSize: '1.2rem' }} onClick={() => router.push('/dashboard')}>←</button>
          <h2 style={{ fontSize: '1.2rem' }}>StreamX Room</h2>
          <span style={{ 
            background: '#ff0033', color: 'white', padding: '0.2rem 0.6rem', 
            borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', marginLeft: '1rem',
            animation: 'pulseBg 2s infinite'
          }}>LIVE</span>
        </div>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <div style={{ flex: 1, padding: '2rem', display: 'flex', flexDirection: 'column', gap: '1rem', overflowY: 'auto' }}>
          
          <div style={{ 
            display: 'grid', gap: '1rem', flex: 1,
            gridTemplateColumns: connectedPeers.length > 1 ? '1fr 1fr' : '1fr'
          }}>
            {connectedPeers.length === 0 ? (
              <div className="glass-card" style={{ 
                flex: 1, display: 'flex', background: 'rgba(0,0,0,0.8)', alignItems: 'center', justifyContent: 'center', borderRadius: '16px'
              }}>
                <div style={{ color: 'var(--text-secondary)' }}>Waiting for others to join...</div>
              </div>
            ) : (
              connectedPeers.map(peer => <RemotePeer key={peer.id} peer={peer} />)
            )}
          </div>

          <div style={{ position: 'relative', height: '100px', display: 'flex', justifyContent: 'center', alignItems: 'center', marginTop: 'auto' }}>
            <div style={{
              display: 'flex', gap: '1rem',
              background: 'var(--glass-bg)', padding: '0.75rem 1.5rem', borderRadius: '24px', border: '1px solid var(--glass-border)'
            }}>
              <button className="btn-social" onClick={toggleMic} style={{ background: isMuted ? 'var(--error)' : '' }}>
                {isMuted ? '🔇' : '🎤'}
              </button>
              <button className="btn-social" onClick={toggleCamera} style={{ background: isVideoOff ? 'var(--error)' : '' }}>
                {isVideoOff ? '🚫' : '📷'}
              </button>
              <button className="btn-social" style={{ background: 'var(--error)', borderColor: 'var(--error)' }} onClick={() => router.push('/dashboard')}>
                📞
              </button>
            </div>

            {localStreamRef.current && (
              <div style={{
                position: 'absolute', right: '0', bottom: '0', width: '160px', height: '120px',
                borderRadius: '12px', overflow: 'hidden', border: '2px solid var(--primary)', background: '#111'
              }}>
                <video 
                  ref={localVideoRef} 
                  autoPlay 
                  muted 
                  playsInline 
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              </div>
            )}
          </div>
        </div>

        <div style={{ width: '350px', borderLeft: '1px solid var(--glass-border)', background: 'var(--glass-bg)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '1rem', borderBottom: '1px solid var(--glass-border)' }}>
            <h3 style={{ fontSize: '1rem' }}>Live Chat</h3>
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ 
                background: msg.sender === 'You' ? 'rgba(131, 56, 236, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                padding: '0.75rem', borderRadius: '12px', alignSelf: msg.sender === 'You' ? 'flex-end' : 'flex-start', maxWidth: '85%'
              }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>{msg.sender}</div>
                <div style={{ fontSize: '0.9rem' }}>{msg.text}</div>
              </div>
            ))}
          </div>
          <div style={{ padding: '1rem', borderTop: '1px solid var(--glass-border)' }}>
            <form onSubmit={handleSendMessage} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" className="form-input" placeholder="Type a message..." 
                value={chatMessage} onChange={(e) => setChatMessage(e.target.value)} style={{ padding: '0.6rem' }}
              />
              <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.6rem 1rem' }}>Send</button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
