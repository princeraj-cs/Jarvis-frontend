import React, { useState } from 'react';
import './Navbar.css';

export default function Navbar({ config, setConfig }) {
  const [showSettings, setShowSettings] = useState(false);

  const handleSizeChange = (e) => {
    setConfig({ ...config, size: parseInt(e.target.value) });
  };

  const handleColorChange = (e) => {
    setConfig({ ...config, colorTheme: e.target.value });
  };

  const handleIntensityChange = (e) => {
    setConfig({ ...config, intensity: parseFloat(e.target.value) });
  };

  return (
    <nav className="ai-navbar">
      <div className="nav-container">
        <div className="nav-brand">
          <span className="brand-icon">J.A.R.V.I.S</span>
          <span className="brand-text">SYSTEM</span>
        </div>
        <ul className="nav-links">
          <li><a href="#core">CORE</a></li>
          <li><a href="#diagnostics">DIAGNOSTICS</a></li>
          <li><a href="#network">NETWORK</a></li>
          <li className="settings-nav-item">
            <a href="#settings" onClick={(e) => { e.preventDefault(); setShowSettings(!showSettings); }}>
              SETTINGS ▾
            </a>
            
            {showSettings && config && (
              <div className="nav-settings-dropdown">
                <div className="nav-setting-group">
                  <label>ORB SIZE ({config.size || 350}px)</label>
                  <input 
                    type="range" 
                    min="150" max="800" step="10" 
                    value={config.size || 350} 
                    onChange={handleSizeChange} 
                  />
                </div>

                <div className="nav-setting-group">
                  <label>ORB COLOR</label>
                  <input 
                    type="color" 
                    value={config.colorTheme} 
                    onChange={handleColorChange}
                    className="color-picker-input"
                  />
                </div>

                <div className="nav-setting-group">
                  <label>SENSITIVITY ({config.intensity.toFixed(1)}x)</label>
                  <input 
                    type="range" 
                    min="0.5" max="3.0" step="0.1" 
                    value={config.intensity} 
                    onChange={handleIntensityChange} 
                  />
                </div>
              </div>
            )}
          </li>
        </ul>
        <div className="nav-status">
          <span className="status-dot"></span>
          <span className="status-text">ONLINE</span>
        </div>
      </div>
    </nav>
  );
}
