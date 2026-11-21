const DEG2RAD = Math.PI / 180;
const LATITUDE_RAD = 35 * DEG2RAD; // 日本（北緯35度）
const NIGHT_THRESHOLD_RAD = -4 * DEG2RAD;
const SEASON_BLEND_HALF_DAYS = 10;

function smoothstep01(x) {
  const t = Math.max(0, Math.min(1, x));
  return t * t * (3 - 2 * t);
}

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function dayIndexInYear(year, monthIndex, dayOfMonth) {
  return Math.round(
    (Date.UTC(year, monthIndex, dayOfMonth) - Date.UTC(year, 0, 1)) / 86400000
  );
}

export class WorldClock {
  constructor(speed = 30) {
    this.speed = speed;
    // ?t=2026-05-01T13:00 で開始時刻を指定できる（確認用）
    let start = Date.now();
    try { const t = new URLSearchParams(location.search).get('t'); if (t && !isNaN(Date.parse(t))) start = Date.parse(t); } catch (e) {}
    this._timeMs = start;

    this.date = new Date(this._timeMs);
    this.hours = 0;
    this.dayOfYear = 0;
    this.season = 'spring';
    this.seasonWeights = { spring: 1, summer: 0, autumn: 0, winter: 0 };
    this.sunElevation = 0;
    this.sunAzimuth = Math.PI;
    this.isNight = false;

    this._recompute();
  }

  update(realDtSec) {
    const dt = Number.isFinite(realDtSec) && realDtSec > 0 ? realDtSec : 0;
    this._timeMs += dt * this.speed * 1000;
    this._recompute();
  }

  gameDtFromReal(realDt) {
    const dt = Number.isFinite(realDt) && realDt > 0 ? realDt : 0;
    return dt * this.speed;
  }

  _recompute() {
    this.date = new Date(this._timeMs);

    const year = this.date.getFullYear();
    const month = this.date.getMonth(); // 0..11
    const day = this.date.getDate(); // 1..31

    this.hours =
      this.date.getHours() +
      this.date.getMinutes() / 60 +
      this.date.getSeconds() / 3600 +
      this.date.getMilliseconds() / 3600000;

    const daysInYear = isLeapYear(year) ? 366 : 365;
    const exactDay = dayIndexInYear(year, month, day) + this.hours / 24;
    this.dayOfYear = Math.max(0, Math.min(365, exactDay));

    // 日本・北半球の季節（3-5月春, 6-8月夏, 9-11月秋, 12-2月冬）
    const monthNum = month + 1;
    if (monthNum >= 3 && monthNum <= 5) {
      this.season = 'spring';
    } else if (monthNum >= 6 && monthNum <= 8) {
      this.season = 'summer';
    } else if (monthNum >= 9 && monthNum <= 11) {
      this.season = 'autumn';
    } else {
      this.season = 'winter';
    }

    // 季節の境目（3/1, 6/1, 9/1, 12/1）の前後10日でなめらかに混ざる重み（合計1）
    const bSpring = dayIndexInYear(year, 2, 1);
    const bSummer = dayIndexInYear(year, 5, 1);
    const bAutumn = dayIndexInYear(year, 8, 1);
    const bWinter = dayIndexInYear(year, 11, 1);
    const w = SEASON_BLEND_HALF_DAYS;

    let spring = 0;
    let summer = 0;
    let autumn = 0;
    let winter = 0;

    if (exactDay < bSpring - w) {
      winter = 1;
    } else if (exactDay < bSpring + w) {
      const t = smoothstep01((exactDay - (bSpring - w)) / (2 * w));
      winter = 1 - t;
      spring = t;
    } else if (exactDay < bSummer - w) {
      spring = 1;
    } else if (exactDay < bSummer + w) {
      const t = smoothstep01((exactDay - (bSummer - w)) / (2 * w));
      spring = 1 - t;
      summer = t;
    } else if (exactDay < bAutumn - w) {
      summer = 1;
    } else if (exactDay < bAutumn + w) {
      const t = smoothstep01((exactDay - (bAutumn - w)) / (2 * w));
      summer = 1 - t;
      autumn = t;
    } else if (exactDay < bWinter - w) {
      autumn = 1;
    } else if (exactDay < bWinter + w) {
      const t = smoothstep01((exactDay - (bWinter - w)) / (2 * w));
      autumn = 1 - t;
      winter = t;
    } else {
      winter = 1;
    }

    this.seasonWeights = { spring, summer, autumn, winter };

    // 緯度35度における太陽高度・方位角（ラジアン）
    // 太陽赤緯: 春分（day ~80）で0°、夏至で+23.44°、冬至で-23.44°
    const declination =
      23.44 * DEG2RAD * Math.sin((2 * Math.PI * (exactDay - 80)) / daysInYear);

    // 時角: 太陽南中(12時)で0、午前は負、午後は正
    const hourAngle = ((this.hours - 12) / 12) * Math.PI;

    const sinLat = Math.sin(LATITUDE_RAD);
    const cosLat = Math.cos(LATITUDE_RAD);
    const sinDec = Math.sin(declination);
    const cosDec = Math.cos(declination);
    const cosH = Math.cos(hourAngle);
    const sinH = Math.sin(hourAngle);

    const sinEl = Math.max(-1, Math.min(1, sinLat * sinDec + cosLat * cosDec * cosH));
    this.sunElevation = Math.asin(sinEl);

    // 方位角: 北=0, 東=π/2, 南=π, 西=3π/2（時計回り）
    const eastComponent = -cosDec * sinH;
    const northComponent = cosLat * sinDec - sinLat * cosDec * cosH;
    let azimuth = Math.atan2(eastComponent, northComponent);
    if (azimuth < 0) {
      azimuth += Math.PI * 2;
    }
    this.sunAzimuth = azimuth;

    // 太陽高度 < -4度 で夜
    this.isNight = this.sunElevation < NIGHT_THRESHOLD_RAD;
  }
}
