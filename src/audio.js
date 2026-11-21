const MASTER_VOLUME = 0.28; // 控えめで心地よい全体音量

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function randRange(min, max) {
  return min + Math.random() * (max - min);
}

export class Soundscape {
  constructor() {
    this.ctx = null;
    this._started = false;
    this._muted = true;

    this._masterGain = null;
    this._pinkBuffer = null;
    this._whiteBuffer = null;

    // 連続環境音ノード
    this._windGain = null;
    this._windFilter = null;
    this._leafGain = null;
    this._leafFilter = null;
    this._rainHiGain = null;
    this._rainHiFilter = null;
    this._rainLoGain = null;
    this._cicadaBedGain = null;
    this._cicadaLfo = null;

    // 状態キャッシュ（犬イベント音用）
    this._cameraPos = { x: 0, y: 1.5, z: 5 };
    this._dogPos = { x: 0, y: 0, z: 0 };
    this._wetness = 0;
    this._snowCover = 0;
    this._lastStepTime = 0;
    this._windPhase = 0;

    // 単発環境音スケジューラ
    this._birdTimer = 1.8;
    this._uguisuTimer = 7.5;
    this._cicadaPhraseTimer = 4.0;
    this._insectTimer = 1.4;
    this._dripTimer = 2.2;
  }

  get isEnabled() {
    return this._started && !this._muted;
  }

  start() {
    if (!this._started) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;

      this.ctx = new AudioCtx();
      this._buildGraph();
      this._started = true;
    }

    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }

    this.setMuted(false);
  }

  setMuted(muted) {
    this._muted = Boolean(muted);
    if (!this.ctx || !this._masterGain) return;

    const now = this.ctx.currentTime;
    const target = this._muted ? 0.0001 : MASTER_VOLUME;
    this._masterGain.gain.cancelScheduledValues(now);
    this._masterGain.gain.setTargetAtTime(target, now, 0.14);
  }

  toggle() {
    if (!this._started) {
      this.start();
      return true;
    }
    this.setMuted(!this._muted);
    if (!this._muted && this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.isEnabled;
  }

  _buildGraph() {
    const ctx = this.ctx;

    // マスター出力（コンプレッサー + 柔らかい高域ロールオフで聴き疲れ防止）
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -16;
    compressor.knee.value = 18;
    compressor.ratio.value = 4;
    compressor.attack.value = 0.01;
    compressor.release.value = 0.2;

    const warmth = ctx.createBiquadFilter();
    warmth.type = 'lowpass';
    warmth.frequency.value = 9800;
    warmth.Q.value = 0.6;

    this._masterGain = ctx.createGain();
    this._masterGain.gain.value = 0.0001;

    this._masterGain.connect(warmth);
    warmth.connect(compressor);
    compressor.connect(ctx.destination);

    // 共有ノイズバッファ生成（ピンクノイズ・ホワイトノイズ）
    this._pinkBuffer = this._createNoiseBuffer(3.5, true);
    this._whiteBuffer = this._createNoiseBuffer(2.5, false);

    // 1. 風のベース（低い空気の流れ）
    const windSrc = this._createLoopingNoise(this._pinkBuffer);
    this._windFilter = ctx.createBiquadFilter();
    this._windFilter.type = 'bandpass';
    this._windFilter.frequency.value = 320;
    this._windFilter.Q.value = 1.6;
    this._windGain = ctx.createGain();
    this._windGain.gain.value = 0.0001;
    windSrc.connect(this._windFilter);
    this._windFilter.connect(this._windGain);
    this._windGain.connect(this._masterGain);

    // 2. 木の葉のざわめき（春夏秋の風）
    const leafSrc = this._createLoopingNoise(this._pinkBuffer);
    this._leafFilter = ctx.createBiquadFilter();
    this._leafFilter.type = 'bandpass';
    this._leafFilter.frequency.value = 1450;
    this._leafFilter.Q.value = 1.1;
    this._leafGain = ctx.createGain();
    this._leafGain.gain.value = 0.0001;
    leafSrc.connect(this._leafFilter);
    this._leafFilter.connect(this._leafGain);
    this._leafGain.connect(this._masterGain);

    // 3. 雨音（高域のしとしと + 低域の地面の響き）
    const rainHiSrc = this._createLoopingNoise(this._whiteBuffer);
    this._rainHiFilter = ctx.createBiquadFilter();
    this._rainHiFilter.type = 'bandpass';
    this._rainHiFilter.frequency.value = 2800;
    this._rainHiFilter.Q.value = 0.65;
    this._rainHiGain = ctx.createGain();
    this._rainHiGain.gain.value = 0.0001;
    rainHiSrc.connect(this._rainHiFilter);
    this._rainHiFilter.connect(this._rainHiGain);
    this._rainHiGain.connect(this._masterGain);

    const rainLoSrc = this._createLoopingNoise(this._pinkBuffer);
    const rainLoFilter = ctx.createBiquadFilter();
    rainLoFilter.type = 'lowpass';
    rainLoFilter.frequency.value = 620;
    this._rainLoGain = ctx.createGain();
    this._rainLoGain.gain.value = 0.0001;
    rainLoSrc.connect(rainLoFilter);
    rainLoFilter.connect(this._rainLoGain);
    this._rainLoGain.connect(this._masterGain);

    // 4. 夏のセミの遠いジージー音（AM変調バンドパスノイズ）
    const cicadaSrc = this._createLoopingNoise(this._whiteBuffer);
    const cicadaBp = ctx.createBiquadFilter();
    cicadaBp.type = 'bandpass';
    cicadaBp.frequency.value = 4650;
    cicadaBp.Q.value = 4.2;

    const cicadaAmGain = ctx.createGain();
    cicadaAmGain.gain.value = 0.55;
    this._cicadaLfo = ctx.createOscillator();
    this._cicadaLfo.type = 'sine';
    this._cicadaLfo.frequency.value = 29;
    const cicadaLfoDepth = ctx.createGain();
    cicadaLfoDepth.gain.value = 0.42;
    this._cicadaLfo.connect(cicadaLfoDepth);
    cicadaLfoDepth.connect(cicadaAmGain.gain);
    this._cicadaLfo.start();

    this._cicadaBedGain = ctx.createGain();
    this._cicadaBedGain.gain.value = 0.0001;

    cicadaSrc.connect(cicadaBp);
    cicadaBp.connect(cicadaAmGain);
    cicadaAmGain.connect(this._cicadaBedGain);
    this._cicadaBedGain.connect(this._masterGain);
  }

  _createNoiseBuffer(durationSec, isPink) {
    const sampleRate = this.ctx.sampleRate;
    const length = Math.floor(sampleRate * durationSec);
    const buffer = this.ctx.createBuffer(1, length, sampleRate);
    const data = buffer.getChannelData(0);

    if (!isPink) {
      for (let i = 0; i < length; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      return buffer;
    }

    // Paul Kellet's pink noise filter
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.095;
      b6 = white * 0.115926;
    }
    return buffer;
  }

  _createLoopingNoise(buffer) {
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0, Math.random() * buffer.duration);
    return src;
  }

  update(realDt, clock, garden, dog, cameraPos) {
    if (cameraPos) {
      this._cameraPos.x = cameraPos.x || 0;
      this._cameraPos.y = cameraPos.y || 1.5;
      this._cameraPos.z = cameraPos.z || 5;
    }
    if (dog && dog.position) {
      this._dogPos.x = dog.position.x || 0;
      this._dogPos.y = dog.position.y || 0;
      this._dogPos.z = dog.position.z || 0;
    }
    if (garden) {
      this._wetness = clamp(garden.wetness || 0, 0, 1);
      this._snowCover = clamp(garden.snowCover || 0, 0, 1);
    }

    if (!this.isEnabled || !this.ctx || this.ctx.state !== 'running') return;

    const dt = clamp(Number.isFinite(realDt) ? realDt : 0.016, 0, 0.1);
    const now = this.ctx.currentTime;

    const weights = clock?.seasonWeights || { spring: 1, summer: 0, autumn: 0, winter: 0 };
    const hours = clock?.hours ?? 12;
    const isNight = Boolean(clock?.isNight);
    const sunEl = clock?.sunElevation ?? 0.4;

    const weather = garden?.weather || 'clear';
    const intensity = clamp(garden?.weatherIntensity || 0, 0, 1);
    const wind = clamp(garden?.windStrength ?? 0.2, 0, 1);
    const rainLevel = weather === 'rain' ? intensity : 0;
    const snowDamp = 1 - this._snowCover * 0.35; // 雪の日は音を吸って静か

    // 風のうねり（時間変化で自然な息遣い）
    this._windPhase += dt * (0.25 + wind * 0.45);
    const gust = 0.72 + 0.28 * Math.sin(this._windPhase) * Math.cos(this._windPhase * 0.43);

    const windVol = (0.04 + wind * 0.26) * gust * snowDamp;
    const foliageFactor = clamp(
      weights.spring * 0.75 + weights.summer * 1.0 + weights.autumn * 0.85 + weights.winter * 0.12,
      0.1,
      1
    );
    const leafVol = Math.pow(wind, 1.3) * 0.18 * foliageFactor * gust * (1 - rainLevel * 0.5);

    this._windGain.gain.setTargetAtTime(Math.max(0.0001, windVol), now, 0.35);
    this._windFilter.frequency.setTargetAtTime(220 + wind * 420 * gust, now, 0.4);
    this._leafGain.gain.setTargetAtTime(Math.max(0.0001, leafVol), now, 0.35);
    this._leafFilter.frequency.setTargetAtTime(1100 + wind * 950, now, 0.4);

    // 雨音
    const rainHiVol = rainLevel > 0.01 ? (0.04 + rainLevel * 0.22) : 0.0001;
    const rainLoVol = rainLevel > 0.01 ? (0.05 + rainLevel * 0.26) : 0.0001;
    this._rainHiGain.gain.setTargetAtTime(rainHiVol, now, 0.4);
    this._rainHiFilter.frequency.setTargetAtTime(2100 + rainLevel * 2000, now, 0.5);
    this._rainLoGain.gain.setTargetAtTime(rainLoVol, now, 0.4);

    // セミの背景音（夏の昼、雨でないとき）
    const isDaytime = !isNight && sunEl > 0.05;
    const middayHeat = clamp(1 - Math.abs(hours - 13.5) / 5.5, 0, 1);
    const cicadaActivity =
      weights.summer * (isDaytime ? 0.35 + 0.65 * middayHeat : 0) * (1 - rainLevel * 0.9);
    const cicadaWave = 0.65 + 0.35 * Math.sin(this._windPhase * 0.55);
    const cicadaBedVol = cicadaActivity > 0.08 ? cicadaActivity * 0.085 * cicadaWave : 0.0001;
    this._cicadaBedGain.gain.setTargetAtTime(cicadaBedVol, now, 0.6);

    // 単発イベント: 鳥（春夏の朝昼・秋は控えめ・冬は静か）
    const morningBoost = hours >= 5 && hours <= 10.5 ? 1.35 : 0.85;
    const birdSeason = weights.spring * 1.0 + weights.summer * 0.85 + weights.autumn * 0.35 + weights.winter * 0.06;
    const birdActivity = isDaytime ? birdSeason * morningBoost * (1 - rainLevel * 0.85) : 0;

    if (birdActivity > 0.12) {
      this._birdTimer -= dt * birdActivity;
      if (this._birdTimer <= 0) {
        this._playSparrow();
        this._birdTimer = randRange(3.2, 8.5);
      }
    }

    // ウグイス（春の朝昼中心）
    const uguisuActivity = isDaytime
      ? (weights.spring * 1.0 + weights.summer * 0.18) * (1 - rainLevel * 0.9)
      : 0;
    if (uguisuActivity > 0.18) {
      this._uguisuTimer -= dt * uguisuActivity;
      if (this._uguisuTimer <= 0) {
        this._playUguisu();
        this._uguisuTimer = randRange(12, 26);
      }
    }

    // ミンミンゼミのひと鳴き（夏の昼）
    if (cicadaActivity > 0.25) {
      this._cicadaPhraseTimer -= dt * cicadaActivity;
      if (this._cicadaPhraseTimer <= 0) {
        this._playCicadaPhrase();
        this._cicadaPhraseTimer = randRange(8, 18);
      }
    }

    // 夏秋の夜の虫（コオロギ・鈴虫）
    const eveningOrNight = isNight || sunEl < 0.08;
    const insectSeason = weights.autumn * 1.0 + weights.summer * 0.72 + weights.spring * 0.08;
    const insectActivity = eveningOrNight ? insectSeason * (1 - rainLevel * 0.85) : 0;

    if (insectActivity > 0.12) {
      this._insectTimer -= dt * insectActivity;
      if (this._insectTimer <= 0) {
        if (Math.random() < 0.52) {
          this._playSuzumushi();
        } else {
          this._playKorogi();
        }
        this._insectTimer = randRange(1.4, 4.2);
      }
    }

    // 雨上がりや雨の日のしずく音
    if (rainLevel > 0.15 || this._wetness > 0.55) {
      this._dripTimer -= dt * (0.4 + rainLevel * 1.4);
      if (this._dripTimer <= 0) {
        this._playWaterDrip();
        this._dripTimer = randRange(1.6, 5.0);
      }
    }
  }

  _createPannedGain(panValue = 0) {
    const gain = this.ctx.createGain();
    if (typeof this.ctx.createStereoPanner === 'function') {
      const panner = this.ctx.createStereoPanner();
      panner.pan.value = clamp(panValue, -0.85, 0.85);
      gain.connect(panner);
      panner.connect(this._masterGain);
    } else {
      gain.connect(this._masterGain);
    }
    return gain;
  }

  // スズメ（チュン・チュン）
  _playSparrow() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const out = this._createPannedGain(randRange(-0.75, 0.75));
    const count = Math.random() < 0.55 ? 2 : 3;
    const baseFreq = randRange(3100, 3900);

    for (let i = 0; i < count; i++) {
      const t = now + i * randRange(0.11, 0.17);
      const dur = randRange(0.055, 0.085);
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(baseFreq * randRange(0.95, 1.05), t);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 1.28, t + dur * 0.45);
      osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.92, t + dur);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(randRange(0.045, 0.085), t + dur * 0.25);
      env.gain.exponentialRampToValueAtTime(0.0001, t + dur);

      osc.connect(env);
      env.connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.02);
    }
  }

  // ウグイス（ホー・ホケキョ）
  _playUguisu() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.04;
    const out = this._createPannedGain(randRange(-0.8, 0.8));
    const f0 = randRange(1380, 1560);

    // 「ホー」
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(f0 * 0.96, now);
    osc1.frequency.exponentialRampToValueAtTime(f0, now + 0.18);
    osc1.frequency.setValueAtTime(f0, now + 0.55);

    g1.gain.setValueAtTime(0.0001, now);
    g1.gain.linearRampToValueAtTime(0.085, now + 0.22);
    g1.gain.setValueAtTime(0.08, now + 0.46);
    g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);

    osc1.connect(g1);
    g1.connect(out);
    osc1.start(now);
    osc1.stop(now + 0.65);

    // 「ホ・ケ・キョ」
    const notes = [
      { offset: 0.74, dur: 0.075, fStart: f0 * 1.18, fEnd: f0 * 1.38 },
      { offset: 0.84, dur: 0.075, fStart: f0 * 1.56, fEnd: f0 * 1.22 },
      { offset: 0.94, dur: 0.13, fStart: f0 * 1.35, fEnd: f0 * 1.72 },
    ];

    for (const n of notes) {
      const t = now + n.offset;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.fStart, t);
      osc.frequency.exponentialRampToValueAtTime(n.fEnd, t + n.dur);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.08, t + n.dur * 0.25);
      env.gain.exponentialRampToValueAtTime(0.0001, t + n.dur);

      osc.connect(env);
      env.connect(out);
      osc.start(t);
      osc.stop(t + n.dur + 0.02);
    }
  }

  // ミンミンゼミ風のひと鳴き
  _playCicadaPhrase() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const out = this._createPannedGain(randRange(-0.8, 0.8));
    const pulses = [0.22, 0.22, 0.24, 0.55];
    let cursor = now;

    for (const dur of pulses) {
      const osc = ctx.createOscillator();
      const bp = ctx.createBiquadFilter();
      const env = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(randRange(260, 290), cursor);

      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(4150, cursor);
      bp.frequency.linearRampToValueAtTime(3850, cursor + dur);
      bp.Q.value = 6.5;

      env.gain.setValueAtTime(0.0001, cursor);
      env.gain.linearRampToValueAtTime(0.065, cursor + 0.04);
      env.gain.setValueAtTime(0.055, cursor + dur * 0.7);
      env.gain.exponentialRampToValueAtTime(0.0001, cursor + dur);

      osc.connect(bp);
      bp.connect(env);
      env.connect(out);
      osc.start(cursor);
      osc.stop(cursor + dur + 0.03);

      cursor += dur + 0.08;
    }
  }

  // 鈴虫（リーン・リーン）
  _playSuzumushi() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const dur = randRange(1.0, 1.8);
    const out = this._createPannedGain(randRange(-0.85, 0.85));

    const carrier = ctx.createOscillator();
    carrier.type = 'sine';
    carrier.frequency.value = randRange(4150, 4450);

    const am = ctx.createGain();
    am.gain.value = 0.5;
    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = randRange(34, 42);
    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.48;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.055, now + 0.25);
    env.gain.setValueAtTime(0.05, now + dur * 0.72);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    lfo.connect(lfoDepth);
    lfoDepth.connect(am.gain);
    carrier.connect(am);
    am.connect(env);
    env.connect(out);

    carrier.start(now);
    lfo.start(now);
    carrier.stop(now + dur + 0.04);
    lfo.stop(now + dur + 0.04);
  }

  // コオロギ（コロコロコロ）
  _playKorogi() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.02;
    const out = this._createPannedGain(randRange(-0.85, 0.85));
    const pulses = 3 + Math.floor(Math.random() * 3);
    const freq = randRange(3200, 3650);

    for (let i = 0; i < pulses; i++) {
      const t = now + i * 0.068;
      const osc = ctx.createOscillator();
      const env = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.94, t + 0.04);

      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.05, t + 0.01);
      env.gain.exponentialRampToValueAtTime(0.0001, t + 0.042);

      osc.connect(env);
      env.connect(out);
      osc.start(t);
      osc.stop(t + 0.05);
    }
  }

  // 雨粒・水滴のぽちゃん音
  _playWaterDrip() {
    const ctx = this.ctx;
    const now = ctx.currentTime + 0.01;
    const out = this._createPannedGain(randRange(-0.7, 0.7));
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    const f = randRange(750, 1450);

    osc.type = 'sine';
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.85, now + 0.055);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.032, now + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.065);

    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + 0.07);
  }

  /**
   * 犬の行動イベント音を再生する（距離による音量減衰・パン付き）
   * @param {'step'|'bark'|'snore'|'lap'|'dig'|'shake'|'pant'|'howl'|'whine'} name
   * @param {{x:number,y:number,z:number}} [position]
   */
  playDogEvent(name, position) {
    if (!this.isEnabled || !this.ctx || this.ctx.state !== 'running') return;

    const pos = position || this._dogPos;
    const dx = (pos.x || 0) - this._cameraPos.x;
    const dy = (pos.y || 0) - this._cameraPos.y;
    const dz = (pos.z || 0) - this._cameraPos.z;
    const dist = Math.hypot(dx, dy, dz);

    // 距離減衰: 近くでは明瞭、離れると優しく遠のく
    const att = clamp(1 / (1 + Math.pow(dist / 4.8, 1.45)), 0.04, 1.0);

    // カメラから犬への視線方向を基準とした自然な左右定位
    const fx = this._dogPos.x - this._cameraPos.x;
    const fz = this._dogPos.z - this._cameraPos.z;
    const fLen = Math.hypot(fx, fz);
    let pan = 0;
    if (fLen > 0.01) {
      const rightX = -fz / fLen;
      const rightZ = fx / fLen;
      const side = dx * rightX + dz * rightZ;
      pan = clamp(side / Math.max(2.5, dist), -0.65, 0.65);
    }

    switch (name) {
      case 'step':
        this._playDogStep(att, pan);
        break;
      case 'bark':
        this._playDogBark(att, pan);
        break;
      case 'howl':
        this._playDogHowl(att, pan);
        break;
      case 'whine':
        this._playDogWhine(att, pan);
        break;
      case 'snore':
        this._playDogSnore(att, pan);
        break;
      case 'lap':
        this._playDogLap(att, pan);
        break;
      case 'dig':
        this._playDogDig(att, pan);
        break;
      case 'shake':
        this._playDogShake(att, pan);
        break;
      case 'pant':
        this._playDogPant(att, pan);
        break;
      default:
        break;
    }
  }

  _playNoiseBurst({ duration, freq, q, filterType = 'bandpass', volume, pan, pink = true, freqEnd = null }) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const buffer = pink ? this._pinkBuffer : this._whiteBuffer;
    if (!buffer) return;

    const src = ctx.createBufferSource();
    src.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.setValueAtTime(freq, now);
    if (freqEnd !== null) {
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, freqEnd), now + duration);
    }
    filter.Q.value = q;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(Math.max(0.0002, volume), now + Math.min(0.015, duration * 0.25));
    env.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    const out = this._createPannedGain(pan);
    src.connect(filter);
    filter.connect(env);
    env.connect(out);

    const maxOffset = Math.max(0, buffer.duration - duration - 0.05);
    src.start(now, Math.random() * maxOffset, duration + 0.02);
  }

  _playDogStep(att, pan) {
    const now = this.ctx.currentTime;
    if (now - this._lastStepTime < 0.08) return;
    this._lastStepTime = now;

    if (this._snowCover > 0.35) {
      // 雪をさくっと踏む音
      this._playNoiseBurst({
        duration: 0.055,
        freq: randRange(1800, 2500),
        freqEnd: 900,
        q: 1.4,
        volume: 0.075 * att,
        pan,
        pink: false,
      });
    } else if (this._wetness > 0.45) {
      // 濡れた芝をぴちゃっと踏む音
      this._playNoiseBurst({
        duration: 0.05,
        freq: randRange(1300, 1900),
        freqEnd: 700,
        q: 1.2,
        volume: 0.07 * att,
        pan,
        pink: true,
      });
    } else {
      // 乾いた芝・土の柔らかな足音
      this._playNoiseBurst({
        duration: 0.045,
        freq: randRange(420, 680),
        freqEnd: 200,
        q: 1.0,
        volume: 0.065 * att,
        pan,
        pink: true,
      });
    }
  }

  _playDogBark(att, pan) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this._createPannedGain(pan);

    const basePitch = randRange(250, 360);
    const dur = randRange(0.14, 0.2);

    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(basePitch * 1.15, now);
    osc.frequency.exponentialRampToValueAtTime(basePitch * 0.62, now + dur);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(basePitch * 2.6, now);
    formant.frequency.exponentialRampToValueAtTime(basePitch * 1.45, now + dur);
    formant.Q.value = 2.4;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.32 * att, now + 0.018);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(formant);
    formant.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.03);

    // 息のアタック
    this._playNoiseBurst({
      duration: 0.075,
      freq: 1100,
      freqEnd: 550,
      q: 1.2,
      volume: 0.14 * att,
      pan,
      pink: true,
    });
  }

  _playDogHowl(att, pan) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this._createPannedGain(pan);
    const dur = randRange(1.5, 2.2);
    const fLow = randRange(270, 320);
    const fHigh = fLow * randRange(1.62, 1.85);

    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(fLow, now);
    osc.frequency.exponentialRampToValueAtTime(fHigh, now + dur * 0.32);
    osc.frequency.setValueAtTime(fHigh * 0.98, now + dur * 0.72);
    osc.frequency.exponentialRampToValueAtTime(fLow * 1.15, now + dur);

    // 穏やかなビブラート
    const vib = ctx.createOscillator();
    const vibGain = ctx.createGain();
    vib.frequency.value = 5.2;
    vibGain.gain.value = 9;
    vib.connect(vibGain);
    vibGain.connect(osc.frequency);

    const formant = ctx.createBiquadFilter();
    formant.type = 'bandpass';
    formant.frequency.setValueAtTime(fHigh * 1.6, now);
    formant.Q.value = 2.0;

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.26 * att, now + dur * 0.22);
    env.gain.setValueAtTime(0.22 * att, now + dur * 0.7);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(formant);
    formant.connect(env);
    env.connect(out);

    osc.start(now);
    vib.start(now);
    osc.stop(now + dur + 0.05);
    vib.stop(now + dur + 0.05);
  }

  _playDogWhine(att, pan) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this._createPannedGain(pan);
    const dur = randRange(0.35, 0.55);
    const f = randRange(660, 820);

    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(f * 0.9, now);
    osc.frequency.exponentialRampToValueAtTime(f * 1.25, now + dur * 0.45);
    osc.frequency.exponentialRampToValueAtTime(f * 0.82, now + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.11 * att, now + dur * 0.25);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + dur + 0.03);
  }

  _playDogSnore(att, pan) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = randRange(0.55, 0.85);
    if (!this._pinkBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this._pinkBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(240, now);
    bp.frequency.linearRampToValueAtTime(320, now + dur * 0.6);
    bp.Q.value = 3.2;

    const flutter = ctx.createGain();
    flutter.gain.value = 0.65;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 24;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.3;
    lfo.connect(lfoGain);
    lfoGain.connect(flutter.gain);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.13 * att, now + dur * 0.35);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const out = this._createPannedGain(pan);
    src.connect(bp);
    bp.connect(flutter);
    flutter.connect(env);
    env.connect(out);

    src.start(now, Math.random() * 1.5, dur + 0.05);
    lfo.start(now);
    lfo.stop(now + dur + 0.05);
  }

  _playDogLap(att, pan) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const out = this._createPannedGain(pan);

    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = 'sine';
    const f = randRange(460, 620);
    osc.frequency.setValueAtTime(f, now);
    osc.frequency.exponentialRampToValueAtTime(f * 2.1, now + 0.05);

    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.11 * att, now + 0.012);
    env.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

    osc.connect(env);
    env.connect(out);
    osc.start(now);
    osc.stop(now + 0.07);

    this._playNoiseBurst({
      duration: 0.04,
      freq: 2200,
      freqEnd: 1300,
      q: 1.5,
      volume: 0.07 * att,
      pan,
      pink: false,
    });
  }

  _playDogDig(att, pan) {
    // 土をかくザッという音 + 軽い低音
    this._playNoiseBurst({
      duration: 0.11,
      freq: randRange(950, 1300),
      freqEnd: 420,
      q: 1.1,
      volume: 0.16 * att,
      pan,
      pink: true,
    });
    this._playNoiseBurst({
      duration: 0.08,
      freq: 220,
      freqEnd: 110,
      q: 0.9,
      filterType: 'lowpass',
      volume: 0.14 * att,
      pan,
      pink: true,
    });
  }

  _playDogShake(att, pan) {
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const dur = 0.45;
    if (!this._pinkBuffer) return;

    const src = ctx.createBufferSource();
    src.buffer = this._pinkBuffer;

    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = this._wetness > 0.3 ? 1700 : 1050;
    bp.Q.value = 1.0;

    const am = ctx.createGain();
    am.gain.value = 0.55;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 15;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.45;
    lfo.connect(lfoGain);
    lfoGain.connect(am.gain);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, now);
    env.gain.linearRampToValueAtTime(0.22 * att, now + 0.06);
    env.gain.setValueAtTime(0.18 * att, now + dur * 0.65);
    env.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    const out = this._createPannedGain(pan);
    src.connect(bp);
    bp.connect(am);
    am.connect(env);
    env.connect(out);

    src.start(now, Math.random() * 1.5, dur + 0.05);
    lfo.start(now);
    lfo.stop(now + dur + 0.05);
  }

  _playDogPant(att, pan) {
    this._playNoiseBurst({
      duration: 0.095,
      freq: randRange(1300, 1750),
      freqEnd: 1050,
      q: 1.8,
      volume: 0.065 * att,
      pan,
      pink: true,
    });
  }
}
