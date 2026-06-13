import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
export function cn(...inputs) {
    return twMerge(clsx(inputs));
}
export function getLanguageFromPath(path) {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const map = {
        js: 'javascript', jsx: 'javascript', ts: 'typescript', tsx: 'typescript',
        py: 'python', html: 'html', css: 'css', scss: 'scss',
        json: 'json', md: 'markdown', sh: 'shell', bash: 'shell',
        yaml: 'yaml', yml: 'yaml', xml: 'xml', sql: 'sql',
        rs: 'rust', go: 'go', rb: 'ruby', java: 'java',
        c: 'c', cpp: 'cpp', cs: 'csharp', php: 'php',
        swift: 'swift', kt: 'kotlin', vue: 'html', svelte: 'html',
    };
    return map[ext] || 'plaintext';
}
export function getFileIcon(name) {
    const ext = name.split('.').pop()?.toLowerCase() ?? '';
    const icons = {
        js: '📄', jsx: '⚛️', ts: '📘', tsx: '⚛️',
        py: '🐍', html: '🌐', css: '🎨', scss: '🎨',
        json: '{}', md: '📝', sh: '💻', yaml: '📋',
        yml: '📋', env: '🔑', lock: '🔒',
    };
    return icons[ext] || '📄';
}
export function formatBytes(bytes) {
    if (bytes === 0)
        return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
export function formatTimestamp(ts) {
    return new Date(ts).toLocaleTimeString('es', {
        hour: '2-digit',
        minute: '2-digit',
    });
}
export function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}
export function truncate(str, maxLen) {
    return str.length > maxLen ? str.slice(0, maxLen) + '...' : str;
}
export const SKIP_DIRS = new Set([
    'node_modules', '.git', '.next', 'dist', 'build',
    '__pycache__', '.venv', '.svelte-kit', '.nuxt',
]);
export const IMAGE_EXTENSIONS = /\.(png|jpe?g|gif|svg|webp|ico|bmp|avif)$/i;
