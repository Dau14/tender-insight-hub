import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import WordCloud from 'react-wordcloud';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE = 'http://localhost:8000';

function Dashboard() {
  const [tenders, setTenders] = useState([]);
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState({ province: '', deadline: '', buyer: '', budget: '' });
  const [workspace, setWorkspace] = useState([]);
  const [status, setStatus] = useState('');
  const [file, setFile] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const tendersRes = await axios.get(`${API_BASE}/tenders`);
        const tendersWithScores = await Promise.all(tendersRes.data.map(async (tender) => {
          try {
            const scoreRes = await axios.post(`${API_BASE}/readiness/check`, {
              tenderId: tender.id,
              profile: { industry: 'construction', certifications: 'CIDB' }
            });
            return { ...tender, ...scoreRes.data };
          } catch (error) {
            console.error(`Failed to fetch score for tender ${tender.id}:`, error);
            return { ...tender, suitabilityScore: 0, checklist: {}, recommendation: 'Score unavailable' };
          }
        }));
        setTenders(tendersWithScores);
      } catch (error) {
        console.error('Failed to fetch data:', error);
      }
      try {
        const workspaceRes = await axios.get(`${API_BASE}/workspace`);
        setWorkspace(workspaceRes.data);
      } catch (error) {
        console.error('Failed to fetch workspace:', error);
      }
    };
    fetchData();
  }, []);

  const filteredTenders = tenders.filter(tender => {
    const matchesSearch = tender.title.toLowerCase().includes(search.toLowerCase());
    const matchesProvince = !filters.province || tender.province === filters.province;
    const matchesDeadline = !filters.deadline || new Date(tender.deadline) <= new Date(filters.deadline);
    const matchesBuyer = !filters.buyer || tender.buyer === filters.buyer;
    const matchesBudget = !filters.budget || (tender.budget || 0) <= parseInt(filters.budget);
    return matchesSearch && matchesProvince && matchesDeadline && matchesBuyer && matchesBudget;
  });

  const chartData = {
    labels: filteredTenders.map(tender => new Date(tender.uploaded_at).toLocaleDateString()),
    datasets: [{
      label: 'Tenders Uploaded',
      data: filteredTenders.map(() => 1),
      backgroundColor: 'rgba(75, 192, 192, 0.6)',
      borderColor: 'rgba(75, 192, 192, 1)',
      borderWidth: 1,
    }],
  };

  const wordCloudWords = filteredTenders.flatMap(tender =>
    tender.title.split(' ').map(word => ({ text: word, value: Math.random() * 100 }))
  );

  const matchTender = async (tenderId) => {
    const profile = { industry: 'construction', certifications: 'CIDB' };
    try {
      const response = await axios.post(`${API_BASE}/readiness/check`, { tenderId, ...profile });
      setTenders(tenders.map(t => t.id === tenderId ? { ...t, ...response.data } : t));
    } catch (error) {
      console.error(error);
    }
  };

  const saveToWorkspace = (tender) => {
    axios.post(`${API_BASE}/workspace`, { ...tender, status }).then(() => setWorkspace([...workspace, { ...tender, status }]));
  };

  const handleFileChange = (event) => {
    setFile(event.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      alert(`Upload successful! Tender ID: ${response.data.tender_id}`);
      // Refresh tenders after upload
      const tendersRes = await axios.get(`${API_BASE}/tenders`);
      const tendersWithScores = await Promise.all(tendersRes.data.map(async (tender) => {
        try {
          const scoreRes = await axios.post(`${API_BASE}/readiness/check`, {
            tenderId: tender.id,
            profile: { industry: 'construction', certifications: 'CIDB' }
          });
          return { ...tender, ...scoreRes.data };
        } catch (error) {
          console.error(`Failed to fetch score for tender ${tender.id}:`, error);
          return { ...tender, suitabilityScore: 0, checklist: {}, recommendation: 'Score unavailable' };
        }
      }));
      setTenders(tendersWithScores);
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Upload failed. Please try again.');
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-3xl font-bold mb-6">Tender Management Dashboard</h1>
      <div className="mb-6">
        <input
          type="text"
          placeholder="Search tenders (e.g., road construction)..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border rounded mb-2"
        />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
          <input
            type="text"
            placeholder="Province"
            value={filters.province}
            onChange={e => setFilters({ ...filters, province: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="date"
            value={filters.deadline}
            onChange={e => setFilters({ ...filters, deadline: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="text"
            placeholder="Buyer"
            value={filters.buyer}
            onChange={e => setFilters({ ...filters, buyer: e.target.value })}
            className="p-2 border rounded"
          />
          <input
            type="number"
            placeholder="Budget"
            value={filters.budget}
            onChange={e => setFilters({ ...filters, budget: e.target.value })}
            className="p-2 border rounded"
          />
        </div>
      </div>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold mb-2">Upload New Tender</h2>
        <input type="file" accept=".pdf" onChange={handleFileChange} className="mb-2" />
        <button onClick={handleUpload} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">
          Upload
        </button>
      </div>
      <h3 className="text-xl font-semibold mb-2">Tender List</h3>
      {filteredTenders.map(tender => (
        <div key={tender.id} className="p-2 border rounded mb-2">
          <h3>{tender.title}</h3>
          <p>Deadline: {new Date(tender.deadline).toLocaleDateString()}</p>
          <p>Summary: {tender.summary || 'No summary available'}</p>
          <p>Score: {tender.suitabilityScore !== undefined ? tender.suitabilityScore : 'N/A'}</p>
          <button onClick={() => matchTender(tender.id)} className="bg-green-600 text-white px-2 py-1 rounded mr-2">Match This Tender</button>
          <select value={status} onChange={e => setStatus(e.target.value)} className="p-1 border rounded">
            <option value="">Select Status</option>
            <option value="Pending">Pending</option>
            <option value="Interested">Interested</option>
            <option value="Not Eligible">Not Eligible</option>
            <option value="Submitted">Submitted</option>
          </select>
          <button onClick={() => saveToWorkspace(tender)} className="bg-blue-600 text-white px-2 py-1 rounded ml-2">Save to Workspace</button>
        </div>
      ))}
      <h3 className="text-xl font-semibold mb-2">Tender Uploads Over Time</h3>
      <Bar data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' }, title: { display: true, text: 'Tender Uploads' } } }} className="mb-4" />
      <h3 className="text-xl font-semibold mb-2">Tender Keywords</h3>
      <WordCloud words={wordCloudWords} options={{ rotations: 3, rotationAngles: [-90, 0, 90], fontSizes: [12, 60] }} />
      <h3 className="text-xl font-semibold mb-2">Workspace</h3>
      {workspace.map((t, i) => (
        <div key={i} className="p-2 border rounded mb-2">
          <h4>{t.title}</h4>
          <p>Status: {t.status} (Updated by: User)</p>
          <p>Summary: {t.summary}</p>
          <p>Score: {t.suitabilityScore || 'N/A'}</p>
        </div>
      ))}
    </div>
  );
}

export default Dashboard;
