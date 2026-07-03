-- 1. Add advancing_team to tables (if not already present)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='matches' AND column_name='advancing_team') THEN
    ALTER TABLE matches ADD COLUMN advancing_team text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='predictions' AND column_name='advancing_team') THEN
    ALTER TABLE predictions ADD COLUMN advancing_team text;
  END IF;
END $$;

-- 2. Create the unified scoring function
CREATE OR REPLACE FUNCTION update_prediction_points()
RETURNS TRIGGER AS $$
DECLARE
  actual_home int;
  actual_away int;
  actual_advancing text;
  pred RECORD;
  pts int;
  predicted_winner text;
  actual_winner text;
BEGIN
  -- If we are updating a match to 'finished'
  IF NEW.status = 'finished' THEN
    actual_home := NEW.home_score;
    actual_away := NEW.away_score;
    actual_advancing := NEW.advancing_team;

    -- Iterate over all predictions for this match
    FOR pred IN SELECT * FROM predictions WHERE match_id = NEW.id LOOP
      pts := 0;
      
      -- Determine predicted winner
      IF pred.home_score > pred.away_score THEN
        predicted_winner := NEW.home_team;
      ELSIF pred.home_score < pred.away_score THEN
        predicted_winner := NEW.away_team;
      ELSE
        predicted_winner := pred.advancing_team;
      END IF;
      
      -- Determine actual winner
      IF actual_home > actual_away THEN
        actual_winner := NEW.home_team;
      ELSIF actual_home < actual_away THEN
        actual_winner := NEW.away_team;
      ELSE
        actual_winner := actual_advancing;
      END IF;

      -- 1 point for guessing the correct winner/advancing team
      IF predicted_winner = actual_winner AND actual_winner IS NOT NULL THEN
         pts := pts + 1;
      END IF;
      
      -- 2 extra points for guessing the exact score (Total 3)
      IF pred.home_score = actual_home AND pred.away_score = actual_away THEN
         pts := pts + 2;
      END IF;

      -- Update the prediction points
      UPDATE predictions SET points_earned = pts WHERE id = pred.id;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 3. Re-attach trigger if not exists
DROP TRIGGER IF EXISTS match_finished_trigger ON matches;
CREATE TRIGGER match_finished_trigger
AFTER UPDATE OF status, home_score, away_score, advancing_team ON matches
FOR EACH ROW
EXECUTE FUNCTION update_prediction_points();
