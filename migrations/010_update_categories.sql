-- 010_update_categories.sql
-- Refactor task categories to new Polish/general tags

DO $$
DECLARE
    rec RECORD;
BEGIN
    -- Dynamically drop existing CHECK constraints on category columns that contain old values
    FOR rec IN 
        SELECT tc.table_name, tc.constraint_name, cc.check_clause
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name IN ('daily_tasks', 'kronos_streaks', 'kronos_patterns', 'kronos_analyses', 'habits', 'projects', 'agent_task_proposals')
    LOOP
        IF rec.check_clause LIKE '%vitality%' OR rec.check_clause LIKE '%willpower%' THEN
            EXECUTE 'ALTER TABLE ' || quote_ident(rec.table_name) || ' DROP CONSTRAINT ' || quote_ident(rec.constraint_name);
        END IF;
    END LOOP;
END $$;

-- Update values in daily_tasks
UPDATE daily_tasks SET category = 
    CASE category
        WHEN 'vitality' THEN 'health'
        WHEN 'intellect' THEN 'knowledge'
        WHEN 'wealth' THEN 'work'
        WHEN 'charisma' THEN 'relationships'
        WHEN 'discipline' THEN 'other'
        WHEN 'willpower' THEN 'other'
    END
WHERE category IN ('vitality', 'intellect', 'wealth', 'charisma', 'discipline', 'willpower');

-- Update values in habits
UPDATE habits SET category = 
    CASE category
        WHEN 'vitality' THEN 'health'
        WHEN 'intellect' THEN 'knowledge'
        WHEN 'wealth' THEN 'work'
        WHEN 'charisma' THEN 'relationships'
        WHEN 'discipline' THEN 'other'
        WHEN 'willpower' THEN 'other'
    END
WHERE category IN ('vitality', 'intellect', 'wealth', 'charisma', 'discipline', 'willpower');

-- Update values in projects
UPDATE projects SET category = 
    CASE category
        WHEN 'vitality' THEN 'health'
        WHEN 'intellect' THEN 'knowledge'
        WHEN 'wealth' THEN 'work'
        WHEN 'charisma' THEN 'relationships'
        WHEN 'discipline' THEN 'other'
        WHEN 'willpower' THEN 'other'
    END
WHERE category IN ('vitality', 'intellect', 'wealth', 'charisma', 'discipline', 'willpower');

-- Update values in kronos_streaks
DELETE FROM kronos_streaks WHERE category = 'willpower';
UPDATE kronos_streaks SET category = 
    CASE category
        WHEN 'vitality' THEN 'health'
        WHEN 'intellect' THEN 'knowledge'
        WHEN 'wealth' THEN 'work'
        WHEN 'charisma' THEN 'relationships'
        WHEN 'discipline' THEN 'other'
    END
WHERE category IN ('vitality', 'intellect', 'wealth', 'charisma', 'discipline');

-- Update values in kronos_patterns
DELETE FROM kronos_patterns WHERE category = 'willpower';
UPDATE kronos_patterns SET category = 
    CASE category
        WHEN 'vitality' THEN 'health'
        WHEN 'intellect' THEN 'knowledge'
        WHEN 'wealth' THEN 'work'
        WHEN 'charisma' THEN 'relationships'
        WHEN 'discipline' THEN 'other'
    END
WHERE category IN ('vitality', 'intellect', 'wealth', 'charisma', 'discipline');

-- Update values in kronos_analyses
UPDATE kronos_analyses SET focus_category = 
    CASE focus_category
        WHEN 'vitality' THEN 'health'
        WHEN 'intellect' THEN 'knowledge'
        WHEN 'wealth' THEN 'work'
        WHEN 'charisma' THEN 'relationships'
        WHEN 'discipline' THEN 'other'
        WHEN 'willpower' THEN 'other'
    END
WHERE focus_category IN ('vitality', 'intellect', 'wealth', 'charisma', 'discipline', 'willpower');

-- Update values in agent_task_proposals
UPDATE agent_task_proposals SET proposed_category = 
    CASE proposed_category
        WHEN 'vitality' THEN 'health'
        WHEN 'intellect' THEN 'knowledge'
        WHEN 'wealth' THEN 'work'
        WHEN 'charisma' THEN 'relationships'
        WHEN 'discipline' THEN 'other'
        WHEN 'willpower' THEN 'other'
    END
WHERE proposed_category IN ('vitality', 'intellect', 'wealth', 'charisma', 'discipline', 'willpower');


-- Add the new CHECK constraints
ALTER TABLE daily_tasks ADD CHECK (category IN ('health','work','knowledge','relationships','other'));
ALTER TABLE habits ADD CHECK (category IN ('health','work','knowledge','relationships','other'));
ALTER TABLE projects ADD CHECK (category IN ('health','work','knowledge','relationships','other'));
ALTER TABLE kronos_streaks ADD CHECK (category IN ('health','work','knowledge','relationships','other'));
ALTER TABLE kronos_patterns ADD CHECK (category IN ('health','work','knowledge','relationships','other'));
ALTER TABLE kronos_analyses ADD CHECK (focus_category IS NULL OR focus_category IN ('health','work','knowledge','relationships','other'));
ALTER TABLE agent_task_proposals ADD CHECK (proposed_category IN ('health','work','knowledge','relationships','other'));