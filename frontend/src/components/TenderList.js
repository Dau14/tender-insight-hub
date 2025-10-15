import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const API_BASE = 'https://your-app.onrender.com';

function TenderList() {
  const [tenders, setTenders] = useState([]);

  useEffect(() => {
    axios.get(`${API_BASE}/tenders`)
      .then(res => setTenders(res.data))
      .catch(err => console.error(err));
  }, []);

  const chartData = {
    labels: tenders.map(tender => new Date(tender.uploaded_at).toLocaleDateString()),
    datasets: [
      {
        label: 'Tenders Uploaded',
        data: tenders.map(() => 1),
        backgroundColor: 'rgba(75, 192, 192, 0.6)',
        borderColor: 'rgba(75, 192, 192, 1)',
        borderWidth: 1,
      },
    ],
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Tender List</h2>
      <ul>
        {tenders.map(tender => (
          <li key={tender.id} className="mb-2">
            {tender.title} (Uploaded: {new Date(tender.uploaded_at).toLocaleString()})
            <Link to={`/summary/${tender.id}`} className="text-blue-600 hover:text-blue-800 ml-2">View Summary</Link>
          </li>
        ))}
      </ul>
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
    </div>
  );
}

export default TenderList;
