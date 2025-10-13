import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import axios from 'axios';
import Home from './components/Home';
import UploadTender from './components/UploadTender';
import TenderList from './components/TenderList';
import Summary from './components/Summary';
import Dashboard from './components/Dashboard';
import './index.css';

const API_BASE = 'http://localhost:8000';

function App() {
  const [backendStatus, setBackendStatus] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/health`)
      .then(res => setBackendStatus(res.data.status))
      .catch(err => {
        console.error(err);
        setBackendStatus('Backend not connected');
      });
  }, []);

  return (
    <Router>
      <div className="max-w-5xl mx-auto p-4">
        <header className="flex items-center gap-4 mb-4">
          <img src="/images/logo.png" alt="Tender Insight Hub Logo" className="w-20 h-auto" />
          <nav>
            <ul className="flex gap-4">
              <li><Link to="/" className="text-blue-600 hover:text-blue-800">Home</Link></li>
              <li><Link to="/dashboard" className="text-blue-600 hover:text-blue-800">Dashboard</Link></li>
              <li><Link to="/upload" className="text-blue-600 hover:text-blue-800">Upload Tender</Link></li>
              <li><Link to="/tenders" className="text-blue-600 hover:text-blue-800">Tender List</Link></li>
            </ul>
          </nav>
        </header>
        <h1 className="text-3xl font-bold mb-4">Tender Insight Hub</h1>
        <p className="text-gray-600 mb-4">Backend Status: {backendStatus}</p>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/upload" element={<UploadTender />} />
          <Route path="/tenders" element={<TenderList />} />
          <Route path="/summary/:tenderId" element={<Summary />} />
        </Routes>
      </div>
    </Router>
  );
}

export default App;
