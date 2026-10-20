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

page.addEventListener('click', (e) => {
    const img = e.target.closest('img');
    if (!img) {
        overlay.classList.remove('active');
        focused_img.classList.remove('focused');
        return;
    }
    focused_img.src = img.src;

    overlay.classList.add('active');
    focused_img.classList.add('focused');
});