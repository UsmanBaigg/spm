-- Supabase PostgreSQL Schema for Trust & Rating Module

-- 1. Users Table (if not using auth.users directly, or extending it)
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    username TEXT NOT NULL,
    profile_image TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMPTZ,
    account_age INTEGER DEFAULT 0,
    last_active TIMESTAMPTZ DEFAULT NOW(),
    is_suspended BOOLEAN DEFAULT FALSE,
    suspension_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Ratings Table
CREATE TYPE rating_context AS ENUM ('marketplace', 'services', 'general');
CREATE TYPE rating_status AS ENUM ('active', 'edited', 'flagged', 'deleted');

CREATE TABLE public.ratings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rater_id TEXT NOT NULL,
    ratee_id TEXT NOT NULL,
    stars INTEGER NOT NULL CHECK (stars >= 1 AND stars <= 5),
    context rating_context DEFAULT 'general',
    context_id TEXT,
    review_id UUID,
    rater_info JSONB DEFAULT '{}'::jsonb,
    is_anonymous BOOLEAN DEFAULT FALSE,
    status rating_status DEFAULT 'active',
    report_count INTEGER DEFAULT 0,
    is_pinned BOOLEAN DEFAULT FALSE,
    edit_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Compound unique index to prevent duplicate ratings
CREATE UNIQUE INDEX idx_ratings_unique ON public.ratings(rater_id, ratee_id, context, COALESCE(context_id, '')) WHERE status != 'deleted';
CREATE INDEX idx_ratings_ratee_created ON public.ratings(ratee_id, created_at DESC);
CREATE INDEX idx_ratings_rater_created ON public.ratings(rater_id, created_at DESC);

-- 3. Reviews Table
CREATE TYPE review_status AS ENUM ('published', 'edited', 'flagged', 'removed', 'admin-removed');

CREATE TABLE public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    rating_id UUID UNIQUE NOT NULL REFERENCES public.ratings(id) ON DELETE CASCADE,
    rater_id TEXT NOT NULL,
    ratee_id TEXT NOT NULL,
    title TEXT,
    content TEXT NOT NULL,
    context rating_context DEFAULT 'general',
    tags TEXT[] DEFAULT '{}',
    report_count INTEGER DEFAULT 0,
    flag_reasons JSONB DEFAULT '[]'::jsonb,
    status review_status DEFAULT 'published',
    admin_notes TEXT,
    helpful_count INTEGER DEFAULT 0,
    not_helpful_count INTEGER DEFAULT 0,
    edit_history JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Trust Scores Table
CREATE TYPE trust_badge AS ENUM (
    'new-neighbor', 'community-member', 'trusted-neighbor', 
    'verified-contributor', 'community-star', 
    'verified-seller', 'trusted-service-provider'
);

CREATE TABLE public.trust_scores (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id TEXT UNIQUE NOT NULL,
    score INTEGER NOT NULL DEFAULT 50 CHECK (score >= 0 AND score <= 100),
    badge trust_badge DEFAULT 'new-neighbor',
    metrics JSONB DEFAULT '{
        "totalRatingsReceived": 0,
        "averageRating": 0,
        "marketplaceRatings": {"count": 0, "average": 0},
        "serviceRatings": {"count": 0, "average": 0},
        "accountAgeDays": 0,
        "verificationStatus": "unverified",
        "moderationIncidents": 0
    }'::jsonb,
    weighted_factors JSONB DEFAULT '{
        "ratingWeight": 0.4,
        "volumeWeight": 0.2,
        "accountAgeWeight": 0.1,
        "verificationBonus": 0.15,
        "moderationPenalty": 0
    }'::jsonb,
    badges JSONB DEFAULT '{
        "verifiedSeller": {"earned": false},
        "trustedServiceProvider": {"earned": false}
    }'::jsonb,
    score_history JSONB DEFAULT '[]'::jsonb,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    next_recalculation_date TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_trust_scores_score ON public.trust_scores(score DESC);
CREATE INDEX idx_trust_scores_badge ON public.trust_scores(badge);
