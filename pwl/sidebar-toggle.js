// Perkecil/perbesar sidebar (desktop), diingat lewat localStorage
function toggleSidebarCollapse() {
    document.body.classList.toggle('sidebar-collapsed');
    try {
        localStorage.setItem('pwl-sidebar-collapsed', document.body.classList.contains('sidebar-collapsed') ? '1' : '0');
    } catch (e) {}
}
try {
    if (localStorage.getItem('pwl-sidebar-collapsed') === '1') document.body.classList.add('sidebar-collapsed');
} catch (e) {}
