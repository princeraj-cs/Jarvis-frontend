import React, { useState, useEffect, useCallback } from 'react';
import './StatusPanel.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function StatusPanel() {
  const [micStatus, setMicStatus] = useState('checking');
  const [speechStatus, setSpeechStatus] = useState('offline');
  const [systemStats, setSystemStats] = useState({ cpu: 0, memory: 0 });
  const [backendHealth, setBackendHealth] = useState({
    status: 'checking',
    groq: false,
    news: false,
    weather: false
  });

  const [size, setSize] = useState({ width: 200, height: 'auto' });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e) => {
      const newWidth = e.clientX - 30;
      const newHeight = e.clientY - 80;
      setSize({
        width: Math.max(200, newWidth),
        height: Math.max(150, newHeight)
      });
    };
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  // Check microphone permission
  useEffect(() => {
    if (!navigator.permissions) {
      setMicStatus('unknown');
      return;
    }
    navigator.permissions.query({ name: 'microphone' }).then((result) => {
      setMicStatus(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'prompt');
      result.onchange = () => {
        setMicStatus(result.state === 'granted' ? 'granted' : result.state === 'denied' ? 'denied' : 'prompt');
      };
    });
  }, []);

  // Check speech synthesis availability
  useEffect(() => {
    if (window.speechSynthesis) setSpeechStatus('online');
    else setSpeechStatus('offline');
  }, []);

  // Fetch system telemetry
  useEffect(() => {
    const fetchSystem = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/system`);
        const data = await res.json();
        setSystemStats(data);
      } catch (err) {}
    };
    fetchSystem();
    const interval = setInterval(fetchSystem, 3000);
    return () => clearInterval(interval);
  }, []);

  // Check backend health
  useEffect(() => {
    const checkHealth = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/health`);
        const data = await res.json();
        setBackendHealth({
          status: 'online',
          groq: data.groq,
          news: data.news,
          weather: data.weather
        });
      } catch (err) {
        setBackendHealth({
          status: 'offline',
          groq: false,
          news: false,
          weather: false
        });
      }
    };

    checkHealth();
    const interval = setInterval(checkHealth, 5000); // Check every 5 seconds
    return () => clearInterval(interval);
  }, []);

  const statuses = [
    {
      id: 'cpu',
      label: 'CPU USAGE',
      value: `${systemStats.cpu}%`,
      state: systemStats.cpu > 80 ? 'offline' : systemStats.cpu > 50 ? 'warning' : 'online',
    },
    {
      id: 'mem',
      label: 'MEMORY',
      value: `${systemStats.memory}%`,
      state: systemStats.memory > 85 ? 'offline' : systemStats.memory > 70 ? 'warning' : 'online',
    },
    {
      id: 'backend',
      label: 'BACKEND',
      value: backendHealth.status === 'online' ? 'CONNECTED' : 'DISCONNECTED',
      state: backendHealth.status === 'online' ? 'online' : 'offline',
    },
    {
      id: 'mic',
      label: 'MICROPHONE',
      value: micStatus === 'granted' ? 'ACTIVE' : micStatus === 'denied' ? 'BLOCKED' : 'READY',
      state: micStatus === 'granted' ? 'online' : micStatus === 'denied' ? 'offline' : 'warning',
    },
    {
      id: 'api',
      label: 'GROQ AI',
      value: backendHealth.groq ? 'ACTIVE' : 'INACTIVE',
      state: backendHealth.groq ? 'online' : 'offline',
    },
    {
      id: 'weather',
      label: 'WEATHER API',
      value: backendHealth.weather ? 'ACTIVE' : 'INACTIVE',
      state: backendHealth.weather ? 'online' : 'offline',
    },
    {
      id: 'speech',
      label: 'SPEECH ENGINE',
      value: speechStatus === 'online' ? 'ACTIVE' : 'OFFLINE',
      state: speechStatus === 'online' ? 'online' : 'offline',
    },
  ];

  return (
    <div className="status-panel" style={{ width: size.width, height: size.height }}>
      <div className="status-resize-handle" onMouseDown={startResizing} />
      <div className="status-panel-header">
        <span className="status-panel-title">SYSTEM STATUS</span>
        <div className="status-header-line" />
      </div>
      <div className="status-list">
        {statuses.map((s) => (
          <div key={s.id} className={`status-item ${s.state}`}>
            <div className="status-item-left">
              <div className={`status-dot ${s.state}`} />
              <span className="status-label">{s.label}</span>
            </div>
            <span className={`status-value ${s.state}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
