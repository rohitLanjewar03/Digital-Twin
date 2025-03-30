import React, { useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/LandingPage.css';

const LandingPage = () => {
  const navigate = useNavigate();
  const splineContainerRef = useRef(null);

  // Use useCallback to memoize the redirectToLogin function
  const redirectToLogin = useCallback((e) => {
    // Prevent default behavior to avoid any external redirects
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    
    // Navigate to login page
    navigate('/login');
    
    return false;
  }, [navigate]);

  useEffect(() => {
    // Check if the script is already loaded
    if (document.querySelector('script[src*="spline-viewer"]')) {
      createSplineViewer();
      return;
    }

    // Load Spline viewer script
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'https://unpkg.com/@splinetool/viewer@1.9.82/build/spline-viewer.js';
    script.onload = createSplineViewer;
    document.head.appendChild(script);

    function createSplineViewer() {
      if (!splineContainerRef.current) return;
      
      // Clear previous content
      splineContainerRef.current.innerHTML = '';
      
      // Create the spline-viewer element
      const splineViewer = document.createElement('spline-viewer');
      splineViewer.setAttribute('url', 'https://prod.spline.design/O3wdCRYFtuSAQy0u/scene.splinecode');
      splineViewer.setAttribute('loading-anim', 'true');
      splineViewer.setAttribute('loading-anim-type', 'spinner-small-dark');
      splineViewer.style.width = '100%';
      splineViewer.style.height = '100%';
      
      // Disable any links in the Spline viewer
      splineViewer.addEventListener('load', () => {
        // Try to find and disable any links in the Spline content
        const links = splineViewer.shadowRoot?.querySelectorAll('a');
        if (links) {
          links.forEach(link => {
            link.addEventListener('click', redirectToLogin);
            link.style.pointerEvents = 'none';
          });
        }
      });
      
      // Add click event to the spline viewer itself
      splineViewer.addEventListener('click', redirectToLogin);
      
      splineContainerRef.current.appendChild(splineViewer);
    }

    // Add a click event listener to the container
    const container = document.querySelector('.landing-container');
    if (container) {
      container.addEventListener('click', redirectToLogin);
    }

    // Cleanup function
    return () => {
      if (splineContainerRef.current) {
        splineContainerRef.current.innerHTML = '';
      }
      
      const container = document.querySelector('.landing-container');
      if (container) {
        container.removeEventListener('click', redirectToLogin);
      }
    };
  }, [redirectToLogin]);

  return (
    <div className="landing-container">
      <div className="spline-container" ref={splineContainerRef}></div>
      <div className="landing-overlay"></div>
      
      {/* Invisible overlay to capture all clicks */}
      <div 
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          zIndex: 1000,
          cursor: 'pointer'
        }}
        onClick={redirectToLogin}
      ></div>
    </div>
  );
};

export default LandingPage;