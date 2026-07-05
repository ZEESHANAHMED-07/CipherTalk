-- ====================================================================
-- CIPHERTALK DATABASE SCHEMA & SECURITY POLICIES
-- Run this in your Supabase SQL Editor.
-- ====================================================================

-- 1. PROFILES TABLE (Linked to auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    public_key TEXT NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    private_key_iv TEXT NOT NULL,
    private_key_auth_tag TEXT NOT NULL,
    private_key_salt TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Public profiles are viewable by everyone" ON public.profiles
    FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile" ON public.profiles
    FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);


-- 2. ROOMS TABLE
CREATE TABLE IF NOT EXISTS public.rooms (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT,
    is_group BOOLEAN DEFAULT false NOT NULL,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Rooms
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;


-- 3. ROOM PARTICIPANTS TABLE
CREATE TABLE IF NOT EXISTS public.room_participants (
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    encrypted_room_key TEXT NOT NULL,
    room_key_iv TEXT NOT NULL,
    room_key_auth_tag TEXT NOT NULL,
    creator_dh_public_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    PRIMARY KEY (room_id, user_id)
);

-- Enable RLS on Room Participants
ALTER TABLE public.room_participants ENABLE ROW LEVEL SECURITY;

-- Helper function to check room participation bypassing RLS to avoid circular recursion
CREATE OR REPLACE FUNCTION public.is_room_participant(room_uuid UUID, user_uuid UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.room_participants
    WHERE room_id = room_uuid AND user_id = user_uuid
  );
END;
$$;

-- Policies for Room Participants
CREATE POLICY "Users can view participants of their rooms" ON public.room_participants
    FOR SELECT USING (public.is_room_participant(room_id, auth.uid()));

CREATE POLICY "Users can add participants" ON public.room_participants
    FOR INSERT WITH CHECK (true);

-- Now Policies for Rooms
CREATE POLICY "Users can view rooms they are in" ON public.rooms
    FOR SELECT USING (
        created_by = auth.uid()
        OR
        public.is_room_participant(id, auth.uid())
    );

CREATE POLICY "Users can create rooms" ON public.rooms
    FOR INSERT WITH CHECK (auth.uid() = created_by);


-- 4. MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.messages (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    room_id UUID REFERENCES public.rooms(id) ON DELETE CASCADE NOT NULL,
    sender_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    ciphertext TEXT NOT NULL,
    iv TEXT NOT NULL,
    auth_tag TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Messages
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;

-- Messages Policies
CREATE POLICY "Users can view messages in their rooms" ON public.messages
    FOR SELECT USING (public.is_room_participant(room_id, auth.uid()));

CREATE POLICY "Users can send messages to their rooms" ON public.messages
    FOR INSERT WITH CHECK (
        auth.uid() = sender_id AND
        public.is_room_participant(room_id, auth.uid())
    );


-- 5. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS on Audit Logs
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit Logs Policies
CREATE POLICY "Users can insert audit logs for themselves" ON public.audit_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

CREATE POLICY "Users can view their own audit logs" ON public.audit_logs
    FOR SELECT USING (auth.uid() = user_id);


-- 6. PROFILE CREATION TRIGGER
-- Automatically creates a profile when a new user signs up via auth
CREATE OR REPLACE FUNCTION public.handle_new_user_trigger()
RETURNS TRIGGER AS $$
BEGIN
  -- We don't populate keys here because we generate them on the client side.
  -- This trigger is a fallback, but user creation is primarily done from the client.
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
