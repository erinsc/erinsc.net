const orderBtn = document.getElementById('button-order');
const modeBtn = document.getElementById('button-mode');
const tagBtns = [...document.querySelectorAll('.button-tag')];

const gallery = document.getElementById('gallery');
const items = [...gallery.querySelectorAll('.labeled')];


orderBtn.addEventListener('click', () => {
    const reversed = orderBtn.getAttribute('aria-pressed') === 'true';
    orderBtn.setAttribute('aria-pressed', !reversed);
    orderBtn.textContent = reversed ? 'newest first' : 'oldest first';

    const items = [...gallery.querySelectorAll('.labeled')];
    items.reverse().forEach(p => gallery.appendChild(p));    
});
modeBtn.addEventListener('click', () => {
    const reversed = modeBtn.getAttribute('aria-pressed') === 'true';
    modeBtn.setAttribute('aria-pressed', !reversed);
    modeBtn.textContent = reversed ? 'tags: any' : 'tags: all';
    filterImages();
});
tagBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const reversed = btn.getAttribute('aria-pressed') === 'true';
        btn.setAttribute('aria-pressed', !reversed);
        filterImages();
    })
});

function filterImages() {

    const selected = tagBtns
        .filter(btn => btn.getAttribute('aria-pressed') === 'true')
        .map(btn => btn.getAttribute('tag'));

    items.forEach(item => {
        const tags = item.getAttribute('tags').split(' ');

        let show;
        const match_all = modeBtn.getAttribute('aria-pressed') === 'true';
        if (match_all) {
            show = selected.every(t => tags.includes(t));
        } else {
            show = selected.some(t => tags.includes(t));
        }

        console.log(tags);

        item.classList.toggle('hidden', !show);
    })
}


const page = document.getElementById('content');
const focused_img = document.getElementById('focused-img');
let moved = false;

document.getElementById('content').addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) return;
    focused_img.src = img.currentSrc || img.src;
    overlay.classList.add('active');
});

overlay.addEventListener('click', (e) => {
    if (moved) { moved = false; return; }
    if (e.target === focused_img) {
        overlay.classList.toggle('zoomed');
        // re-center the scroll position
        overlay.scrollLeft = (overlay.scrollWidth - overlay.clientWidth) / 2;
        overlay.scrollTop = (overlay.scrollHeight - overlay.clientHeight) / 2;
    } else {
        overlay.classList.remove('active', 'zoomed');
    }
});

let drag = null;
overlay.addEventListener('pointerdown', (e) => {
    if (e.target === focused_img && overlay.classList.contains('zoomed'))
        drag = { x: e.clientX, y: e.clientY, l: overlay.scrollLeft, t: overlay.scrollTop };
});
overlay.addEventListener('pointermove', (e) => {
    if (!drag) return;
    moved = true;
    overlay.scrollLeft = drag.l - (e.clientX - drag.x);
    overlay.scrollTop = drag.t - (e.clientY - drag.y);
});
addEventListener('pointerup', () => drag = null);