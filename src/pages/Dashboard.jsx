import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/AuthContext';
import { LogOut, Trophy, Calendar, CheckCircle, Clock, Users, X } from 'lucide-react';
import { format, isPast, isFuture } from 'date-fns';
import { getFlag } from '../lib/flags';

export default function Dashboard() {
  const { user, profile, setProfile } = useAuth();
  const [matches, setMatches] = useState([]);
  const [predictions, setPredictions] = useState({});
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAllPredictionsModal, setShowAllPredictionsModal] = useState(false);
  const [allPredictionsData, setAllPredictionsData] = useState([]);


  useEffect(() => {
    fetchData();
  }, [user]);

  const fetchData = async () => {
    setLoading(true);
    await Promise.all([
      fetchMatchesAndPredictions(),
      fetchLeaderboard()
    ]);
    setLoading(false);
  };

  const fetchMatchesAndPredictions = async () => {
    // Fetch all matches
    const { data: matchData, error: matchError } = await supabase
      .from('matches')
      .select('*')
      .order('start_time', { ascending: true });
    
    if (matchData) setMatches(matchData);

    // Fetch user's predictions
    const { data: predData } = await supabase
      .from('predictions')
      .select('*')
      .eq('user_id', user.id);
    
    if (predData) {
      const predMap = {};
      predData.forEach(p => {
        predMap[p.match_id] = { home_score: p.home_score, away_score: p.away_score, id: p.id, points_earned: p.points_earned, advancing_team: p.advancing_team };
      });
      setPredictions(predMap);
    }
  };

  const fetchLeaderboard = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .order('total_score', { ascending: false });
    if (data) setLeaderboard(data);
  };

  const handleOpenAllPredictions = async () => {
    setShowAllPredictionsModal(true);
    // Fetch all predictions joined with profiles
    const { data, error } = await supabase
      .from('predictions')
      .select(`
        *,
        profiles:user_id (display_name, avatar_url)
      `);
    if (data && !error) {
      setAllPredictionsData(data);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
  };

  const handlePredictionSubmit = async (matchId, homeScore, awayScore, advancingTeam) => {
    if (homeScore === '' || awayScore === '') return;
    
    // Validate advancing team selection on draw
    if (homeScore === awayScore && !advancingTeam) {
      alert('Please select which team will advance (in case of a draw).');
      return;
    }
    
    // Clear advancing team if it's not a draw
    const finalAdvancingTeam = homeScore === awayScore ? advancingTeam : null;
    
    const existing = predictions[matchId];
    
    if (existing) {
      const { error } = await supabase
        .from('predictions')
        .update({ home_score: parseInt(homeScore), away_score: parseInt(awayScore), advancing_team: finalAdvancingTeam })
        .eq('id', existing.id);
        
      if (!error) {
        setPredictions(prev => ({ ...prev, [matchId]: { ...prev[matchId], home_score: parseInt(homeScore), away_score: parseInt(awayScore), advancing_team: finalAdvancingTeam }}));
        alert('Prediction updated!');
      } else {
        alert('Error updating prediction: ' + error.message);
      }
    } else {
      const { data, error } = await supabase
        .from('predictions')
        .insert({
          user_id: user.id,
          match_id: matchId,
          home_score: parseInt(homeScore),
          away_score: parseInt(awayScore),
          advancing_team: finalAdvancingTeam
        })
        .select()
        .single();
        
      if (!error && data) {
        setPredictions(prev => ({ ...prev, [matchId]: { home_score: data.home_score, away_score: data.away_score, id: data.id, points_earned: 0, advancing_team: data.advancing_team }}));
        alert('Prediction saved!');
      } else {
        alert('Error saving prediction: ' + error.message);
      }
    }
  };

  if (loading) {
    return <div className="app-container" style={{ textAlign: 'center', marginTop: '4rem' }}>Loading Dashboard...</div>;
  }

  const upcomingMatches = matches.filter(m => isFuture(new Date(m.start_time)));
  const finishedMatches = matches.filter(m => isPast(new Date(m.start_time)));

  return (
    <div className="app-container">
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '3rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="avatar" style={{ width: '48px', height: '48px', borderRadius: '50%', border: '2px solid var(--accent-color)' }} />
          ) : (
            <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--surface-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid var(--accent-color)' }}>
              {profile?.display_name?.charAt(0)?.toUpperCase()}
            </div>
          )}
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{profile?.display_name || 'User'}</h1>
            <p style={{ color: 'var(--accent-color)', fontWeight: '600' }}>{profile?.total_score} Points</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem' }}>
          <button onClick={handleOpenAllPredictions} style={{ background: 'var(--accent-color)', border: 'none', color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontWeight: 'bold' }}>
            <Users size={16} /> Global Predictions
          </button>
          <button onClick={handleSignOut} style={{ background: 'transparent', border: '1px solid var(--surface-border)', color: 'var(--text-primary)', padding: '0.5rem 1rem', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
            <LogOut size={16} /> Sign Out
          </button>
        </div>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '2rem' }}>
        
        {/* Left Column: Matches */}
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <Calendar size={24} color="var(--accent-color)" /> Upcoming Matches
          </h2>
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '3rem' }}>
            {upcomingMatches.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No upcoming matches scheduled.</p>
            ) : upcomingMatches.map(match => (
              <MatchCard 
                key={match.id} 
                match={match} 
                prediction={predictions[match.id]} 
                onSubmit={handlePredictionSubmit} 
              />
            ))}
          </div>

          <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem' }}>
            <CheckCircle size={24} color="var(--success-color)" /> Finished / Live
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {finishedMatches.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No matches have started yet.</p>
            ) : finishedMatches.map(match => (
              <MatchCard 
                key={match.id} 
                match={match} 
                prediction={predictions[match.id]} 
                onSubmit={handlePredictionSubmit} 
              />
            ))}
          </div>
        </div>

        {/* Right Column: Leaderboard */}
        <div>
          <div className="glass-panel" style={{ position: 'sticky', top: '2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--warning-color)' }}>
              <Trophy size={24} /> Leaderboard
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {leaderboard.map((lbUser, index) => (
                <div key={lbUser.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '1rem', background: 'rgba(15, 23, 42, 0.4)', borderRadius: '8px', border: lbUser.id === user.id ? '1px solid var(--accent-color)' : '1px solid transparent' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 'bold', color: index === 0 ? 'var(--warning-color)' : 'var(--text-secondary)', width: '20px' }}>
                      #{index + 1}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {lbUser.avatar_url ? (
                        <img src={lbUser.avatar_url} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%' }} />
                      ) : (
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--bg-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem' }}>
                          {lbUser.display_name?.charAt(0)?.toUpperCase()}
                        </div>
                      )}
                      <span style={{ fontWeight: '500' }}>{lbUser.display_name}</span>
                    </div>
                  </div>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-color)' }}>{lbUser.total_score} pts</span>
                </div>
              ))}
            </div>
          </div>

          {/* User Predictions Table */}
          <div className="glass-panel" style={{ marginTop: '2rem' }}>
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.5rem', color: 'var(--accent-color)' }}>
              <CheckCircle size={24} /> Your Predictions
            </h2>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--surface-border)' }}>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'left', color: 'var(--text-secondary)' }}>Match</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Pick</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Result</th>
                    <th style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--text-secondary)' }}>Pts</th>
                  </tr>
                </thead>
                <tbody>
                  {matches.filter(m => predictions[m.id]).length === 0 ? (
                    <tr>
                      <td colSpan="4" style={{ padding: '1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        No predictions made yet.
                      </td>
                    </tr>
                  ) : (
                    matches.filter(m => predictions[m.id]).map(match => {
                      const pred = predictions[match.id];
                      return (
                        <tr key={match.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                          <td style={{ padding: '0.75rem 0.5rem' }}>
                            {getFlag(match.home_team)} {match.home_team} <br/> 
                            {getFlag(match.away_team)} {match.away_team}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontWeight: 'bold' }}>
                            {pred.home_score} - {pred.away_score}
                            {pred.home_score === pred.away_score && pred.advancing_team && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--accent-color)' }}>
                                {getFlag(pred.advancing_team)} Advances
                              </div>
                            )}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'center' }}>
                            {(match.status === 'finished' || match.status === 'live') ? `${match.home_score ?? '-'} - ${match.away_score ?? '-'}` : '-'}
                          </td>
                          <td style={{ padding: '0.75rem 0.5rem', textAlign: 'right', color: 'var(--warning-color)', fontWeight: 'bold' }}>
                            {match.status === 'finished' ? pred.points_earned : '-'}
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Global Predictions Modal */}
      {showAllPredictionsModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="glass-panel" style={{ width: '100%', maxWidth: '800px', maxHeight: '80vh', overflowY: 'auto', position: 'relative' }}>
            <button 
              onClick={() => setShowAllPredictionsModal(false)}
              style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'transparent', border: 'none', color: 'white', cursor: 'pointer' }}
            >
              <X size={24} />
            </button>
            <h2 style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--accent-color)' }}>
              <Users size={24} /> Global Predictions
            </h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
              {matches.map(match => {
                const matchPreds = allPredictionsData.filter(p => p.match_id === match.id);
                if (matchPreds.length === 0) return null;
                
                return (
                  <div key={match.id} style={{ background: 'rgba(255,255,255,0.02)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
                    <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.1rem' }}>
                      {getFlag(match.home_team)} {match.home_team} vs {match.away_team} {getFlag(match.away_team)}
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 'normal', marginLeft: 'auto' }}>
                        {match.status === 'finished' ? `Final: ${match.home_score} - ${match.away_score}` : 'Upcoming'}
                      </span>
                    </h3>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                      {matchPreds.map(pred => (
                        <div key={pred.id} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(0,0,0,0.3)', padding: '0.5rem', borderRadius: '6px' }}>
                          <img src={pred.profiles?.avatar_url || 'https://via.placeholder.com/32'} alt="" style={{ width: '32px', height: '32px', borderRadius: '50%', border: '1px solid var(--accent-color)' }} />
                          <div style={{ display: 'flex', flexDirection: 'column' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 'bold' }}>{pred.profiles?.display_name || 'Unknown'}</span>
                            <span style={{ fontSize: '1rem', color: 'var(--warning-color)', fontWeight: 'bold' }}>{pred.home_score} - {pred.away_score}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MatchCard({ match, prediction, onSubmit }) {
  const isStarted = isPast(new Date(match.start_time));
  
  const [homeScore, setHomeScore] = useState(prediction?.home_score ?? '');
  const [awayScore, setAwayScore] = useState(prediction?.away_score ?? '');
  const [advancingTeam, setAdvancingTeam] = useState(prediction?.advancing_team ?? '');
  
  const isDraw = homeScore !== '' && awayScore !== '' && homeScore === awayScore;

  return (
    <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderLeft: isStarted ? '4px solid var(--text-secondary)' : '4px solid var(--accent-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
          <Clock size={14} /> {format(new Date(match.start_time), 'MMM d, yyyy - HH:mm')}
        </span>
        {isStarted ? (
          <span style={{ color: 'var(--success-color)', fontWeight: '600' }}>{match.status === 'finished' ? 'FT' : 'LIVE'}</span>
        ) : (
          <span style={{ color: 'var(--accent-color)' }}>Upcoming</span>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '2rem' }} title={match.home_team}>{getFlag(match.home_team)}</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'center' }}>{match.home_team}</span>
        </div>
        
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 1rem' }}>
          {isStarted ? (
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', background: 'rgba(0,0,0,0.3)', padding: '0.5rem 1rem', borderRadius: '8px' }}>
              {match.home_score ?? '-'} : {match.away_score ?? '-'}
            </div>
          ) : (
            <>
              <input 
                type="number" 
                min="0"
                value={homeScore}
                onChange={(e) => setHomeScore(e.target.value)}
                style={{ width: '60px', textAlign: 'center', fontSize: '1.25rem' }} 
              />
              <span style={{ fontWeight: 'bold', color: 'var(--text-secondary)' }}>-</span>
              <input 
                type="number" 
                min="0"
                value={awayScore}
                onChange={(e) => setAwayScore(e.target.value)}
                style={{ width: '60px', textAlign: 'center', fontSize: '1.25rem' }} 
              />
            </>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
          <span style={{ fontSize: '2rem' }} title={match.away_team}>{getFlag(match.away_team)}</span>
          <span style={{ fontSize: '1.25rem', fontWeight: 'bold', textAlign: 'center' }}>{match.away_team}</span>
        </div>
      </div>

      {!isStarted && isDraw && (
        <div style={{ marginTop: '0.5rem', padding: '1rem', background: 'rgba(255,255,255,0.05)', borderRadius: '8px', border: '1px solid var(--surface-border)' }}>
          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.9rem', textAlign: 'center', color: 'var(--text-secondary)' }}>Who will advance if it's a draw?</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name={`advancing-${match.id}`} 
                value={match.home_team} 
                checked={advancingTeam === match.home_team}
                onChange={(e) => setAdvancingTeam(e.target.value)}
              />
              <span>{match.home_team}</span>
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
              <input 
                type="radio" 
                name={`advancing-${match.id}`} 
                value={match.away_team} 
                checked={advancingTeam === match.away_team}
                onChange={(e) => setAdvancingTeam(e.target.value)}
              />
              <span>{match.away_team}</span>
            </label>
          </div>
        </div>
      )}

      {!isStarted && (
        <button 
          onClick={() => onSubmit(match.id, homeScore, awayScore, advancingTeam)}
          className="btn-primary" 
          style={{ width: '100%', marginTop: '0.5rem' }}
        >
          {prediction ? 'Update Prediction' : 'Save Prediction'}
        </button>
      )}

      {isStarted && prediction && (
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(56, 189, 248, 0.1)', borderRadius: '8px', textAlign: 'center', fontSize: '0.875rem' }}>
          Your Prediction: <strong>{prediction.home_score} - {prediction.away_score}</strong>
          {match.status === 'finished' && (
            <div style={{ marginTop: '0.25rem', color: 'var(--warning-color)', fontWeight: 'bold' }}>
              Points Earned: {prediction.points_earned}
            </div>
          )}
        </div>
      )}
      
      {isStarted && !prediction && (
        <div style={{ marginTop: '0.5rem', padding: '0.75rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: '8px', textAlign: 'center', fontSize: '0.875rem', color: 'var(--danger-color)' }}>
          You did not make a prediction for this match.
        </div>
      )}
    </div>
  );
}
