// Sidebar Hide/Show checkbox logic
// Only one checkbox can be checked at a time

document.addEventListener('DOMContentLoaded', function () {
    const hideCheckbox = document.getElementById('sidebarHideCheckbox');
    const showCheckbox = document.getElementById('sidebarShowCheckbox');

    function updateCheckboxes(source) {
        if (source === hideCheckbox && hideCheckbox.checked) {
            showCheckbox.checked = false;
            // Add your logic for 'Hide' here
        } else if (source === showCheckbox && showCheckbox.checked) {
            hideCheckbox.checked = false;
            // Add your logic for 'Show' here
        }
    }

    if (hideCheckbox && showCheckbox) {
        hideCheckbox.addEventListener('change', function () {
            updateCheckboxes(hideCheckbox);
        });
        showCheckbox.addEventListener('change', function () {
            updateCheckboxes(showCheckbox);
        });
    }
});
