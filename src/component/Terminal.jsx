import React, { useState, useEffect, useRef, useCallback } from 'react';
import './Terminal.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
const GROQ_MODEL = 'llama-3.1-8b-instant';
const SYSTEM_PROMPT = `You are J.A.R.V.I.S, a sophisticated AI butler.
RULES:
1. Concise, formal English.
2. Use 'media_control' for music/video (YouTube/Spotify).
3. NEVER mix text and tool calls. Use tool first, then summarize.
4. ABSOLUTELY NO JSON in your final response.
5. Optimized for Indian English/Hinglish (e.g., Patna, Mumbai, Saharsa, IRCTC, "gaana bajao", "play song kar do", "what is the weather of Delhi").
6. Voice-to-Text input; ignore phonetic errors (e.g., "zervas" -> "Jarvis", "open chrome browser" -> "open chrome").`;

function getISTDateTime() {
  const now = new Date();
  const d = now.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric', month: 'short' });
  const t = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
  return `IST: ${d} ${t}`;
}

export default function Terminal() {
  const [messages, setMessages] = useState([]);       // full conversation history
  const [userText, setUserText] = useState('');       // live interim speech
  const [jarvisText, setJarvisText] = useState('');   // streaming Jarvis response
  const [status, setStatus] = useState('idle');       // idle | listening | thinking | speaking
  const recognitionRef = useRef(null);
  const listeningRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const convHistoryRef = useRef([]);                  // keeps Groq message history
  const messagesEndRef = useRef(null);               // for auto-scroll
  const [size, setSize] = useState({ width: 440, height: 180 });
  const [isResizing, setIsResizing] = useState(false);

  // Resize handler
  const startResizing = useCallback((e) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  useEffect(() => {
    if (!isResizing) return;

    const onMouseMove = (e) => {
      // Calculate new size based on mouse movement relative to bottom-right anchor
      const newWidth = window.innerWidth - e.clientX - 30; // 30 is the 'right' offset
      const newHeight = window.innerHeight - e.clientY - 30; // 30 is the 'bottom' offset
      
      setSize({
        width: Math.max(300, newWidth),
        height: Math.max(200, newHeight)
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [isResizing]);

  // ---- Auto-scroll to bottom on every update ----
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, userText, jarvisText]);

  // ---- Web Speech API (TTS) ----
  const speak = useCallback((text) => {
    if (!window.speechSynthesis || !text) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = 'en-GB';
    utterance.rate = 1.2; 
    utterance.pitch = 0.95;

    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes('Microsoft Ryan') ||
      v.name.includes('Microsoft George') ||
      v.name.includes('Google UK English Male')
    ) || voices.find(v => v.lang.startsWith('en-GB')) || voices[0];
    if (preferred) utterance.voice = preferred;

    utterance.onstart = () => {
      isSpeakingRef.current = true;
      setStatus('speaking');
    };
    utterance.onend = () => {
      isSpeakingRef.current = false;
      if (listeningRef.current) setStatus('listening');
      else setStatus('idle');
    };
    window.speechSynthesis.speak(utterance);
  }, []);

  // ---- Groq AI Proxy (streaming with Chunked TTS) ----
  const askGroq = useCallback(async (userMessage) => {
    if (!userMessage.trim()) return;
    setStatus('thinking');
    setJarvisText('');
    window.speechSynthesis?.cancel(); 

    const contextMsg = `${userMessage}\n\n(${getISTDateTime()})`;
    const updatedHistory = [...convHistoryRef.current, { role: 'user', content: contextMsg }].slice(-10);
    convHistoryRef.current = updatedHistory;

    try {
      const response = await fetch(`${BACKEND_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model: GROQ_MODEL, messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...updatedHistory], stream: true }),
      });

      if (!response.ok) throw new Error('Network error');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '', buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const lines = decoder.decode(value).split('\n').filter(l => l.startsWith('data: '));
        for (const line of lines) {
          const raw = line.replace('data: ', '').trim();
          if (raw === '[DONE]') break;
          try {
            const token = JSON.parse(raw).choices?.[0]?.delta?.content || '';
            
            // Skip hallucinated JSON or tool tags in the stream
            if (token.includes('{') && token.includes('"')) continue; 
            if (token.includes('<function')) continue;

            fullText += token;
            buffer += token;
            setJarvisText(fullText);

            if (/[.!?]\s$/.test(buffer) || (buffer.length > 100 && /\s$/.test(token))) {
              speak(buffer.trim());
              buffer = '';
            }
          } catch {}
        }
      }

      if (buffer.trim()) speak(buffer.trim());

      convHistoryRef.current = [...updatedHistory, { role: 'assistant', content: fullText }].slice(-10);
      setMessages(prev => [...prev, { role: 'user', text: userMessage }, { role: 'jarvis', text: fullText }]);
      setJarvisText('');
      setUserText('');
      setStatus(listeningRef.current ? 'listening' : 'idle');

    } catch (err) {
      console.error('Groq error:', err);
      const errMsg = 'Connection lost. Please try again.';
      setMessages(prev => [...prev, { role: 'jarvis', text: errMsg }]);
      speak(errMsg);
      setStatus('idle');
    }
  }, [speak]);

  // ---- Speech Recognition ----
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setMessages([{ role: 'system', text: 'Speech Recognition not supported in this browser.' }]);
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-IN';

    recognition.onstart = () => {
      setStatus('listening');
    };

    recognition.onresult = (event) => {
      // Don't process speech while Jarvis is speaking
      if (isSpeakingRef.current) return;

      let interim = '';
      let final = '';
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          final += event.results[i][0].transcript;
        } else {
          interim += event.results[i][0].transcript;
        }
      }

    if (final.trim()) {
        if (status === 'thinking' || status === 'speaking') return;
        setUserText('');
        askGroq(final.trim());
      } else if (interim) {
        setUserText(interim);
      }
    };

    recognition.onerror = (event) => {
      if (event.error === 'not-allowed') {
        setMessages(prev => [...prev, { role: 'system', text: 'Microphone access denied.' }]);
      }
    };

    recognition.onend = () => {
      // If we are still supposed to be listening, restart the service
      if (listeningRef.current) {
        try { 
          recognition.start(); 
          setStatus('listening');
        } catch (e) {
          // Ignore "already started" errors
        }
      } else {
        setStatus('idle');
      }
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
      isSpeakingRef.current = false; // Reset speaking state
      setStatus('idle');
      setUserText('');
    } else {
      listeningRef.current = true;
      isSpeakingRef.current = false; // Reset speaking state before starting
      try { 
        recognitionRef.current.start(); 
        setStatus('listening');
      } catch (e) {
        console.error('Recognition start error:', e);
      }
    }
  };

  const statusLabel = {
    idle: 'OFFLINE',
    listening: 'LISTENING',
    thinking: 'PROCESSING',
    speaking: 'RESPONDING',
  }[status];

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
        {/* Conversation history */}
        {messages.map((msg, i) => (
          <div key={i} className={`msg-row ${msg.role}`}>
            <span className="msg-label">
              {msg.role === 'user' ? 'YOU' : msg.role === 'jarvis' ? 'J.A.R.V.I.S' : 'SYS'}
            </span>
            <span className="msg-text">{msg.text}</span>
          </div>
        ))}

        {/* Live user speech (interim) */}
        {userText && (
          <div className="msg-row user live">
            <span className="msg-label">YOU</span>
            <span className="msg-text">{userText}<span className="cursor-blink">|</span></span>
          </div>
        )}

        {/* Streaming Jarvis response */}
        {jarvisText && (
          <div className="msg-row jarvis live">
            <span className="msg-label">J.A.R.V.I.S</span>
            <span className="msg-text">{jarvisText}<span className="cursor-blink">|</span></span>
          </div>
        )}

        {/* Idle hint */}
        {messages.length === 0 && !userText && !jarvisText && (
          <div className="msg-row system">
            <span className="msg-label">SYS</span>
            <span className="msg-text">Click ACTIVATE and speak to J.A.R.V.I.S...</span>
          </div>
        )}
        <div ref={messagesEndRef} style={{ height: '1px' }} />
      </div>
    </div>
  );
}
