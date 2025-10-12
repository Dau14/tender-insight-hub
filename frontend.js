import React, { useState } from 'react';
import axios from 'axios';

function App() {
  const [token, setToken] = useState('');
  const [keywords, setKeywords] = useState('');
  const [results, setResults] = useState([]);

  const login = async () => {
    const res = await axios.post('http://localhost:8000/token', new URLSearchParams({username: 'user', password: 'pass'}));
    setToken(res.data.access_token);
  };

  const search = async () => {
    const res = await axios.post('http://localhost:8000/search/', {keywords}, {headers: {Authorization: `Bearer ${token}`}});
    setResults(res.data);
  };

  return (
    <div>
      <button onClick={login}>Login</button>
      <input value={keywords} onChange={e => setKeywords(e.target.value)} placeholder="Search keywords" />
      <button onClick={search}>Search</button>
      <ul>{results.map(r => <li key={r.id}>{r.title}</li>)}</ul>
    </div>
  );
}

export default App;