import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function Home() {
  const [stats, setStats] = useState({ total_tenders: 0, recent_tenders: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_BASE}/stats`);
        setStats(response.data);
      } catch (error) {
        console.error('Failed to fetch stats:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div
      className="min-h-screen bg-cover bg-center relative"
      style={{
        backgroundImage: "url('https://images.unsplash.com/photo-1506784897867-3d7f6688a9e0?ixlib=rb-4.0.3&auto=format&fit=crop&w=1350&q=80')", // Placeholder professional office image
      }}
    >
      {/* Overlay for readability */}
      <div className="absolute inset-0 bg-black opacity-50"></div>
      <div className="relative z-10 p-4 text-white">
        <h1 className="text-3xl font-bold mb-6">Welcome to Tender Insight Hub</h1>
        {loading ? (
          <p className="text-center">Loading stats...</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-100 bg-opacity-90 p-4 rounded shadow">
              <h2 className="text-lg font-semibold">Total Tenders Uploaded</h2>
              <p className="text-4xl">{stats.total_tenders}</p>
            </div>
            <div className="bg-green-100 bg-opacity-90 p-4 rounded shadow">
              <h2 className="text-lg font-semibold">Tenders Uploaded Today</h2>
              <p className="text-4xl">{stats.recent_tenders}</p>
            </div>
          </div>
        )}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold mb-4">About Us</h2>
          <p className="text-gray-200">
            Tender Insight Hub is a dedicated platform designed to empower South African SMEs by simplifying access to public procurement opportunities. Our mission is to break down the complexities of tender documents using cutting-edge AI technology, providing actionable insights and readiness assessments to help businesses succeed. Founded with a vision to foster economic growth, we offer a collaborative environment for tender tracking and decision-making, tailored to the needs of small and medium enterprises across various industries.
          </p>
          <p className="text-gray-200 mt-2">
            Our team combines expertise in software development, AI, and procurement to deliver a user-friendly solution. With secure cloud infrastructure and tiered subscription plans (Free, Basic, Pro), we ensure accessibility and scalability. Join us in transforming the tender process and unlocking new opportunities for your business!
          </p>
        </div>
        <a href="/dashboard" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700">
          Go to Dashboard
        </a>
      </div>
    </div>
  );
}

export default Home;
