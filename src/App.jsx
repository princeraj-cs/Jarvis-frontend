import React, { useState } from 'react';
import Navbar from './component/Navbar'
import BlobScene from './component/blob.jsx'
import Terminal from './component/Terminal'
import StatusPanel from './component/StatusPanel'
import WeatherClock from './component/WeatherClock'
import NetworkGraph from './component/NetworkGraph'


function App() {
  const [status, setStatus] = useState('idle'); // idle | listening | thinking | speaking
  const [blobConfig, setBlobConfig] = useState({
    size: 470,
    colorTheme: "#00bbff",
    intensity: 1.0,
  });

  return (
    <>
      <Navbar config={blobConfig} setConfig={setBlobConfig} />
      <StatusPanel status={status} />
      <WeatherClock />
      <BlobScene config={blobConfig} status={status} />
      <Terminal onStatusChange={setStatus} />
      <NetworkGraph status={status} />
    </>
  )
}

export default App
