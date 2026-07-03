import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // 1. Verify Authentication (Supports old Vercel Cron header OR simple URL key for cron-job.org)
  const isAuthorizedHeader = req.headers.authorization === `Bearer ${process.env.CRON_SECRET}`;
  const isAuthorizedQuery = req.query?.key === 'admin1234';

  if (!isAuthorizedHeader && !isAuthorizedQuery) {
    return res.status(401).json({ error: 'Unauthorized. Please provide ?key=admin1234 in the URL.' });
  }

  const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    return res.status(500).json({ error: 'Missing environment variables' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    // 2. Fetch LIVE matches from ESPN's free public API
    const response = await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard');
    
    if (!response.ok) {
      throw new Error(`ESPN API returned ${response.status}`);
    }

    const data = await response.json();
    const events = data.events;

    if (!events || events.length === 0) {
      return res.status(200).json({ message: 'No live/upcoming fixtures found right now.' });
    }

    // 3. Map the ESPN data and Upsert into Supabase
    const upsertData = events.map(event => {
      const comp = event.competitions[0];
      const homeCompetitor = comp.competitors.find(c => c.homeAway === 'home');
      const awayCompetitor = comp.competitors.find(c => c.homeAway === 'away');
      
      let status = 'scheduled';
      const eventState = event.status.type.state; // 'pre', 'in', 'post'
      
      if (eventState === 'post') {
        status = 'finished';
      } else if (eventState === 'in') {
        status = 'live'; 
      }

      const homeScore = homeCompetitor?.score ? parseInt(homeCompetitor.score) : null;
      const awayScore = awayCompetitor?.score ? parseInt(awayCompetitor.score) : null;
      
      let advancingTeam = null;
      if (status === 'finished' && homeScore === awayScore && homeScore !== null) {
        if (homeCompetitor?.winner) advancingTeam = homeCompetitor.team.name;
        else if (awayCompetitor?.winner) advancingTeam = awayCompetitor.team.name;
      }

      return {
        home_team: homeCompetitor?.team?.name || 'TBD',
        away_team: awayCompetitor?.team?.name || 'TBD',
        start_time: event.date,
        home_score: homeScore,
        away_score: awayScore,
        advancing_team: advancingTeam,
        status: status
      };
    });

    // To prevent duplicate matches if the user hasn't added a UNIQUE constraint in Supabase:
    const { data: existingMatches, error: fetchError } = await supabase.from('matches').select('id, home_team, away_team');
    if (fetchError) throw fetchError;

    let updatedCount = 0;
    let insertedCount = 0;

    for (const match of upsertData) {
      // Find an existing match between these two teams
      const existing = existingMatches.find(e => e.home_team === match.home_team && e.away_team === match.away_team);
      
      if (existing) {
        await supabase.from('matches').update(match).eq('id', existing.id);
        updatedCount++;
      } else {
        await supabase.from('matches').insert([match]);
        insertedCount++;
      }
    }

    return res.status(200).json({ 
      success: true, 
      message: `Sync complete! Inserted ${insertedCount}, Updated ${updatedCount} live matches from ESPN.` 
    });

  } catch (error) {
    console.error('Failed to sync:', error);
    return res.status(500).json({ error: error.message });
  }
}
