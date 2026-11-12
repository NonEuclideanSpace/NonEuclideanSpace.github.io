---
title: Diffusion
---
<link rel="stylesheet" href="/assets/diffusion/diffusion.css?v=1">
<div class="diffusion-demo" aria-label="Interactive diffusion model demonstration">
  <canvas id="diffusion-canvas" tabindex="0" aria-label="Point-cloud Earth. Drag or use the arrow keys to rotate. Use plus and minus to zoom." aria-describedby="diffusion-description"></canvas>
  <div class="diffusion-controls" role="group" aria-label="Diffusion controls">
    <button type="button" data-mode="forward" aria-label="Noise: play or pause forward diffusion" aria-pressed="false" disabled>Noise</button>
    <button type="button" data-mode="training" aria-label="Train: play or pause recorded training" aria-pressed="false" title="Replay the model learning through 48,000 training updates" disabled>Train</button>
    <button type="button" data-mode="reverse" aria-label="Sample: play or pause reverse diffusion" aria-pressed="false" disabled>Sample</button>
    <button type="button" data-mode="reset" aria-label="Reset the Earth and viewing angle" disabled>Reset</button>
  </div>
  <p id="diffusion-status" class="diffusion-status" role="status" aria-live="polite">Loading…</p>
  <p id="diffusion-description" class="visually-hidden">A DDPM trained on three-dimensional land points. Noise plays forward diffusion. Train replays samples from saved training checkpoints. Sample replays three recorded reverse-diffusion trajectories in rotation. Intermediate animation frames are interpolated for smooth playback. Select an active control again to pause or resume. Reset restores the original Earth with Asia facing forward.</p>
  <noscript><p>Enable JavaScript to explore the Earth.</p></noscript>
</div>
<script type="module" src="/assets/diffusion/diffusion.js?v=2"></script>
