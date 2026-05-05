# Supabase Setup Guide

This guide explains how to connect the frontend to Supabase and add tables/data to your Supabase project.

## Getting Your Supabase Credentials

1. Go to [supabase.com](https://supabase.com) and sign in to your class project
2. Navigate to **Project Settings** > **API**
3. Copy the following values:
   - **Project URL** → Add to `VITE_SUPABASE_URL` in `.env`
   - **anon/public** key → Add to `VITE_SUPABASE_ANON_KEY` in `.env`

## Required Database Tables

The frontend expects the following Supabase tables:

### 1. `reviews` Table
```sql
CREATE TABLE reviews (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  target_type TEXT NOT NULL CHECK (target_type IN ('user', 'service', 'marketplace_item')),
  target_id UUID NOT NULL,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  reviewer_id UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better performance
CREATE INDEX idx_reviews_target ON reviews(target_type, target_id);
CREATE INDEX idx_reviews_created_at ON reviews(created_at DESC);
```

### 2. `user_trust` Table
```sql
CREATE TABLE user_trust (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) UNIQUE,
  reputation_score INTEGER DEFAULT 0,
  is_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3. `badges` Table (Optional - for future use)
```sql
CREATE TABLE badges (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  name TEXT NOT NULL,
  description TEXT,
  icon TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## How to Add Tables to Supabase

### Option 1: Using SQL Editor
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Paste the SQL code above for each table
5. Click **Run** to execute

### Option 2: Using Table Editor
1. Go to **Table Editor** in the left sidebar
2. Click **Create a new table**
3. Enter table name and add columns with the correct types
4. Save the table

## Row Level Security (RLS) Policies

Enable RLS to protect your data:

```sql
-- Enable RLS
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_trust ENABLE ROW LEVEL SECURITY;

-- Allow public read access to reviews (adjust as needed)
CREATE POLICY "Public reviews are viewable by everyone"
  ON reviews FOR SELECT
  USING (true);

-- Allow authenticated users to create reviews
CREATE POLICY "Authenticated users can create reviews"
  ON reviews FOR INSERT
  WITH CHECK (auth.uid() = reviewer_id);

-- Allow users to update their own reviews
CREATE POLICY "Users can update own reviews"
  ON reviews FOR UPDATE
  USING (auth.uid() = reviewer_id);

-- Allow users to delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON reviews FOR DELETE
  USING (auth.uid() = reviewer_id);

-- Allow public read access to user trust
CREATE POLICY "Public user trust is viewable by everyone"
  ON user_trust FOR SELECT
  USING (true);

-- Allow users to update their own trust score (usually done by backend)
CREATE POLICY "Users can update own trust"
  ON user_trust FOR UPDATE
  USING (auth.uid() = user_id);
```

## Testing the Connection

1. Update your `.env` file with your Supabase credentials
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Navigate to one of the routes (e.g., `/users/1`)
4. The app should fetch data from Supabase (or show empty states if no data exists)

## Adding Sample Data

To add sample data for testing:

```sql
-- Add sample reviews
INSERT INTO reviews (target_type, target_id, rating, comment, reviewer_id)
VALUES 
  ('user', '00000000-0000-0000-0000-000000000001', 5, 'Great user!', auth.uid()),
  ('user', '00000000-0000-0000-0000-000000000001', 4, 'Very helpful', auth.uid());

-- Add sample trust data
INSERT INTO user_trust (user_id, reputation_score, is_verified)
VALUES 
  (auth.uid(), 75, true);
```

## Common Issues

### "Missing Supabase environment variables"
- Make sure you've updated the `.env` file with your credentials
- Restart the dev server after updating `.env`

### "Permission denied" errors
- Check your RLS policies in Supabase
- Make sure you're authenticated if required

### Table not found errors
- Verify table names match exactly (case-sensitive)
- Check that tables exist in your Supabase project

## Next Steps

1. Set up authentication flow in your app using the auth functions in `src/state/auth.js`
2. Add a login/signup page
3. Configure Row Level Security based on your requirements
4. Add real-time subscriptions if needed (Supabase supports this)

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript)
- [Supabase Auth](https://supabase.com/docs/guides/auth)
