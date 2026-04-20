import React, { useEffect, useRef } from 'react';
import './NetworkGraph.css';

const NetworkGraph = ({ status }) => {
  const canvasRef = useRef(null);
  const statusRef = useRef(status || 'idle');

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    let animationFrameId;

    const barCount = 30;
    const bars = [];
    const mouse = { x: null, y: null, radius: 100 };

    const resize = () => {
      canvas.width = 300;
      canvas.height = 100;
    };

    window.addEventListener('resize', resize);
    resize();

    class Bar {
      constructor(index) {
        this.index = index;
        this.width = (canvas.width / barCount) - 2;
        this.x = index * (this.width + 2);
        this.targetHeight = Math.random() * canvas.height;
        this.currentHeight = 0;
        this.baseSpeed = 0.05 + Math.random() * 0.1;
      }

      update(status) {
        let speed = this.baseSpeed;
        let jitter = 0.95;

        if (status === 'thinking') {
          speed *= 3.0; // Fast processing
          jitter = 0.7;  // More frequent updates
        } else if (status === 'speaking') {
          speed *= 1.5;
        } else if (status === 'listening') {
          speed *= 0.8;
        }

        // Natural fluctuation
        if (Math.random() > jitter) {
          this.targetHeight = Math.random() * canvas.height;
        }

        // Mouse interaction (subtle height increase)
        if (mouse.x !== null) {
          const dx = mouse.x - (this.x + this.width / 2);
          const distance = Math.abs(dx);
          if (distance < mouse.radius) {
            const factor = (mouse.radius - distance) / mouse.radius;
            this.targetHeight = Math.min(canvas.height, this.targetHeight + (canvas.height * 0.3 * factor));
          }
        }

        this.currentHeight += (this.targetHeight - this.currentHeight) * speed;
      }

      draw() {
        const opacity = (this.currentHeight / canvas.height) * 0.8 + 0.2;
        ctx.fillStyle = `rgba(0, 187, 255, ${opacity})`;
        ctx.fillRect(this.x, canvas.height - this.currentHeight, this.width, this.currentHeight);
        
        // Add a small glow on top
        ctx.fillStyle = '#00bbff';
        ctx.fillRect(this.x, canvas.height - this.currentHeight - 2, this.width, 2);
      }
    }

    const init = () => {
      for (let i = 0; i < barCount; i++) {
        bars.push(new Bar(i));
      }
    };

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const currentStatus = statusRef.current;
      bars.forEach(bar => {
        bar.update(currentStatus);
        bar.draw();
      });
      animationFrameId = requestAnimationFrame(animate);
    };

    const handleMouseMove = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };

    const handleMouseLeave = () => {
      mouse.x = null;
      mouse.y = null;
    };

    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mouseleave', handleMouseLeave);

    init();
    animate();

    return () => {
      window.removeEventListener('resize', resize);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mouseleave', handleMouseLeave);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <div className="network-graph-container">
      <div className="network-graph-label">NEURAL NETWORK ACTIVE</div>
      <canvas ref={canvasRef} className="network-graph-canvas" />
    </div>
  );
};

export default NetworkGraph;
