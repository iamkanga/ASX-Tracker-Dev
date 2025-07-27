// JS logic for sidebar and modal toggle switches
// Sidebar: Hide (left/red), Show (right/green)
// Modal: Below (left/red), Above (right/green)
document.addEventListener('DOMContentLoaded', function() {
    // Define toggle label elements
    const sidebarLeft = document.getElementById('sidebarToggleLeft');
    const sidebarRight = document.getElementById('sidebarToggleRight');
    const modalLeft = document.getElementById('modalToggleLeft');
    const modalRight = document.getElementById('modalToggleRight');

    const sidebarToggle = document.getElementById('sidebarLiveToggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', function(e) {
            e.stopPropagation(); // Prevent sidebar from closing
        });
        sidebarToggle.addEventListener('change', function() {
            if (sidebarToggle.checked) {
                if (sidebarLeft) sidebarLeft.style.color = '#888';
                if (sidebarRight) sidebarRight.style.color = '#2ecc40';
                sidebarToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#2ecc40';
                // TODO: Show live price display logic here
            } else {
                if (sidebarLeft) sidebarLeft.style.color = '#ff4136';
                if (sidebarRight) sidebarRight.style.color = '#888';
                sidebarToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#ff4136';
                // TODO: Hide live price display logic here
            }
        });
        // Initial state
        sidebarToggle.dispatchEvent(new Event('change'));
    } else {
        console.warn('Sidebar toggle switch element not found.');
    }

    const modalToggle = document.getElementById('modalTargetToggle');
    if (modalToggle) {
        modalToggle.addEventListener('change', function() {
            if (modalToggle.checked) {
                if (modalLeft) modalLeft.style.color = '#888';
                if (modalRight) modalRight.style.color = '#2ecc40';
                modalToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#2ecc40';
                // Set target direction to 'above' in the form
                if (window.targetDirectionToggle) window.targetDirectionToggle.checked = true;
            } else {
                if (modalLeft) modalLeft.style.color = '#ff4136';
                if (modalRight) modalRight.style.color = '#888';
                modalToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#ff4136';
                // Set target direction to 'below' in the form
                if (window.targetDirectionToggle) window.targetDirectionToggle.checked = false;
            }
        });
        // Initial state
        modalToggle.dispatchEvent(new Event('change'));
    } else {
        console.warn('Modal toggle switch element not found.');
    }
});
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

  // Modal toggle
  const modalToggle = document.getElementById('modalTargetToggle');
  const modalLeft = document.getElementById('modalToggleLeft');
  const modalRight = document.getElementById('modalToggleRight');
  modalToggle.addEventListener('change', function() {
    if (modalToggle.checked) {
      modalLeft.style.color = '#888';
      modalRight.style.color = '#2ecc40';
      modalToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#2ecc40';
      // Set target direction to 'above' logic here
    } else {
      modalLeft.style.color = '#ff4136';
      modalRight.style.color = '#888';
      modalToggle.parentElement.querySelector('.toggle-switch-slider').style.background = '#ff4136';
      // Set target direction to 'below' logic here
    }
  });
  // Initial state
  modalToggle.dispatchEvent(new Event('change'));
});
