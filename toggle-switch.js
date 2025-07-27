// JS logic for sidebar and modal toggle switches
// Sidebar: Hide (left/red), Show (right/green)
// Modal: Below (left/red), Above (right/green)
document.addEventListener('DOMContentLoaded', function() {
    // Sidebar toggle switch logic
    const sidebarToggle = document.getElementById('sidebarLiveToggle');
    const sidebarLeft = document.getElementById('sidebarToggleLeft');
    const sidebarRight = document.getElementById('sidebarToggleRight');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function(e) {
            e.stopPropagation();
        });
        sidebarToggle.addEventListener('change', function() {
            if (sidebarToggle.checked) {
                if (sidebarLeft) sidebarLeft.style.color = '#888';
                if (sidebarRight) sidebarRight.style.color = '#2ecc40';
                sidebarToggle.parentElement.querySelector('.slider').style.background = '#2ecc40';
            } else {
                if (sidebarLeft) sidebarLeft.style.color = '#ff4136';
                if (sidebarRight) sidebarRight.style.color = '#888';
                sidebarToggle.parentElement.querySelector('.slider').style.background = '#ff4136';
            }
        });
        sidebarToggle.dispatchEvent(new Event('change'));
    }

    // New modal toggle switch logic
    const targetDirectionToggle = document.getElementById('targetDirectionToggle');
    const targetDirectionLabel = document.getElementById('targetDirectionLabel');
    if (targetDirectionToggle && targetDirectionLabel) {
        targetDirectionToggle.addEventListener('change', function() {
            if (targetDirectionToggle.checked) {
                targetDirectionLabel.textContent = 'Above';
                targetDirectionLabel.style.color = '#2ecc40';
                targetDirectionToggle.parentElement.querySelector('.slider').style.background = '#2ecc40';
            } else {
                targetDirectionLabel.textContent = 'Below';
                targetDirectionLabel.style.color = '#ff4136';
                targetDirectionToggle.parentElement.querySelector('.slider').style.background = '#ff4136';
            }
        });
        targetDirectionToggle.dispatchEvent(new Event('change'));
    }
document.addEventListener('DOMContentLoaded', function() {
  // Sidebar toggle
  const sidebarToggle = document.getElementById('sidebarLiveToggle');
  const sidebarLeft = document.getElementById('sidebarToggleLeft');
  const sidebarRight = document.getElementById('sidebarToggleRight');
  sidebarToggle.addEventListener('change', function() {
    if (sidebarToggle.checked) {
      sidebarLeft.style.color = '#888';
      sidebarRight.style.color = '#2ecc40';
      sidebarToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#2ecc40';
      // Show live price display logic here
    } else {
      sidebarLeft.style.color = '#ff4136';
      sidebarRight.style.color = '#888';
      sidebarToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#ff4136';
      // Hide live price display logic here
    }
  });
  // Initial state
  sidebarToggle.dispatchEvent(new Event('change'));

