import React, { useEffect, useRef } from "react";
import * as THREE from "three";

export default function BlobScene({ config }) {
  const mountRef = useRef(null);
  const configRef = useRef(config || { size: 350, colorTheme: "#00bbff", intensity: 1.0 });
  const statusRef = useRef(status || 'idle');

  useEffect(() => {
    if (config) configRef.current = config;
  }, [config]);

  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  useEffect(() => {
    const mount = mountRef.current;

    // ---------------- SCENE ----------------
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      75,
      mount.clientWidth / mount.clientHeight,
      0.1,
      100
    );
    camera.position.z = 2.4;

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });

    renderer.setSize(mount.clientWidth, mount.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    renderer.setClearColor(0x000000, 0);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;

    mount.appendChild(renderer.domElement);

    // ---------------- PARAMS ----------------
    const params = {
      timeScale: 1.2,
      rotationSpeedX: 0.0015,
      rotationSpeedY: 0.0035,
    };

    // ---------------- GROUP ----------------
    const mainGroup = new THREE.Group();
    scene.add(mainGroup);

    const pointLight = new THREE.PointLight(0x00bbff, 2.5, 10);
    mainGroup.add(pointLight);

    // ---------------- MIC ----------------
    let analyser;
    let micArray;
    let audioCtx;
    let micStrength = 0;

    async function initMic() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const source = audioCtx.createMediaStreamSource(stream);

        analyser = audioCtx.createAnalyser();
        analyser.fftSize = 128;

        micArray = new Uint8Array(analyser.frequencyBinCount);

        source.connect(analyser);
      } catch (e) {
        console.log("Mic blocked");
      }
    }

    initMic();

    // ---------------- WAVE EFFECT ----------------
    let targetWave = 0;
    let currentWave = 0;

    const onMouseMove = (e) => {
      const rect = mount.getBoundingClientRect();
      const nx = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const ny = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      const dist = Math.sqrt(nx * nx + ny * ny);
      targetWave = dist < 0.8 ? 1.0 : 0.0;
    };
    const onMouseLeave = () => { targetWave = 0; };
    mount.addEventListener("mousemove", onMouseMove);
    mount.addEventListener("mouseleave", onMouseLeave);

    // ---------------- NOISE ----------------
    const noise = `
    vec3 mod289(vec3 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 mod289(vec4 x){return x-floor(x*(1.0/289.0))*289.0;}
    vec4 permute(vec4 x){return mod289(((x*34.0)+1.0)*x);}
    vec4 taylorInvSqrt(vec4 r){return 1.79284291400159-0.85373472095314*r;}

    float snoise(vec3 v){
      const vec2 C=vec2(1.0/6.0,1.0/3.0);
      const vec4 D=vec4(0.0,0.5,1.0,2.0);

      vec3 i=floor(v+dot(v,C.yyy));
      vec3 x0=v-i+dot(i,C.xxx);

      vec3 g=step(x0.yzx,x0.xyz);
      vec3 l=1.0-g;
      vec3 i1=min(g.xyz,l.zxy);
      vec3 i2=max(g.xyz,l.zxy);

      vec3 x1=x0-i1+C.xxx;
      vec3 x2=x0-i2+C.yyy;
      vec3 x3=x0-D.yyy;

      i=mod289(i);
      vec4 p=permute(permute(permute(
      i.z+vec4(0.0,i1.z,i2.z,1.0))
      +i.y+vec4(0.0,i1.y,i2.y,1.0))
      +i.x+vec4(0.0,i1.x,i2.x,1.0));

      float n_=0.142857142857;
      vec3 ns=n_*D.wyz-D.xzx;

      vec4 j=p-49.0*floor(p*ns.z*ns.z);
      vec4 x_=floor(j*ns.z);
      vec4 y_=floor(j-7.0*x_);

      vec4 x=x_*ns.x+ns.yyyy;
      vec4 y=y_*ns.x+ns.yyyy;
      vec4 h=1.0-abs(x)-abs(y);

      vec4 b0=vec4(x.xy,y.xy);
      vec4 b1=vec4(x.zw,y.zw);

      vec4 s0=floor(b0)*2.0+1.0;
      vec4 s1=floor(b1)*2.0+1.0;
      vec4 sh=-step(h,vec4(0.0));

      vec4 a0=b0.xzyw+s0.xzyw*sh.xxyy;
      vec4 a1=b1.xzyw+s1.xzyw*sh.zzww;

      vec3 p0=vec3(a0.xy,h.x);
      vec3 p1=vec3(a0.zw,h.y);
      vec3 p2=vec3(a1.xy,h.z);
      vec3 p3=vec3(a1.zw,h.w);

      vec4 norm=taylorInvSqrt(vec4(dot(p0,p0),dot(p1,p1),dot(p2,p2),dot(p3,p3)));
      p0*=norm.x;p1*=norm.y;p2*=norm.z;p3*=norm.w;

      vec4 m=max(0.6-vec4(dot(x0,x0),dot(x1,x1),dot(x2,x2),dot(x3,x3)),0.0);
      m=m*m;
      return 42.0*dot(m*m,vec4(dot(p0,x0),dot(p1,x1),dot(p2,x2),dot(p3,x3)));
    }

    float fbm(vec3 p){
      float t=0.0;
      float a=0.5;
      float f=1.0;
      for(int i=0;i<2;i++){
        t += snoise(p*f)*a;
        a*=0.5;
        f*=2.0;
      }
      return t;
    }
    `;

    // ---------------- SHELL ----------------
    const shellGeo = new THREE.SphereGeometry(1, 42, 42);

    const shellMat = new THREE.ShaderMaterial({
      uniforms: {
        uColor: { value: new THREE.Color(0x0033ff) },
        uOpacity: { value: 0.6 },
      },
      vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;

      void main(){
        vNormal = normalize(normalMatrix * normal);
        vec4 mv = modelViewMatrix * vec4(position,1.0);
        vView = -mv.xyz;
        gl_Position = projectionMatrix * mv;
      }
      `,
      fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;

      varying vec3 vNormal;
      varying vec3 vView;

      void main(){
        float fres = pow(1.0-dot(normalize(vNormal),normalize(vView)),2.5);
        gl_FragColor = vec4(uColor, fres * uOpacity);
      }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const shell = new THREE.Mesh(shellGeo, shellMat);
    mainGroup.add(shell);

    // ---------------- PLASMA ----------------
    const plasmaGeo = new THREE.SphereGeometry(0.998, 64, 64);

    const plasmaMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uMic: { value: 0 },
        uWave: { value: 0 },
        uC1: { value: new THREE.Vector3(0.01, 0.02, 0.15) },
        uC2: { value: new THREE.Vector3(0.0, 0.3, 0.7) },
        uC3: { value: new THREE.Vector3(0.2, 0.9, 1.0) },
      },

      vertexShader: `
      varying vec3 vPos;
      void main(){
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0);
      }
      `,

      fragmentShader: `
      uniform float uTime;
      uniform float uMic;
      uniform float uWave;
      
      uniform vec3 uC1;
      uniform vec3 uC2;
      uniform vec3 uC3;

      varying vec3 vPos;

      ${noise}

      void main(){
        vec3 p = vPos * 0.2;
        
        // Add hover wave effect to distortion
        p.x += sin(p.y * 10.0 + uTime * 3.0) * uWave * 0.05;
        p.y += cos(p.x * 12.0 + uTime * 2.5) * uWave * 0.05;

        float n = fbm(p + uTime * 0.12);
        float t = (n + 0.5);

        vec3 color = mix(uC1, uC2, t);
        color = mix(color, uC3, smoothstep(0.55, 1.0, t));

        float alpha = smoothstep(0.15, 0.8, t);
        alpha += uMic * 0.4;
        alpha += uWave * 0.15; // wave makes it glow slightly more

        gl_FragColor = vec4(color * (1.25 + uMic * 0.8 + uWave * 0.3), alpha);
      }
      `,
      transparent: true,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    const plasma = new THREE.Mesh(plasmaGeo, plasmaMat);
    mainGroup.add(plasma);

    // ---------------- PARTICLES ----------------
    const count = 400;
    const positions = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const r = 0.92 * Math.cbrt(Math.random());
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }

    const particleGeo = new THREE.BufferGeometry();
    particleGeo.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const particleMat = new THREE.PointsMaterial({
      size: 0.02,
      color: 0xffffff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const particles = new THREE.Points(particleGeo, particleMat);
    mainGroup.add(particles);

    // ---------------- THEMES ----------------
    function getThemeColorsFromHex(hex) {
      // Fallback to default if hex is invalid
      let baseColor;
      try {
        baseColor = new THREE.Color(hex);
      } catch (e) {
        baseColor = new THREE.Color("#00bbff");
      }
      
      const hsl = { h: 0, s: 0, l: 0 };
      baseColor.getHSL(hsl);

      const shell = baseColor.clone();
      const light = new THREE.Color().setHSL(hsl.h, hsl.s, Math.min(1.0, hsl.l + 0.2));

      // Create plasma gradient colors based on the base color
      const c1 = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.01, hsl.l - 0.4));
      const c2 = new THREE.Color().setHSL(hsl.h, hsl.s, Math.max(0.1, hsl.l - 0.1));
      const c3 = new THREE.Color().setHSL(hsl.h, Math.min(1.0, hsl.s + 0.2), Math.min(1.0, hsl.l + 0.3));

      return {
        shell: shell,
        light: light,
        c1: new THREE.Vector3(c1.r, c1.g, c1.b),
        c2: new THREE.Vector3(c2.r, c2.g, c2.b),
        c3: new THREE.Vector3(c3.r, c3.g, c3.b),
      };
    }

    // ---------------- CLOCK ----------------
    const clock = new THREE.Clock();
    let frame = 0;

    // ---------------- ANIMATE ----------------
    function animate() {
      frame = requestAnimationFrame(animate);

      const t = clock.getElapsedTime();
      const cfg = configRef.current;
      const currentStatus = statusRef.current;

      // mic read
      let level = 0;
      if (analyser && micArray) {
        analyser.getByteFrequencyData(micArray);
        let sum = 0;
        for (let i = 0; i < micArray.length; i++) sum += micArray[i];
        level = sum / micArray.length / 255;
      }

      // SYNC: If JARVIS is speaking, simulate voice activity for the blob
      if (currentStatus === 'speaking') {
        // Create a rhythmic pulse that feels like speech
        level = Math.max(level, 0.15 + Math.sin(t * 12) * 0.1);
      } else if (currentStatus === 'thinking') {
        // Subtle "processing" hum
        level = Math.max(level, 0.05 + Math.sin(t * 20) * 0.02);
      }

      micStrength += (level - micStrength) * 0.12;

      // Smooth wave effect
      currentWave += (targetWave - currentWave) * 0.1;
      plasmaMat.uniforms.uWave.value = currentWave;

      // Apply Config
      const intensity = cfg.intensity || 1.0;
      const themeColors = getThemeColorsFromHex(cfg.colorTheme || "#00bbff");

      // Smooth color transitions — lerp each channel individually for Vector3
      const tc = themeColors;
      shellMat.uniforms.uColor.value.lerp(tc.shell, 0.05);
      pointLight.color.lerp(tc.light, 0.05);
      const u1 = plasmaMat.uniforms.uC1.value;
      const u2 = plasmaMat.uniforms.uC2.value;
      const u3 = plasmaMat.uniforms.uC3.value;
      u1.x += (tc.c1.x - u1.x) * 0.05;
      u1.y += (tc.c1.y - u1.y) * 0.05;
      u1.z += (tc.c1.z - u1.z) * 0.05;
      u2.x += (tc.c2.x - u2.x) * 0.05;
      u2.y += (tc.c2.y - u2.y) * 0.05;
      u2.z += (tc.c2.z - u2.z) * 0.05;
      u3.x += (tc.c3.x - u3.x) * 0.05;
      u3.y += (tc.c3.y - u3.y) * 0.05;
      u3.z += (tc.c3.z - u3.z) * 0.05;

      plasmaMat.uniforms.uTime.value = t * params.timeScale;
      plasmaMat.uniforms.uMic.value = micStrength * intensity;

      const scale = 1 + (micStrength * 0.3 * intensity) + (currentWave * 0.05);
      mainGroup.scale.set(scale, scale, scale);

      plasma.rotation.y = t * 0.08 + (currentWave * 0.5); // spin slightly faster on hover
      mainGroup.rotation.x += params.rotationSpeedX;
      mainGroup.rotation.y += params.rotationSpeedY;

      renderer.render(scene, camera);
    }

    animate();

    // ---------------- RESIZE ----------------
    function onResize() {
      if (!mountRef.current) return;
      camera.aspect = mountRef.current.clientWidth / mountRef.current.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    }

    const resizeObserver = new ResizeObserver(() => {
      onResize();
    });
    
    if (mountRef.current) {
      resizeObserver.observe(mountRef.current);
    }
    window.addEventListener("resize", onResize);

    // ---------------- CLEANUP ----------------
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", onResize);
      resizeObserver.disconnect();
      mount.removeEventListener("mousemove", onMouseMove);
      mount.removeEventListener("mouseleave", onMouseLeave);

      if (audioCtx) audioCtx.close();
      if (renderer) renderer.dispose();
      
      if (mount && renderer.domElement && mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Compute styles dynamically based on config
  const cfg = config || { size: 350 };
  const sizePx = `${cfg.size}px`;
  
  let containerStyle = {
    position: "fixed",
    width: sizePx,
    height: sizePx,
    background: "transparent",
    zIndex: 50,
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
  };

  return <div ref={mountRef} style={containerStyle} />;
}