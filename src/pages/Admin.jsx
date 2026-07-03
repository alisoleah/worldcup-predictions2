import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ShieldAlert, Save, LogOut, Users, CheckCircle, Calendar } from 'lucide-react';
import { getFlag } from '../lib/flags';

export default function Admin() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  
  const [activeTab, setActiveTab] = useState('matches'); // matches, users, predictions
  
  const [matches, setMatches] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [predictions, setPredictions] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(null); // id being saved

  useEffect(() => {
    if (isAuthenticated) {
      fetchData();
    }
  }, [isAuthenticated]);

  const fetchData = async () => {
    setLoading(true);
    
    const [matchesRes, profilesRes, predictionsRes] = await Promise.all([
      supabase.from('matches').select('*').order('start_time', { ascending: true }),
      supabase.from('profiles').select('*').order('total_score', { ascending: false }),
      supabase.from('predictions').select('*, profiles(display_name), matches(home_team, away_team)')
    ]);
    
    if (matchesRes.data) setMatches(matchesRes.data);
    if (profilesRes.data) setProfiles(profilesRes.data);
    if (predictionsRes.data) setPredictions(predictionsRes.data);
    
    setLoading(false);
  };

  const handleLogin = (e) => {
    e.preventDefault();
    if (username === 'admin' && password === 'admin1234') {
      setIsAuthenticated(true);
    } else {
      alert('Invalid credentials');
    }
  };

  const handleUpdateRecord = async (table, id) => {
    setSaving(id);
    let recordData = null;
    
    if (table === 'matches') recordData = matches.find(m => m.id === id);
    if (table === 'profiles') recordData = profiles.find(p => p.id === id);
    if (table === 'predictions') {
      // Exclude joined relations before saving
      const fullRecord = predictions.find(p => p.id === id);
      const { profiles: _p, matches: _m, ...cleanRecord } = fullRecord;
      recordData = cleanRecord;
    }
    
    try {
      const res = await fetch('/api/adminUpdateRecord', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: 'admin',
          password: 'admin1234',
          table,
          recordData
        })
      });
      
      const result = await res.json();
      
      if (res.ok && result.success) {
        alert('Record updated successfully!');
      } else {
        alert('Failed to update: ' + (result.error || 'Unknown error'));
      }
    } catch (err) {
      alert('Error updating. Note: If testing locally with "npm run dev", the /api folder is not running unless you use Vercel CLI.');
    } finally {
      setSaving(null);
    }
  };

  const handleChange = (table, id, field, value) => {
    if (table === 'matches') {
      setMatches(prev => prev.map(m => {
        if (m.id === id) {
          let finalValue = value;
          if ((field === 'home_score' || field === 'away_score') && value !== '') finalValue = parseInt(value);
          if (field === 'advancing_team' && value === '') finalValue = null;
          return { ...m, [field]: finalValue };
        }
        return m;
      }));
    } else if (table === 'profiles') {
      setProfiles(prev => prev.map(p => {
        if (p.id === id) {
          let finalValue = value;
          if (field === 'total_score' && value !== '') finalValue = parseInt(value);
          return { ...p, [field]: finalValue };
        }
        return p;
      }));
    } else if (table === 'predictions') {
      setPredictions(prev => prev.map(p => {
        if (p.id === id) {
          let finalValue = value;
          if ((field === 'home_score' || field === 'away_score' || field === 'points_earned') && value !== '') finalValue = parseInt(value);
          if (field === 'advancing_team' && value === '') finalValue = null;
          return { ...p, [field]: finalValue };
        }
        return p;
      }));
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="app-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '80vh' }}>
        <div className="glass-panel" style={{ padding: '3rem', width: '100%', maxWidth: '400px', textAlign: 'center' }}>
          <ShieldAlert size={48} color="var(--danger-color)" style={{ marginBottom: '1.5rem' }} />
          <h1 style={{ marginBottom: '2rem' }}>Admin Access</h1>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input 
              type="text" 
              placeholder="Username" 
              className="input-field"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
            <input 
              type="password" 
              placeholder="Password" 
              className="input-field"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
            <button type="submit" className="btn-primary" style={{ marginTop: '1rem', background: 'var(--danger-color)' }}>
              Login to Admin
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <h1 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger-color)' }}>
          <ShieldAlert size={28} /> Admin Dashboard
        </h1>
        <button onClick={() => setIsAuthenticated(false)} style={{ background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
          <LogOut size={16} /> Exit Admin
        </button>
      </header>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem' }}>
        <button 
          onClick={() => setActiveTab('matches')} 
          style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: activeTab === 'matches' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
          <Calendar size={18} /> Matches
        </button>
        <button 
          onClick={() => setActiveTab('users')} 
          style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: activeTab === 'users' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
          <Users size={18} /> Users
        </button>
        <button 
          onClick={() => setActiveTab('predictions')} 
          style={{ padding: '0.75rem 1.5rem', borderRadius: '8px', border: 'none', background: activeTab === 'predictions' ? 'var(--accent-color)' : 'rgba(255,255,255,0.1)', color: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 'bold' }}>
          <CheckCircle size={18} /> Predictions
        </button>
      </div>

      <div className="glass-panel">
        {loading ? (
          <p>Loading data...</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            
            {/* MATCHES TABLE */}
            {activeTab === 'matches' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Match Teams</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Home Score</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Away Score</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Advancing</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.map(match => (
                    <tr key={match.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>{getFlag(match.home_team)}</span>
                            <input 
                              value={match.home_team} 
                              onChange={(e) => handleChange('matches', match.id, 'home_team', e.target.value)}
                              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.25rem', borderRadius: '4px', width: '120px' }}
                            />
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontSize: '1.25rem' }}>{getFlag(match.away_team)}</span>
                            <input 
                              value={match.away_team} 
                              onChange={(e) => handleChange('matches', match.id, 'away_team', e.target.value)}
                              style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.25rem', borderRadius: '4px', width: '120px' }}
                            />
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input 
                          type="number"
                          value={match.home_score ?? ''} 
                          onChange={(e) => handleChange('matches', match.id, 'home_score', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '60px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input 
                          type="number"
                          value={match.away_score ?? ''} 
                          onChange={(e) => handleChange('matches', match.id, 'away_score', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '60px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <select
                          value={match.advancing_team || ''}
                          onChange={(e) => handleChange('matches', match.id, 'advancing_team', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
                        >
                          <option value="">None</option>
                          <option value={match.home_team}>{match.home_team}</option>
                          <option value={match.away_team}>{match.away_team}</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <select 
                          value={match.status}
                          onChange={(e) => handleChange('matches', match.id, 'status', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px' }}
                        >
                          <option value="scheduled">Scheduled</option>
                          <option value="live">Live</option>
                          <option value="finished">Finished</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleUpdateRecord('matches', match.id)}
                          disabled={saving === match.id}
                          className="btn-primary"
                          style={{ background: 'var(--success-color)', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <Save size={16} /> {saving === match.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* USERS TABLE */}
            {activeTab === 'users' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Display Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Total Score</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {profiles.map(user => (
                    <tr key={user.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                          <img src={user.avatar_url || 'https://via.placeholder.com/32'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                          <input 
                            value={user.display_name || ''} 
                            onChange={(e) => handleChange('profiles', user.id, 'display_name', e.target.value)}
                            style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '200px' }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input 
                          type="number"
                          value={user.total_score ?? ''} 
                          onChange={(e) => handleChange('profiles', user.id, 'total_score', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '80px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleUpdateRecord('profiles', user.id)}
                          disabled={saving === user.id}
                          className="btn-primary"
                          style={{ background: 'var(--success-color)', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <Save size={16} /> {saving === user.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* PREDICTIONS TABLE */}
            {activeTab === 'predictions' && (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>User</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left' }}>Match</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Pick</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Advancing Pick</th>
                    <th style={{ padding: '0.75rem', textAlign: 'center' }}>Points Earned</th>
                    <th style={{ padding: '0.75rem', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map(pred => (
                    <tr key={pred.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ fontWeight: 'bold' }}>{pred.profiles?.display_name || 'Unknown'}</span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span style={{ color: 'var(--text-secondary)' }}>
                          {pred.matches?.home_team} vs {pred.matches?.away_team}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input 
                          type="number"
                          value={pred.home_score ?? ''} 
                          onChange={(e) => handleChange('predictions', pred.id, 'home_score', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '50px', textAlign: 'center', marginRight: '0.5rem' }}
                        />
                        -
                        <input 
                          type="number"
                          value={pred.away_score ?? ''} 
                          onChange={(e) => handleChange('predictions', pred.id, 'away_score', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '50px', textAlign: 'center', marginLeft: '0.5rem' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <select
                          value={pred.advancing_team || ''}
                          onChange={(e) => handleChange('predictions', pred.id, 'advancing_team', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', maxWidth: '100px' }}
                        >
                          <option value="">None</option>
                          <option value={pred.matches?.home_team}>{pred.matches?.home_team}</option>
                          <option value={pred.matches?.away_team}>{pred.matches?.away_team}</option>
                        </select>
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'center' }}>
                        <input 
                          type="number"
                          value={pred.points_earned ?? ''} 
                          onChange={(e) => handleChange('predictions', pred.id, 'points_earned', e.target.value)}
                          style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid var(--surface-border)', color: 'white', padding: '0.5rem', borderRadius: '4px', width: '80px', textAlign: 'center' }}
                        />
                      </td>
                      <td style={{ padding: '0.75rem', textAlign: 'right' }}>
                        <button 
                          onClick={() => handleUpdateRecord('predictions', pred.id)}
                          disabled={saving === pred.id}
                          className="btn-primary"
                          style={{ background: 'var(--success-color)', padding: '0.5rem 1rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
                        >
                          <Save size={16} /> {saving === pred.id ? 'Saving...' : 'Save'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

          </div>
        )}
      </div>
    </div>
  );
}
