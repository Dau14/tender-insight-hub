import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function Summary() {
  const { tenderId } = useParams();
  const [summary, setSummary] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/summary/${tenderId}`)
      .then(res => setSummary(res.data.summary))
      .catch(err => console.error(err));
  }, [tenderId]);

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tender Summary</h2>
      <p className="text-gray-600">{summary || 'Loading...'}</p>
    </div>
  );
}

export default Summary;
