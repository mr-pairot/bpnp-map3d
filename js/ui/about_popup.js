/* js/ui/about_popup.js
 * หน้าต่าง "มีอะไรใหม่ & ข้อมูลระบบ" (เปิดจากเมนูมุมล่างซ้าย) — ประวัติอ่านจาก history.json */

async function openAboutModal() {
    if (typeof logUserEvent === 'function') logUserEvent("Open Modal", "เปิด History");
    let modal = document.getElementById('aboutModal');

    if (modal) {
        modal.style.display = 'flex';
        const body = modal.querySelector('.about-body');
        if (body) body.classList.remove('is-visible');
        startPurposeScroll();
    } else {
        const modalHtml = `
        <div id="aboutModal" class="about-modal-overlay">
            <div class="about-modal-content">
                <button class="about-close-btn" onclick="closeAboutModal()">&times;</button>
                <div class="about-header">
                    <div class="about-header-top">
                        <div class="profile-img-container skeleton">
                            <img src="assets/ui/dev-profile.webp" alt="Mr.Pairot" id="devProfileImg"
                                 width="100" height="100" loading="lazy"
                                 onload="this.classList.add('loaded'); this.parentElement.classList.remove('skeleton')"
                                 onerror="this.style.visibility='hidden'; this.parentElement.classList.remove('skeleton')">
                        </div>
                        <div class="dev-info-box">
                            <h2>นายไพโรจน์ หุ่ยปาน</h2>
                            <p class="dev-role">Software Developer</p>
                            <div class="dev-contact-group">
                                <a href="mailto:mr.pairot@gmail.com" class="dev-email">
                                    <i class="fas fa-envelope"></i>
                                    <span>Mr.Pairot@gmail.com</span>
                                </a>
                                <a href="https://line.me/ti/p/~mr.pairot2016" target="_blank" class="dev-line-btn">
                                    <i class="fab fa-line"></i>
                                    <span>ทักไลน์ผู้พัฒนา</span>
                                </a>
                            </div>
                        </div>
                    </div>
                    <div class="dev-purpose-box">
                        <h3><i class="fas fa-info-circle"></i> รายละเอียดและวัตถุประสงค์</h3>
                        <div class="purpose-scroll-container" id="purposeScroll">
                            <p class="purpose-text">
                                <strong>รายละเอียดการพัฒนา:</strong><br>
                                แผนที่ BPNP Map 3D นี้พัฒนาด้วย HTML, CSS, JavaScript และ MapLibre GL JS
                                เพื่อแสดงผลข้อมูลเชิงพื้นที่ (Spatial Data)
                            </p>
                            <p class="purpose-text sm">
                                <strong>วัตถุประสงค์:</strong><br>
                                เพื่อใช้เป็นเครื่องมือสนับสนุนภายในโครงการรถไฟทางคู่ สายบ้านไผ่-หนองพอก<br>
                                ช่วยให้ทีมงานสามารถตรวจสอบพิกัด แปลงที่ดินเวนคืน ติดตามความก้าวหน้างาน
                                และจุดสำคัญต่างๆ ได้อย่างรวดเร็วและแม่นยำ
                            </p>
                            <div class="purpose-cta">
                                <p>
                                    <strong>พบปัญหาการใช้งานและมีข้อแนะนำ:</strong><br>
                                    ทักแชทไลน์แจ้งข้อมูลได้เลย<br>
                                    และยินดีที่ได้ร่วมกันพัฒนางานไปด้วยกันครับ
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="about-body" id="aboutBody">
                    <h3><i class="fas fa-history"></i> ประวัติการพัฒนา</h3>
                    <div id="historyTimeline" class="history-timeline">
                        <div class="loading-history">กำลังโหลดข้อมูล...</div>
                    </div>
                </div>
                <div class="about-footer">BPNP Map 3D &copy; 2025–2026</div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        modal = document.getElementById('aboutModal');
        modal.addEventListener('click', (e) => { if (e.target.id === 'aboutModal') closeAboutModal(); });
        startPurposeScroll();
    }

    await loadHistory();
}

function closeAboutModal() {
    const modal = document.getElementById('aboutModal');
    const body  = document.getElementById('aboutBody');
    if (modal) {
        if (body) body.classList.remove('is-visible');
        setTimeout(() => { modal.style.display = 'none'; }, 300);
    }
}

let purposeScrollRAF;

function startPurposeScroll() {
    const el = document.getElementById('purposeScroll');
    if (!el) return;

    if (purposeScrollRAF) cancelAnimationFrame(purposeScrollRAF);
    el.scrollTop = 0;

    let isPaused = true;
    let currentY = 0;
    const speed  = 0.2;

    if (!el.hasAttribute('data-scroll-init')) {
        el.addEventListener('mouseenter', () => { isPaused = true;  });
        el.addEventListener('mouseleave', () => { isPaused = false; });
        el.addEventListener('touchstart', () => { isPaused = true;  }, { passive: true });
        el.addEventListener('touchend',   () => { isPaused = false; });
        el.setAttribute('data-scroll-init', 'true');
    }

    setTimeout(() => { isPaused = false; }, 1500);

    function step() {
        if (!isPaused) {
            currentY += speed;
            el.scrollTop = currentY;
            if (Math.abs(currentY - el.scrollTop) > speed + 1) currentY = el.scrollTop;
            if (Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight) return;
        }
        purposeScrollRAF = requestAnimationFrame(step);
    }

    purposeScrollRAF = requestAnimationFrame(step);
}

async function loadHistory() {
    try {
        const startTime = Date.now();
        const response  = await fetch('history.json?t=' + Date.now());
        if (!response.ok) throw new Error('Network response was not ok');

        const historyData = await response.json();
        const waitTime    = Math.max(1000 - (Date.now() - startTime), 0);

        setTimeout(() => {
            renderHistory(historyData);
            document.getElementById('aboutBody').classList.add('is-visible');
        }, waitTime);

    } catch (error) {
        console.error('Error loading history:', error);
        document.getElementById('historyTimeline').innerHTML =
            '<p style="color:red; text-align:center; padding:20px;">ไม่สามารถโหลดข้อมูลประวัติได้</p>';
        document.getElementById('aboutBody').classList.add('is-visible');
    }
}

function renderHistory(data) {
    const container = document.getElementById('historyTimeline');
    container.innerHTML = data.map((item, index) => `
        <div class="timeline-item ${index === 0 ? 'latest' : ''}">
            <div class="timeline-marker"></div>
            <div class="timeline-content">
                <div class="timeline-header">
                    <div class="timeline-version">
                        <span class="timeline-version-tag">v${BPNP.escapeHtml(item.version)}</span>
                    </div>
                    <div class="timeline-title-date">
                        <h4 class="timeline-title-text">${BPNP.escapeHtml(item.title)}</h4>
                        <span class="timeline-date">${BPNP.escapeHtml(item.date)}</span>
                    </div>
                </div>
                <ul class="timeline-details">
                    ${(item.details || []).map(d => `<li>${BPNP.escapeHtml(d)}</li>`).join('')}
                </ul>
            </div>
        </div>`).join('');
}

BPNP.ui.openAboutModal  = openAboutModal;
BPNP.ui.closeAboutModal = closeAboutModal;
