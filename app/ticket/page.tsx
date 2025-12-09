<canvas id="smolDropCanvas" style="touch-action: none; width: 100vw; height: 100vh; display:block;"></canvas>
<script>
  const canvas = document.getElementById('smolDropCanvas');
  const ctx = canvas.getContext('2d');

  const COLORS = {
    bg: '#000B3B',
    accent: '#B8FB3C',
    errorOverlay: 'rgba(255, 60, 60, 0.22)',
    successOverlay: 'rgba(184, 251, 60, 0.18)',
    text: '#FFFFFF'
  };

  let width, height, dpr;
  function resize() {
    dpr = window.devicePixelRatio || 1;
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  window.addEventListener('resize', resize);
  resize();

  // State
  let state = 'idle'; // idle | holding | pending | success | error
  let holdStart = 0;
  let holdProgress = 0;
  const HOLD_DURATION = 800; // ms
  let intensity = 0;       // текущая
  let targetIntensity = 0; // целевая
  let lastTime = performance.now();

  // Для одиночного вызова API
  let redeemCalled = false;

  function onRedeem() {
    if (redeemCalled) return;
    redeemCalled = true;
    state = 'pending';

    // TODO: вот сюда втыкаешь реальный API-вызов
    // Имитация API
    setTimeout(() => {
      const ok = true; // или false для ошибки
      state = ok ? 'success' : 'error';
      targetIntensity = ok ? 0.6 : 0.2;
    }, 400);
  }

  // Pointer events
  let pointerDown = false;

  function startHold(ev) {
    if (state === 'success' || state === 'pending') return;
    pointerDown = true;
    state = 'holding';
    holdStart = performance.now();
    holdProgress = 0;
    targetIntensity = 1;
    redeemCalled = false;
  }

  function endHold(ev) {
    pointerDown = false;
    if (state === 'holding') {
      // не дожали
      state = 'idle';
      targetIntensity = 0;
    }
  }

  canvas.addEventListener('pointerdown', startHold);
  canvas.addEventListener('pointerup', endHold);
  canvas.addEventListener('pointercancel', endHold);
  canvas.addEventListener('pointerleave', endHold);

  // Core loop
  function loop(now) {
    const dt = now - lastTime;
    lastTime = now;
    const t = now / 1000;

    // Обновляем holdProgress
    if (state === 'holding') {
      const elapsed = now - holdStart;
      holdProgress = Math.min(1, elapsed / HOLD_DURATION);
      if (holdProgress === 1 && !redeemCalled) {
        onRedeem();
      }
    } else {
      // плавное схлопывание прогресса
      holdProgress += (0 - holdProgress) * 0.15;
    }

    // Плавное приближение intensity к целевой
    intensity += (targetIntensity - intensity) * 0.08;

    // Рисуем
    drawScene(t);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  function drawScene(t) {
    // background
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, width, height);

    const cx = width / 2;
    const cy = height / 2;
    const baseRadius = Math.min(width, height) * 0.25;

    // Параметры от intensity
    const speedBase = 0.4 + intensity * 1.0;
    const thicknessBase = 2 + intensity * 3;
    const radiusPulseAmp = baseRadius * (0.02 + 0.03 * intensity);

    // Орбитальные дуги
    const orbits = 4;
    for (let i = 0; i < orbits; i++) {
      const orbitRatio = 0.75 + i * 0.18; // радиусы
      const r = baseRadius * orbitRatio
        + radiusPulseAmp * Math.sin(t * (0.4 + 0.1 * i) + i);

      const angleSpan = Math.PI * (1.4 + 0.1 * i); // длина дуги
      const baseAngle = t * speedBase * (1 + i * 0.2);
      const phaseOffset = i * 0.7;
      const startAngle = baseAngle + phaseOffset;
      const endAngle = startAngle + angleSpan;

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, endAngle);
      ctx.lineWidth = thicknessBase * (0.9 + i * 0.08);
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.4 + 0.1 * i + 0.3 * intensity;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Радиальные лучи (сканеры)
    const rays = 6;
    const rayLength = baseRadius * 1.4;
    for (let i = 0; i < rays; i++) {
      const rayPhase = i * (Math.PI * 2 / rays);
      const rayAngle = t * (0.3 + 0.5 * intensity) + rayPhase;

      const innerR = baseRadius * 0.3;
      const outerR = innerR + rayLength * (0.8 + 0.2 * intensity);

      const x1 = cx + Math.cos(rayAngle) * innerR;
      const y1 = cy + Math.sin(rayAngle) * innerR;
      const x2 = cx + Math.cos(rayAngle) * outerR;
      const y2 = cy + Math.sin(rayAngle) * outerR;

      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(x2, y2);
      ctx.lineWidth = 1 + 2 * intensity;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.25 + 0.35 * intensity;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Центральный круг + прогресс удержания
    const coreR = baseRadius * 0.35;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, coreR, 0, Math.PI * 2);
    ctx.lineWidth = 1 + 2 * intensity;
    ctx.strokeStyle = COLORS.accent;
    ctx.globalAlpha = 0.4 + 0.3 * intensity;
    ctx.stroke();
    ctx.restore();

    // Прогресс удержания по окружности
    if (holdProgress > 0.01) {
      const progAngle = holdProgress * Math.PI * 2;
      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, coreR * 0.85, -Math.PI / 2, -Math.PI / 2 + progAngle);
      ctx.lineWidth = 3 + 2 * intensity;
      ctx.strokeStyle = COLORS.accent;
      ctx.globalAlpha = 0.8;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.restore();
    }

    // Glow центра
    if (intensity > 0.05) {
      const glowR = coreR * (1.1 + 0.3 * intensity);
      const grad = ctx.createRadialGradient(
        cx, cy, 0, cx, cy, glowR
      );
      grad.addColorStop(0, 'rgba(184,251,60,0.35)');
      grad.addColorStop(1, 'rgba(184,251,60,0)');
      ctx.save();
      ctx.fillStyle = grad;
      ctx.fillRect(cx - glowR, cy - glowR, glowR * 2, glowR * 2);
      ctx.restore();
    }

    // Overlays для state
    if (state === 'success') {
      ctx.save();
      ctx.fillStyle = COLORS.successOverlay;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      drawLabel('Билет погашён', cx, cy);
    } else if (state === 'error') {
      ctx.save();
      ctx.fillStyle = COLORS.errorOverlay;
      ctx.fillRect(0, 0, width, height);
      ctx.restore();

      drawLabel('Ошибка', cx, cy);
    } else if (state === 'pending') {
      drawLabel('Проверка…', cx, cy);
    }
  }

  function drawLabel(text, cx, cy) {
    ctx.save();
    ctx.font = '500 16px system-ui, -apple-system, BlinkMacSystemFont, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = COLORS.text;
    ctx.globalAlpha = 0.9;
    ctx.fillText(text, cx, cy);
    ctx.restore();
  }
</script>
