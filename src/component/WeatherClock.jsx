import React, { useState, useEffect } from 'react';
import './WeatherClock.css';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

export default function WeatherClock() {
  const [time, setTime] = useState(new Date());
  const [weather, setWeather] = useState(null);

  // Update clock every second
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch(`${BACKEND_URL}/api/weather?city=New Delhi`);
        const data = await res.json();
        if (data.cod === 200) {
          setWeather(data);
        }
      } catch (err) {
        console.error('Weather Clock error:', err);
      }
    };

    fetchWeather();
    const interval = setInterval(fetchWeather, 600000); // Update every 10 mins
    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  const formatDate = (date) => {
    return date.toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).toUpperCase();
  };

  return (
    <div className="weather-clock-panel">
      <div className="wc-header">
        <div className="wc-country">
          <span className="flag-icon">🇮🇳</span>
          <span>INDIA | IST</span>
        </div>
        <div className="status-dot online"></div>
      </div>
      
      <div className="wc-body">
        <div className="digital-clock">{formatTime(time)}</div>
        <div className="date-display">{formatDate(time)}</div>
        
        {weather && (
          <div className="weather-info">
            <div className="weather-main">
              <span className="weather-temp">{Math.round(weather.main.temp)}°C</span>
              <span className="weather-desc">{weather.weather[0].description}</span>
            </div>
            <div className="weather-details">
              <div>H: {weather.main.humidity}%</div>
              <div>W: {weather.wind.speed}m/s</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
