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

function pad2(n) {
  return String(n).padStart(2, '0');
}

export class UI {
  constructor({ breeds = [], initialBreedId = null, onBreedChange = null, onSoundToggle = null } = {}) {
    this._hudEl = document.getElementById('hud');
    this._clockEl = document.getElementById('clock-text');
    this._seasonEl = document.getElementById('season-text');
    this._weatherIconEl = document.getElementById('weather-icon');
    this._actionEl = document.getElementById('action-text');
    this._soundBtnEl = document.getElementById('sound-btn');
    this._soundIconEl = document.getElementById('sound-icon');
    this._breedSelectEl = document.getElementById('breed-select');
    this._loadingOverlayEl = document.getElementById('loading-overlay');
    this._loadingMessageEl = document.getElementById('loading-message');

    this._lastClockText = '';
    this._lastSeason = '';
    this._lastWeatherKey = '';
    this._lastActionLabel = '';
    this._lastIsNight = null;
    this._actionFadeTimer = null;

    this._populateBreeds(breeds, initialBreedId);

    if (this._breedSelectEl && typeof onBreedChange === 'function') {
      this._breedSelectEl.addEventListener('change', (e) => {
        onBreedChange(e.target.value);
      });
    }

    if (this._soundBtnEl && typeof onSoundToggle === 'function') {
      this._soundBtnEl.addEventListener('click', () => {
        onSoundToggle();
      });
    }

    this.setSoundEnabled(false);
  }

  _populateBreeds(breeds, initialBreedId) {
    if (!this._breedSelectEl) return;
    this._breedSelectEl.innerHTML = '';

    for (const breed of breeds) {
      const option = document.createElement('option');
      option.value = breed.id;
      option.textContent = breed.name;
      this._breedSelectEl.appendChild(option);
    }

    if (initialBreedId && breeds.some((b) => b.id === initialBreedId)) {
      this._breedSelectEl.value = initialBreedId;
    } else if (breeds.length > 0) {
      this._breedSelectEl.value = breeds[0].id;
    }
  }

  setBreed(breedId) {
    if (this._breedSelectEl && breedId) {
      this._breedSelectEl.value = breedId;
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

  update(clock, garden, dog) {
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

    const actionLabel = dog?.action?.label || 'のんびりしています';
    if (actionLabel !== this._lastActionLabel && this._actionEl) {
      const isInitial = this._lastActionLabel === '';
      this._lastActionLabel = actionLabel;
      if (isInitial) {
        this._actionEl.textContent = actionLabel;
      } else {
        this._actionEl.classList.add('is-updating');
        if (this._actionFadeTimer !== null) {
          clearTimeout(this._actionFadeTimer);
        }
        this._actionFadeTimer = window.setTimeout(() => {
          if (this._actionEl) {
            this._actionEl.textContent = actionLabel;
            this._actionEl.classList.remove('is-updating');
          }
          this._actionFadeTimer = null;
        }, 110);
      }
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
