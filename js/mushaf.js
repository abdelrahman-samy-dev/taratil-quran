/**
 * مصحف تراتيل — Mushaf Image Reader Module
 * Premium offline-first Quran page viewer
 * Powered by: raw.githubusercontent.com/nawafalqari/ayah/main/src/data/images/
 */

(function () {
    'use strict';

    // ─── Constants ────────────────────────────────────────────────────────────
    const TOTAL_PAGES = 604;
    const IMG_BASE = 'https://raw.githubusercontent.com/nawafalqari/ayah/main/src/data/images/';
    const MUSHAF_CACHE = 'mushaf-pages-v1';
    const MAX_CACHE_PAGES = 160;

    // Surah start pages (Uthmani Mushaf, standard 604-page edition)
    const SURAH_PAGES = [
        1,   2,   50,  77,  106, 128, 151, 177, 187, 208,
        221, 235, 249, 255, 267, 274, 282, 293, 305, 312,
        322, 332, 342, 350, 359, 367, 377, 385, 396, 404,
        411, 415, 418, 428, 434, 440, 446, 453, 458, 467,
        477, 483, 489, 496, 499, 502, 507, 511, 515, 518,
        520, 523, 526, 528, 531, 534, 537, 542, 545, 549,
        551, 553, 554, 556, 558, 560, 562, 564, 566, 568,
        570, 572, 574, 575, 577, 578, 580, 582, 583, 585,
        586, 587, 587, 588, 589, 590, 591, 591, 592, 592,
        593, 594, 594, 595, 595, 596, 596, 597, 597, 598,
        598, 599, 599, 600, 600, 601, 601, 602, 602, 603,
        603, 603, 603, 604, 604
    ];

    const SURAH_NAMES = [
        'الفاتحة','البقرة','آل عمران','النساء','المائدة','الأنعام','الأعراف','الأنفال',
        'التوبة','يونس','هود','يوسف','الرعد','إبراهيم','الحجر','النحل','الإسراء',
        'الكهف','مريم','طه','الأنبياء','الحج','المؤمنون','النور','الفرقان','الشعراء',
        'النمل','القصص','العنكبوت','الروم','لقمان','السجدة','الأحزاب','سبأ','فاطر',
        'يس','الصافات','ص','الزمر','غافر','فصلت','الشورى','الزخرف','الدخان',
        'الجاثية','الأحقاف','محمد','الفتح','الحجرات','ق','الذاريات','الطور',
        'النجم','القمر','الرحمن','الواقعة','الحديد','المجادلة','الحشر','الممتحنة',
        'الصف','الجمعة','المنافقون','التغابن','الطلاق','التحريم','الملك','القلم',
        'الحاقة','المعارج','نوح','الجن','المزمل','المدثر','القيامة','الإنسان',
        'المرسلات','النبأ','النازعات','عبس','التكوير','الانفطار','المطففين',
        'الانشقاق','البروج','الطارق','الأعلى','الغاشية','الفجر','البلد','الشمس',
        'الليل','الضحى','الشرح','التين','العلق','القدر','البينة','الزلزلة',
        'العاديات','القارعة','التكاثر','العصر','الهمزة','الفيل','قريش',
        'الماعون','الكوثر','الكافرون','النصر','المسد','الإخلاص','الفلق','الناس'
    ];

    const SURAH_TYPES = [
        'مكية','مدنية','مدنية','مدنية','مدنية','مكية','مكية','مدنية','مدنية',
        'مكية','مكية','مكية','مدنية','مكية','مكية','مكية','مكية','مكية','مكية',
        'مكية','مكية','مدنية','مكية','مدنية','مكية','مكية','مكية','مكية','مكية',
        'مكية','مكية','مكية','مدنية','مكية','مكية','مكية','مكية','مكية','مكية',
        'مكية','مكية','مكية','مكية','مكية','مكية','مكية','مدنية','مدنية','مدنية',
        'مكية','مكية','مكية','مكية','مكية','مدنية','مكية','مدنية','مدنية','مدنية',
        'مدنية','مدنية','مدنية','مدنية','مدنية','مدنية','مكية','مكية','مكية',
        'مكية','مكية','مكية','مكية','مكية','مكية','مدنية','مكية','مكية','مكية',
        'مكية','مكية','مكية','مكية','مكية','مكية','مكية','مكية','مكية','مكية',
        'مكية','مكية','مكية','مكية','مكية','مكية','مدنية','مكية','مكية','مكية',
        'مكية','مكية','مكية','مكية','مكية','مكية','مكية','مكية','مكية','مكية',
        'مكية','مكية','مكية','مكية','مكية'
    ];

    // ─── State ────────────────────────────────────────────────────────────────
    let state = {
        currentPage: parseInt(localStorage.getItem('mushaf_last_page')) || 1,
        viewMode: localStorage.getItem('mushaf_view_mode') || 'vertical', // 'vertical' | 'horizontal'
        nightBrightness: parseFloat(localStorage.getItem('mushaf_night')) || 0,
        controlsHideDelay: parseInt(localStorage.getItem('mushaf_hide_delay')) || 3,
        bookmarks: JSON.parse(localStorage.getItem('mushaf_bookmarks') || '[]'),
        werd: null,
        controlsVisible: true,
        controlsTimer: null,
        isZoomed: false,
        zoomScale: 1,
        zoomOriginX: 0.5,
        zoomOriginY: 0.5,
        imgLoaded: false,
        retryCount: 0,
        touchStartX: 0,
        touchStartY: 0,
        touchStartDist: 0,
        isPinching: false,
    };

    // ─── DOM References ───────────────────────────────────────────────────────
    let el = {};
    let initialized = false;  // ← guard: prevent double-init

    // ─── Init ─────────────────────────────────────────────────────────────────
    function init() {
        if (initialized) return;
        initialized = true;
        el = {
            reader:           document.getElementById('mushafReaderPanel'),
            modeToggleMushaf: document.getElementById('btnModeMushaf'),
            modeToggleTafsir: document.getElementById('btnModeTafsir'),
            tafsirPanel:      document.getElementById('tafsirReader'),
            mushafPanel:      document.getElementById('mushafReaderPanel'),
            pageImg:          document.getElementById('mushafPageImg'),
            skeletonLoader:   document.getElementById('mushafSkeleton'),
            pageIndicator:    document.getElementById('mushafPageIndicator'),
            jumpInput:        document.getElementById('mushafJumpInput'),
            btnPrev:          document.getElementById('mushafBtnPrev'),
            btnNext:          document.getElementById('mushafBtnNext'),
            btnJump:          document.getElementById('mushafBtnJump'),
            surahSelect:      document.getElementById('mushafSurahSelect'),
            surahSearch:      document.getElementById('mushafSurahSearch'),
            surahInfo:        document.getElementById('mushafSurahInfo'),
            btnBookmark:      document.getElementById('mushafBtnBookmark'),
            bookmarksList:    document.getElementById('mushafBookmarksList'),
            werdBar:          document.getElementById('mushafWerdBar'),
            werdFill:         document.getElementById('mushafWerdFill'),
            werdLabel:        document.getElementById('mushafWerdLabel'),
            werdGoalSelect:   document.getElementById('mushafWerdGoal'),
            nightSlider:      document.getElementById('mushafNightSlider'),
            nightOverlay:     document.getElementById('mushafNightOverlay'),
            btnViewMode:      document.getElementById('mushafBtnViewMode'),
            btnFullscreen:    document.getElementById('mushafBtnFullscreen'),
            controlsOverlay:  document.getElementById('mushafControlsOverlay'),
            controlsFooter:   document.getElementById('mushafControlsFooter'),
            continueModal:    document.getElementById('mushafContinueModal'),
            btnContinue:      document.getElementById('mushafBtnContinue'),
            btnStartFresh:    document.getElementById('mushafBtnStartFresh'),
            btnCloseModal:    document.getElementById('mushafBtnCloseModal'),
            hideDelayBtns:    document.querySelectorAll('.mushaf-delay-btn'),
            pageContainer:    document.getElementById('mushafPageContainer'),
            errorMsg:         document.getElementById('mushafErrorMsg'),
            sessionTimer:     document.getElementById('mushafSessionTimer'),
        };

        if (!el.reader) return; // Not in DOM yet

        loadWerd();
        populateSurahDropdown();
        buildBookmarksList();
        syncNightOverlay();
        applyViewMode();

        bindEvents();
        showContinueModal();
    }

    // ─── Mushaf View Mode ─────────────────────────────────────────────────────
    function showMushafMode() {
        el.mushafPanel.style.display = 'flex';
        el.tafsirPanel.style.display = 'none';
        el.modeToggleMushaf.classList.add('active');
        el.modeToggleTafsir.classList.remove('active');
        localStorage.setItem('mushaf_active_mode', 'mushaf');

        // Start reading session timer
        startSessionTimer();

        // Only load page if not already showing one (prevents flash on tab re-entry)
        if (!state.imgLoaded) {
            loadPage(state.currentPage, false);
        }
    }

    function showTafsirMode() {
        el.mushafPanel.style.display = 'none';
        el.tafsirPanel.style.display = 'block';
        el.modeToggleTafsir.classList.add('active');
        el.modeToggleMushaf.classList.remove('active');
        localStorage.setItem('mushaf_active_mode', 'tafsir');
        stopSessionTimer();
    }

    // ─── Page Loading ─────────────────────────────────────────────────────────
    function loadPage(pageNum, withAnimation = true) {
        if (pageNum < 1) pageNum = 1;
        if (pageNum > TOTAL_PAGES) pageNum = TOTAL_PAGES;

        // Don't reload the same page
        if (pageNum === state.currentPage && state.imgLoaded) return;

        const wasLoaded = state.imgLoaded; // was any image shown before?
        state.currentPage = pageNum;
        state.retryCount = 0;
        // Note: do NOT set state.imgLoaded = false here.
        // We keep it true if an image was previously shown so the skeleton stays hidden.

        // Save last read
        localStorage.setItem('mushaf_last_page', pageNum);

        // Update UI indicators
        updatePageIndicator();
        updateSurahInfo();
        updateWerd(pageNum);

        // Show skeleton only on very first load
        showSkeleton(true);
        el.errorMsg.style.display = 'none';

        if (withAnimation && wasLoaded) {
            el.pageContainer.classList.add('page-transition-out');
            setTimeout(() => {
                el.pageContainer.classList.remove('page-transition-out');
                _loadImageSrc(pageNum);
            }, 180);
        } else {
            _loadImageSrc(pageNum);
        }

        // Preload adjacent pages
        setTimeout(() => preloadPages(pageNum), 300);
    }

    function _loadImageSrc(pageNum) {
        const url = IMG_BASE + pageNum + '.jpg';
        const img = el.pageImg;

        // ⚠️ Do NOT set img.src = '' — that causes an immediate flash/blank frame.
        // Instead just dim the existing image slightly while we wait for the new one.
        img.style.opacity = '0.3';

        // Set new src directly — browser handles the transition gracefully
        img.src = url;

        // Also cache in background if Service Worker cache API is available
        if ('caches' in window) {
            caches.match(url).then(hit => {
                if (!hit) _cachePage(url, pageNum);
            }).catch(() => {});
        }
    }

    function _cachePage(url, pageNum) {
        if (!('caches' in window)) return;
        fetch(url, { mode: 'cors' })
            .then(resp => {
                if (!resp.ok) return;
                caches.open(MUSHAF_CACHE).then(cache => {
                    cache.put(url, resp);
                    _enforceCacheLimit();
                });
            })
            .catch(() => {});
    }

    function _enforceCacheLimit() {
        if (!('caches' in window)) return;
        caches.open(MUSHAF_CACHE).then(cache => {
            cache.keys().then(keys => {
                if (keys.length > MAX_CACHE_PAGES) {
                    // Delete oldest entries (LRU approximation: delete first entries)
                    const toDelete = keys.slice(0, keys.length - MAX_CACHE_PAGES);
                    toDelete.forEach(k => cache.delete(k));
                }
            });
        });
    }

    function preloadPages(currentPage) {
        const toPreload = [currentPage + 1, currentPage + 2, currentPage - 1];
        toPreload.forEach(p => {
            if (p < 1 || p > TOTAL_PAGES) return;
            const url = IMG_BASE + p + '.jpg';
            if ('caches' in window) {
                caches.match(url).then(hit => {
                    if (!hit) {
                        fetch(url, { mode: 'cors' })
                            .then(resp => {
                                if (resp.ok) caches.open(MUSHAF_CACHE).then(c => c.put(url, resp));
                            }).catch(() => {});
                    }
                });
            } else {
                const img = new Image();
                img.src = url;
            }
        });
    }

    // ─── Skeleton & Image Events ───────────────────────────────────────────────
    function showSkeleton(show) {
        if (show) {
            // Only show skeleton if there's no image currently displayed
            // (i.e. first ever load). During navigation, keep old image dimmed.
            if (!state.imgLoaded) {
                el.skeletonLoader.style.display = 'flex';
                el.pageImg.style.display = 'none';
            }
            // else: skeleton stays hidden, old image stays dimmed (0.3)
        } else {
            // Hide skeleton, show image
            el.skeletonLoader.style.display = 'none';
            el.pageImg.style.display = 'block';
        }
    }

    function onImageLoad() {
        state.imgLoaded = true;
        state.retryCount = 0;
        showSkeleton(false);
        // Smooth fade-in from the dimmed state (0.3) to full opacity
        requestAnimationFrame(() => {
            el.pageImg.style.transition = 'opacity 0.35s ease';
            el.pageImg.style.opacity = '1';
        });
    }

    function onImageError() {
        if (state.retryCount < 2) {
            state.retryCount++;
            setTimeout(() => _loadImageSrc(state.currentPage), 1200 * state.retryCount);
        } else {
            showSkeleton(false);
            el.pageImg.style.display = 'none';
            el.errorMsg.style.display = 'flex';
        }
    }

    // ─── Navigation ──────────────────────────────────────────────────────────
    function goNext() {
        if (state.currentPage < TOTAL_PAGES) {
            loadPage(state.currentPage + 1);
            resetControlsTimer();
        }
    }

    function goPrev() {
        if (state.currentPage > 1) {
            loadPage(state.currentPage - 1);
            resetControlsTimer();
        }
    }

    function jumpToPage(p) {
        const pg = parseInt(p);
        if (!isNaN(pg) && pg >= 1 && pg <= TOTAL_PAGES) {
            loadPage(pg);
        }
    }

    // ─── Page Indicator & Surah Info ──────────────────────────────────────────
    function updatePageIndicator() {
        el.pageIndicator.textContent = `صفحة ${toArabicNumerals(state.currentPage)} من ${toArabicNumerals(TOTAL_PAGES)}`;
        el.jumpInput.value = state.currentPage;
    }

    function updateSurahInfo() {
        const surahIdx = getSurahAtPage(state.currentPage);
        if (surahIdx === -1) return;
        const name = SURAH_NAMES[surahIdx];
        const type = SURAH_TYPES[surahIdx];
        const startPage = SURAH_PAGES[surahIdx];
        const endPage = surahIdx < 113 ? SURAH_PAGES[surahIdx + 1] - 1 : TOTAL_PAGES;

        el.surahInfo.innerHTML = `
            <span class="mushaf-surah-name">${name}</span>
            <span class="mushaf-surah-badge">${type}</span>
            <span class="mushaf-surah-pages">ص ${toArabicNumerals(startPage)}–${toArabicNumerals(endPage)}</span>
        `;

        // Sync dropdown selection
        const selectedText = document.getElementById('mushafSurahSelectedText');
        if (selectedText) {
            selectedText.textContent = `${surahIdx + 1}. ${name}`;
        }
        
        // Also update selected styling in the options list if it exists
        const optionsList = document.getElementById('mushafSurahOptions');
        if (optionsList) {
            Array.from(optionsList.children).forEach(opt => opt.classList.remove('selected'));
            if (optionsList.children[surahIdx]) {
                optionsList.children[surahIdx].classList.add('selected');
                // Scroll to selected
                if (!optionsList.closest('.prs-menu.show')) {
                    // Only scroll if not currently interacting
                    optionsList.children[surahIdx].scrollIntoView({ block: 'nearest' });
                }
            }
        }
    }

    function getSurahAtPage(page) {
        let found = 0;
        for (let i = 0; i < SURAH_PAGES.length; i++) {
            if (SURAH_PAGES[i] <= page) found = i;
            else break;
        }
        return found;
    }

    // ─── Surah Dropdown ───────────────────────────────────────────────────────
    function populateSurahDropdown() {
        const wrapper = document.getElementById('mushafSurahDropdownWrapper');
        const selectedText = document.getElementById('mushafSurahSelectedText');
        const menu = document.getElementById('mushafSurahMenu');
        const searchInput = document.getElementById('mushafSurahSearchInput');
        const optionsList = document.getElementById('mushafSurahOptions');
        
        if (!wrapper || !optionsList || !menu) return;
        
        let isOpen = false;

        function closeMenu() {
            isOpen = false;
            menu.classList.remove('show');
            wrapper.style.borderColor = '';
            wrapper.style.boxShadow = '';
        }

        function openMenu() {
            isOpen = true;
            menu.classList.add('show');
            wrapper.style.borderColor = 'var(--primary)';
            wrapper.style.boxShadow = '0 0 20px rgba(45, 122, 79, 0.15)';
            searchInput.value = '';
            renderOptions();
            setTimeout(() => searchInput.focus(), 50);
            
            // Scroll to selected if available
            const selectedOpt = optionsList.querySelector('.selected');
            if (selectedOpt) selectedOpt.scrollIntoView({ block: 'nearest' });
        }

        wrapper.addEventListener('click', (e) => {
            if (e.target.closest('.prs-menu')) return;
            if (isOpen) closeMenu();
            else openMenu();
        });

        document.addEventListener('click', (e) => {
            if (isOpen && !wrapper.contains(e.target)) closeMenu();
        });

        function renderOptions(filter = '') {
            optionsList.innerHTML = '';
            const q = normalizeAr(filter);
            const currentSurahIdx = getSurahAtPage(state.currentPage);
            
            SURAH_NAMES.forEach((name, i) => {
                const label = `${i + 1}. ${name}`;
                if (q && !normalizeAr(label).includes(q)) return;
                
                const opt = document.createElement('div');
                opt.className = 'prs-option';
                opt.textContent = label;
                if (i === currentSurahIdx) {
                    opt.classList.add('selected');
                }
                
                opt.addEventListener('click', (e) => {
                    e.stopPropagation();
                    selectedText.textContent = label;
                    closeMenu();
                    loadPage(SURAH_PAGES[i]);
                });
                optionsList.appendChild(opt);
            });
        }

        searchInput.addEventListener('input', () => {
            renderOptions(searchInput.value);
        });
        
        // Render initially
        renderOptions();
    }

    // ─── Bookmarks ────────────────────────────────────────────────────────────
    function addBookmark(label = 'عام') {
        const maxBookmarks = 12;
        const existing = state.bookmarks.findIndex(b => b.page === state.currentPage);
        if (existing !== -1) {
            // Remove if already bookmarked
            state.bookmarks.splice(existing, 1);
            saveBookmarks();
            buildBookmarksList();
            showBookmarkFeedback(false);
            return;
        }
        if (state.bookmarks.length >= maxBookmarks) {
            state.bookmarks.shift(); // Remove oldest
        }
        state.bookmarks.push({
            page: state.currentPage,
            label: label,
            date: new Date().toLocaleDateString('ar-SA')
        });
        saveBookmarks();
        buildBookmarksList();
        showBookmarkFeedback(true);
    }

    function saveBookmarks() {
        localStorage.setItem('mushaf_bookmarks', JSON.stringify(state.bookmarks));
    }

    function buildBookmarksList() {
        if (!el.bookmarksList) return;
        if (state.bookmarks.length === 0) {
            el.bookmarksList.innerHTML = '<p class="mushaf-empty-msg">لا توجد إشارات مرجعية</p>';
            return;
        }
        el.bookmarksList.innerHTML = '';
        [...state.bookmarks].reverse().forEach((bm, i) => {
            const item = document.createElement('div');
            item.className = 'mushaf-bookmark-item';
            item.innerHTML = `
                <div class="mushaf-bm-info" data-page="${bm.page}">
                    <span class="mushaf-bm-label">${bm.label}</span>
                    <span class="mushaf-bm-page">صفحة ${toArabicNumerals(bm.page)}</span>
                    <span class="mushaf-bm-date">${bm.date}</span>
                </div>
                <button class="mushaf-bm-delete" data-page="${bm.page}" aria-label="حذف">✕</button>
            `;
            item.querySelector('.mushaf-bm-info').addEventListener('click', () => {
                loadPage(bm.page);
                closePanels();
            });
            item.querySelector('.mushaf-bm-delete').addEventListener('click', (e) => {
                e.stopPropagation();
                state.bookmarks = state.bookmarks.filter(b => b.page !== bm.page);
                saveBookmarks();
                buildBookmarksList();
            });
            el.bookmarksList.appendChild(item);
        });
    }

    function showBookmarkFeedback(added) {
        el.btnBookmark.classList.toggle('bookmarked', added);
        el.btnBookmark.title = added ? 'إزالة الإشارة' : 'إضافة إشارة';

        const toast = document.createElement('div');
        toast.className = 'mushaf-toast';
        toast.textContent = added ? '🔖 تم حفظ الإشارة' : '🗑️ تم حذف الإشارة';
        el.reader.appendChild(toast);
        setTimeout(() => toast.remove(), 2000);
    }

    // Check if current page is bookmarked
    function syncBookmarkBtn() {
        const isBookmarked = state.bookmarks.some(b => b.page === state.currentPage);
        el.btnBookmark.classList.toggle('bookmarked', isBookmarked);
    }

    // ─── Werd Tracker ─────────────────────────────────────────────────────────
    function getTodayWerdKey() {
        return 'mushaf_werd_' + new Date().toLocaleDateString('en-CA');
    }

    function loadWerd() {
        const saved = JSON.parse(localStorage.getItem(getTodayWerdKey()) || 'null');
        const goal = parseInt(localStorage.getItem('mushaf_werd_goal') || '10');
        state.werd = saved || { goal: goal, pagesRead: [], completed: false };

        if (el.werdGoalSelect) {
            el.werdGoalSelect.value = state.werd.goal;
        }
        updateWerdUI();
    }

    function updateWerd(page) {
        if (!state.werd) return;
        const pageStr = String(page);
        if (!state.werd.pagesRead.includes(pageStr)) {
            state.werd.pagesRead.push(pageStr);
        }
        if (state.werd.pagesRead.length >= state.werd.goal && !state.werd.completed) {
            state.werd.completed = true;
            showWerdCompleted();
        }
        localStorage.setItem(getTodayWerdKey(), JSON.stringify(state.werd));
        updateWerdUI();
        syncBookmarkBtn();
    }

    function updateWerdUI() {
        if (!state.werd || !el.werdFill) return;
        const pct = Math.min(100, (state.werd.pagesRead.length / state.werd.goal) * 100);
        el.werdFill.style.width = pct + '%';
        el.werdFill.style.background = pct >= 100
            ? 'linear-gradient(90deg, #34c759, #30d158)'
            : 'linear-gradient(90deg, var(--primary), var(--accent))';

        if (el.werdLabel) {
            el.werdLabel.textContent = `الورد: ${toArabicNumerals(state.werd.pagesRead.length)} / ${toArabicNumerals(state.werd.goal)} صفحة`;
        }
    }

    function showWerdCompleted() {
        const banner = document.createElement('div');
        banner.className = 'mushaf-werd-complete-banner';
        banner.innerHTML = `
            <span>🌟</span>
            <span>مبروك! أتممت وردك اليوم</span>
            <span>🌟</span>`;
        el.reader.appendChild(banner);
        setTimeout(() => banner.remove(), 4000);
    }

    // ─── Night Mode ───────────────────────────────────────────────────────────
    function syncNightOverlay() {
        if (!el.nightOverlay || !el.nightSlider) return;
        el.nightSlider.value = state.nightBrightness;
        el.nightOverlay.style.opacity = state.nightBrightness;
    }

    // ─── View Mode ────────────────────────────────────────────────────────────
    function applyViewMode() {
        if (!el.pageContainer) return;
        el.pageContainer.dataset.viewMode = state.viewMode;
        if (el.btnViewMode) {
            el.btnViewMode.innerHTML = state.viewMode === 'vertical'
                ? `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="12" y1="3" x2="12" y2="21"/></svg> عمودي`
                : `<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/></svg> أفقي`;
        }
    }

    function toggleViewMode() {
        state.viewMode = state.viewMode === 'vertical' ? 'horizontal' : 'vertical';
        localStorage.setItem('mushaf_view_mode', state.viewMode);
        applyViewMode();
    }

    // ─── Controls Auto-hide ───────────────────────────────────────────────────
    function showControls() {
        state.controlsVisible = true;
        el.controlsOverlay.classList.remove('controls-hidden');
        el.controlsFooter.classList.remove('controls-hidden');
        resetControlsTimer();
    }

    function hideControls() {
        state.controlsVisible = false;
        el.controlsOverlay.classList.add('controls-hidden');
        el.controlsFooter.classList.add('controls-hidden');
    }

    function resetControlsTimer() {
        clearTimeout(state.controlsTimer);
        if (state.controlsHideDelay > 0) {
            state.controlsTimer = setTimeout(hideControls, state.controlsHideDelay * 1000);
        }
    }

    // ─── Zoom (Pinch & Double-tap) ────────────────────────────────────────────
    function applyZoom() {
        const scale = state.zoomScale;
        el.pageImg.style.transform = scale > 1
            ? `scale(${scale})`
            : 'scale(1)';
        el.pageImg.style.transformOrigin = `${state.zoomOriginX * 100}% ${state.zoomOriginY * 100}%`;
    }

    function resetZoom() {
        state.zoomScale = 1;
        state.isZoomed = false;
        applyZoom();
    }

    function handlePinchStart(e) {
        if (e.touches.length !== 2) return;
        state.isPinching = true;
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        state.touchStartDist = Math.hypot(dx, dy);
    }

    function handlePinchMove(e) {
        if (!state.isPinching || e.touches.length !== 2) return;
        e.preventDefault();
        const dx = e.touches[0].clientX - e.touches[1].clientX;
        const dy = e.touches[0].clientY - e.touches[1].clientY;
        const dist = Math.hypot(dx, dy);
        const scale = Math.max(1, Math.min(4, state.zoomScale * (dist / state.touchStartDist)));
        state.touchStartDist = dist;
        state.zoomScale = scale;
        state.isZoomed = scale > 1;
        applyZoom();
    }

    function handlePinchEnd() {
        state.isPinching = false;
        if (state.zoomScale < 1.15) resetZoom();
    }

    // Double-tap to zoom
    let lastTap = 0;
    function handleDoubleTap(e) {
        const now = Date.now();
        if (now - lastTap < 350) {
            if (state.isZoomed) {
                resetZoom();
            } else {
                const rect = el.pageContainer.getBoundingClientRect();
                state.zoomOriginX = (e.clientX - rect.left) / rect.width;
                state.zoomOriginY = (e.clientY - rect.top) / rect.height;
                state.zoomScale = 2.5;
                state.isZoomed = true;
                applyZoom();
            }
            lastTap = 0;
        } else {
            lastTap = now;
        }
    }

    // ─── Swipe Navigation ─────────────────────────────────────────────────────
    function handleTouchStart(e) {
        if (e.touches.length === 2) { handlePinchStart(e); return; }
        state.touchStartX = e.touches[0].clientX;
        state.touchStartY = e.touches[0].clientY;
        handleDoubleTap(e.touches[0]);

        // Controls toggle on single tap (not dragging)
        if (!state.controlsVisible) showControls();
        else resetControlsTimer();
    }

    function handleTouchEnd(e) {
        if (state.isPinching) { handlePinchEnd(); return; }
        if (state.isZoomed) return; // Don't swipe when zoomed

        const dx = e.changedTouches[0].clientX - state.touchStartX;
        const dy = e.changedTouches[0].clientY - state.touchStartY;

        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            if (dx < 0) goNext();   // swipe left → next
            else goPrev();          // swipe right → prev
        }
    }

    // ─── Continue Reading Modal ───────────────────────────────────────────────
    function showContinueModal() {
        const saved = parseInt(localStorage.getItem('mushaf_last_page'));
        if (!saved || saved === 1 || !el.continueModal) return;

        // Only show if we're opening Mushaf reader
        const savedMode = localStorage.getItem('mushaf_active_mode') || 'mushaf';
        if (savedMode !== 'mushaf') return;

        el.continueModal.style.display = 'flex';
        const info = el.continueModal.querySelector('#mushafContinueInfo');
        if (info) info.textContent = `آخر صفحة: ${toArabicNumerals(saved)}`;
    }

    // ─── Session Timer ────────────────────────────────────────────────────────
    let sessionStart = null, sessionInterval = null;
    function startSessionTimer() {
        sessionStart = Date.now();
        clearInterval(sessionInterval);
        sessionInterval = setInterval(() => {
            if (!el.sessionTimer) return;
            const mins = Math.floor((Date.now() - sessionStart) / 60000);
            const secs = Math.floor(((Date.now() - sessionStart) % 60000) / 1000);
            el.sessionTimer.textContent = `⏱ ${toArabicNumerals(mins)}:${secs < 10 ? '٠' : ''}${toArabicNumerals(secs)}`;
        }, 1000);
    }
    function stopSessionTimer() { clearInterval(sessionInterval); }

    // ─── Fullscreen ───────────────────────────────────────────────────────────
    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            el.reader.requestFullscreen?.().catch(() => {});
        } else {
            document.exitFullscreen?.();
        }
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────
    function toArabicNumerals(n) {
        return String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
    }
    function normalizeAr(str) {
        return str.replace(/[أإآ]/g, 'ا').replace(/ة/g, 'ه').toLowerCase();
    }
    function closePanels() {
        document.querySelectorAll('.mushaf-panel-dropdown.open')
            .forEach(p => p.classList.remove('open'));
    }

    // ─── Event Binding ────────────────────────────────────────────────────────
    function bindEvents() {
        // Mode toggle
        el.modeToggleMushaf?.addEventListener('click', showMushafMode);
        el.modeToggleTafsir?.addEventListener('click', showTafsirMode);

        // Page navigation
        // RTL FIX: In Arabic Mushaf, the LEFT button (‹) moves FORWARD (next page = higher number)
        //           and the RIGHT button (›) moves BACKWARD (previous page = lower number).
        el.btnPrev?.addEventListener('click', () => { goNext(); });  // left arrow → next in RTL
        el.btnNext?.addEventListener('click', () => { goPrev(); });  // right arrow → prev in RTL

        el.btnJump?.addEventListener('click', () => jumpToPage(el.jumpInput.value));
        el.jumpInput?.addEventListener('keydown', e => { if (e.key === 'Enter') jumpToPage(el.jumpInput.value); });

        // Keyboard navigation
        document.addEventListener('keydown', e => {
            if (el.mushafPanel.style.display === 'none') return;
            if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); goNext(); }
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); goPrev(); }
            if (e.key === 'f' || e.key === 'F') toggleFullscreen();
        });

        // Image events
        el.pageImg?.addEventListener('load', onImageLoad);
        el.pageImg?.addEventListener('error', onImageError);

        // Touch / Swipe
        el.pageContainer?.addEventListener('touchstart', handleTouchStart, { passive: true });
        el.pageContainer?.addEventListener('touchmove', handlePinchMove, { passive: false });
        el.pageContainer?.addEventListener('touchend', handleTouchEnd, { passive: true });

        // Mouse click to show/hide controls (desktop)
        el.pageContainer?.addEventListener('click', () => {
            if (state.controlsVisible) hideControls();
            else showControls();
        });

        // Bookmark
        el.btnBookmark?.addEventListener('click', (e) => {
            e.stopPropagation();
            addBookmark('عام');
        });

        // Bookmark label buttons
        document.querySelectorAll('.mushaf-bm-label-btn').forEach(btn => {
            btn.addEventListener('click', () => addBookmark(btn.dataset.label));
        });

        // Night mode slider
        el.nightSlider?.addEventListener('input', e => {
            state.nightBrightness = parseFloat(e.target.value);
            el.nightOverlay.style.opacity = state.nightBrightness;
            localStorage.setItem('mushaf_night', state.nightBrightness);
        });

        // View mode toggle
        el.btnViewMode?.addEventListener('click', toggleViewMode);

        // Fullscreen
        el.btnFullscreen?.addEventListener('click', toggleFullscreen);

        // Werd goal select
        el.werdGoalSelect?.addEventListener('change', e => {
            const goal = parseInt(e.target.value);
            state.werd.goal = goal;
            
            // Recalculate completeness
            if (state.werd.pagesRead.length >= goal) {
                if (!state.werd.completed) {
                    state.werd.completed = true;
                    showWerdCompleted();
                }
            } else {
                state.werd.completed = false;
            }
            
            localStorage.setItem('mushaf_werd_goal', goal);
            localStorage.setItem(getTodayWerdKey(), JSON.stringify(state.werd));
            updateWerdUI();
        });

        // Controls hide delay buttons
        el.hideDelayBtns?.forEach(btn => {
            btn.addEventListener('click', () => {
                el.hideDelayBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                state.controlsHideDelay = parseInt(btn.dataset.delay);
                localStorage.setItem('mushaf_hide_delay', state.controlsHideDelay);
                resetControlsTimer();
            });
        });

        // Continue modal
        el.btnContinue?.addEventListener('click', () => {
            el.continueModal.style.display = 'none';
            loadPage(parseInt(localStorage.getItem('mushaf_last_page')) || 1, false);
            showMushafMode();
        });
        el.btnStartFresh?.addEventListener('click', () => {
            el.continueModal.style.display = 'none';
            loadPage(1, false);
            showMushafMode();
        });
        el.btnCloseModal?.addEventListener('click', () => {
            el.continueModal.style.display = 'none';
        });

        // Error retry button
        document.getElementById('mushafBtnRetry')?.addEventListener('click', () => {
            state.retryCount = 0;
            loadPage(state.currentPage, false);
        });

        // Bookmarks panel toggle
        document.getElementById('mushafBtnToggleBookmarks')?.addEventListener('click', (e) => {
            e.stopPropagation();
            const panel = document.getElementById('mushafBookmarksPanel');
            const isOpen = panel?.classList.contains('open');
            document.querySelectorAll('.mushaf-panel-dropdown.open').forEach(p => p.classList.remove('open'));
            if (!isOpen) panel?.classList.add('open');
        });

        // Close panels on outside click
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.mushaf-panel-dropdown')) {
                document.querySelectorAll('.mushaf-panel-dropdown.open').forEach(p => p.classList.remove('open'));
            }
        });

        // Restore active mode on init
        const savedMode = localStorage.getItem('mushaf_active_mode') || 'mushaf';
        if (savedMode === 'tafsir') {
            showTafsirMode();
        } else {
            showMushafMode();
        }

        // Set active hide delay button
        el.hideDelayBtns?.forEach(btn => {
            btn.classList.toggle('active', parseInt(btn.dataset.delay) === state.controlsHideDelay);
        });

        // Mouse movement to show controls
        el.reader?.addEventListener('mousemove', () => {
            if (!state.controlsVisible) showControls();
            resetControlsTimer();
        });
    }

    // ─── Expose jump-to-page for external integration ─────────────────────────
    window.MushafReader = {
        jumpToPage,
        jumpToSurah: (surahNum) => {
            const idx = Math.max(0, Math.min(113, surahNum - 1));
            if (SURAH_PAGES[idx]) loadPage(SURAH_PAGES[idx]);
        },
        getCurrentPage: () => state.currentPage,
        showMushafMode,
        showTafsirMode,
    };

    // ─── Wait for DOM then init ───────────────────────────────────────────────
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        // If tab is activated later, init when tab first viewed
        const targetSection = document.getElementById('view-tafsir');
        if (targetSection) {
            const observer = new MutationObserver(() => {
                if (targetSection.classList.contains('active')) {
                    observer.disconnect();
                    init();
                }
            });
            observer.observe(targetSection, { attributes: true, attributeFilter: ['class'] });

            // Also support direct init if already active
            if (targetSection.classList.contains('active')) init();
        }
    }

})();
