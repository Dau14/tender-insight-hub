import React, { useState } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:8000';

function CompanyProfile() {
  const [profile, setProfile] = useState({
    industry: '', services: '', certifications: '', geographicCoverage: '', yearsExperience: '', contact: ''
  });
  const [message, setMessage] = useState('');

  const handleChange = (e) => setProfile({ ...profile, [e.target.name]: e.target.value });
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${API_BASE}/profile`, profile);
      setMessage('Profile updated successfully!');
    } catch (error) {
      setMessage('Error updating profile');
      console.error(error);
    }
  };

  return (
    <div className="p-4">
      <h2 className="text-2xl font-bold mb-4">Company Profile</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input type="text" name="industry" placeholder="Industry Sector" value={profile.industry} onChange={handleChange} className="w-full p-2 border rounded" />
        <input type="text" name="services" placeholder="Services Provided" value={profile.services} onChange={handleChange} className="w-full p-2 border rounded" />
        <input type="text" name="certifications" placeholder="Certifications (e.g., CIDB, BBBEE)" value={profile.certifications} onChange={handleChange} className="w-full p-2 border rounded" />
        <input type="text" name="geographicCoverage" placeholder="Geographic Coverage" value={profile.geographicCoverage} onChange={handleChange} className="w-full p-2 border rounded" />
        <input type="number" name="yearsExperience" placeholder="Years of Experience" value={profile.yearsExperience} onChange={handleChange} className="w-full p-2 border rounded" />
        <input type="text" name="contact" placeholder="Contact Information" value={profile.contact} onChange={handleChange} className="w-full p-2 border rounded" />
        <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-800">Save Profile</button>
      </form>
      <p className="mt-2 text-gray-600">{message}</p>
    </div>
  );
}

export default CompanyProfile;