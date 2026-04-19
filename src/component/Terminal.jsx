import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Terminal.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const SYSTEM_PROMPT = `You are J.A.R.V.I.S, a sophisticated AI butler. Address the user as 'master'.
RULES:
1. Concise, formal.
2. MULTI-TASK: If master says "open X, Y and Z", call 'open_website' for EACH one in a single turn.
3. 'media_control' is ONLY for playing songs/videos. For opening sites like "YouTube" or "Facebook", use 'open_website'.
4. If task fails, say: "Sorry master, I'm not able to do the task."
5. NO JSON.
VOCAB: YouTube, Facebook,  Instagram, X, Gmail, WhatsApp, VS Code.`;

function getISTDateTime() {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
  const t = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  return `IST: ${d} ${t}`;
}

export default function Terminal() {
  const [messages, setMessages] = useState([]);       
  const [userText, setUserText] = useState('');       
  const [jarvisText, setJarvisText] = useState('');   
  const [status, setStatus] = useState('idle');       
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const convHistoryRef = useRef([]);                  
  const messagesEndRef = useRef(null);               

  const [size, setSize] = useState({ width: 440, height: 180 });
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;
    const onMouseMove = (e) => {
      const newWidth = window.innerWidth - e.clientX - 30;
      const newHeight = window.innerHeight - e.clientY - 30;
      setSize({ width: Math.max(300, newWidth), height: Math.max(200, newHeight) });
    };
    const onMouseUp = () => setIsResizing(false);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, userText, jarvisText]);

  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 1.2; 
    utterance.pitch = 0.95;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => v.name.includes('Ryan') || v.name.includes('George') || v.name.includes('UK English Male')) || voices[0];
    if (preferred) utterance.voice = preferred;

    const watchdog = setTimeout(() => {
      if (isSpeakingRef.current) {
        isSpeakingRef.current = false;
        setStatus(listeningRef.current ? 'listening' : 'idle');
      }
    }, 12000);

    utterance.onstart = () => { isSpeakingRef.current = true; setStatus('speaking'); };
    utterance.onend = () => { clearTimeout(watchdog); isSpeakingRef.current = false; setStatus(listeningRef.current ? 'listening' : 'idle'); };
    utterance.onerror = () => { clearTimeout(watchdog); isSpeakingRef.current = false; setStatus('idle'); };
    window.speechSynthesis.speak(utterance);
  }, []);

  const askGroq = useCallback(async (userMessage) => {
    if (!userMessage.trim()) return;
    setStatus('thinking');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setUserText('');
    setJarvisText('');
    window.speechSynthesis?.cancel(); 

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 20000); 

    const contextMsg = `${userMessage}\n\n(${getISTDateTime()})`;
    const updatedHistory = [...convHistoryRef.current, { role: 'user', content: contextMsg }].slice(-10);
    convHistoryRef.current = updatedHistory;

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...updatedHistory], stream: true }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) throw new Error('Network error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '', buffer = '', isHallucinating = false;

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const raw = line.replace('data: ', '').trim();
          if (raw === '[DONE]') break;
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content || '';
            if (token.includes('{') || token.includes('<')) isHallucinating = true;
            if (isHallucinating) {
              if (/[.!?]\s$/.test(token) || (token.length > 2 && !/[{<"':]/.test(token))) isHallucinating = false;
              if (isHallucinating) continue; 
            }
            fullText += token;
            buffer += token;
            setJarvisText(fullText);
            if (/[.!?]\s$/.test(buffer) || (buffer.length > 80 && /[.?!]/.test(token))) {
              speak(buffer.trim());
              buffer = '';
            }
          } catch {}
        }
      }
      if (buffer.trim()) speak(buffer.trim());
      setMessages(prev => [...prev, { role: 'jarvis', text: fullText }]);
      convHistoryRef.current = [...updatedHistory, { role: 'assistant', content: fullText }].slice(-10);
    } catch (err) {
      console.error('Groq error:', err);
      const errMsg = err.name === 'AbortError' ? 'Request timed out.' : 'Connection lost.';
      setMessages(prev => [...prev, { role: 'jarvis', text: errMsg }]);
      speak(errMsg);
    } finally {
      setJarvisText('');
      setStatus(listeningRef.current ? 'listening' : 'idle');
    }
  }, [speak]);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';
    recognition.onstart = () => setStatus('listening');
    recognition.onresult = (event) => {
      if (isSpeakingRef.current) return;
      let interim = '', final = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      const current = (final || interim).trim();
      if (current) setUserText(current);
      if (final.trim()) {
        const text = final.trim();
        const wakeWords = ['jarvis', 'zervas', 'service', 'hi jarvis', 'hello jarvis'];
        if (wakeWords.some(w => text.toLowerCase().includes(w))) askGroq(text);
        else setTimeout(() => setUserText(''), 2000);
      }
    };
    recognition.onend = () => {
      if (listeningRef.current) {
        try { 
          recognition.start(); 
          setStatus(prev => (prev === 'thinking' || prev === 'speaking') ? prev : 'listening');
        } catch {}
      } else setStatus('idle');
    };
    recognitionRef.current = recognition;
    return () => {
      listeningRef.current = false;
      recognitionRef.current?.stop();
      window.speechSynthesis?.cancel();
    };
  }, [askGroq]);

  const toggleListening = () => {
    if (!recognitionRef.current) return;
    if (listeningRef.current) {
      listeningRef.current = false;
      recognitionRef.current.stop();
      window.speechSynthesis?.cancel();
      isSpeakingRef.current = false; 
      setStatus('idle');
      setUserText('');
    } else {
      listeningRef.current = true;
      isSpeakingRef.current = false;
      try { recognitionRef.current.start(); setStatus('listening'); } catch {}
    }
  };

  const statusLabel = { idle: 'OFFLINE', listening: 'LISTENING', thinking: 'PROCESSING', speaking: 'RESPONDING' }[status];

  return (
    <div className="jarvis-terminal-wrapper" style={{ width: size.width, height: size.height }}>
      <div className="terminal-resize-handle" onMouseDown={startResizing} />
      <div className="terminal-topbar">
        <span className="terminal-title">J.A.R.V.I.S INTERFACE</span>
        <div className="terminal-controls">
          <span className={`status-badge ${status}`}>{statusLabel}</span>
          <button className={`mic-btn ${listeningRef.current ? 'active' : ''}`} onClick={toggleListening}>
            {listeningRef.current ? '⏹ STOP' : '🎙 ACTIVATE'}
          </button>
        </div>
      </div>
      <div className="terminal-body">
        {messages.map((msg, i) => (
          <div key={i} className={`msg-row ${msg.role}`}>
            <span className="msg-label">{msg.role === 'user' ? 'YOU' : 'J.A.R.V.I.S'}</span>
            <span className="msg-text">{msg.text}</span>
          </div>
        ))}
        {userText && (
          <div className="msg-row user live">
            <span className="msg-label">YOU</span>
            <span className="msg-text">{userText}<span className="cursor-blink">|</span></span>
          </div>
        )}
        {jarvisText && (
          <div className="msg-row jarvis live">
            <span className="msg-label">J.A.R.V.I.S</span>
            <span className="msg-text">{jarvisText}<span className="cursor-blink">|</span></span>
          </div>
        )}
        {messages.length === 0 && !userText && !jarvisText && (
          <div className="msg-row system">
            <span className="msg-label">SYS</span>
            <span className="msg-text">Say "Jarvis..." to start.</span>
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>
    </div>
  );
}
