const btn = document.getElementById('button-order');
const page = document.getElementById('content');
const focused_img = document.getElementById('focused-img');
let reversed = false;

btn.addEventListener('click', () => {
    reversed = !reversed;

    const container = document.querySelector("content");
    const paragraphs = [...container.children];
    const first = paragraphs.shift(); // remove A from the list

    paragraphs.reverse().forEach(p => container.appendChild(p));

    if (reversed) {
        btn.textContent = 'Oldest first';
    } else {
        btn.textContent = 'Newest first';
    }
});
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