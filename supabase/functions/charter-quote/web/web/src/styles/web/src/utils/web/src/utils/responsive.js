// Check device type and apply appropriate responsive settings
function applyResponsiveLayout() {
  const width = window.innerWidth;
  let deviceType;
  
  if (width < 576) {
    deviceType = 'mobile';
  } else if (width < 992) {
    deviceType = 'tablet';
  } else {
    deviceType = 'desktop';
  }
  
  // Set data attribute on body
  document.body.setAttribute('data-device-type', deviceType);
  
  // Adjust form layout based on device type
  adjustFormLayout(deviceType);
}

// Apply device-specific form layout adjustments
function adjustFormLayout(deviceType) {
  const form = document.getElementById('quoteForm');
  const quoteResult = document.getElementById('quoteResult');
  
  if (!form) return;
  
  // Mobile-specific adjustments
  if (deviceType === 'mobile') {
    // Stack all columns
    document.querySelectorAll('.col-md-6').forEach(col => {
      col.classList.add('mb-3');
    });
    
    // Full-width buttons
    document.querySelectorAll('.btn').forEach(btn => {
      btn.classList.add('w-100');
    });
  } else {
    // Reset for larger screens
    document.querySelectorAll('.col-md-6').forEach(col => {
      col.classList.remove('mb-3');
    });
    
    document.querySelectorAll('.btn').forEach(btn => {
      btn.classList.remove('w-100');
    });
  }
  
  // Add box shadow to quote result on desktop
  if (quoteResult && deviceType === 'desktop') {
    quoteResult.style.boxShadow = '0 8px 16px rgba(0, 0, 0, 0.1)';
  }
}

// Initialize responsive behavior
document.addEventListener('DOMContentLoaded', () => {
  applyResponsiveLayout();
  
  // Reapply on resize with debounce
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      applyResponsiveLayout();
    }, 250);
  });
});
