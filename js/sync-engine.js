/**
 * =====================================================
 * SyncEngine — محرك المزامنة الذكي
 * Quran Audio-Text Synchronization Engine
 * =====================================================
 * 
 * 3-Tier approach:
 *   Tier 1: Real timestamps from Quran.com API v4
 *   Tier 3: Enhanced weighted text estimation
 * 
 * Features:
 *   - Arabic character weight model for tajweed-aware timing
 *   - Exponential drift correction
 *   - User calibration (tap-to-sync + offset slider)
 *   - localStorage caching for offline/PWA usage
 *   - Reciter mapping table (mp3quran.net → Quran.com IDs)
 */

class SyncEngine {

    // ─── Reciter mapping: mp3quran.net server URL fragments → Quran.com recitation IDs
    // Quran.com recitation ID 7 = Mishari Al Afasy (Murattal)
    static RECITER_MAP = {
        'mishari_al_afasy':   7,
        'afasy':              7,
        'العفاسي':             7,
        'minshawi_murattal':  8,
        'المنشاوي':           8,
        'husary':             5,
        'الحصري':             5,
        'abdulbasit_murattal': 1,
        'عبدالباسط':          1,
        'abdul_baset':        1,
        'sudais':             10,
        'السديس':             10,
        'shuraym':            10,
        'الشريم':             10,
        'maher':              6,
        'ماهر المعيقلي':       6,
        'muaiqly':            6,
        'ghamdi':             9,
        'الغامدي':            9,
        'ajamy':              11,
        'العجمي':             11,
        'banna':              12,
        'البنا':              12,
        'tablawi':            13,
        'الطبلاوي':           13,
        'dosari':             14,
        'الدوسري':            14,
        'juhany':             15,
        'الجهني':             15,
        'shatri':             16,
        'الشاطري':            16,
    };

    // ─── Arabic Character Weight Model ───
    // Tajweed-aware weights for more accurate time estimation
    static CHAR_WEIGHTS = {
        // Long vowels — take more time to recite
        'آ': 1.8, 'ا': 1.0, 'و': 1.2, 'ي': 1.2, 'ى': 1.2,
        // Emphasized letters (tafkhim)
        'ص': 1.3, 'ض': 1.3, 'ط': 1.3, 'ظ': 1.3, 'ق': 1.2, 'غ': 1.2, 'خ': 1.2,
        // Regular letters
        'ب': 1.0, 'ت': 1.0, 'ث': 1.0, 'ج': 1.0, 'ح': 1.1, 'د': 1.0,
        'ذ': 1.0, 'ر': 1.0, 'ز': 1.0, 'س': 1.1, 'ش': 1.1, 'ع': 1.1,
        'ف': 1.0, 'ك': 1.0, 'ل': 1.0, 'م': 1.0, 'ن': 1.0, 'ه': 1.0,
        'ء': 0.8, 'ئ': 0.9, 'ؤ': 0.9, 'إ': 1.0, 'أ': 1.0,
        // Diacritics — modify timing
        'ّ': 0.6,   // Shadda — letter is doubled, adds time
        'ً': 0.3,   // Tanwin fatha
        'ٌ': 0.3,   // Tanwin damma
        'ٍ': 0.3,   // Tanwin kasra
        'َ': 0.15,  // Fatha
        'ُ': 0.15,  // Damma
        'ِ': 0.15,  // Kasra
        'ْ': 0.05,  // Sukun — very brief
        'ٰ': 0.4,   // Superscript alef
        'ۖ': 0.8,   // Waqf sign — brief pause
        'ۗ': 0.8,   // Waqf sign
        'ۘ': 0.8,
        'ۙ': 0.8,
        'ۚ': 0.8,
        'ۛ': 0.8,
        'ۜ': 0.8,
    };

    // Time added between ayahs (seconds) to account for reciter pauses
    static INTER_AYAH_PAUSE = 1.2;
    // Estimated basmala duration (seconds)
    static BASMALA_DURATION = 4.5;
    // Surahs that DON'T start with basmala
    static NO_BASMALA_SURAHS = [1, 9]; // Al-Fatiha (it IS the basmala), At-Tawbah

    constructor() {
        /** @type {'tier1'|'tier3'|'none'} */
        this.activeTier = 'none';

        /** Tier 1 data: array of { verseKey, startMs, endMs } for surah-level sync */
        this.tier1Timings = null;

        /** Tier 3 data: computed weights per ayah */
        this.tier3Weights = null;
        this.tier3TotalWeight = 0;
        this.tier3CumulativeWeights = [];

        /** User correction state */
        this.userOffsetSeconds = 0;
        this.calibrationAnchor = null; // { ayahIndex, audioTime }
        this.driftCorrection = 0;
        this.driftAlpha = 0.08; // EMA smoothing factor

        /** Current state */
        this.currentSurahNumber = null;
        this.currentReciterServer = '';
        this.ayahCount = 0;
        this.audioDuration = 0;

        /** Previous active index for change detection */
        this._prevActiveIndex = -1;

        /** Cached timing data key prefix */
        this._cachePrefix = 'sync_cache_';
    }

    // ═══════════════════════════════════════════════
    //  PUBLIC API
    // ═══════════════════════════════════════════════

    /**
     * Initialize sync for a new surah.
     * @param {number} surahNumber  1-based surah number
     * @param {string} reciterServer  The mp3quran.net server URL
     * @param {Array<{text: string, length: number}>} ayahsData  Array of ayah objects
     * @param {number} audioDuration  Total audio duration in seconds
     */
    async init(surahNumber, reciterServer, ayahsData, audioDuration) {
        this.currentSurahNumber = surahNumber;
        this.currentReciterServer = reciterServer;
        this.ayahCount = ayahsData.length;
        this.audioDuration = audioDuration;
        this.activeTier = 'none';
        this.tier1Timings = null;
        this.tier3Weights = null;
        this._prevActiveIndex = -1;
        this.driftCorrection = 0;

        // Load persisted user offset for this surah+reciter combo
        this._loadPersistedOffset(surahNumber, reciterServer);

        // Try Tier 1 first
        const reciterId = this._resolveReciterId(reciterServer);
        if (reciterId) {
            const timings = await this._fetchTier1Timings(surahNumber, reciterId);
            if (timings && timings.length > 0) {
                this.tier1Timings = timings;
                this.activeTier = 'tier1';
                return;
            }
        }

        // Fall through to Tier 3
        this._computeTier3Weights(ayahsData, surahNumber);
        this.activeTier = 'tier3';
    }

    /**
     * Get the currently active ayah index based on audio currentTime.
     * @param {number} currentTime  audioEl.currentTime in seconds
     * @returns {{ index: number, progress: number, changed: boolean }}
     *   - index: 0-based ayah index
     *   - progress: 0–1 progress within current ayah
     *   - changed: whether the active ayah changed since last call
     */
    getActiveAyah(currentTime) {
        const adjustedTime = currentTime + this.userOffsetSeconds + this.driftCorrection;
        const clampedTime = Math.max(0, Math.min(adjustedTime, this.audioDuration));

        let index = 0;
        let progress = 0;

        if (this.activeTier === 'tier1' && this.tier1Timings) {
            ({ index, progress } = this._tier1Lookup(clampedTime));
        } else if (this.activeTier === 'tier3') {
            ({ index, progress } = this._tier3Lookup(clampedTime));
        }

        const changed = index !== this._prevActiveIndex;
        this._prevActiveIndex = index;

        return { index, progress, changed };
    }

    /**
     * User taps a verse to calibrate sync ("this verse is playing right now").
     * @param {number} ayahIndex  0-based index of the tapped ayah
     * @param {number} currentTime  audioEl.currentTime
     */
    calibrate(ayahIndex, currentTime) {
        this.calibrationAnchor = { ayahIndex, audioTime: currentTime };

        // Compute what time the engine thinks this ayah should start
        let predictedStart = 0;
        if (this.activeTier === 'tier1' && this.tier1Timings && this.tier1Timings[ayahIndex]) {
            predictedStart = this.tier1Timings[ayahIndex].startMs / 1000;
        } else if (this.activeTier === 'tier3') {
            predictedStart = (this.tier3CumulativeWeights[ayahIndex] / this.tier3TotalWeight) * this.audioDuration;
        }

        const error = predictedStart - currentTime - this.userOffsetSeconds;

        // Apply exponential moving average for smooth correction
        this.driftCorrection = this.driftCorrection + this.driftAlpha * (error - this.driftCorrection);

        // Persist correction
        this._persistOffset(this.currentSurahNumber, this.currentReciterServer);
    }

    /**
     * Set manual user offset (from slider).
     * @param {number} offsetSeconds  Positive = audio is ahead, negative = audio is behind
     */
    setUserOffset(offsetSeconds) {
        this.userOffsetSeconds = offsetSeconds;
        this._persistOffset(this.currentSurahNumber, this.currentReciterServer);
    }

    /**
     * Get current user offset.
     */
    getUserOffset() {
        return this.userOffsetSeconds;
    }

    /**
     * Get the active sync tier label for UI display.
     * @returns {{ tier: string, labelAr: string, labelEn: string, icon: string }}
     */
    getTierInfo() {
        switch (this.activeTier) {
            case 'tier1':
                return {
                    tier: 'tier1',
                    labelAr: 'مزامنة دقيقة',
                    labelEn: 'Precise Sync',
                    icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px;"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>'
                };
            case 'tier3':
                return {
                    tier: 'tier3',
                    labelAr: 'مزامنة تقريبية',
                    labelEn: 'Estimated Sync',
                    icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px;"><path d="M21 2v6h-6"></path><path d="M3 12a9 9 0 0 1 15-6.7L21 8"></path><path d="M3 22v-6h6"></path><path d="M21 12a9 9 0 0 1-15 6.7L3 16"></path></svg>'
                };
            default:
                return {
                    tier: 'none',
                    labelAr: 'بدون مزامنة',
                    labelEn: 'No Sync',
                    icon: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block; vertical-align:middle; margin-left:4px;"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>'
                };
        }
    }

    /**
     * Reset calibration and drift corrections.
     */
    resetCalibration() {
        this.driftCorrection = 0;
        this.userOffsetSeconds = 0;
        this.calibrationAnchor = null;
        this._persistOffset(this.currentSurahNumber, this.currentReciterServer);
    }

    // ═══════════════════════════════════════════════
    //  TIER 1: Quran.com API Timestamps
    // ═══════════════════════════════════════════════

    /**
     * Resolve mp3quran.net server URL to Quran.com recitation ID
     */
    _resolveReciterId(serverUrl) {
        if (!serverUrl) return null;
        const urlLower = serverUrl.toLowerCase();

        for (const [key, id] of Object.entries(SyncEngine.RECITER_MAP)) {
            if (urlLower.includes(key)) return id;
        }
        return null;
    }

    /**
     * Fetch timing data from Quran.com API v4 or cache.
     */
    async _fetchTier1Timings(surahNumber, reciterId) {
        const cacheKey = `${this._cachePrefix}t1_${reciterId}_${surahNumber}`;

        // Check cache first
        try {
            const cached = localStorage.getItem(cacheKey);
            if (cached) {
                const data = JSON.parse(cached);
                if (data && data.timings && data.timings.length > 0) {
                    return data.timings;
                }
            }
        } catch (e) { /* cache miss */ }

        // Fetch from API
        try {
            const url = `https://api.quran.com/api/v4/recitations/${reciterId}/by_chapter/${surahNumber}?fields=segments`;
            const res = await fetch(url);
            if (!res.ok) return null;

            const data = await res.json();
            if (!data.audio_files || data.audio_files.length === 0) return null;

            // The API returns per-ayah audio files with word-level segments.
            // Each file: { verse_key, segments: [[word_start, word_end, start_ms, end_ms], ...] }
            // We compute cumulative timing by summing individual ayah durations.
            const timings = this._computeCumulativeTimings(data.audio_files);

            // Cache for offline use
            try {
                localStorage.setItem(cacheKey, JSON.stringify({
                    timings,
                    timestamp: Date.now()
                }));
            } catch (e) { /* localStorage full — that's ok */ }

            return timings;

        } catch (e) {
            console.warn('SyncEngine: Tier 1 fetch failed', e);
            return null;
        }
    }

    /**
     * Compute cumulative start/end times from per-ayah segment data.
     * The API gives timings relative to individual ayah files.
     * We need to estimate their positions within a full surah audio file.
     * 
     * Strategy: Sum individual ayah durations (from their segment data)
     * and scale proportionally to the actual surah audio duration.
     */
    _computeCumulativeTimings(audioFiles) {
        if (!audioFiles || audioFiles.length === 0) return null;

        // Extract the raw duration of each ayah (from its segments)
        const ayahDurations = audioFiles.map(af => {
            if (!af.segments || af.segments.length === 0) return 2000; // Fallback 2s
            // Last segment's end time gives the ayah duration
            const lastSeg = af.segments[af.segments.length - 1];
            return lastSeg[3] || 2000; // end_ms
        });

        const rawTotal = ayahDurations.reduce((a, b) => a + b, 0);
        if (rawTotal === 0) return null;

        // Scale to actual audio duration (in ms)
        const actualDurationMs = this.audioDuration * 1000;
        const scale = actualDurationMs / rawTotal;

        const timings = [];
        let cumulative = 0;

        for (let i = 0; i < audioFiles.length; i++) {
            const scaledDuration = ayahDurations[i] * scale;
            timings.push({
                verseKey: audioFiles[i].verse_key,
                startMs: cumulative,
                endMs: cumulative + scaledDuration,
                rawDurationMs: ayahDurations[i]
            });
            cumulative += scaledDuration;
        }

        return timings;
    }

    /**
     * Tier 1 lookup: binary search for current ayah by time.
     */
    _tier1Lookup(timeSeconds) {
        const timeMs = timeSeconds * 1000;
        let index = 0;
        let progress = 0;

        for (let i = 0; i < this.tier1Timings.length; i++) {
            if (timeMs >= this.tier1Timings[i].startMs) {
                index = i;
            } else {
                break;
            }
        }

        const t = this.tier1Timings[index];
        if (t) {
            const duration = t.endMs - t.startMs;
            progress = duration > 0 ? Math.min(1, (timeMs - t.startMs) / duration) : 0;
        }

        return { index, progress };
    }

    // ═══════════════════════════════════════════════
    //  TIER 3: Enhanced Weighted Text Estimation
    // ═══════════════════════════════════════════════

    /**
     * Compute weighted durations for each ayah.
     */
    _computeTier3Weights(ayahsData, surahNumber) {
        const weights = [];
        let totalWeight = 0;

        for (let i = 0; i < ayahsData.length; i++) {
            const text = ayahsData[i].text || '';
            let w = this._computeTextWeight(text);

            // Add inter-ayah pause weight (except for first ayah if it has basmala)
            if (i > 0) {
                w += SyncEngine.INTER_AYAH_PAUSE * 10; // Convert to weight units
            }

            weights.push(w);
            totalWeight += w;
        }

        // Add basmala overhead to first ayah if applicable
        if (!SyncEngine.NO_BASMALA_SURAHS.includes(surahNumber) && weights.length > 0) {
            const basmalaWeight = SyncEngine.BASMALA_DURATION * 10;
            weights[0] += basmalaWeight;
            totalWeight += basmalaWeight;
        }

        this.tier3Weights = weights;
        this.tier3TotalWeight = totalWeight;

        // Pre-compute cumulative weights for fast lookup
        this.tier3CumulativeWeights = [];
        let running = 0;
        for (let i = 0; i < weights.length; i++) {
            this.tier3CumulativeWeights.push(running);
            running += weights[i];
        }
    }

    /**
     * Compute weight for a single ayah text using character weights.
     */
    _computeTextWeight(text) {
        let weight = 0;
        for (const ch of text) {
            weight += SyncEngine.CHAR_WEIGHTS[ch] || 0.5; // Default weight for unknown chars
        }
        // Minimum weight to avoid zero-duration ayahs
        return Math.max(weight, 2.0);
    }

    /**
     * Tier 3 lookup: find ayah by weighted time position.
     */
    _tier3Lookup(timeSeconds) {
        if (!this.tier3Weights || this.tier3TotalWeight === 0) {
            return { index: 0, progress: 0 };
        }

        const targetWeight = (timeSeconds / this.audioDuration) * this.tier3TotalWeight;
        let index = 0;
        let progress = 0;

        for (let i = 0; i < this.tier3CumulativeWeights.length; i++) {
            const start = this.tier3CumulativeWeights[i];
            const end = start + this.tier3Weights[i];

            if (targetWeight >= start && targetWeight < end) {
                index = i;
                progress = (targetWeight - start) / this.tier3Weights[i];
                break;
            }
            if (i === this.tier3CumulativeWeights.length - 1) {
                index = i;
                progress = 1;
            }
        }

        return { index, progress };
    }

    // ═══════════════════════════════════════════════
    //  PERSISTENCE: Save/Load corrections
    // ═══════════════════════════════════════════════

    _getOffsetKey(surahNumber, reciterServer) {
        // Create a short hash from the reciter server URL
        const hash = reciterServer ? reciterServer.replace(/[^a-zA-Z0-9]/g, '').slice(-20) : 'default';
        return `${this._cachePrefix}offset_${hash}_${surahNumber}`;
    }

    _persistOffset(surahNumber, reciterServer) {
        if (!surahNumber) return;
        try {
            const key = this._getOffsetKey(surahNumber, reciterServer);
            localStorage.setItem(key, JSON.stringify({
                userOffset: this.userOffsetSeconds,
                driftCorrection: this.driftCorrection,
                timestamp: Date.now()
            }));
        } catch (e) { /* localStorage full */ }
    }

    _loadPersistedOffset(surahNumber, reciterServer) {
        try {
            const key = this._getOffsetKey(surahNumber, reciterServer);
            const data = localStorage.getItem(key);
            if (data) {
                const parsed = JSON.parse(data);
                this.userOffsetSeconds = parsed.userOffset || 0;
                this.driftCorrection = parsed.driftCorrection || 0;
            } else {
                this.userOffsetSeconds = 0;
                this.driftCorrection = 0;
            }
        } catch (e) {
            this.userOffsetSeconds = 0;
            this.driftCorrection = 0;
        }
    }
}

// Export for use in app.js (loaded as regular script)
window.SyncEngine = SyncEngine;
