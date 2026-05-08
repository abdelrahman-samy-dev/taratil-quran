/**
 * تطبيق تراتيل الإسلامي الشامل
 * Advanced Features & Layout Override
 */

document.addEventListener('DOMContentLoaded', () => {

    // ==========================================
    // 0. Utility Functions
    // ==========================================

    /**
     * Arabic text normalization for fuzzy search.
     * Normalizes hamza variants, taa marbuta, alef maqsura,
     * and strips diacritical marks (tashkeel).
     */
    function normalizeArabic(text) {
        if (!text) return '';
        return text
            .replace(/[إأآٱ]/g, 'ا')    // Hamza variants → Alef
            .replace(/ة/g, 'ه')           // Taa Marbuta → Ha
            .replace(/ى/g, 'ي')           // Alef Maqsura → Ya
            .replace(/ؤ/g, 'و')           // Hamza on Waw → Waw
            .replace(/ئ/g, 'ي')           // Hamza on Ya → Ya
            .replace(/[ًٌٍَُِّْٰٓٔ]/g, '')  // Strip tashkeel/diacritics
            .replace(/\s+/g, ' ')          // Collapse whitespace
            .trim()
            .toLowerCase();
    }

    /** Debounce utility */
    function debounce(fn, delay = 300) {
        let timer;
        return function (...args) {
            clearTimeout(timer);
            timer = setTimeout(() => fn.apply(this, args), delay);
        };
    }

    // ==========================================
    // 1. Storage & Preferences Engine
    // ==========================================
    const htmlObj = document.documentElement;
    const bodyObj = document.body;

    // Load Prefs
    const prefs = {
        theme: localStorage.getItem('prefs_theme') || 'light',
        shape: localStorage.getItem('prefs_shape') || 'shape-rounded',
        fontScale: parseFloat(localStorage.getItem('prefs_fontScale')) || 1,
        autoplay: localStorage.getItem('prefs_autoplay') !== 'false',
        haptics: localStorage.getItem('prefs_haptics') !== 'false',
        notifications: localStorage.getItem('prefs_notif') === 'true'
    };

    function applyPreferences() {
        htmlObj.setAttribute('data-theme', prefs.theme);
        bodyObj.className = prefs.shape;
        htmlObj.style.setProperty('--font-scale', prefs.fontScale);

        // Sync UI toggles
        document.querySelector(`.picker-btn[data-theme="${prefs.theme}"]`)?.classList.add('active');
        document.querySelector(`.picker-btn[data-shape="${prefs.shape}"]`)?.classList.add('active');
        document.getElementById('fontSizeSlider').value = prefs.fontScale;
        document.getElementById('autoplayToggle').checked = prefs.autoplay;
        document.getElementById('hapticsToggle').checked = prefs.haptics;
        document.getElementById('notificationToggle').checked = prefs.notifications;
    }
    applyPreferences();

    // Event Listeners for settings
    document.getElementById('themePicker').addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelectorAll('#themePicker .picker-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        prefs.theme = e.target.dataset.theme;
        htmlObj.setAttribute('data-theme', prefs.theme);
        localStorage.setItem('prefs_theme', prefs.theme);
    });

    document.getElementById('shapePicker').addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        document.querySelectorAll('#shapePicker .picker-btn').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        prefs.shape = e.target.dataset.shape;
        bodyObj.className = prefs.shape;
        localStorage.setItem('prefs_shape', prefs.shape);
    });

    document.getElementById('fontSizeSlider').addEventListener('input', (e) => {
        prefs.fontScale = e.target.value;
        htmlObj.style.setProperty('--font-scale', prefs.fontScale);
        localStorage.setItem('prefs_fontScale', prefs.fontScale);
    });

    // Checkboxes
    ['autoplay', 'haptics', 'notifications'].forEach(key => {
        const id = key === 'autoplay' ? 'autoplayToggle' : key === 'haptics' ? 'hapticsToggle' : 'notificationToggle';
        document.getElementById(id).addEventListener('change', (e) => {
            prefs[key] = e.target.checked;
            localStorage.setItem('prefs_' + key, prefs[key] ? 'true' : 'false');
            if (key === 'notifications' && prefs[key]) {
                if (Notification.permission !== 'granted') Notification.requestPermission();
            }
        });
    });


    // ==========================================
    // 2. Navigation (Dual Sync Desktop/Mobile)
    // ==========================================
    const allNavBtns = document.querySelectorAll('.nav-btn');
    const views = document.querySelectorAll('.view-section');

    function switchView(targetId) {
        // Sync all buttons containing this target
        allNavBtns.forEach(btn => {
            if (btn.dataset.target === targetId) btn.classList.add('active');
            else btn.classList.remove('active');
        });

        views.forEach(view => {
            if (view.id === targetId) {
                view.style.display = 'block';
                // trigger re-animation by removing and adding active
                view.classList.remove('active');
                void view.offsetWidth;
                view.classList.add('active');

                // Lazy load features
                if (targetId === 'view-prayer' && !window.prayerLoaded) { loadPrayerTimes(); window.prayerLoaded = true; }
                if (targetId === 'view-hadith' && !window.hadithLoaded) { loadHadith(); window.hadithLoaded = true; }
                if (targetId === 'view-radio' && !window.radioLoaded) { loadRadio(); window.radioLoaded = true; }

            } else {
                view.style.display = 'none';
                view.classList.remove('active');
            }
        });

        // Save current view
        localStorage.setItem('active_view', targetId);

        // if leaving radio mode
        if (targetId !== 'view-radio' && window.isRadioMode) {
            leaveRadioMode();
        }

        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    allNavBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            if (btn.dataset.target) {
                switchView(btn.dataset.target);
                // Close the more drawer if it's open
                closeMoreDrawer();
            }
        });
    });

    // ==========================================
    // 2b. Mobile "More" Drawer
    // ==========================================
    const moreBtn = document.getElementById('btnMoreMenu');
    const moreDrawer = document.getElementById('moreDrawer');
    const moreOverlay = document.getElementById('moreDrawerOverlay');

    function openMoreDrawer() {
        if (!moreDrawer || !moreOverlay) return;
        moreDrawer.classList.add('active');
        moreOverlay.classList.add('active');
    }

    function closeMoreDrawer() {
        if (!moreDrawer || !moreOverlay) return;
        moreDrawer.classList.remove('active');
        moreOverlay.classList.remove('active');
    }

    if (moreBtn) {
        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (moreDrawer.classList.contains('active')) {
                closeMoreDrawer();
            } else {
                openMoreDrawer();
            }
        });
    }

    if (moreOverlay) {
        moreOverlay.addEventListener('click', closeMoreDrawer);
    }

    // Mobile settings shortcut button
    const btnMobileSettings = document.getElementById('btnMobileSettings');
    if (btnMobileSettings) {
        btnMobileSettings.addEventListener('click', () => {
            switchView('view-settings');
        });
    }


    // ==========================================
    // 3. Audio Player (Loop, Speed, Timer)
    // ==========================================
    const audioEl = document.getElementById('audioElement');
    const playPauseBtn = document.getElementById('btnPlayPause');
    const playIcon = playPauseBtn.querySelector('.play-icon');
    const pauseIcons = playPauseBtn.querySelectorAll('.pause-icon');
    const progressBar = document.getElementById('audioProgress');
    const progressFill = document.getElementById('progressFill');
    const timeCurrent = document.getElementById('timeCurrent');
    const timeTotal = document.getElementById('timeTotal');
    const nowPlayingTitle = document.getElementById('nowPlayingTitle');
    const nowPlayingReciter = document.getElementById('nowPlayingReciter');
    const reciterSelect = document.getElementById('reciterSelect');
    const surahsGrid = document.getElementById('surahsGrid');

    // Advanced controls
    const btnSpeed = document.getElementById('btnSpeed');
    const btnLoop = document.getElementById('btnLoop');
    const btnSleepTimer = document.getElementById('btnSleepTimer');
    const sleepModal = document.getElementById('sleepModal');

    // Full Player DOM references
    const fullPlayerOverlay = document.getElementById('fullPlayerOverlay');
    const fpCloseBtn = document.getElementById('fpCloseBtn');
    const fpSurahName = document.getElementById('fpSurahName');
    const fpRevelationType = document.getElementById('fpRevelationType');
    const fpAyahsCount = document.getElementById('fpAyahsCount');
    const fpReciterName = document.getElementById('fpReciterName');
    const fpTimeCurrent = document.getElementById('fpTimeCurrent');
    const fpTimeTotal = document.getElementById('fpTimeTotal');
    const fpProgressBar = document.getElementById('fpProgressBar');
    const fpBtnPlayPause = document.getElementById('fpBtnPlayPause');
    const fpBtnNext = document.getElementById('fpBtnNext');
    const fpBtnPrev = document.getElementById('fpBtnPrev');
    const fpBtnSpeed = document.getElementById('fpBtnSpeed');
    const fpBtnLoop = document.getElementById('fpBtnLoop');
    const fpDownloadBtn = document.getElementById('fpDownloadBtn');
    const fpPlayIcon = document.getElementById('fpPlayIcon');
    const fpPauseIcon = document.getElementById('fpPauseIcon');
    const fpCCContainer = document.getElementById('fpCCContainer');

    const fpSyncBadge = document.getElementById('fpSyncBadge');
    const fpOffsetSlider = document.getElementById('fpOffsetSlider');
    const fpOffsetValue = document.getElementById('fpOffsetValue');
    const fpResetSync = document.getElementById('fpResetSync');

    // Initialize SyncEngine
    const syncEngine = new window.SyncEngine();

    let currentAyahsData = [];
    let currentSurahs = [];
    let currentReciterServer = '';
    let playingIndex = -1;
    let loopState = 0; // 0: off, 1: surah, 2: all
    let playbackSpeed = 1.0;

    let sleepTimerId = null;
    let sleepTimeRemaining = 0;
    let sleepIntervalId = null;

    // Fetch surahs list (metadata)
    async function loadSurahs() {
        surahsGrid.innerHTML = Array(12).fill('<div class="skeleton-card"></div>').join('');
        try {
            const res = await fetch('https://api.alquran.cloud/v1/meta');
            const data = await res.json();
            currentSurahs = data.data.surahs.references;
            renderSurahGrid(currentSurahs);
            loadTafsirSurahsDropdown(currentSurahs);

            // Restore Continue Reading
            const savedSurah = localStorage.getItem('continue_reading_surah');
            if (savedSurah) {
                tafsirSurahSelect.value = savedSurah;
                loadTafsir();
            }
        } catch (error) {
            surahsGrid.innerHTML = '<div class="loading-state text-error">خطأ في التحميل. تأكد من الإنترنت.</div>';
        }
    }

    // Fetch reciters
    async function loadReciters() {
        try {
            const res = await fetch('https://www.mp3quran.net/api/v3/reciters?language=ar');
            const data = await res.json();
            reciterSelect.innerHTML = '';
            let isFirst = true;

            data.reciters.forEach(rec => {
                if (rec.moshaf && rec.moshaf.length > 0) {
                    rec.moshaf.forEach(moshaf => {
                        const opt = document.createElement('option');
                        opt.value = moshaf.server;
                        opt.textContent = moshaf.name ? `${rec.name} (${moshaf.name})` : rec.name;

                        if (isFirst) {
                            currentReciterServer = moshaf.server;
                            isFirst = false;
                        }
                        reciterSelect.appendChild(opt);
                    });
                }
            });

            initCustomReciterDropdown();

            reciterSelect.addEventListener('change', (e) => {
                currentReciterServer = e.target.value;
                if (playingIndex !== -1) playSurah(playingIndex);
            });
        } catch (error) {
            reciterSelect.innerHTML = '<option value="">تعذر تحميل القراء</option>';
            document.getElementById('reciterSelectedText').textContent = 'تعذر تحميل القراء';
        }
    }

    function initCustomReciterDropdown() {
        const wrapper = document.getElementById('reciterDropdownWrapper');
        const selectedText = document.getElementById('reciterSelectedText');
        const menu = document.getElementById('reciterMenu');
        const searchInput = document.getElementById('reciterSearchInput');
        const optionsList = document.getElementById('reciterOptions');

        if (!wrapper || !menu) return;

        // Sync initial text
        selectedText.textContent = reciterSelect.options[reciterSelect.selectedIndex]?.text || '';

        const renderOptions = (filter = '') => {
            optionsList.innerHTML = '';
            Array.from(reciterSelect.options).forEach(opt => {
                const text = opt.text;
                if (filter && !normalizeArabic(text).includes(normalizeArabic(filter))) return;

                const item = document.createElement('div');
                item.className = 'prs-option';
                if (reciterSelect.value === opt.value) item.classList.add('selected');
                item.textContent = text;
                item.addEventListener('click', () => {
                    reciterSelect.value = opt.value;
                    reciterSelect.dispatchEvent(new Event('change'));
                    selectedText.textContent = text;
                    menu.classList.remove('show');

                    // Update visual classes
                    optionsList.querySelectorAll('.prs-option').forEach(el => el.classList.remove('selected'));
                    item.classList.add('selected');
                });
                optionsList.appendChild(item);
            });
        };

        renderOptions();

        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.prs-menu')) return; // Ignore clicks inside menu
            e.stopPropagation();
            menu.classList.toggle('show');
            if (menu.classList.contains('show')) {
                searchInput.value = '';
                renderOptions();
                searchInput.focus();
            }
        });

        searchInput.addEventListener('input', (e) => {
            renderOptions(e.target.value);
        });

        document.addEventListener('click', (e) => {
            if (!wrapper.contains(e.target)) {
                menu.classList.remove('show');
            }
        });
    }

    function renderSurahGrid(surahs) {
        surahsGrid.innerHTML = '';
        surahs.forEach((s, idx) => {
            const card = document.createElement('div');
            card.className = 'surah-card glass-card';
            card.id = `surah-card-${idx}`;
            card.style.setProperty('--card-index', Math.min(idx, 20));
            card.innerHTML = `
                <div class="surah-number">${s.number}</div>
                <div class="surah-titles">
                    <div class="surah-name-ar">${s.name}</div>
                    <div class="surah-name-en">${s.englishName}</div>
                </div>
            `;
            card.addEventListener('click', () => playSurah(idx));
            surahsGrid.appendChild(card);
        });
    }

    function formatTime(seconds) {
        if (isNaN(seconds)) return '0:00';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
    const padNumber = (num) => num.toString().padStart(3, '0');

    function playSurah(index) {
        if (index < 0 || index >= currentSurahs.length) return;
        if (playingIndex !== -1) {
            const oldCard = document.getElementById(`surah-card-${playingIndex}`);
            if (oldCard) oldCard.classList.remove('playing');
        }

        playingIndex = index;
        const surah = currentSurahs[index];
        const reciterName = reciterSelect.options[reciterSelect.selectedIndex]?.text || '';

        nowPlayingTitle.textContent = surah.name;
        nowPlayingReciter.textContent = reciterName;

        const newCard = document.getElementById(`surah-card-${index}`);
        if (newCard) newCard.classList.add('playing');

        const audioUrl = currentReciterServer + padNumber(surah.number) + '.mp3';
        audioEl.src = audioUrl;
        audioEl.playbackRate = playbackSpeed;
        audioEl.play().catch(e => console.log('Autoplay blocked'));
        updatePlayBtn(true);

        // Full Player SYNC
        if (fullPlayerOverlay.classList.contains('active')) {
            updateFullPlayerInfo();
            fetchSurahCC(surah.number);
        } else {
            fpCCContainer.dataset.surahId = '';
        }
    }

    function updatePlayBtn(isPlaying) {
        playIcon.style.display = isPlaying ? 'none' : 'block';
        pauseIcons.forEach(i => i.style.display = isPlaying ? 'block' : 'none');
        if (fpPlayIcon && fpPauseIcon) {
            fpPlayIcon.style.display = isPlaying ? 'none' : 'block';
            fpPauseIcon.style.display = isPlaying ? 'block' : 'none';
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (audioEl.src) {
            if (audioEl.paused) { audioEl.play(); updatePlayBtn(true); }
            else { audioEl.pause(); updatePlayBtn(false); }
        }
    });

    document.getElementById('btnNext').addEventListener('click', () => playSurah(playingIndex + 1));
    document.getElementById('btnPrev').addEventListener('click', () => playSurah(playingIndex - 1));

    // ==========================================
    // Full Screen Advanced Player Logic
    // ==========================================
    const playerBottom = document.querySelector('.global-player');
    playerBottom.addEventListener('click', (e) => {
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('.progress-bar-container')) return;
        // Don't open full player in radio mode - it's a live stream with no verse data
        if (window.isRadioMode) return;
        if (audioEl.src && playingIndex >= 0) {
            fullPlayerOverlay.classList.add('active');
            updateFullPlayerInfo();
            if (!fpCCContainer.dataset.surahId || fpCCContainer.dataset.surahId !== currentSurahs[playingIndex].number.toString()) {
                fetchSurahCC(currentSurahs[playingIndex].number);
            }
        }
    });

    fpCloseBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        fullPlayerOverlay.classList.remove('active');
    });

    function updateFullPlayerInfo() {
        if (playingIndex === -1) return;
        const s = currentSurahs[playingIndex];
        fpSurahName.textContent = s.name;
        fpRevelationType.textContent = s.revelationType === 'Meccan' ? 'مكية' : 'مدنية';
        fpAyahsCount.textContent = `${s.numberOfAyahs} آيات`;
        fpReciterName.textContent = reciterSelect.options[reciterSelect.selectedIndex]?.text || '';
    }

    async function fetchSurahCC(surahId) {
        fpCCContainer.dataset.surahId = surahId;
        fpCCContainer.innerHTML = '<div class="cc-placeholder">يتم تحميل الآيات...</div>';
        currentAyahsData = [];
        try {
            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahId}`);
            const data = await res.json();
            const ayahs = data.data.ayahs;

            fpCCContainer.innerHTML = '';
            ayahs.forEach((ayah, i) => {
                const sp = document.createElement('span');
                sp.className = 'fp-cc-verse';
                sp.id = `fp-verse-${i}`;
                sp.innerHTML = `${ayah.text} <span class="fp-ayah-container"><span class="fp-ayah-symbol">۝</span><span class="fp-ayah-num">${ayah.numberInSurah}</span></span> `;

                // Tap-to-sync interaction
                sp.addEventListener('click', (e) => {
                    if (!audioEl.src || !audioEl.duration) return;

                    // Visual feedback
                    const ripple = document.createElement('div');
                    ripple.className = 'verse-ripple ripple-active';
                    sp.appendChild(ripple);
                    setTimeout(() => ripple.remove(), 600);
                    sp.classList.add('calibrating');
                    setTimeout(() => sp.classList.remove('calibrating'), 500);

                    // Calibrate sync engine
                    syncEngine.calibrate(i, audioEl.currentTime);
                    updateSyncEngineUI();
                    updateSmartCC();
                });

                currentAyahsData.push({
                    element: sp,
                    length: ayah.text.length,
                    text: ayah.text
                });
                fpCCContainer.appendChild(sp);
            });

            // Wait for audio metadata to initialize SyncEngine
            if (audioEl.readyState >= 1) {
                await initSyncEngine();
            } else {
                audioEl.addEventListener('loadedmetadata', initSyncEngine, { once: true });
            }
        } catch (e) {
            fpCCContainer.innerHTML = '<div class="cc-placeholder text-error">تعذر تحميل الآيات</div>';
        }
    }

    async function initSyncEngine() {
        if (!currentSurahs[playingIndex] || !audioEl.duration) return;
        await syncEngine.init(currentSurahs[playingIndex].number, currentReciterServer, currentAyahsData, audioEl.duration);
        updateSyncEngineUI();
        updateSmartCC();
    }

    function updateSyncEngineUI() {
        const info = syncEngine.getTierInfo();
        if (fpSyncBadge) {
            fpSyncBadge.className = `fp-badge fp-sync-badge sync-${info.tier}`;
            fpSyncBadge.innerHTML = `${info.icon} ${info.labelAr}`;
        }
        if (fpOffsetSlider && fpOffsetValue) {
            fpOffsetSlider.value = syncEngine.getUserOffset();
            fpOffsetValue.textContent = (syncEngine.getUserOffset() > 0 ? '+' : '') + syncEngine.getUserOffset().toFixed(1) + ' ث';
        }
    }

    if (fpOffsetSlider) {
        fpOffsetSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            fpOffsetValue.textContent = (val > 0 ? '+' : '') + val.toFixed(1) + ' ث';
            syncEngine.setUserOffset(val);
            updateSmartCC();
        });
    }

    if (fpResetSync) {
        fpResetSync.addEventListener('click', () => {
            syncEngine.resetCalibration();
            fpOffsetSlider.value = 0;
            fpOffsetValue.textContent = '0.0 ث';
            updateSmartCC();
        });
    }

    // Debounce scroll
    let scrollTimeout = null;

    function updateSmartCC() {
        if (!currentAyahsData.length || !audioEl.duration || syncEngine.activeTier === 'none') {
            // Fallback to naive if sync engine isn't ready
            if (!currentAyahsData.length || !audioEl.duration) return;
            const totalChars = currentAyahsData.reduce((acc, curr) => acc + curr.length, 0);
            const perc = Math.max(0, Math.min(1, audioEl.currentTime / audioEl.duration));
            let targetChar = perc * totalChars;

            let runningTotal = 0;
            let activeIndex = 0;

            for (let i = 0; i < currentAyahsData.length; i++) {
                runningTotal += currentAyahsData[i].length;
                if (runningTotal >= targetChar) {
                    activeIndex = i;
                    break;
                }
            }
            _applyVerseHighlighting(activeIndex, 0);
            return;
        }

        const { index, progress, changed } = syncEngine.getActiveAyah(audioEl.currentTime);

        _applyVerseHighlighting(index, progress, changed);
    }

    function _applyVerseHighlighting(activeIndex, progress, changed = true) {
        currentAyahsData.forEach((item, i) => {
            const el = item.element;

            // Reset state classes
            el.classList.remove('active', 'verse-passed', 'verse-prev', 'verse-next');

            if (i < activeIndex) {
                el.classList.add('verse-passed');
                if (i === activeIndex - 1) el.classList.add('verse-prev');
            } else if (i === activeIndex) {
                el.classList.add('active');

                // Debounced scroll
                if (changed) {
                    clearTimeout(scrollTimeout);
                    scrollTimeout = setTimeout(() => {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                }
            } else if (i === activeIndex + 1) {
                el.classList.add('verse-next');
            }
        });

        // Update reading line progress
        // Calculate overall read progress based on audio progress
        fpCCContainer.style.setProperty('--read-progress', `${Math.max(0, Math.min(100, (audioEl.currentTime / audioEl.duration) * 100))}%`);
    }

    function updateFpPlayBtn(isPlaying) {
        fpPlayIcon.style.display = isPlaying ? 'none' : 'block';
        fpPauseIcon.style.display = isPlaying ? 'block' : 'none';
        updatePlayBtn(isPlaying);
    }

    fpBtnPlayPause.addEventListener('click', (e) => {
        e.stopPropagation();
        if (audioEl.src) {
            if (audioEl.paused) { audioEl.play(); updateFpPlayBtn(true); }
            else { audioEl.pause(); updateFpPlayBtn(false); }
        }
    });

    fpBtnNext.addEventListener('click', (e) => {
        e.stopPropagation();
        if (playingIndex < currentSurahs.length - 1) {
            playSurah(playingIndex + 1);
            updateFpPlayBtn(true);
        }
    });

    fpBtnPrev.addEventListener('click', (e) => {
        e.stopPropagation();
        if (playingIndex > 0) {
            playSurah(playingIndex - 1);
            updateFpPlayBtn(true);
        }
    });

    fpBtnSpeed.addEventListener('click', (e) => {
        e.stopPropagation();
        playbackSpeed = playbackSpeed >= 2 ? 0.5 : playbackSpeed + 0.5;
        audioEl.playbackRate = playbackSpeed;
        btnSpeed.textContent = playbackSpeed + 'x';
        fpBtnSpeed.textContent = playbackSpeed + 'x';
    });

    fpBtnLoop.addEventListener('click', (e) => {
        e.stopPropagation();
        audioEl.loop = !audioEl.loop;
        fpBtnLoop.style.color = audioEl.loop ? 'var(--primary)' : 'var(--text-main)';
    });

    fpDownloadBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!audioEl.src) return;
        const a = document.createElement('a');
        a.href = audioEl.src;
        a.setAttribute('download', `${fpSurahName.textContent}.mp3`);
        a.setAttribute('target', '_blank');
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });

    fpProgressBar.addEventListener('input', (e) => {
        if (!audioEl.duration) return;
        const perc = parseFloat(e.target.value);
        const seekTime = (perc / 100) * audioEl.duration;
        fpTimeCurrent.textContent = formatTime(seekTime);
        timeCurrent.textContent = formatTime(seekTime);
    });

    fpProgressBar.addEventListener('change', (e) => {
        if (!audioEl.duration) return;
        const perc = parseFloat(e.target.value);
        audioEl.currentTime = (perc / 100) * audioEl.duration;
    });

    // Audio Progress Sync & Error Handling
    let isDraggingProgress = false;

    progressBar.addEventListener('mousedown', () => { isDraggingProgress = true; });
    progressBar.addEventListener('touchstart', () => { isDraggingProgress = true; }, { passive: true });

    // Use document-level events so drag release is always caught
    document.addEventListener('mouseup', () => { isDraggingProgress = false; });
    document.addEventListener('touchend', () => { isDraggingProgress = false; });

    audioEl.addEventListener('error', () => {
        // In radio mode, the playRadioStation retry logic handles errors
        if (window.isRadioMode) return;
        nowPlayingTitle.textContent = 'نعتذر، خطأ في التشغيل';
        nowPlayingReciter.textContent = 'تحقق من اتصال الإنترنت أو حدث الصفحة';
        updatePlayBtn(false);
    });

    audioEl.addEventListener('timeupdate', () => {
        if (!audioEl.duration || isDraggingProgress) return;
        const perc = (audioEl.currentTime / audioEl.duration) * 100;
        progressBar.value = perc;
        progressFill.style.width = `${perc}%`;
        timeCurrent.textContent = formatTime(audioEl.currentTime);
        timeTotal.textContent = formatTime(audioEl.duration);

        // Full Player Sync
        fpProgressBar.value = perc;
        fpTimeCurrent.textContent = formatTime(audioEl.currentTime);
        fpTimeTotal.textContent = formatTime(audioEl.duration);
        updateSmartCC();
    });

    progressBar.addEventListener('input', (e) => {
        if (!audioEl.duration) return;
        const perc = parseFloat(e.target.value);
        progressFill.style.width = `${perc}%`;
        const seekTime = (perc / 100) * audioEl.duration;
        timeCurrent.textContent = formatTime(seekTime);
    });

    progressBar.addEventListener('change', (e) => {
        if (!audioEl.duration) return;
        const perc = parseFloat(e.target.value);
        audioEl.currentTime = (perc / 100) * audioEl.duration;
        isDraggingProgress = false;
    });

    // Loop & End Logic
    audioEl.addEventListener('ended', () => {
        if (loopState === 1) { // loop surah
            playSurah(playingIndex);
        } else if (loopState === 2) { // loop all / autoplay
            playSurah(playingIndex + 1);
        } else if (prefs.autoplay) {
            playSurah(playingIndex + 1);
        } else {
            updatePlayBtn(false);
        }
    });

    btnLoop.addEventListener('click', () => {
        loopState = (loopState + 1) % 3;
        btnLoop.classList.toggle('active', loopState > 0);
        if (loopState === 0) btnLoop.style.opacity = '0.5';
        else if (loopState === 1) { btnLoop.style.opacity = '1'; btnLoop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 2.1l4 4-4 4"/><path d="M3 12.2v-2a4 4 0 0 1 4-4h12.8M7 21.9l-4-4 4-4"/><path d="M21 11.8v2a4 4 0 0 1-4 4H4.2"/><text x="12" y="16" font-size="6" fill="currentColor">1</text></svg>'; }
        else { btnLoop.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="17 1 21 5 17 9"></polyline><path d="M3 11V9a4 4 0 0 1 4-4h14"></path><polyline points="7 23 3 19 7 15"></polyline><path d="M21 13v2a4 4 0 0 1-4 4H3"></path></svg>'; }
    });

    // Speed Control
    btnSpeed.addEventListener('click', () => {
        const speeds = [1.0, 1.25, 1.5, 2.0, 0.5, 0.75];
        let idx = speeds.indexOf(playbackSpeed);
        playbackSpeed = speeds[(idx + 1) % speeds.length];
        audioEl.playbackRate = playbackSpeed;
        btnSpeed.textContent = playbackSpeed + 'x';
    });

    // Sleep Timer
    btnSleepTimer.addEventListener('click', () => sleepModal.classList.add('active'));
    document.getElementById('closeSleepModal').addEventListener('click', () => sleepModal.classList.remove('active'));

    document.getElementById('timerOptions').addEventListener('click', (e) => {
        if (e.target.tagName !== 'BUTTON') return;
        const mins = parseInt(e.target.dataset.time);

        clearTimeout(sleepTimerId);
        clearInterval(sleepIntervalId);

        const statusEl = document.getElementById('activeTimerStatus');
        const remainEl = document.getElementById('timeRemaining');

        if (mins === 0) {
            btnSleepTimer.classList.remove('active');
            statusEl.style.display = 'none';
        } else {
            btnSleepTimer.classList.add('active');
            let secsRemaining = mins * 60;
            statusEl.style.display = 'block';

            const updateUI = () => {
                if (secsRemaining <= 0) {
                    clearInterval(sleepIntervalId);
                    audioEl.pause();
                    updatePlayBtn(false);
                    btnSleepTimer.classList.remove('active');
                    statusEl.style.display = 'none';
                } else {
                    remainEl.textContent = formatTime(secsRemaining);
                    secsRemaining--;
                }
            };

            updateUI();
            sleepIntervalId = setInterval(updateUI, 1000);
            sleepTimerId = setTimeout(() => { }, mins * 60 * 1000); // placeholder, handled by interval
        }
        sleepModal.classList.remove('active');
    });


    // ==========================================
    // 4. Tafsir Segment & Hifz Mode
    // ==========================================
    const tafsirSurahSelect = document.getElementById('tafsirSurahSelect');
    const tafsirSelect = document.getElementById('tafsirSelect');
    const tafsirContent = document.getElementById('tafsirContent');
    const btnHifzMode = document.getElementById('btnHifzMode');
    let isHifzActive = false;

    btnHifzMode.addEventListener('click', () => {
        isHifzActive = !isHifzActive;
        if (isHifzActive) {
            btnHifzMode.style.background = 'var(--accent)';
            tafsirContent.classList.add('hifz-active');
            gamificationEngine.increment('hifz_usage');
            btnHifzMode.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><path d="M12 9a3 3 0 1 0 0 6 3 3 0 1 0 0-6z"></path><line x1="2" y1="2" x2="22" y2="22"></line></svg> إظهار النص`;
        } else {
            btnHifzMode.style.background = '';
            tafsirContent.classList.remove('hifz-active');
            btnHifzMode.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> وضع التسميع`;
            // Unreveal all
            document.querySelectorAll('.aya-text.revealed').forEach(el => el.classList.remove('revealed'));
        }
    });

    function loadTafsirSurahsDropdown(surahs) {
        tafsirSurahSelect.innerHTML = '<option value="">اختر السورة...</option>';
        surahs.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.number;
            opt.textContent = `${s.number}. ${s.name}`;
            tafsirSurahSelect.appendChild(opt);
        });
    }

    async function loadTafsir() {
        const surahId = tafsirSurahSelect.value;
        const edition = tafsirSelect.value;
        if (!surahId) {
            tafsirContent.innerHTML = '<div class="placeholder-text text-center text-muted">اختر سورة لعرض الآيات والتفسير</div>';
            return;
        }

        // Auto-save last read
        localStorage.setItem('continue_reading_surah', surahId);
        usageStats.mostUsedSection = 'tafsir';
        localStorage.setItem('usage', JSON.stringify(usageStats));

        tafsirContent.innerHTML = Array(3).fill('<div class="skeleton-aya"></div>').join('');

        try {
            const currentEdition = edition;
            const arEdition = 'quran-uthmani';

            const res = await fetch(`https://api.alquran.cloud/v1/surah/${surahId}/editions/${arEdition},${currentEdition}`);
            const data = await res.json();

            if (data.status !== 'OK') throw new Error();

            const textAyahs = data.data[0].ayahs;
            const tafsirAyahs = data.data[1].ayahs;

            tafsirContent.innerHTML = '';

            textAyahs.forEach((ayah, i) => {
                const tafsir = tafsirAyahs[i].text;
                const block = document.createElement('div');
                block.className = 'aya-block';
                block.innerHTML = `
                    <div class="aya-actions">
                        <button class="icon-btn copy-btn" data-text="${ayah.text}" aria-label="نسخ"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                    </div>
                    <div class="aya-text quran-text">${ayah.text} <span class="aya-number">${ayah.numberInSurah}</span></div>
                    <div class="tafsir-text">${tafsir}</div>
                `;

                // Hifz mode click to reveal logic
                const ayaTxt = block.querySelector('.aya-text');
                ayaTxt.addEventListener('click', () => {
                    if (isHifzActive) ayaTxt.classList.toggle('revealed');
                });

                // Copy
                block.querySelector('.copy-btn').addEventListener('click', (e) => {
                    navigator.clipboard.writeText(ayah.text);
                    const originalhtml = e.currentTarget.innerHTML;
                    e.currentTarget.innerHTML = '✓';
                    setTimeout(() => e.currentTarget.innerHTML = originalhtml, 1500);
                });

                tafsirContent.appendChild(block);
            });

        } catch (e) {
            tafsirContent.innerHTML = '<div class="loading-state text-error text-center">خطأ في التحميل. حاول مجدداً.</div>';
        }
    }

    tafsirSurahSelect.addEventListener('change', loadTafsir);
    tafsirSelect.addEventListener('change', loadTafsir);


    // ==========================================
    // 5. Azkar & Rings Logic
    // ==========================================
    const azkarContainer = document.getElementById('azkarContainer');
    const azkarTabs = document.querySelectorAll('.azkar-tab');
    const btnResetAzkar = document.getElementById('btnResetAzkar');
    const btnCompleteAzkar = document.getElementById('btnCompleteAzkar');

    // Very short beep base64 for audio cue
    const hapticBeep = new Audio('data:audio/wav;base64,UklGRl9vT19XQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YU');

    function getTodayAzkarKey() {
        // Adjust date to account for timezone to be safe, but local date is usually fine.
        return 'azkar_progress_' + new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
    }

    function renderAzkar(category) {
        azkarContainer.innerHTML = '';
        if (!window.azkarData || !window.azkarData[category]) return;

        const list = window.azkarData[category];
        const savedProgress = JSON.parse(localStorage.getItem(getTodayAzkarKey()) || '{}');
        if (!savedProgress[category]) savedProgress[category] = {};

        list.forEach((zekr, idx) => {
            const card = document.createElement('div');
            card.className = 'zekr-card glass-card';

            const maxCount = zekr.count;
            let currentCount = savedProgress[category][idx] !== undefined ? savedProgress[category][idx] : maxCount;

            // Generate circular SVG
            const radius = 30; const circumference = 2 * Math.PI * radius;

            const referenceHtml = zekr.reference ? `<div class="zekr-reference" style="font-size:0.85rem; color:var(--text-muted); opacity:0.85; margin-top:6px;">${zekr.reference}</div>` : '';

            card.innerHTML = `
                <div class="zekr-text">${zekr.text}</div>
                <div class="zekr-footer">
                    <div style="flex:1;">
                        <div class="zekr-virtue">${zekr.virtue || ''}</div>
                        ${referenceHtml}
                    </div>
                    <div class="counter-wrapper">
                        <svg class="counter-ring">
                            <circle class="bg" cx="35" cy="35" r="${radius}"></circle>
                            <circle class="progress" cx="35" cy="35" r="${radius}" stroke-dasharray="${circumference}" stroke-dashoffset="${circumference}"></circle>
                        </svg>
                        <button class="counter-btn" id="btn-count-${category}-${idx}">${currentCount}</button>
                    </div>
                </div>
            `;

            const btn = card.querySelector('.counter-btn');
            const progressCircle = card.querySelector('.progress');

            function updateUI() {
                btn.textContent = currentCount;
                const offset = circumference - ((maxCount - currentCount) / maxCount) * circumference;
                progressCircle.style.strokeDashoffset = offset;
                if (currentCount <= 0) {
                    card.classList.add('completed');
                    btn.innerHTML = '✓';
                } else {
                    card.classList.remove('completed');
                }
            }
            updateUI();

            btn.addEventListener('click', () => {
                if (currentCount > 0) {
                    if (prefs.haptics && navigator.vibrate) navigator.vibrate(50);
                    currentCount--;
                    
                    const p = JSON.parse(localStorage.getItem(getTodayAzkarKey()) || '{}');
                    if (!p[category]) p[category] = {};
                    p[category][idx] = currentCount;
                    localStorage.setItem(getTodayAzkarKey(), JSON.stringify(p));

                    updateUI();

                    if (currentCount === 0) {
                        card.classList.add('completed');
                        if (prefs.haptics && navigator.vibrate) navigator.vibrate([100, 50, 100]);
                        // gamificationEngine is hoisted for execution since this is an event listener
                        if (typeof gamificationEngine !== 'undefined') gamificationEngine.increment('azkar_read');
                    }
                }
            });

            azkarContainer.appendChild(card);
        });
    }

    if (btnResetAzkar) {
        btnResetAzkar.addEventListener('click', () => {
            const activeTab = document.querySelector('.azkar-tab.active');
            if (!activeTab) return;
            const category = activeTab.dataset.category;
            const p = JSON.parse(localStorage.getItem(getTodayAzkarKey()) || '{}');
            if (p[category]) delete p[category];
            localStorage.setItem(getTodayAzkarKey(), JSON.stringify(p));
            renderAzkar(category);
        });
    }

    if (btnCompleteAzkar) {
        btnCompleteAzkar.addEventListener('click', () => {
            const activeTab = document.querySelector('.azkar-tab.active');
            if (!activeTab) return;
            const category = activeTab.dataset.category;
            const list = window.azkarData[category];
            if (!list) return;

            const p = JSON.parse(localStorage.getItem(getTodayAzkarKey()) || '{}');
            if (!p[category]) p[category] = {};
            list.forEach((_, idx) => {
                const prev = p[category][idx];
                // Record achievement only if it wasn't already completed
                if (prev !== 0) {
                    p[category][idx] = 0;
                    if (typeof gamificationEngine !== 'undefined') gamificationEngine.increment('azkar_read');
                }
            });
            localStorage.setItem(getTodayAzkarKey(), JSON.stringify(p));
            renderAzkar(category);
            if (prefs.haptics && navigator.vibrate) navigator.vibrate([100, 50, 100]);
        });
    }

    azkarTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            azkarTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            renderAzkar(tab.dataset.category);
        });
    });


    // ==========================================
    // 6. Gamification Engine (Streaks & Badges)
    // ==========================================
    const streakCountEl = document.getElementById('streakCount');
    const azkarTodayCountEl = document.getElementById('azkarTodayCount');
    const werdSelect = document.getElementById('werdSelect');
    const btnCompleteWerd = document.getElementById('btnCompleteWerd');
    const achievementsGrid = document.getElementById('achievementsGrid');

    const gamificationEngine = {
        data: JSON.parse(localStorage.getItem('gami_data')) || {
            streak: 0,
            lastDate: null,
            azkarToday: 0,
            azkarTotal: 0,
            hifzUsage: 0,
            unlockedBadges: []
        },

        init() {
            this.checkStreak();
            this.updateStatsUI();
            this.renderWerdOptions();
            this.renderBadges();

            btnCompleteWerd.addEventListener('click', () => {
                if (!werdSelect.value) return alert('اختر هدفاً أولاً');
                if (!this.data.unlockedBadges.includes('first_werd')) {
                    this.unlockBadge('first_werd');
                }
                btnCompleteWerd.textContent = 'تم إنجاز الورد بنجاح ✓';
                btnCompleteWerd.style.background = 'var(--accent)';
                if (prefs.haptics && navigator.vibrate) navigator.vibrate(200);
            });
        },

        checkStreak() {
            const today = new Date().toDateString();
            if (this.data.lastDate !== today) {
                // If it's the very next day, increment
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);

                if (this.data.lastDate === yesterday.toDateString()) {
                    this.data.streak++;
                } else if (this.data.lastDate !== null) {
                    this.data.streak = 1; // Reset if missed a day
                } else {
                    this.data.streak = 1; // First time
                }
                this.data.azkarToday = 0;
                this.data.lastDate = today;
                this.save();
            }

            if (this.data.streak >= 7) this.unlockBadge('streak_7');
            if (this.data.streak >= 30) this.unlockBadge('streak_30');
        },

        increment(type) {
            if (type === 'azkar_read') {
                this.data.azkarToday++;
                this.data.azkarTotal++;
                this.updateStatsUI();
                if (this.data.azkarTotal >= 100) this.unlockBadge('azkar_100');
            }
            if (type === 'hifz_usage') {
                this.data.hifzUsage++;
                if (this.data.hifzUsage >= 10) this.unlockBadge('hifz_master');
            }
            this.save();
        },

        unlockBadge(badgeId) {
            if (!this.data.unlockedBadges.includes(badgeId)) {
                this.data.unlockedBadges.push(badgeId);
                this.save();
                this.renderBadges();
                // simple local notification
                if (prefs.notifications && Notification.permission === 'granted') {
                    new Notification('إنجاز جديد!', { body: 'تم فتح وسام جديد في تراتيل.', icon: 'icons/icon.svg' });
                }
            }
        },

        save() {
            localStorage.setItem('gami_data', JSON.stringify(this.data));
        },

        updateStatsUI() {
            streakCountEl.textContent = this.data.streak;
            azkarTodayCountEl.textContent = this.data.azkarToday;
        },

        renderWerdOptions() {
            window.werdData.forEach(w => {
                const opt = document.createElement('option');
                opt.value = w.id;
                opt.textContent = `${w.name} - ${w.description}`;
                werdSelect.appendChild(opt);
            });
        },

        renderBadges() {
            if (!window.achievementsData) return;
            achievementsGrid.innerHTML = '';
            window.achievementsData.forEach(b => {
                const card = document.createElement('div');
                const unlocked = this.data.unlockedBadges.includes(b.id);
                card.className = `badge-card glass-card ${unlocked ? 'unlocked' : ''}`;
                card.innerHTML = `
                    <div class="badge-icon">${b.icon}</div>
                    <div class="badge-title">${b.title}</div>
                    <div class="badge-desc">${b.description}</div>
                `;
                achievementsGrid.appendChild(card);
            });
        }
    };

    gamificationEngine.init();


    // ==========================================
    // 7. Quotes 
    // ==========================================
    const quotesContainer = document.getElementById('quotesContainer');
    function renderQuotes() {
        if (!window.quotesData) return;
        quotesContainer.innerHTML = '';
        window.quotesData.forEach(q => {
            const card = document.createElement('div');
            card.className = 'quote-card glass-card';
            card.innerHTML = `
                <div class="quote-text">${q.quote}</div>
                <div class="quote-author">${q.author}</div>
            `;
            quotesContainer.appendChild(card);
        });
    }

    // ==========================================
    // 8. Prayer Times (Feature 1)
    // ==========================================
    async function loadPrayerTimes() {
        const prayerCityInput = document.getElementById('prayerCity');
        const prayerCountryInput = document.getElementById('prayerCountry');
        const sCity = localStorage.getItem('prayer_city') || 'cairo';
        const sCountry = localStorage.getItem('prayer_country') || 'egypt';

        prayerCityInput.value = sCity;
        prayerCountryInput.value = sCountry;

        function fetchPrayerAPI(url) {
            document.getElementById('prayerGrid').innerHTML = '<div class="loading-state">جاري تحميل المواقيت...</div>';
            fetch(url)
                .then(res => res.json())
                .then(data => {
                    if (data.code !== 200) throw new Error('API Error');
                    const t = data.data.timings;
                    const d = data.data.date;
                    document.getElementById('hijriDate').textContent = d.hijri.date;
                    document.getElementById('gregorianDate').textContent = d.readable;

                    const prayersList = [
                        { id: 'Fajr', name: 'الفجر', time: t.Fajr },
                        { id: 'Sunrise', name: 'الشروق', time: t.Sunrise },
                        { id: 'Dhuhr', name: 'الظهر', time: t.Dhuhr },
                        { id: 'Asr', name: 'العصر', time: t.Asr },
                        { id: 'Maghrib', name: 'المغرب', time: t.Maghrib },
                        { id: 'Isha', name: 'العشاء', time: t.Isha }
                    ];

                    document.getElementById('prayerGrid').innerHTML = '';

                    let nextPrayerIdx = -1;
                    const now = new Date();
                    const currentMinutes = now.getHours() * 60 + now.getMinutes();

                    for (let i = 0; i < prayersList.length; i++) {
                        const [h, m] = prayersList[i].time.split(':').map(Number);
                        const pMinutes = h * 60 + m;
                        if (pMinutes > currentMinutes && nextPrayerIdx === -1) {
                            nextPrayerIdx = i;
                        }
                    }
                    // if all passed, next is Fajr tomorrow
                    if (nextPrayerIdx === -1) nextPrayerIdx = 0;

                    const nextPrayerObj = prayersList[nextPrayerIdx];
                    document.getElementById('nextPrayerName').textContent = nextPrayerObj.name;

                    function format12HourTime(time24) {
                        const [h, m] = time24.split(':').map(Number);
                        const hr12 = h % 12 || 12;
                        const ampm = h >= 12 ? 'مساءً' : 'صباحاً';
                        return hr12.toString().padStart(2, '0') + ':' + m.toString().padStart(2, '0') + ' ' + ampm;
                    }

                    prayersList.forEach((p, idx) => {
                        const card = document.createElement('div');
                        card.className = `prayer-card glass-card ${idx === nextPrayerIdx ? 'prayer-card--active' : ''}`;
                        card.innerHTML = `
                        <div class="prayer-card-name">${p.name}</div>
                        <div class="prayer-card-time">${format12HourTime(p.time)}</div>
                    `;
                        document.getElementById('prayerGrid').appendChild(card);
                    });

                    // Set Up Countdown
                    if (window.prayerInterval) clearInterval(window.prayerInterval);
                    window.prayerInterval = setInterval(() => {
                        const dNow = new Date();
                        let [nH, nM] = nextPrayerObj.time.split(':').map(Number);
                        let targetMinutes = nH * 60 + nM;
                        let cMinutes = dNow.getHours() * 60 + dNow.getMinutes();
                        let diff = targetMinutes - cMinutes;
                        if (diff < 0) diff += 24 * 60; // Next day

                        let mins = diff % 60;
                        let hrs = Math.floor(diff / 60);
                        let secs = 59 - dNow.getSeconds(); // approximate

                        document.getElementById('prayerCountdown').textContent = `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
                    }, 1000);
                })
                .catch(err => {
                    document.getElementById('prayerGrid').innerHTML = '<div class="loading-state text-error">خطأ في جلب المواقيت.</div>';
                });
        }

        if (navigator.geolocation && !localStorage.getItem('prayer_city_manual')) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    fetchPrayerAPI(`https://api.aladhan.com/v1/timings?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&method=5`);
                },
                (err) => {
                    fetchPrayerAPI(`https://api.aladhan.com/v1/timingsByCity?city=${sCity}&country=${sCountry}&method=5`);
                }
            );
        } else {
            fetchPrayerAPI(`https://api.aladhan.com/v1/timingsByCity?city=${sCity}&country=${sCountry}&method=5`);
        }

        document.getElementById('btnSaveLocation').addEventListener('click', () => {
            const c = prayerCityInput.value.trim() || 'cairo';
            const cnt = prayerCountryInput.value.trim() || 'egypt';
            localStorage.setItem('prayer_city', c);
            localStorage.setItem('prayer_country', cnt);
            localStorage.setItem('prayer_city_manual', 'true'); // bypass GPS
            fetchPrayerAPI(`https://api.aladhan.com/v1/timingsByCity?city=${c}&country=${cnt}&method=5`);
        });
    }

    // ==========================================
    // 9. Hadith (Feature 2)
    // ==========================================
    let hadithDataAll = [];
    let hadithCurrentPage = 1;
    const HADITH_PER_PAGE = 20;

    async function loadHadithCore(bookCode) {
        document.getElementById('hadithList').innerHTML = '<div class="loading-state">جاري التحميل...</div>';
        try {
            const res = await fetch(`https://cdn.jsdelivr.net/gh/fawazahmed0/hadith-api@1/editions/${bookCode}.min.json`);
            if (!res.ok) throw new Error();
            const data = await res.json();
            hadithDataAll = data.hadiths || [];

            // Random featured
            if (hadithDataAll.length > 0) {
                renderRandomHadith();
            }

            hadithCurrentPage = 1;
            renderHadithPage();
            document.getElementById('hadithPagination').style.display = 'flex';
        } catch (e) {
            document.getElementById('hadithList').innerHTML = '<div class="loading-state text-error">خطأ في التحميل.</div>';
        }
    }

    function renderRandomHadith() {
        if (hadithDataAll.length === 0) return;
        let item = null;
        for (let i = 0; i < 50; i++) {
            item = hadithDataAll[Math.floor(Math.random() * hadithDataAll.length)];
            if (item && item.text && item.text.length > 15) break;
        }
        if (item) document.getElementById('featuredHadithText').textContent = item.text;
    }

    function renderHadithPage() {
        const listEl = document.getElementById('hadithList');
        listEl.innerHTML = '';
        const start = (hadithCurrentPage - 1) * HADITH_PER_PAGE;
        const end = start + HADITH_PER_PAGE;
        const pageItems = hadithDataAll.slice(start, end);

        pageItems.forEach((h, idx) => {
            const card = document.createElement('div');
            card.className = 'zekr-card glass-card';
            card.innerHTML = `
                <div class="zekr-text">${h.text}</div>
                <div class="zekr-footer" style="padding-top:1rem;">
                    <span class="zekr-virtue">رقم الحديث: ${h.hadithnumber}</span>
                    <button class="icon-btn copy-btn" aria-label="نسخ"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>
                </div>
            `;
            card.querySelector('.copy-btn').addEventListener('click', (e) => {
                navigator.clipboard.writeText(h.text);
                const oh = e.currentTarget.innerHTML;
                e.currentTarget.innerHTML = '✓';
                setTimeout(() => e.currentTarget.innerHTML = oh, 1500);
            });
            listEl.appendChild(card);
        });

        const totalPages = Math.ceil(hadithDataAll.length / HADITH_PER_PAGE);
        document.getElementById('hadithPageInfo').textContent = `صفحة ${hadithCurrentPage} من ${totalPages}`;
        document.getElementById('btnHadithPrev').disabled = (hadithCurrentPage === 1);
        document.getElementById('btnHadithNext').disabled = (hadithCurrentPage === totalPages);
    }

    function loadHadith() {
        const bookSelect = document.getElementById('hadithBookSelect');
        loadHadithCore(bookSelect.value);

        bookSelect.addEventListener('change', () => {
            loadHadithCore(bookSelect.value);
        });

        document.getElementById('btnRefreshHadith').addEventListener('click', renderRandomHadith);

        document.getElementById('btnHadithPrev').addEventListener('click', () => {
            if (hadithCurrentPage > 1) { hadithCurrentPage--; renderHadithPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
        document.getElementById('btnHadithNext').addEventListener('click', () => {
            const totalPages = Math.ceil(hadithDataAll.length / HADITH_PER_PAGE);
            if (hadithCurrentPage < totalPages) { hadithCurrentPage++; renderHadithPage(); window.scrollTo({ top: 0, behavior: 'smooth' }); }
        });
    }

    // ==========================================
    // 10. Radio (Feature 3) — Enhanced with MP3Quran API
    // ==========================================
    window.isRadioMode = false;
    let radioData = [];
    let filteredRadioData = [];

    // Featured / Pinned stations (always shown at top)
    // Using multiple fallback URLs per station for reliability
    const featuredStations = [
        {
            name: 'إذاعة القرآن الكريم - مصر',
            url: 'https://stream.radiojar.com/8s5u5tpdtwzuv',
            fallbackUrls: [
                'https://n0a.radiojar.com/8s5u5tpdtwzuv',
                'https://n0b.radiojar.com/8s5u5tpdtwzuv',
            ],
            category: 'featured',
            countryCode: 'EG'
        },
        {
            name: 'إذاعة القرآن الكريم - السعودية',
            url: 'https://stream.radiojar.com/0tpy1h0kxtzuv',
            fallbackUrls: [
                'https://n0a.radiojar.com/0tpy1h0kxtzuv',
                'https://n0b.radiojar.com/0tpy1h0kxtzuv',
            ],
            category: 'featured',
            countryCode: 'SA'
        },
        {
            name: 'إذاعة السنة النبوية - السعودية',
            url: 'https://stream.radiojar.com/4wqre23fytzuv',
            fallbackUrls: [
                'https://n0a.radiojar.com/4wqre23fytzuv',
                'https://n0b.radiojar.com/4wqre23fytzuv',
            ],
            category: 'featured',
            countryCode: 'SA'
        },
    ];

    // Category mapping for radios from MP3Quran API
    const sunnaCategoryIds = [109066, 109067, 109073, 10903, 10904, 21114, 21115, 21116, 21117, 109069, 109083, 109076];
    const specialCategoryIds = [108, 109, 110, 113, 114, 115, 116, 10906, 10907, 109060, 109061];

    function categorizeRadio(radio) {
        const id = radio.id;
        if (sunnaCategoryIds.includes(id)) return 'sunnah';
        if (specialCategoryIds.includes(id)) return 'special';
        if (id >= 109038 && id <= 109059) return 'translation'; // translations
        return 'quran';
    }

    /**
     * Normalize and generate alternative stream URLs for a radio station.
     * The backup.qurango.net streams can be unreliable on mobile,
     * so we try multiple mirrors.
     */
    function getStreamUrls(station) {
        const primary = station.url || station.URL || station.stream || '';
        const urls = [primary];

        // Add explicit fallback URLs if provided
        if (station.fallbackUrls && Array.isArray(station.fallbackUrls)) {
            urls.push(...station.fallbackUrls);
        }

        // For qurango streams, try multiple mirror domains
        if (primary.includes('backup.qurango.net')) {
            const path = primary.replace('https://backup.qurango.net', '');
            // Try the primary domain and additional mirrors
            urls.push('https://qurango.net' + path);
            urls.push('https://backup.qurango.net' + path); // ensure it's in the list
        } else if (primary.includes('qurango.net')) {
            const path = primary.replace(/https?:\/\/[^/]+/, '');
            urls.push('https://backup.qurango.net' + path);
        }

        // For radiojar, try alternative subdomains
        if (primary.includes('stream.radiojar.com')) {
            const streamId = primary.replace('https://stream.radiojar.com/', '');
            urls.push('https://n0a.radiojar.com/' + streamId);
            urls.push('https://n0b.radiojar.com/' + streamId);
        }

        // Deduplicate
        return [...new Set(urls)].filter(u => u);
    }

    async function loadRadio() {
        const grid = document.getElementById('radioGrid');
        grid.innerHTML = '<div class="loading-state">جاري تحميل الإذاعات...</div>';
        try {
            const res = await fetch('https://www.mp3quran.net/api/v3/radios?language=ar');
            const data = await res.json();
            radioData = (data.radios || []).map(r => ({
                ...r,
                category: categorizeRadio(r)
            }));

            // Prepend featured stations
            featuredStations.forEach((fs, i) => {
                radioData.unshift({ ...fs, id: `featured-${i}`, isFeatured: true });
            });

            filteredRadioData = radioData;
            renderRadioGrid(filteredRadioData);
            setupRadioSearch();
        } catch (e) {
            // Fallback to the old API
            try {
                const res2 = await fetch('https://data-rosy.vercel.app/radio.json');
                const fallback = await res2.json();
                radioData = (fallback.radios || fallback).map(r => ({ ...r, category: 'quran' }));
                featuredStations.forEach((fs, i) => {
                    radioData.unshift({ ...fs, id: `featured-${i}`, isFeatured: true });
                });
                filteredRadioData = radioData;
                renderRadioGrid(filteredRadioData);
                setupRadioSearch();
            } catch (e2) {
                grid.innerHTML = '<div class="loading-state text-error">تعذر تحميل الإذاعات. تحقق من اتصال الإنترنت.</div>';
            }
        }
    }

    function renderRadioGrid(radios) {
        const grid = document.getElementById('radioGrid');
        grid.innerHTML = '';

        if (radios.length === 0) {
            grid.innerHTML = '<div class="loading-state">لا توجد نتائج</div>';
            return;
        }

        radios.forEach((r, idx) => {
            const card = document.createElement('div');
            card.className = `radio-card glass-card ${r.isFeatured ? 'radio-card--featured' : ''}`;
            card.id = `radio-card-${r.id}`;
            card.style.setProperty('--card-index', Math.min(idx, 20));

            const icon = r.isFeatured && r.countryCode ? `<span class="radio-country-badge">${r.countryCode}</span>` : (r.isFeatured ? `<svg class="radio-icon-svg" viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>` : '');
            const liveTag = r.isFeatured ? '<span class="radio-live-tag">بث مباشر</span>' : '';

            card.innerHTML = `
                <div class="radio-info">
                    ${icon}
                    <div class="radio-title">${r.name || 'إذاعة القرآن'}</div>
                    ${liveTag}
                </div>
                <button class="radio-btn" aria-label="تشغيل الإذاعة">
                    <svg viewBox="0 0 24 24" fill="currentColor" width="20" height="20"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                </button>
            `;
            card.querySelector('.radio-btn').addEventListener('click', () => {
                playRadioStation(r.id, r);
            });
            grid.appendChild(card);
        });
    }

    function setupRadioSearch() {
        const searchEl = document.getElementById('radioSearch');
        if (!searchEl) return;
        let debounceTimer;

        searchEl.addEventListener('input', (e) => {
            clearTimeout(debounceTimer);
            debounceTimer = setTimeout(() => {
                const val = normalizeArabic(e.target.value.trim());
                const activeTab = document.querySelector('[data-radio-cat].active');
                const cat = activeTab ? activeTab.dataset.radioCat : 'all';

                let filtered = radioData;
                if (cat !== 'all') {
                    filtered = filtered.filter(r => r.category === cat || (cat === 'featured' && r.isFeatured));
                }
                if (val) {
                    filtered = filtered.filter(r => normalizeArabic(r.name || '').includes(val));
                }
                renderRadioGrid(filtered);
            }, 250);
        });
    }

    /**
     * Play a radio station with robust retry logic.
     * Tries multiple stream URLs if the primary one fails.
     */
    function playRadioStation(idx, station) {
        window.isRadioMode = true;

        document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('radio-card--playing'));
        const activeCard = document.getElementById(`radio-card-${idx}`);
        if (activeCard) activeCard.classList.add('radio-card--playing');

        audioEl.pause();
        // remove playing styling from surah
        if (playingIndex !== -1) {
            const oldCard = document.getElementById(`surah-card-${playingIndex}`);
            if (oldCard) oldCard.classList.remove('playing');
        }
        playingIndex = -1;

        // Get all possible stream URLs
        const streamUrls = getStreamUrls(station);
        let currentUrlIndex = 0;
        let connectionTimeout = null;
        let hasConnected = false;

        // Show connecting state
        document.getElementById('nowPlayingTitle').textContent = station.name || station.title || 'إذاعة القرآن';
        document.getElementById('nowPlayingReciter').innerHTML = '<span class="live-indicator" style="display:inline-block;width:8px;height:8px;margin-left:6px;"></span> جاري الاتصال...';

        const pb = document.getElementById('progressBarContainer');
        if (pb) pb.style.display = 'none';

        const lc = document.querySelector('.extra-controls');
        if (lc) lc.style.opacity = '0';

        const lb = document.getElementById('playerLiveBadge');
        if (lb) lb.style.display = 'flex';

        // Hide expand hint in radio mode
        const eh = document.querySelector('.expand-hint');
        if (eh) eh.style.display = 'none';

        function tryNextUrl() {
            if (currentUrlIndex >= streamUrls.length) {
                // All URLs failed
                document.getElementById('nowPlayingTitle').textContent = 'تعذر تشغيل الإذاعة';
                document.getElementById('nowPlayingReciter').textContent = 'جرب إذاعة أخرى أو تحقق من الإنترنت';
                updatePlayBtn(false);
                return;
            }

            const url = streamUrls[currentUrlIndex];
            console.log(`[Radio] Trying URL ${currentUrlIndex + 1}/${streamUrls.length}: ${url}`);

            // Clear previous timeout
            if (connectionTimeout) clearTimeout(connectionTimeout);

            // Remove previous event listeners
            audioEl.removeEventListener('playing', onPlaying);
            audioEl.removeEventListener('error', onError);
            audioEl.removeEventListener('stalled', onStalled);

            // Set the source and try to play
            audioEl.src = url;
            audioEl.load();

            // Set connection timeout (12 seconds)
            connectionTimeout = setTimeout(() => {
                if (!hasConnected) {
                    console.warn(`[Radio] Connection timeout for: ${url}`);
                    currentUrlIndex++;
                    tryNextUrl();
                }
            }, 12000);

            // Listen for successful connection
            audioEl.addEventListener('playing', onPlaying);
            audioEl.addEventListener('error', onError);
            audioEl.addEventListener('stalled', onStalled);

            audioEl.play().catch(e => {
                console.warn(`[Radio] Play failed for: ${url}`, e.message);
                // On mobile, autoplay might be blocked — don't retry for autoplay policy
                if (e.name === 'NotAllowedError') {
                    clearTimeout(connectionTimeout);
                    hasConnected = true; // Source is valid, just needs user interaction
                    document.getElementById('nowPlayingReciter').innerHTML = '<span class="live-indicator" style="display:inline-block;width:8px;height:8px;margin-left:6px;"></span> اضغط ▶ للتشغيل';
                    updatePlayBtn(false);
                } else {
                    // Network error — try next URL
                    currentUrlIndex++;
                    tryNextUrl();
                }
            });
        }

        function onPlaying() {
            hasConnected = true;
            if (connectionTimeout) clearTimeout(connectionTimeout);
            document.getElementById('nowPlayingReciter').innerHTML = '<span class="live-indicator" style="display:inline-block;width:8px;height:8px;margin-left:6px;"></span> بث مباشر';
            updatePlayBtn(true);
            console.log('[Radio] ✓ Connected successfully');
        }

        function onError(e) {
            if (hasConnected) return; // Ignore errors after successful connection
            console.warn(`[Radio] Error on URL: ${streamUrls[currentUrlIndex]}`, audioEl.error?.message || '');
            if (connectionTimeout) clearTimeout(connectionTimeout);
            currentUrlIndex++;
            tryNextUrl();
        }

        function onStalled() {
            if (hasConnected) return;
            // Stalled usually means the stream is buffering — give it more time
            console.log('[Radio] Stream stalled, waiting...');
        }

        // Start trying URLs
        tryNextUrl();
    }

    function leaveRadioMode() {
        if (!window.isRadioMode) return;
        window.isRadioMode = false;
        audioEl.pause();
        audioEl.removeAttribute('src');
        audioEl.load(); // Reset the audio element
        updatePlayBtn(false);
        document.querySelectorAll('.radio-card').forEach(c => c.classList.remove('radio-card--playing'));

        const pb = document.getElementById('progressBarContainer');
        if (pb) pb.style.display = 'block';

        const lc = document.querySelector('.extra-controls');
        if (lc) lc.style.opacity = '1';

        const lb = document.getElementById('playerLiveBadge');
        if (lb) lb.style.display = 'none';

        document.getElementById('nowPlayingTitle').textContent = 'جاهز للاستماع';
        document.getElementById('nowPlayingReciter').textContent = 'اختر سورة للبدء';

        // Show expand hint again
        const eh = document.querySelector('.expand-hint');
        if (eh) eh.style.display = 'flex';
    }

    // ==========================================
    // Initialization
    // ==========================================

    // Mini Analytics
    const usageStats = JSON.parse(localStorage.getItem('usage')) || {
        totalSessions: 0,
        mostUsedSection: 'home'
    };
    usageStats.totalSessions++;
    localStorage.setItem('usage', JSON.stringify(usageStats));

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js').catch(console.error);
    }

    loadSurahs();
    loadReciters();
    renderAzkar('morning');
    renderQuotes();

    // Start with saved view
    const savedView = localStorage.getItem('active_view') || 'view-player';
    switchView(savedView);

    // Enhanced Surah Search with debouncing + dropdown suggestions
    const surahSearchInput = document.getElementById('surahSearch');
    const surahSearchContainer = surahSearchInput?.closest('.search-box');
    let surahDropdown = null;

    if (surahSearchContainer) {
        // Create dropdown container
        surahDropdown = document.createElement('div');
        surahDropdown.className = 'search-dropdown';
        surahDropdown.id = 'surahSearchDropdown';
        surahSearchContainer.style.position = 'relative';
        surahSearchContainer.appendChild(surahDropdown);
    }

    const debouncedSurahSearch = debounce(function (val) {
        const normalizedVal = normalizeArabic(val);
        const cards = document.querySelectorAll('.surah-card');
        const matches = [];

        cards.forEach((card, idx) => {
            const nameEl = card.querySelector('.surah-titles');
            const name = nameEl ? normalizeArabic(nameEl.textContent) : '';
            const isMatch = !normalizedVal || name.includes(normalizedVal);
            card.style.display = isMatch ? 'flex' : 'none';
            if (isMatch && normalizedVal && matches.length < 8) {
                const arName = card.querySelector('.surah-name-ar')?.textContent || '';
                const enName = card.querySelector('.surah-name-en')?.textContent || '';
                const num = card.querySelector('.surah-number')?.textContent || '';
                matches.push({ arName, enName, num, idx });
            }
        });

        // Show dropdown suggestions
        if (surahDropdown) {
            if (normalizedVal && matches.length > 0 && matches.length < 20) {
                surahDropdown.innerHTML = matches.map(m =>
                    `<div class="search-dropdown-item" data-idx="${m.idx}">
                        <span class="search-dropdown-num">${m.num}</span>
                        <span class="search-dropdown-name">${m.arName}</span>
                        <span class="search-dropdown-en">${m.enName}</span>
                    </div>`
                ).join('');
                surahDropdown.style.display = 'block';

                // Handle dropdown clicks
                surahDropdown.querySelectorAll('.search-dropdown-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const idx = parseInt(item.dataset.idx);
                        playSurah(idx);
                        surahSearchInput.value = '';
                        surahDropdown.style.display = 'none';
                        cards.forEach(c => c.style.display = 'flex');
                    });
                });
            } else {
                surahDropdown.style.display = 'none';
            }
        }
    }, 200);

    if (surahSearchInput) {
        surahSearchInput.addEventListener('input', (e) => debouncedSurahSearch(e.target.value));
        surahSearchInput.addEventListener('focus', (e) => { if (e.target.value) debouncedSurahSearch(e.target.value); });
        // Close dropdown on click outside
        document.addEventListener('click', (e) => {
            if (surahDropdown && !surahSearchContainer.contains(e.target)) {
                surahDropdown.style.display = 'none';
            }
        });
    }

    // Radio category tab filtering
    const radioTabs = document.querySelectorAll('[data-radio-cat]');
    radioTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            radioTabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            const cat = tab.dataset.radioCat;
            const searchVal = normalizeArabic(document.getElementById('radioSearch')?.value || '');
            let filtered = radioData;
            if (cat !== 'all') {
                filtered = radioData.filter(r => r.category === cat || (cat === 'featured' && r.isFeatured));
            }
            if (searchVal) {
                filtered = filtered.filter(r => normalizeArabic(r.name || '').includes(searchVal));
            }
            renderRadioGrid(filtered);
        });
    });

});
