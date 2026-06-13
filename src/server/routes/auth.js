import { Router } from 'express';
import crypto from 'crypto';
import { config } from '../config';
export const authRouter = Router();
// Credentials from config (loaded from .env, never exposed to frontend)
const AUTH_USER = config.authUser;
const AUTH_PASS = config.authPass;
// Simple token store (in production, use JWT or sessions)
const validTokens = new Set();
function generateToken() {
    return crypto.randomBytes(32).toString('hex');
}
authRouter.post('/login', (req, res) => {
    const { user, password } = req.body;
    if (!user || !password) {
        return res.status(400).json({ error: 'Faltan credenciales' });
    }
    // Constant-time comparison to prevent timing attacks
    const userMatch = user.toLowerCase().trim() === AUTH_USER.toLowerCase().trim();
    const passBuffer = Buffer.from(password);
    const expectedBuffer = Buffer.from(AUTH_PASS);
    let passMatch = false;
    if (passBuffer.length === expectedBuffer.length) {
        passMatch = crypto.timingSafeEqual(passBuffer, expectedBuffer);
    }
    if (userMatch && passMatch) {
        const token = generateToken();
        validTokens.add(token);
        return res.json({ ok: true, token });
    }
    return res.status(401).json({ error: 'Usuario o contraseña incorrectos' });
});
authRouter.post('/verify', (req, res) => {
    const { token } = req.body;
    if (token && validTokens.has(token)) {
        return res.json({ ok: true });
    }
    return res.status(401).json({ error: 'Token inválido' });
});
authRouter.post('/logout', (req, res) => {
    const { token } = req.body;
    if (token)
        validTokens.delete(token);
    return res.json({ ok: true });
});
