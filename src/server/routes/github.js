import { Router } from 'express';
export const githubRouter = Router();
const GH_API = 'https://api.github.com';
function ghHeaders(token) {
    return {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'CodeAI-Studio/2.0',
        'X-GitHub-Api-Version': '2022-11-28',
    };
}
// Get authenticated user's profile
githubRouter.post('/profile', async (req, res) => {
    const { token } = req.body;
    if (!token)
        return res.json({ ok: false, error: 'No GitHub token provided' });
    try {
        const resp = await fetch(`${GH_API}/user`, { headers: ghHeaders(token) });
        if (!resp.ok)
            return res.json({ ok: false, error: `GitHub API error: ${resp.status}` });
        const data = await resp.json();
        res.json({
            ok: true,
            user: {
                login: data.login,
                avatar_url: data.avatar_url,
                name: data.name || data.login,
                html_url: data.html_url,
            },
        });
    }
    catch (err) {
        res.json({ ok: false, error: err.message || 'Error connecting to GitHub' });
    }
});
// List user's repositories
githubRouter.post('/repos', async (req, res) => {
    const { token, page = 1, per_page = 50 } = req.body;
    if (!token)
        return res.json({ ok: false, error: 'No GitHub token provided' });
    try {
        const resp = await fetch(`${GH_API}/user/repos?sort=updated&per_page=${per_page}&page=${page}&affiliation=owner`, { headers: ghHeaders(token) });
        if (!resp.ok)
            return res.json({ ok: false, error: `GitHub API error: ${resp.status}` });
        const data = await resp.json();
        const repos = data.map((r) => ({
            name: r.name,
            full_name: r.full_name,
            html_url: r.html_url,
            clone_url: r.clone_url,
            ssh_url: r.ssh_url,
            private: r.private,
            description: r.description || '',
            updated_at: r.updated_at,
            default_branch: r.default_branch,
        }));
        res.json({ ok: true, repos });
    }
    catch (err) {
        res.json({ ok: false, error: err.message || 'Error fetching repos' });
    }
});
// Create a new repository
githubRouter.post('/create-repo', async (req, res) => {
    const { token, name, description = '', isPrivate = false } = req.body;
    if (!token)
        return res.json({ ok: false, error: 'No GitHub token provided' });
    if (!name)
        return res.status(400).json({ ok: false, error: 'Missing repo name' });
    try {
        const resp = await fetch(`${GH_API}/user/repos`, {
            method: 'POST',
            headers: ghHeaders(token),
            body: JSON.stringify({ name, description, private: isPrivate, auto_init: true }),
        });
        if (!resp.ok) {
            const errData = await resp.json();
            return res.json({ ok: false, error: errData.message || `GitHub API error: ${resp.status}` });
        }
        const data = await resp.json();
        res.json({
            ok: true,
            repo: {
                name: data.name,
                full_name: data.full_name,
                clone_url: data.clone_url,
                html_url: data.html_url,
            },
        });
    }
    catch (err) {
        res.json({ ok: false, error: err.message || 'Error creating repo' });
    }
});
