-- Create stash_yarns table
-- This stores the yarns that users have purchased and own
CREATE TABLE IF NOT EXISTS public.stash_yarns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Yarn identification (from Ravelry or manual entry)
  ravelry_yarn_id TEXT,
  brand TEXT NOT NULL,
  name TEXT NOT NULL,
  colorway TEXT,

  -- Yarn specifications
  weight TEXT, -- lace, fingering, sport, dk, worsted, aran, bulky, super-bulky, jumbo
  fiber_content TEXT,
  yardage INTEGER, -- yards per skein
  grams_per_skein INTEGER,

  -- Stash details
  skeins INTEGER NOT NULL DEFAULT 1,
  purchase_date DATE,
  purchase_price NUMERIC(10, 2),
  location TEXT, -- where the yarn is stored
  notes TEXT,
  image_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create projects table (for project queue)
CREATE TABLE IF NOT EXISTS public.projects (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Project details
  name TEXT NOT NULL,
  pattern TEXT NOT NULL,
  pattern_url TEXT,
  image_url TEXT,
  status TEXT NOT NULL DEFAULT 'queued', -- queued, in-progress, completed, frogged

  -- Knitting specs
  needle_size TEXT,
  gauge TEXT,
  difficulty TEXT, -- beginner, easy, intermediate, advanced

  -- Metadata
  designer TEXT,
  ravelry_id INTEGER,
  notes TEXT,
  tags TEXT[],

  -- Dates
  start_date DATE,
  end_date DATE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create project_yarns junction table (yarns used in projects)
CREATE TABLE IF NOT EXISTS public.project_yarns (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  stash_yarn_id UUID REFERENCES public.stash_yarns(id) ON DELETE SET NULL,

  -- Yarn details (can be from stash or manually entered)
  yarn_name TEXT NOT NULL,
  colorway TEXT,
  skeins_needed INTEGER NOT NULL DEFAULT 1,
  skeins_used INTEGER DEFAULT 0,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_stash_yarns_user_id ON public.stash_yarns(user_id);
CREATE INDEX IF NOT EXISTS idx_stash_yarns_brand ON public.stash_yarns(brand);
CREATE INDEX IF NOT EXISTS idx_stash_yarns_weight ON public.stash_yarns(weight);
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON public.projects(user_id);
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);
CREATE INDEX IF NOT EXISTS idx_project_yarns_project_id ON public.project_yarns(project_id);

-- Enable Row Level Security (RLS)
ALTER TABLE public.stash_yarns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_yarns ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for stash_yarns
-- Users can only see and modify their own yarn stash
CREATE POLICY "Users can view their own stash yarns"
  ON public.stash_yarns
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own stash yarns"
  ON public.stash_yarns
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stash yarns"
  ON public.stash_yarns
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stash yarns"
  ON public.stash_yarns
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for projects
CREATE POLICY "Users can view their own projects"
  ON public.projects
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own projects"
  ON public.projects
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own projects"
  ON public.projects
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own projects"
  ON public.projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Create RLS policies for project_yarns
CREATE POLICY "Users can view project yarns for their projects"
  ON public.project_yarns
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_yarns.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert project yarns for their projects"
  ON public.project_yarns
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_yarns.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update project yarns for their projects"
  ON public.project_yarns
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_yarns.project_id
      AND projects.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete project yarns for their projects"
  ON public.project_yarns
  FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = project_yarns.project_id
      AND projects.user_id = auth.uid()
    )
  );

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at
CREATE TRIGGER update_stash_yarns_updated_at
  BEFORE UPDATE ON public.stash_yarns
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
