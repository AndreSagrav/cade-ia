import { createClient } from '@supabase/supabase-js';
const SUPABASE_URL = 'https://hnqleunrnznoynzdqzsq.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhucWxldW5ybnpub3luemRxenNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkzNzQwMzgsImV4cCI6MjA5NDk1MDAzOH0.haOgam321SOzCkyF-ZvkLKHns_PA3Mjpwdmuy_LryYs';
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
export async function signUp(email, password) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    return { data, error };
}
export async function signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
}
export async function signOut() {
    await supabase.auth.signOut();
}
export async function getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
}
export async function getUser() {
    const { data } = await supabase.auth.getUser();
    return data.user;
}
