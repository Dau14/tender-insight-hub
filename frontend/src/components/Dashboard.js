import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import WordCloud from 'react-wordcloud';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE = 'http://localhost:8000';

function Dashboard() {
  const [stats, setStats] = useState({ total_tenders: 0, recent_tenders: 0 });
  const [tenders, setTenders] = useState([]);
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  useEffect(() => {
    axios.get(`${API_BASE}/stats`)
      .then(res => setStats(res.data))
      .catch(err => console.error(err));
    axios.get(`${API_BASE}/tenders`)
      .then(res => setTenders(res.data))
      .catch(err => console.error(err));
  }, []);

  const filteredTenders = tenders.filter(tender => {
    const matchesSearch = tender.title.toLowerCase().includes(search.toLowerCase());
    const matchesDate = dateFilter
      ? new Date(tender.uploaded_at).toISOString().split('T')[0] === dateFilter
      : true;
    return matchesSearch && matchesDate;
  });

  const chartData = {
    labels: filteredTenders.map(tender => new Date(tender.uploaded_at).toLocaleDateString()),
    datasets: [
      {
        label: 'Tenders Uploaded',
        data: filteredTenders.map(() => 1),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  const wordCloudWords = filteredTenders.flatMap(tender =>
    tender.title.split(' ').map(word => ({ text: word, value: Math.random() * 100 }))
  );

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Tender Dashboard</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-100 p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Total Tenders</h3>
          <p className="text-3xl">{stats.total_tenders}</p>
        </div>
        <div className="bg-green-100 p-4 rounded shadow">
          <h3 className="text-lg font-semibold">Recent Tenders (Today)</h3>
          <p className="text-3xl">{stats.recent_tenders}</p>
        </div>
      </div>
      <div className="flex gap-4 mb-4">
        <input
          type="text"
          placeholder="Search tenders..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full p-2 border rounded"
        />
        <input
          type="date"
          value={dateFilter}
          onChange={e => setDateFilter(e.target.value)}
          className="p-2 border rounded"
        />
      </div>
      <h3 className="text-xl font-semibold mb-2">Tender Uploads Over Time</h3>
      <Bar
        data={chartData}
        options={{
          responsive: true,
          plugins: {
            legend: { position: 'top' },
            title: { display: true, text: 'Tender Uploads' },
          },
        }}
        className="mb-4"
      />
      <h3 className="text-xl font-semibold mb-2">Tender Keywords</h3>
      <WordCloud
        words={wordCloudWords}
        options={{
          rotations: 3,
          rotationAngles: [-90, 0, 90],
          fontSizes: [12, 60],
        }}
      />
    </div>
  );
}

export default Dashboard;
