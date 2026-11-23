const WEEKDAYS_JA = ['日', '月', '火', '水', '木', '金', '土'];

const SEASON_LABELS = {
  spring: '春',
  summer: '夏',
  autumn: '秋',
  winter: '冬',
};

const WEATHER_INFO = {
  clear: { icon: '☀', nightIcon: '🌙', label: '晴れ' },
  cloudy: { icon: '☁', nightIcon: '☁', label: 'くもり' },
  rain: { icon: '☔', nightIcon: '☔', label: '雨' },
  snow: { icon: '❄', nightIcon: '❄', label: '雪' },
};

const SHARED_ACTION_RULES = [
  {
    pattern: /追いかけっこ|social_?chase|chase_?(other|dog|partner)|flee_?(other|dog|partner)|play_?tag/,
    fallback: '2匹で追いかけっこ中',
  },
  {
    pattern: /取っ組み合い|じゃれ|レスリング|social_?wrestle|wrestle|play_?fight|play_?together/,
    fallback: '2匹でじゃれあい中',
  },
  {
    pattern: /ボールの取り合い|引っ張り合い|social_?ball|ball_?tug|tug_?of_?war|tug_?ball/,
    fallback: '2匹でボールの取り合い中',
  },
  {
    pattern: /あいさつ|挨拶|お互いの匂い|匂いを嗅ぎ合|social_?greet|greet_?other|sniff_?other/,
    fallback: '2匹であいさつ中',
  },
  {
    pattern: /並んで日なた|一緒に日なた|social_?sunbathe|sunbathe_?together/,
    fallback: '2匹で並んで日なたぼっこ中',
  },
  {
    pattern: /くっついて寝|寄り添って寝|一緒に.*寝|social_?sleep|cuddle_?sleep|sleep_?together/,
    fallback: '2匹でくっついてお昼寝中',
  },
  {
    pattern: /毛づくろい|顔を舐め|social_?groom|groom_?other/,
    fallback: '2匹で仲良く毛づくろい中',
  },
  {
    pattern: /一緒に.*見つめ|一緒に.*眺め|social_?watch|watch_?together/,
    fallback: '2匹で一緒に観察中',
  },
];

function pad2(n) {
  return String(n).padStart(2, '0');
}

function getSharedActionLabel(dog0, dog1) {
  const a0 = dog0?.action;
  const a1 = dog1?.action;
  if (!a0 || !a1) return null;

  if (a0.sharedLabel && a1.sharedLabel && a0.sharedLabel === a1.sharedLabel) {
    return a0.sharedLabel;
  }
  if (a0.groupLabel && a1.groupLabel && a0.groupLabel === a1.groupLabel) {
    return a0.groupLabel;
  }

  const l0 = a0.label || '';
  const l1 = a1.label || '';
  if (l0 && l0 === l1 && /^(2匹|二匹|ふたり)で/.test(l0)) {
    return l0;
  }

  const text0 = `${(a0.id || '').toLowerCase()} ${l0}`;
  const text1 = `${(a1.id || '').toLowerCase()} ${l1}`;

  for (let i = 0; i < SHARED_ACTION_RULES.length; i++) {
    const rule = SHARED_ACTION_RULES[i];
    if (rule.pattern.test(text0) && rule.pattern.test(text1)) {
      if (l0 && l0 === l1) {
        if (/^(2匹|二匹|一緒|お互い|並んで|くっついて)/.test(l0)) {
          return l0;
        }
        return `2匹で${l0}`;
      }
      return rule.fallback;
    }
  }

  return null;
}

export class UI {
  constructor({
    breeds = [],
    initialBreedId = null,
    initialBreedIds = null,
    initialCount = 1,
    onBreedChange = null,
    onCountChange = null,
    onSoundToggle = null,
  } = {}) {
    this._hudEl = document.getElementById('hud');
    this._clockEl = document.getElementById('clock-text');
    this._seasonEl = document.getElementById('season-text');
    this._weatherIconEl = document.getElementById('weather-icon');

    this._actionPanelEl = document.getElementById('action-panel');
    this._actionPrefix1El = document.getElementById('action-prefix-1');
    this._actionEl = document.getElementById('action-text');
    this._actionRow2El = document.getElementById('action-row-2');
    this._actionPrefix2El = document.getElementById('action-prefix-2');
    this._actionEl2 = document.getElementById('action-text-2');

    this._soundBtnEl = document.getElementById('sound-btn');
    this._soundIconEl = document.getElementById('sound-icon');

    this._countBtn1El = document.getElementById('count-btn-1');
    this._countBtn2El = document.getElementById('count-btn-2');
    this._breedLabel1El = document.getElementById('breed-label-1');
    this._breedPanel2El = document.getElementById('breed-panel-2');
    this._breedSelectEl = document.getElementById('breed-select');
    this._breedSelect2El = document.getElementById('breed-select-2');

    this._loadingOverlayEl = document.getElementById('loading-overlay');
    this._loadingMessageEl = document.getElementById('loading-message');

    this._lastClockText = '';
    this._lastSeason = '';
    this._lastWeatherKey = '';
    this._lastIsNight = null;

    this._lastMultiMode = null;
    this._lastPrefixes = ['', ''];
    this._lastActionLabels = ['', ''];
    this._actionFadeTimers = [null, null];

    this._dogCount = initialCount === 2 ? 2 : 1;

    const breedId0 = (Array.isArray(initialBreedIds) && initialBreedIds[0]) || initialBreedId;
    const defaultBreed2 = breeds.find((b) => b.id !== breedId0)?.id || breeds[1]?.id || breeds[0]?.id || null;
    const breedId1 = (Array.isArray(initialBreedIds) && initialBreedIds[1]) || defaultBreed2;

    this._populateSelect(this._breedSelectEl, breeds, breedId0);
    this._populateSelect(this._breedSelect2El, breeds, breedId1);

    if (this._breedSelectEl && typeof onBreedChange === 'function') {
      this._breedSelectEl.addEventListener('change', (e) => {
        onBreedChange(e.target.value, 0);
      });
    }

    if (this._breedSelect2El && typeof onBreedChange === 'function') {
      this._breedSelect2El.addEventListener('change', (e) => {
        onBreedChange(e.target.value, 1);
      });
    }

    const handleCountClick = (nextCount) => {
      if (nextCount === this._dogCount) return;
      this.setCount(nextCount);
      if (typeof onCountChange === 'function') {
        onCountChange(nextCount);
      }
    };

    if (this._countBtn1El) {
      this._countBtn1El.addEventListener('click', () => handleCountClick(1));
    }
    if (this._countBtn2El) {
      this._countBtn2El.addEventListener('click', () => handleCountClick(2));
    }

    if (this._soundBtnEl && typeof onSoundToggle === 'function') {
      this._soundBtnEl.addEventListener('click', () => {
        onSoundToggle();
      });
    }

    this.setCount(this._dogCount);
    this.setSoundEnabled(false);
  }

  _populateSelect(selectEl, breeds, initialBreedId) {
    if (!selectEl) return;
    selectEl.innerHTML = '';

    for (const breed of breeds) {
      const option = document.createElement('option');
      option.value = breed.id;
      option.textContent = breed.name;
      selectEl.appendChild(option);
    }

    if (initialBreedId && breeds.some((b) => b.id === initialBreedId)) {
      selectEl.value = initialBreedId;
    } else if (breeds.length > 0) {
      selectEl.value = breeds[0].id;
    }
  }

  setCount(count) {
    const normalized = count === 2 ? 2 : 1;
    this._dogCount = normalized;
    const isTwo = normalized === 2;

    if (this._countBtn1El) {
      this._countBtn1El.classList.toggle('is-active', !isTwo);
      this._countBtn1El.setAttribute('aria-pressed', String(!isTwo));
    }
    if (this._countBtn2El) {
      this._countBtn2El.classList.toggle('is-active', isTwo);
      this._countBtn2El.setAttribute('aria-pressed', String(isTwo));
    }
    if (this._breedLabel1El) {
      this._breedLabel1El.textContent = isTwo ? '1匹目' : '犬種';
    }
    if (this._breedPanel2El) {
      this._breedPanel2El.hidden = !isTwo;
    }
  }

  setBreed(breedId, index = 0) {
    const selectEl = index === 1 ? this._breedSelect2El : this._breedSelectEl;
    if (selectEl && breedId) {
      selectEl.value = breedId;
    }
  }

  setSoundEnabled(enabled) {
    const isOn = Boolean(enabled);
    if (this._soundIconEl) {
      this._soundIconEl.textContent = isOn ? '🔊' : '🔇';
    }
    if (this._soundBtnEl) {
      this._soundBtnEl.classList.toggle('is-active', isOn);
      this._soundBtnEl.setAttribute('aria-pressed', String(isOn));
      const label = isOn ? '音を消す' : '音を出す';
      this._soundBtnEl.setAttribute('aria-label', label);
      this._soundBtnEl.setAttribute('title', label);
    }
  }

  _setActionLine(slot, prefixEl, textEl, prefix, label, immediate = false) {
    if (prefixEl && prefix !== this._lastPrefixes[slot]) {
      prefixEl.textContent = prefix;
      this._lastPrefixes[slot] = prefix;
    }

    if (!textEl || label === this._lastActionLabels[slot]) return;

    const isInitial = this._lastActionLabels[slot] === '' || immediate;
    this._lastActionLabels[slot] = label;

    if (this._actionFadeTimers[slot] !== null) {
      clearTimeout(this._actionFadeTimers[slot]);
      this._actionFadeTimers[slot] = null;
    }

    if (isInitial) {
      textEl.textContent = label;
      textEl.classList.remove('is-updating');
    } else {
      textEl.classList.add('is-updating');
      this._actionFadeTimers[slot] = window.setTimeout(() => {
        if (textEl) {
          textEl.textContent = label;
          textEl.classList.remove('is-updating');
        }
        this._actionFadeTimers[slot] = null;
      }, 110);
    }
  }

  update(clock, garden, dogOrDogs) {
    if (clock && clock.date) {
      const d = clock.date;
      const clockStr =
        `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日` +
        `（${WEEKDAYS_JA[d.getDay()]}）${pad2(d.getHours())}:${pad2(d.getMinutes())}`;

      if (clockStr !== this._lastClockText && this._clockEl) {
        this._clockEl.textContent = clockStr;
        this._lastClockText = clockStr;
      }

      const seasonText = SEASON_LABELS[clock.season] || '春';
      if (seasonText !== this._lastSeason && this._seasonEl) {
        this._seasonEl.textContent = seasonText;
        this._lastSeason = seasonText;
      }

      const isNight = Boolean(clock.isNight);
      if (isNight !== this._lastIsNight) {
        document.body.classList.toggle('is-night', isNight);
        this._lastIsNight = isNight;
      }

      const weather = garden?.weather || 'clear';
      const weatherKey = `${weather}:${isNight ? 'n' : 'd'}`;
      if (weatherKey !== this._lastWeatherKey && this._weatherIconEl) {
        const info = WEATHER_INFO[weather] || WEATHER_INFO.clear;
        const icon = isNight ? info.nightIcon : info.icon;
        this._weatherIconEl.textContent = icon;
        this._weatherIconEl.dataset.weather =
          weather === 'clear' && isNight ? 'night-clear' : weather;
        this._weatherIconEl.setAttribute('aria-label', info.label);
        this._lastWeatherKey = weatherKey;
      }
    }

    const dogs = Array.isArray(dogOrDogs)
      ? dogOrDogs.filter(Boolean)
      : dogOrDogs
        ? [dogOrDogs]
        : [];

    if (dogs.length >= 2) {
      const sharedLabel = getSharedActionLabel(dogs[0], dogs[1]);
      if (sharedLabel) {
        const modeChanged = this._lastMultiMode !== false;
        this._lastMultiMode = false;
        if (this._actionPanelEl) this._actionPanelEl.classList.remove('is-multi');
        if (this._actionRow2El) this._actionRow2El.hidden = true;
        this._setActionLine(0, this._actionPrefix1El, this._actionEl, 'いま:', sharedLabel, modeChanged);
      } else {
        const modeChanged = this._lastMultiMode !== true;
        this._lastMultiMode = true;
        if (this._actionPanelEl) this._actionPanelEl.classList.add('is-multi');
        if (this._actionRow2El) this._actionRow2El.hidden = false;

        const name0 = dogs[0].breed?.name || '1匹目';
        const name1 = dogs[1].breed?.name || '2匹目';
        const sameBreed = name0 === name1;
        const prefix0 = sameBreed ? `${name0}①:` : `${name0}:`;
        const prefix1 = sameBreed ? `${name1}②:` : `${name1}:`;
        const label0 = dogs[0].action?.label || 'のんびりしています';
        const label1 = dogs[1].action?.label || 'のんびりしています';

        this._setActionLine(0, this._actionPrefix1El, this._actionEl, prefix0, label0, modeChanged);
        this._setActionLine(1, this._actionPrefix2El, this._actionEl2, prefix1, label1, modeChanged);
      }
    } else {
      const modeChanged = this._lastMultiMode === true;
      this._lastMultiMode = false;
      if (this._actionPanelEl) this._actionPanelEl.classList.remove('is-multi');
      if (this._actionRow2El) this._actionRow2El.hidden = true;

      const actionLabel = dogs[0]?.action?.label || 'のんびりしています';
      this._setActionLine(0, this._actionPrefix1El, this._actionEl, 'いま:', actionLabel, modeChanged);
    }
  }

  hideLoading() {
    if (this._hudEl) {
      this._hudEl.classList.add('is-visible');
    }
    if (this._loadingOverlayEl) {
      this._loadingOverlayEl.classList.add('is-hidden');
    }
  }

  showError(message) {
    if (this._loadingMessageEl) {
      this._loadingMessageEl.textContent = message;
    }
    const spinner = this._loadingOverlayEl?.querySelector('.loading-spinner');
    if (spinner) {
      spinner.style.display = 'none';
    }
  }
}
