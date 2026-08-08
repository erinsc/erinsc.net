const saved = localStorage.getItem('theme');
if (saved) {
    document.documentElement.setAttribute('theme-mode', saved);
} else {
    const next = (window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
    document.documentElement.setAttribute('theme-mode', next);
}

function toggleTheme() {
    const html = document.documentElement;
    const next = html.getAttribute('theme-mode') === 'dark' ?     'light' : 'dark';
    html.setAttribute('theme-mode', next);
    localStorage.setItem('theme', next);
}