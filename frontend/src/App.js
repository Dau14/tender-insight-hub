import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function App() {
  const [summary, setSummary] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/health`)
      .then(res => setSummary(res.data.status))
      .catch(err => console.error(err));
  }, []);

  return (
    <div>
      <h1>Tender Insight Hub</h1>
      <p>Backend Status: {summary}</p>
    </div>
  );
}

export default App;
