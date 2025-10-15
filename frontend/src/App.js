import React from 'react';
import { BrowserRouter as Router, Route, Routes, Link } from 'react-router-dom';
import Home from './components/Home';
import UploadTender from './components/UploadTender';
import Dashboard from './components/Dashboard';
import CompanyProfile from './components/CompanyProfile';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100">
        <nav className="bg-blue-600 text-white p-4">
          <div className="container mx-auto flex justify-between">
            <Link to="/" className="text-xl font-bold">
              
              Tender Insight Hub
            </Link>
            <div className="space-x-4">
              <Link to="/" className="hover:underline">Home</Link>
              <Link to="/upload" className="hover:underline">Upload</Link>
              <Link to="/dashboard" className="hover:underline">Dashboard</Link>
              
            </div>
          </div>
        </nav>
        <div className="container mx-auto p-4">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/upload" element={<UploadTender />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<CompanyProfile />} />
          </Routes>
        </div>
      </div>
    </Router>
  );
}

export default App;
