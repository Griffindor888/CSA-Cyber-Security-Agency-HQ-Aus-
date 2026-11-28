// Vercel Speed Insights initialization
// This script loads and initializes Vercel Speed Insights for the site
(function() {
  'use strict';
  
  // Initialize the Speed Insights queue
  window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };
  
  // Dynamically load the Speed Insights script from CDN
  var script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/speed-insights/script.js';
  script.onerror = function() {
    // Fallback to npm package if Vercel script is not available
    console.warn('Speed Insights: Vercel script not found, trying npm package');
  };
  
  // Insert script into the document
  if (document.head) {
    document.head.appendChild(script);
  } else {
    document.addEventListener('DOMContentLoaded', function() {
      document.head.appendChild(script);
    });
  }
})();
