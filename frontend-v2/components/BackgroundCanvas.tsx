"use client";

import { useEffect, useRef } from "react";

export function BackgroundCanvas() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl =
      (canvas.getContext("webgl") as WebGLRenderingContext | null) ||
      (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);

    if (!gl) return;

    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;

    const isMobile = window.matchMedia("(max-width: 640px)").matches;
    if (prefersReducedMotion || isMobile) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      canvas.width = Math.floor(window.innerWidth * dpr);
      canvas.height = Math.floor(window.innerHeight * dpr);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener("resize", resize);

    const vsSource = `attribute vec2 p;void main(){gl_Position=vec4(p,0,1);}`;
    const fsSource = `
precision highp float;
uniform float t;
uniform vec2 r;
uniform vec3 uInk;
uniform vec3 uPaper;
uniform vec3 uAccent;
uniform float uDark;

float hash(vec2 p){
  return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);
}

float noise(vec2 p){
  vec2 i=floor(p);
  vec2 f=fract(p);
  f=f*f*(3.0-2.0*f);
  float a=hash(i);
  float b=hash(i+vec2(1.0,0.0));
  float c=hash(i+vec2(0.0,1.0));
  float d=hash(i+vec2(1.0,1.0));
  return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);
}

float fbm(vec2 p){
  float v=0.0;
  float a=0.5;
  for(int i=0;i<5;i++){
    v+=a*noise(p);
    p*=2.0;
    a*=0.5;
  }
  return v;
}

void main(){
  vec2 uv=gl_FragCoord.xy/r;
  vec2 p=uv*vec2(r.x/r.y,1.0)*2.2;
  float tt=t*0.045;
  vec2 q=vec2(fbm(p+vec2(0.0,tt)),fbm(p+vec2(5.2,-tt*1.3)));
  vec2 s=vec2(fbm(p+4.0*q+vec2(1.7,9.2)+tt*0.5),fbm(p+4.0*q+vec2(8.3,2.8)-tt*0.4));
  float ink=fbm(p+4.0*s);
  ink=smoothstep(0.25,0.9,ink);
  ink*=0.65+0.35*q.x;
  float vig=1.0-0.55*length(uv-0.5);
  ink*=vig;
  vec3 col=mix(uPaper,uInk,clamp(ink,0.0,1.0));
  float wash=smoothstep(0.34,0.78,0.5*(s.x+s.y));
  col=mix(col,uAccent,wash*(0.12+0.10*(1.0-uDark))*(1.0-ink*0.45));
  col+=(hash(gl_FragCoord.xy)-0.5)*0.015;
  gl_FragColor=vec4(col,1.0);
}
`;

    function compileShader(source: string, type: number) {
      const shader = gl!.createShader(type);
      if (!shader) return null;
      gl!.shaderSource(shader, source);
      gl!.compileShader(shader);
      if (!gl!.getShaderParameter(shader, gl!.COMPILE_STATUS)) {
        gl!.deleteShader(shader);
        return null;
      }
      return shader;
    }

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      gl.deleteProgram(program);
      return;
    }

    gl.useProgram(program);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]),
      gl.STATIC_DRAW,
    );

    const pLocation = gl.getAttribLocation(program, "p");
    gl.enableVertexAttribArray(pLocation);
    gl.vertexAttribPointer(pLocation, 2, gl.FLOAT, false, 0, 0);

    const locT = gl.getUniformLocation(program, "t");
    const locR = gl.getUniformLocation(program, "r");
    const locInk = gl.getUniformLocation(program, "uInk");
    const locPaper = gl.getUniformLocation(program, "uPaper");
    const locAccent = gl.getUniformLocation(program, "uAccent");
    const locDark = gl.getUniformLocation(program, "uDark");

    // Colors matching theme
    const isDark =
      document.documentElement.getAttribute("data-theme") === "dark";
    if (isDark) {
      gl.uniform3f(locInk, 0.1, 0.42, 0.4);
      gl.uniform3f(locPaper, 0.025, 0.035, 0.037);
      gl.uniform3f(locAccent, 0.16, 0.55, 0.49);
      gl.uniform1f(locDark, 1.0);
    } else {
      gl.uniform3f(locInk, 0.4, 0.15, 0.1);
      gl.uniform3f(locPaper, 0.965, 0.965, 0.945);
      gl.uniform3f(locAccent, 0.86, 0.25, 0.16);
      gl.uniform1f(locDark, 0.0);
    }

    canvas.classList.add("is-webgl-ready");

    const startTime = Date.now();
    let animId = 0;
    let lastTime = 0;

    const render = (time: number) => {
      if (time - lastTime >= 33) {
        const elapsed = (Date.now() - startTime) / 1000;
        gl.uniform1f(locT, elapsed);
        gl.uniform2f(locR, canvas.width, canvas.height);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
        lastTime = time;
      }
      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animId);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (buffer) gl.deleteBuffer(buffer);
    };
  }, []);

  return <canvas ref={canvasRef} id="bg-canvas" aria-hidden="true" />;
}
