import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function UploadTender() {
  const [file, setFile] = useState(null);
  const [message, setMessage] = useState('');

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = async () => {
    if (!file) {
      setMessage('Please select a PDF file');
      return;
    }
    const formData = new FormData();
    formData.append('file', file);
    try {
      const response = await axios.post(`${API_BASE}/upload`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setMessage(`Tender uploaded! ID: ${response.data.tender_id}, Summary: ${response.data.summary}`);
    } catch (error) {
      setMessage(`Error: ${error.response?.data?.detail || error.message}`);
    }
  };

  return (
    <div>
      <h2 className="text-2xl font-bold mb-4">Upload Tender</h2>
      <input type="file" accept=".pdf" onChange={handleFileChange} className="mb-4" />
      <button onClick={handleUpload} className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-800">Upload</button>
      <p className="text-gray-600 mt-2">{message}</p>
    </div>
  );
}

export default UploadTender;
