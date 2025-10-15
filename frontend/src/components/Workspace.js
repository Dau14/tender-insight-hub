import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function Workspace() {
  const [tenders, setTenders] = useState([]);
  const [statusFilter, setStatusFilter] = useState('All');
  const [notes, setNotes] = useState({});

  useEffect(() => {
    axios.get(`${API_BASE}/tenders`).then(res => {
      const enriched = res.data.map(tender => ({
        ...tender,
        summary: summaries_collection.find_one({"tender_id": tender.id})["summary"] || "No summary",
        score: 75, // Simulated score
        status: 'Pending Status'
      }));
      setTenders(enriched);
    });
  }, []);

  const updateStatus = (id, status, user = 'Current User') => {
    setTenders(tenders.map(t => t.id === id ? { ...t, status, updated_by: user } : t));
  };

  const addNote = (id, note) => {
    setNotes({ ...notes, [id]: note });
  };

  const filteredTenders = tenders.filter(t => statusFilter === 'All' || t.status === statusFilter).sort((a, b) => b.score - a.score);

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-4">Workspace</h2>
      <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="mb-4 p-2 border rounded">
        <option value="All">All</option>
        <option value="Pending Status">Pending Status</option>
        <option value="Interested">Interested</option>
        <option value="Not Eligible">Not Eligible</option>
        <option value="Submitted">Submitted</option>
      </select>
      {filteredTenders.map(tender => (
        <div key={tender.id} className="border p-4 mb-2 rounded">
          <h3 className="font-semibold">{tender.title}</h3>
          <p>Deadline: {tender.uploaded_at.toLocaleDateString()}</p>
          <p>Summary: {tender.summary}</p>
          <p>Score: {tender.score}/100</p>
          <p>Status: {tender.status} (Updated by: {tender.updated_by})</p>
          <select value={tender.status} onChange={e => updateStatus(tender.id, e.target.value)} className="p-1 border rounded">
            <option value="Pending Status">Pending Status</option>
            <option value="Interested">Interested</option>
            <option value="Not Eligible">Not Eligible</option>
            <option value="Submitted">Submitted</option>
          </select>
          <textarea placeholder="Add note..." onChange={e => addNote(tender.id, e.target.value)} className="w-full p-2 border rounded mt-2"></textarea>
          <p>Note: {notes[tender.id] || ''}</p>
        </div>
      ))}
    </div>
  );
}

export default Workspace;
