import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function UploadTender() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [tenders, setTenders] = useState([]);
  const [filters, setFilters] = useState({ province: '', deadline: '', buyer: '', budget: '' });

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
    setMessage('');
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a PDF file');
      return;
    }
    setLoading(true);
    setMessage('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
      });
      setMessage(`Tender uploaded! ID: ${response.data.tender_id}, Summary: ${response.data.summary}`);
      axios.get(`${API_BASE}/tenders`).then(res => setTenders(res.data));
    } catch (error) {
      console.error('Upload error:', error);
      setMessage(`Server error: ${error.response?.data.detail || error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    // Simulated OCDS API search (replace with real API)
    const results = await axios.get(`${API_BASE}/tenders`);
    setTenders(results.data.filter(t => t.title.toLowerCase().includes(search.toLowerCase())));
  };

  const applyFilters = () => {
    let filtered = [...tenders];
    if (filters.province) filtered = filtered.filter(t => t.title.includes(filters.province));
    if (filters.deadline) filtered = filtered.filter(t => new Date(t.uploaded_at) < new Date(filters.deadline));
    if (filters.buyer) filtered = filtered.filter(t => t.title.includes(filters.buyer));
    if (filters.budget) filtered = filtered.filter(t => true); // Add budget logic
    setTenders(filtered);
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Upload Tender</h2>
      <input type="file" accept=".pdf" onChange={handleFileChange} className="mb-4 p-2 border rounded" />
      <button onClick={handleUpload} disabled={loading || !file} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-800 disabled:bg-gray-400">
        {loading ? 'Uploading...' : 'Upload'}
      </button>
      <p className="text-gray-600 mt-2">{message}</p>
      <h2 className="text-2xl font-bold mt-6 mb-4">Search Tenders</h2>
      <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Keywords (e.g., road construction)" className="w-full p-2 border rounded mb-2" />
      <button onClick={handleSearch} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-800">Search</button>
      <div className="mt-4 space-y-2">
        <input type="text" value={filters.province} onChange={e => setFilters({ ...filters, province: e.target.value })} placeholder="Province" className="w-full p-2 border rounded" />
        <input type="date" value={filters.deadline} onChange={e => setFilters({ ...filters, deadline: e.target.value })} className="w-full p-2 border rounded" />
        <input type="text" value={filters.buyer} onChange={e => setFilters({ ...filters, buyer: e.target.value })} placeholder="Buyer" className="w-full p-2 border rounded" />
        <input type="text" value={filters.budget} onChange={e => setFilters({ ...filters, budget: e.target.value })} placeholder="Budget Range" className="w-full p-2 border rounded" />
        <button onClick={applyFilters} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-800">Apply Filters</button>
      </div>
      <div className="mt-4">
        {tenders.map(tender => (
          <div key={tender.id} className="border p-2 mb-2 rounded">
            <h3>{tender.title}</h3>
            <p>Uploaded: {tender.uploaded_at ? new Date(tender.uploaded_at).toLocaleDateString() : 'Unknown'}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default UploadTender;
