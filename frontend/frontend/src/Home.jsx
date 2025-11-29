import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

import L from 'leaflet';
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

const MapUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 13);
  }, [center, map]);
  return null;
};

const Home = () => {
  const navigate = useNavigate();
  const [ipInput, setIpInput] = useState('');
  const [geoData, setGeoData] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const token = localStorage.getItem('token');

  // Regex for basic IP validation
  const ipRegex = /^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;

  const fetchHistory = async () => {
    try {
      const res = await axios.get('http://localhost:8000/api/history', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistory(res.data);
    } catch (err) { console.error("History fetch error", err); }
  };

const fetchGeoInfo = async (ip) => {
  setError('');
  if (!ip) return;

  try {
    const res = await axios.get(`http://ip-api.com/json/${ip}`);

    if (res.data.status === 'fail') {
      setError(res.data.message);
      return;
    }

    setGeoData({
      ip,
      city: res.data.city,
      region: res.data.regionName,
      country: res.data.country,
      loc: `${res.data.lat},${res.data.lon}`,
      org: res.data.isp
    });

    await axios.post(
      'http://localhost:8000/api/history',
      {
        ip,
        geo: res.data
      },
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );

    fetchHistory();
  } catch (err) {
    console.error(err);
    setError('Failed to fetch Geo Data');
  }
};
  useEffect(() => {
    fetchHistory();
  }, []);

  const handleSearch = (e) => {
    e.preventDefault();
    if (!ipRegex.test(ipInput)) {
      setError('Invalid IP Address Format');
      return;
    }
    fetchGeoInfo(ipInput);
  };

  const handleClear = () => {
    setIpInput('');
    setError('');
    fetchGeoInfo(); 
  };

  const handleHistoryClick = (data) => {
    setGeoData(data.geo_data);
    setIpInput(data.ip_address);
    setError('');
  };

  const toggleSelectHistory = (id) => {
    if(selectedIds.includes(id)) {
      setSelectedIds(selectedIds.filter(itemId => itemId !== id));
    } else {
      setSelectedIds([...selectedIds, id]);
    }
  };

  const deleteSelectedHistory = async () => {
    if(selectedIds.length === 0) return;
    try {
      await axios.post('http://localhost:8000/api/history/delete', { ids: selectedIds }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedIds([]);
      fetchHistory();
    } catch (err) { console.error(err); }
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    navigate('/login');
  };

  const getPosition = () => {
    if (!geoData || !geoData.loc) return [51.505, -0.09]; 
    const [lat, lng] = geoData.loc.split(',');
    return [parseFloat(lat), parseFloat(lng)];
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white shadow p-4 flex justify-between items-center">
        <h1 className="text-xl font-bold text-gray-800">IP Geo Locator</h1>
        <button onClick={handleLogout} className="text-red-500 hover:text-red-700">Logout</button>
      </header>

      <div className="flex-1 p-6 grid grid-cols-1 md:grid-cols-3 gap-6 max-w-7xl mx-auto w-full">
        
     
        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded shadow">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="text" 
                placeholder="Enter IP Address (e.g., 8.8.8.8)"
                value={ipInput}
                onChange={(e) => setIpInput(e.target.value)}
                className="flex-1 border p-2 rounded"
              />
              <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">Search</button>
              <button type="button" onClick={handleClear} className="bg-gray-300 text-gray-700 px-4 py-2 rounded">Clear</button>
            </form>
            {error && <p className="text-red-500 mt-2">{error}</p>}
          </div>

          <div className="bg-white p-4 rounded shadow h-96 relative z-0">
             {geoData && (
                 <MapContainer center={getPosition()} zoom={13} scrollWheelZoom={false}>
                    <TileLayer
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    />
                    <Marker position={getPosition()}>
                        <Popup>
                            {geoData.city}, {geoData.country} <br /> {geoData.org}
                        </Popup>
                    </Marker>
                    <MapUpdater center={getPosition()} />
                 </MapContainer>
             )}
          </div>

          {geoData && (
            <div className="bg-white p-6 rounded shadow grid grid-cols-2 gap-4">
              <div><strong>IP:</strong> {geoData.ip}</div>
              <div><strong>City:</strong> {geoData.city}</div>
              <div><strong>Region:</strong> {geoData.region}</div>
              <div><strong>Country:</strong> {geoData.country}</div>
              <div><strong>ISP:</strong> {geoData.org}</div>
              <div><strong>Coordinates:</strong> {geoData.loc}</div>
            </div>
          )}
        </div>

        <div className="bg-white p-4 rounded shadow h-fit">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-bold text-lg">Search History</h3>
            {selectedIds.length > 0 && (
              <button 
                onClick={deleteSelectedHistory}
                className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200">
                Delete ({selectedIds.length})
              </button>
            )}
          </div>
          
          <ul className="space-y-2 max-h-[80vh] overflow-y-auto">
            {history.length === 0 && <p className="text-gray-400 text-sm">No history yet.</p>}
            {history.map((item) => (
              <li key={item.id} className="border-b pb-2 flex items-start gap-2">
                <input 
                  type="checkbox" 
                  checked={selectedIds.includes(item.id)}
                  onChange={() => toggleSelectHistory(item.id)}
                  className="mt-1.5"
                />
                <div 
                  onClick={() => handleHistoryClick(item)}
                  className="cursor-pointer hover:bg-gray-50 flex-1 p-1 rounded"
                >
                  <p className="font-semibold text-sm">{item.ip_address}</p>
                  <p className="text-xs text-gray-500">
                    {item.geo_data.city}, {item.geo_data.country}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    {new Date(item.createdAt).toLocaleString()}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
};

export default Home;