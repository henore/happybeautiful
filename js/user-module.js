// ==========================================
// 利用者機能モジュール（整理版・完全版）
// ==========================================

import { CONFIG, Utils, ValidationUtil } from './config.js';

// カレンダーウィジェットクラス
class CalendarWidget {
    constructor(userModule) {
        this.userModule = userModule;
        this.currentDate = new Date();
        this.selectedDate = null;
    }

    render() {
        return `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="calendar-nav-btn" id="prevMonth">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <h6 class="calendar-title" id="calendarTitle">出退勤、日報履歴</h6>
                    <button class="calendar-nav-btn" id="nextMonth">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div class="calendar-grid" id="calendarGrid">
                    <!-- カレンダーの日付がここに表示される -->
                </div>
            </div>
        `;
    }

    init() {
        this.setupEventListeners();
        this.updateCalendar();
    }

    setupEventListeners() {
        const prevBtn = document.getElementById('prevMonth');
        const nextBtn = document.getElementById('nextMonth');

        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() - 1);
                this.updateCalendar();
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                this.currentDate.setMonth(this.currentDate.getMonth() + 1);
                this.updateCalendar();
            });
        }
    }

    updateCalendar() {
        const titleElement = document.getElementById('calendarTitle');
        const gridElement = document.getElementById('calendarGrid');

        if (!gridElement) return;

        // タイトルは固定なので更新不要
        // titleElement.textContent = this.currentDate.toLocaleDateString('ja-JP', {
        //     year: 'numeric',
        //     month: 'long'
        // });

        // カレンダーグリッド更新
        gridElement.innerHTML = this.generateCalendarHTML();
        this.setupDateClickHandlers();
    }

    generateCalendarHTML() {
        const year = this.currentDate.getFullYear();
        const month = this.currentDate.getMonth();
        const today = new Date();
        
        // 月の最初の日と最後の日
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        
        // カレンダーの開始日（前月の日曜日から）
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());

        let html = '';

        // 曜日ヘッダー
        const dayHeaders = ['日', '月', '火', '水', '木', '金', '土'];
        dayHeaders.forEach(day => {
            html += `<div class="calendar-day-header">${day}</div>`;
        });

        // 日付セル
        const current = new Date(startDate);
        for (let i = 0; i < 42; i++) { // 6週間分
            const isCurrentMonth = current.getMonth() === month;
            const isToday = current.toDateString() === today.toDateString();
            const hasWork = this.hasWorkData(current);
            const hasComment = this.hasStaffComment(current);
            
            let classes = ['calendar-day'];
            if (!isCurrentMonth) classes.push('other-month');
            if (isToday) classes.push('today');
            if (hasWork) classes.push('has-work');
            if (hasComment) classes.push('has-comment');
            if (hasWork && hasComment) classes.push('has-both');

            html += `
                <div class="${classes.join(' ')}" data-date="${current.toDateString()}">
                    <div class="calendar-day-number">${current.getDate()}</div>
                    ${this.generateIndicators(hasWork, hasComment)}
                </div>
            `;

            current.setDate(current.getDate() + 1);
        }

        return html;
    }

    generateIndicators(hasWork, hasComment) {
        if (!hasWork && !hasComment) return '';

        let html = '<div class="calendar-day-indicators">';
        if (hasWork) {
            html += '<span class="calendar-indicator indicator-work" title="出勤記録あり"></span>';
        }
        if (hasComment) {
            html += '<span class="calendar-indicator indicator-comment" title="スタッフコメントあり"></span>';
        }
        html += '</div>';

        return html;
    }

    hasWorkData(date) {
        if (!this.userModule.auth.currentUser) return false;
        
        const dateStr = date.toDateString();
        const attendance = this.userModule.getAttendance(this.userModule.auth.currentUser.id, dateStr);
        return attendance && attendance.clockIn;
    }

    hasStaffComment(date) {
        if (!this.userModule.auth.currentUser) return false;
        
        const dateStr = date.toDateString();
        const comment = this.userModule.getStaffComment(this.userModule.auth.currentUser.id, dateStr);
        return comment && comment.comment;
    }

    setupDateClickHandlers() {
        const dayElements = document.querySelectorAll('.calendar-day:not(.other-month)');
        dayElements.forEach(dayElement => {
            dayElement.addEventListener('click', () => {
                const dateStr = dayElement.getAttribute('data-date');
                this.onDateClick(dateStr);
            });
        });
    }

    onDateClick(dateStr) {
        if (!this.userModule.auth.currentUser) return;

        const attendance = this.userModule.getAttendance(this.userModule.auth.currentUser.id, dateStr);
        const report = this.userModule.getDailyReport(this.userModule.auth.currentUser.id, dateStr);
        const staffComment = this.userModule.getStaffComment(this.userModule.auth.currentUser.id, dateStr);

        if (attendance || report || staffComment) {
            this.showDateDetail(dateStr, attendance, report, staffComment);
        } else {
            this.userModule.system.showNotification('この日の記録はありません', 'info');
        }
    }

    showDateDetail(dateStr, attendance, report, staffComment) {
        const date = new Date(dateStr);
        const formattedDate = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        const modal = document.getElementById('reportDetailModal');
        const title = document.getElementById('reportDetailTitle');
        const content = document.getElementById('reportDetailContent');

        title.innerHTML = `<i class="fas fa-calendar-alt"></i> ${formattedDate}の記録`;

        let html = '<div class="past-report-display">';

        // 出勤情報（コンパクト版）
        if (attendance) {
            html += `
                <div class="past-work-times">
                    <div class="row">
                        <div class="col-6">
                            <div class="past-work-time-label">出勤時間</div>
                            <div class="past-work-time-value">${attendance.clockIn || '-'}</div>
                        </div>
                        <div class="col-6">
                            <div class="past-work-time-label">退勤時間</div>
                            <div class="past-work-time-value">${attendance.clockOut || '-'}</div>
                        </div>
                    </div>
                    ${attendance.workDuration ? `
                        <div class="text-center mt-2">
                            <small class="text-muted">勤務時間: ${attendance.workDuration.toFixed(1)}時間</small>
                            ${attendance.isEarlyLeave ? '<span class="badge bg-warning ms-2">早退</span>' : ''}
                        </div>
                    ` : ''}
                </div>
            `;
        }

        // 日報情報（フォーム風レイアウト）
        if (report) {
            // 作業内容
            if (report.workContent) {
                html += `
                    <div class="past-form-section">
                        <label class="past-form-label">
                            <i class="fas fa-tasks"></i> 作業内容
                        </label>
                        <div class="past-form-textarea">${ValidationUtil.sanitizeInput(report.workContent)}</div>
                    </div>
                `;
            }

            // 健康状態（横並び）
            html += `
                <div class="past-health-grid">
                    <div>
                        <label class="past-form-label">
                            <i class="fas fa-thermometer-half"></i> 体温
                        </label>
                        <div class="past-form-value">${report.temperature}℃</div>
                    </div>
                    <div>
                        <label class="past-form-label">
                            <i class="fas fa-utensils"></i> 食欲
                        </label>
                        <div class="past-form-value">${this.getAppetiteLabel(report.appetite)}</div>
                    </div>
                    <div>
                        <label class="past-form-label">
                            <i class="fas fa-pills"></i> 頓服服用
                        </label>
                        <div class="past-form-value">${report.medicationTime ? report.medicationTime + '時頃' : 'なし'}</div>
                    </div>
                </div>
            `;

            // 睡眠情報（横並び）
            html += `
                <div class="past-sleep-grid">
                    <div>
                        <label class="past-form-label">
                            <i class="fas fa-bed"></i> 就寝時間
                        </label>
                        <div class="past-form-value">${report.bedtime || '-'}</div>
                    </div>
                    <div>
                        <label class="past-form-label">
                            <i class="fas fa-sun"></i> 起床時間
                        </label>
                        <div class="past-form-value">${report.wakeupTime || '-'}</div>
                    </div>
                    <div>
                        <label class="past-form-label">
                            <i class="fas fa-moon"></i> 睡眠状態
                        </label>
                        <div class="past-form-value">${this.getSleepQualityLabel(report.sleepQuality)}</div>
                    </div>
                </div>
            `;

            // 振り返り
            if (report.reflection) {
                html += `
                    <div class="past-form-section">
                        <label class="past-form-label">
                            <i class="fas fa-lightbulb"></i> 振り返り・感想
                        </label>
                        <div class="past-form-textarea">${ValidationUtil.sanitizeInput(report.reflection)}</div>
                    </div>
                `;
            }

            // 面談希望
            if (report.interviewRequest) {
                html += `
                    <div class="past-form-section">
                        <label class="past-form-label">
                            <i class="fas fa-comments"></i> 面談希望
                        </label>
                        <div class="past-form-value text-info">${this.getInterviewRequestLabel(report.interviewRequest)}</div>
                    </div>
                `;
            }
        }

        // スタッフコメント（独立したセクション）
        if (staffComment) {
            html += `
                <div class="staff-comment-display">
                    <div class="staff-comment-title">
                        <i class="fas fa-comments"></i> スタッフコメント
                    </div>
                    <div class="comment-box">
                        ${ValidationUtil.sanitizeInput(staffComment.comment)}
                    </div>
                    <small class="text-muted">
                        <i class="fas fa-clock"></i> ${new Date(staffComment.created_at).toLocaleString('ja-JP')}
                    </small>
                </div>
            `;
        }

        html += '</div>';
        content.innerHTML = html;

        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }

    getAppetiteLabel(value) {
        const labels = {
            'good': 'あり',
            'none': 'なし'
        };
        return labels[value] || value;
    }

    getSleepQualityLabel(value) {
        const labels = {
            'good': '眠れた',
            'poor': 'あまり眠れない',
            'bad': '眠れない'
        };
        return labels[value] || value;
    }

    getInterviewRequestLabel(value) {
        const labels = {
            'consultation': '相談がある',
            'interview': '面談希望'
        };
        return labels[value] || value;
    }
}

export default class UserModule {
    constructor(systemInstance) {
        this.system = systemInstance;
        this.config = CONFIG;
        this.database = systemInstance.database;
        this.auth = systemInstance.auth;
        this.isWorking = false;
        this.currentAttendance = null;
        this.selectedValues = {};
        this.formValidation = new Map();
        this.calendar = new CalendarWidget(this);
    }

    async init() {
        console.log('👤 利用者モジュール初期化開始');
        
        try {
            // 権限チェック
            this.auth.requirePermission('self_report');
            
            // ダッシュボード表示（先に画面を表示）
            this.showUserDashboard();
            
            // 今日の出勤状況読み込み
            this.loadTodayAttendance();
            
            // ログアウトボタン制御
            this.updateLogoutButtonState();
            
            console.log('✅ 利用者モジュール初期化完了');
            
            // 画面表示後にスタッフコメント確認（非同期で実行）
            setTimeout(async () => {
                await this.checkStaffComments();
            }, 500);
            
        } catch (error) {
            console.error('❌ 利用者モジュール初期化エラー:', error);
            this.system.showError('利用者機能の初期化に失敗しました', error);
        }
    }

    // =================================
    // スタッフコメント確認
    // =================================

    async checkStaffComments() {
        const user = this.auth.currentUser;
        
        // 当日既にログインしている場合はスタッフコメント確認不要
        if (this.hasLoggedInToday(user.id)) {
            return;
        }
        
        // 前回出勤日のスタッフコメントを確認
        const lastWorkDate = this.getLastWorkDate(user.id);
        if (lastWorkDate) {
            const staffComment = this.getStaffComment(user.id, lastWorkDate);
            const report = this.getDailyReport(user.id, lastWorkDate);
            const attendance = this.getAttendance(user.id, lastWorkDate);
            
            // スタッフコメントまたは日報がある場合に表示
            if ((staffComment && staffComment.comment) || report) {
                await this.showStaffCommentModal(staffComment, report, attendance, lastWorkDate);
                return;
            }
        }
        
        // スタッフコメントがない場合は当日ログイン済みとしてマーク
        this.markLoggedInToday(user.id);
    }

    showStaffCommentModal(staffComment, report, attendance, date) {
        return new Promise((resolve) => {
            const modalElement = document.getElementById('staffCommentModal');
            const commentsElement = document.getElementById('previousStaffComments');
            
            const formattedDate = new Date(date).toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            });
            
            let html = `<h6><i class="fas fa-calendar"></i> ${formattedDate}の記録</h6>`;
            
            // 前回の日報内容を表示（読み取り専用）
            if (report || attendance) {
                html += '<div class="report-summary mb-4">';
                
                // 勤務時間表示
                if (attendance) {
                    html += `
                        <div class="row mb-3">
                            <div class="col-6">
                                <label class="past-form-label"><i class="fas fa-clock"></i> 出勤時間</label>
                                <div class="past-form-value">${attendance.clockIn || '-'}</div>
                            </div>
                            <div class="col-6">
                                <label class="past-form-label"><i class="fas fa-clock"></i> 退勤時間</label>
                                <div class="past-form-value">${attendance.clockOut || '-'}</div>
                            </div>
                        </div>
                    `;
                }
                
                if (report) {
                    // 作業内容
                    html += `
                        <div class="mb-3">
                            <label class="past-form-label"><i class="fas fa-tasks"></i> 作業内容</label>
                            <div class="text-content">${ValidationUtil.sanitizeInput(report.workContent || '')}</div>
                        </div>
                    `;
                    
                    // 健康状態
                    html += `
                        <div class="row mb-3">
                            <div class="col-4">
                                <label class="past-form-label"><i class="fas fa-thermometer-half"></i> 体温</label>
                                <div class="past-form-value">${report.temperature}℃</div>
                            </div>
                            <div class="col-4">
                                <label class="past-form-label"><i class="fas fa-utensils"></i> 食欲</label>
                                <div class="past-form-value">${this.getAppetiteLabel(report.appetite)}</div>
                            </div>
                            <div class="col-4">
                                <label class="past-form-label"><i class="fas fa-pills"></i> 頓服服用</label>
                                <div class="past-form-value">${report.medicationTime ? report.medicationTime + '時頃' : 'なし'}</div>
                            </div>
                        </div>
                    `;
                    
                    // 睡眠情報
                    html += `
                        <div class="row mb-3">
                            <div class="col-4">
                                <label class="past-form-label"><i class="fas fa-bed"></i> 就寝時間</label>
                                <div class="past-form-value">${report.bedtime || '-'}</div>
                            </div>
                            <div class="col-4">
                                <label class="past-form-label"><i class="fas fa-sun"></i> 起床時間</label>
                                <div class="past-form-value">${report.wakeupTime || '-'}</div>
                            </div>
                            <div class="col-4">
                                <label class="past-form-label"><i class="fas fa-moon"></i> 睡眠状態</label>
                                <div class="past-form-value">${this.getSleepQualityLabel(report.sleepQuality)}</div>
                            </div>
                        </div>
                    `;
                    
                    // 振り返り
                    html += `
                        <div class="mb-3">
                            <label class="past-form-label"><i class="fas fa-lightbulb"></i> 振り返り・感想</label>
                            <div class="text-content">${ValidationUtil.sanitizeInput(report.reflection || '')}</div>
                        </div>
                    `;
                    
                    // 面談希望
                    if (report.interviewRequest) {
                        html += `
                            <div class="mb-3">
                                <label class="past-form-label"><i class="fas fa-comments"></i> 面談希望</label>
                                <div class="past-form-value text-info">${this.getInterviewRequestLabel(report.interviewRequest)}</div>
                            </div>
                        `;
                    }
                }
                
                html += '</div>';
            }
            
            // スタッフコメント表示
            if (staffComment && staffComment.comment) {
                const safeComment = ValidationUtil.sanitizeInput(staffComment.comment);
                
                html += `
                    <div class="staff-comment-display">
                        <div class="staff-comment-title">
                            <i class="fas fa-comments"></i> スタッフからのコメント
                        </div>
                        <div class="comment-box">
                            ${safeComment}
                        </div>
                        <small class="text-muted">
                            <i class="fas fa-clock"></i> ${new Date(staffComment.created_at).toLocaleString('ja-JP')}
                        </small>
                    </div>
                `;
            }
            
            commentsElement.innerHTML = html;
            
            // チェックボックスとボタンをリセット
            const commentReadCheck = document.getElementById('commentReadCheck');
            const commentConfirmBtn = document.getElementById('commentConfirmBtn');
            
            commentReadCheck.checked = false;
            commentConfirmBtn.disabled = true;
            
            // イベントリスナー設定
            const checkHandler = (e) => {
                commentConfirmBtn.disabled = !e.target.checked;
            };
            
            const confirmHandler = () => {
                this.hideStaffCommentModal();
                commentReadCheck.removeEventListener('change', checkHandler);
                commentConfirmBtn.removeEventListener('click', confirmHandler);
                resolve();
            };
            
            commentReadCheck.addEventListener('change', checkHandler);
            commentConfirmBtn.addEventListener('click', confirmHandler);
            
            const modal = new bootstrap.Modal(modalElement);
            modal.show();
        });
    }

    hideStaffCommentModal() {
        const modalElement = document.getElementById('staffCommentModal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        if (modal) {
            modal.hide();
        }
        
        // 当日ログイン済みとしてマーク
        this.markLoggedInToday(this.auth.currentUser.id);
        
        // セキュリティログ記録
        this.database.logSecurityEvent('STAFF_COMMENT_CONFIRMED', {
            userId: this.auth.currentUser.id
        });
    }

    getAppetiteLabel(value) {
        const labels = {
            'good': 'あり',
            'none': 'なし'
        };
        return labels[value] || value;
    }

    getSleepQualityLabel(value) {
        const labels = {
            'good': '眠れた',
            'poor': 'あまり眠れない',
            'bad': '眠れない'
        };
        return labels[value] || value;
    }

    getInterviewRequestLabel(value) {
        const labels = {
            'consultation': '相談がある',
            'interview': '面談希望'
        };
        return labels[value] || value;
    }

    // =================================
    // ダッシュボード表示
    // =================================

    showUserDashboard() {
        const content = document.getElementById('app-content');
        content.innerHTML = this.getUserDashboardHTML();
        
        // イベントリスナー設定
        this.setupUserEventListeners();
        
        // カレンダー初期化
        this.calendar.init();
        
        // 日報フォーム初期化
        this.initReportForm();
    }

    setupUserEventListeners() {
        // 出退勤ボタン
        this.addEventListenerSafe('clockInBtn', 'click', () => this.handleClockIn());
        this.addEventListenerSafe('clockOutBtn', 'click', () => this.handleClockOut());
        
        // 日報フォーム
        const reportForm = document.getElementById('dailyReportForm');
        if (reportForm) {
            reportForm.addEventListener('submit', (e) => this.handleReportSubmit(e));
        }
    }

    addEventListenerSafe(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    loadTodayAttendance() {
        const today = new Date().toDateString();
        const attendance = this.getAttendance(this.auth.currentUser.id, today);
        
        if (attendance) {
            this.currentAttendance = attendance;
            this.isWorking = attendance.clockIn && !attendance.clockOut;
            this.updateUserUI();
            console.log('📅 出勤状況読み込み:', attendance);
        }
    }

    // =================================
    // フォーム初期化
    // =================================

    initReportForm() {
        setTimeout(() => {
            this.initFormElements();
            
            // 既存の日報があれば読み込み
            const today = new Date().toDateString();
            const existingReport = this.getDailyReport(this.auth.currentUser.id, today);
            if (existingReport) {
                this.loadReportData(existingReport);
            }
        }, 100);
    }

    initFormElements() {
        console.log('🔧 フォーム要素初期化開始');
        
        // selectedValues初期化
        this.selectedValues = {};
        this.formValidation.clear();
        
        // 各種セレクトボックスの初期化
        this.createSelectBox('temperatureSelect', this.generateTemperatureOptions(), 'temperature');
        this.createSelectBox('appetiteSelect', [
            { label: '食欲の状態を選択してください', value: '' },
            { label: '食欲あり（普通に食べられる）', value: 'good' },
            { label: '食欲なし（あまり食べられない）', value: 'none' }
        ], 'appetite');
        
        this.createSelectBox('sleepQualitySelect', [
            { label: '睡眠の質を選択してください', value: '' },
            { label: 'よく眠れた', value: 'good' },
            { label: 'あまり眠れなかった', value: 'poor' },
            { label: '眠れなかった', value: 'bad' }
        ], 'sleepQuality');
        
        this.createSelectBox('interviewRequestSelect', [
            { label: '面談の希望はありません', value: '' },
            { label: '相談したいことがある', value: 'consultation' },
            { label: '正式な面談を希望する', value: 'interview' }
        ], 'interviewRequest');
        
        // 時間選択の初期化
        this.initTimeSelectors();
        
        // リアルタイムバリデーション設定
        this.setupFormValidation();
        
        console.log('✅ フォーム要素初期化完了');
    }

    generateTemperatureOptions() {
        const options = [{ label: '体温を選択してください', value: '' }];
        for (let temp = 35.0; temp <= 39.9; temp += 0.1) {
            const tempStr = temp.toFixed(1);
            let label = `${tempStr}℃`;
            
            // 体温の目安を追加
            if (temp < 36.0) {
                label += ' (低体温)';
            } else if (temp >= 36.0 && temp < 37.5) {
                label += ' (平熱)';
            } else if (temp >= 37.5 && temp < 38.0) {
                label += ' (微熱)';
            } else {
                label += ' (発熱)';
            }
            
            options.push({
                label: label,
                value: tempStr
            });
        }
        return options;
    }

    createSelectBox(selectId, options, key) {
        const selectElement = document.getElementById(selectId);
        if (!selectElement) {
            console.error(`❌ ${selectId} が見つかりません`);
            return;
        }
        
        selectElement.innerHTML = '';
        
        options.forEach(option => {
            const optionElement = document.createElement('option');
            optionElement.value = option.value;
            optionElement.textContent = option.label;
            selectElement.appendChild(optionElement);
        });
        
        // 変更イベントリスナー追加
        selectElement.addEventListener('change', (e) => {
            const value = e.target.value;
            this.selectedValues[key] = value;
            this.validateField(key, value);
            console.log(`${key}選択:`, value);
        });
    }

    initTimeSelectors() {
        this.populateTimeSelect('bedtimeHour', 'bedtimeMinute');
        this.populateTimeSelect('wakeupHour', 'wakeupMinute');
        
        // 頓服服用時間
        const medicationSelect = document.getElementById('medicationTime');
        if (medicationSelect) {
            medicationSelect.innerHTML = '<option value="">服用していない</option>';
            for (let i = 0; i < 24; i++) {
                const option = document.createElement('option');
                option.value = i;
                option.textContent = `${i}時頃に服用`;
                medicationSelect.appendChild(option);
            }
        }
    }

    populateTimeSelect(hourId, minuteId) {
        const hourSelect = document.getElementById(hourId);
        const minuteSelect = document.getElementById(minuteId);
        
        if (!hourSelect || !minuteSelect) return;
        
        // 時間選択
        hourSelect.innerHTML = '';
        for (let i = 0; i < 24; i++) {
            const option = document.createElement('option');
            option.value = String(i).padStart(2, '0');
            option.textContent = String(i).padStart(2, '0') + '時';
            hourSelect.appendChild(option);
        }
        
        // 分選択
        minuteSelect.innerHTML = '';
        for (let i = 0; i < 60; i += 15) {
            const option = document.createElement('option');
            option.value = String(i).padStart(2, '0');
            option.textContent = String(i).padStart(2, '0') + '分';
            minuteSelect.appendChild(option);
        }
    }

    // =================================
    // フォームバリデーション
    // =================================

    setupFormValidation() {
        // リアルタイムバリデーション
        const textInputs = ['workContent', 'reflection'];
        textInputs.forEach(inputId => {
            const element = document.getElementById(inputId);
            if (element) {
                element.addEventListener('input', Utils.debounce((e) => {
                    this.validateField(inputId, e.target.value);
                }, 300));
            }
        });
    }

    validateField(fieldName, value) {
        let validation = { valid: true, message: '' };
        
        switch (fieldName) {
            case 'workContent':
            case 'reflection':
                validation = ValidationUtil.validateWorkContent(value);
                break;
            case 'temperature':
                if (value) {
                    validation = ValidationUtil.validateTemperature(value);
                }
                break;
        }
        
        this.formValidation.set(fieldName, validation);
        this.updateFieldValidationUI(fieldName, validation);
        
        return validation.valid;
    }

    updateFieldValidationUI(fieldName, validation) {
        const element = document.getElementById(fieldName) || 
                        document.getElementById(fieldName + 'Select');
        
        if (!element) return;
        
        // バリデーション状態のクラス更新
        element.classList.remove('is-valid', 'is-invalid');
        
        if (!validation.valid) {
            element.classList.add('is-invalid');
            this.showFieldError(fieldName, validation.message);
        } else if (element.value) {
            element.classList.add('is-valid');
            this.clearFieldError(fieldName);
        }
    }

    showFieldError(fieldName, message) {
        let errorElement = document.getElementById(fieldName + '_error');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.id = fieldName + '_error';
            errorElement.className = 'invalid-feedback';
            
            const field = document.getElementById(fieldName) || 
                         document.getElementById(fieldName + 'Select');
            if (field && field.parentNode) {
                field.parentNode.appendChild(errorElement);
            }
        }
        errorElement.textContent = message;
    }

    clearFieldError(fieldName) {
        const errorElement = document.getElementById(fieldName + '_error');
        if (errorElement) {
            errorElement.remove();
        }
    }

    // =================================
    // 出退勤処理
    // =================================

    handleClockIn() {
        console.log('⏰ 出勤処理開始');
        
        try {
            const currentTime = Utils.getCurrentTimeString();
            const adjustedTime = this.adjustClockInTime(currentTime);
            
            const today = new Date().toDateString();
            const attendanceData = {
                clockIn: adjustedTime,
                clockOut: null,
                originalClockIn: currentTime,
                userId: this.auth.currentUser.id,
                sessionId: this.auth.sessionId,
                created_at: new Date().toISOString()
            };
            
            // データ保存
            this.saveAttendance(this.auth.currentUser.id, today, attendanceData);
            
            // セキュリティログ記録
            this.database.logSecurityEvent('CLOCK_IN', {
                userId: this.auth.currentUser.id,
                time: adjustedTime,
                originalTime: currentTime
            });
            
            this.currentAttendance = attendanceData;
            this.isWorking = true;
            this.updateUserUI();
            
            // カレンダー更新
            this.calendar.updateCalendar();
            
            // ログアウトボタン制御
            this.updateLogoutButtonState();
            
            // ページ離脱防止が有効になる（出勤中）
            console.log('📄 ページ離脱防止: 有効（出勤中）');
            
            this.system.showNotification(`出勤しました（${adjustedTime}）`, 'success');
            console.log('✅ 出勤完了:', adjustedTime);
            
        } catch (error) {
            console.error('❌ 出勤エラー:', error);
            this.system.showNotification('出勤処理に失敗しました', 'danger');
        }
    }

    handleClockOut() {
        console.log('⏰ 退勤処理開始');
        
        try {
            if (!this.currentAttendance || !this.currentAttendance.clockIn) {
                throw new Error('出勤記録が見つかりません');
            }
            
            const currentTime = Utils.getCurrentTimeString();
            const adjustedTime = this.adjustClockOutTime(currentTime);
            
            // 勤務時間チェック
            const clockInTime = new Date('1970-01-01 ' + this.currentAttendance.clockIn);
            const clockOutTime = new Date('1970-01-01 ' + adjustedTime);
            const hoursDiff = (clockOutTime - clockInTime) / (1000 * 60 * 60);
            
            if (hoursDiff < this.config.time.minHours) {
                if (!confirm('1時間未満の勤務です。早退として記録されます。よろしいですか？')) {
                    return;
                }
            }
            
            const today = new Date().toDateString();
            const attendanceData = {
                ...this.currentAttendance,
                clockOut: adjustedTime,
                originalClockOut: currentTime,
                isEarlyLeave: hoursDiff < this.config.time.minHours,
                workDuration: hoursDiff,
                updated_at: new Date().toISOString()
            };
            
            // データ保存
            this.saveAttendance(this.auth.currentUser.id, today, attendanceData);
            
            // セキュリティログ記録
            this.database.logSecurityEvent('CLOCK_OUT', {
                userId: this.auth.currentUser.id,
                time: adjustedTime,
                originalTime: currentTime,
                workDuration: hoursDiff
            });
            
            this.currentAttendance = attendanceData;
            this.isWorking = false;
            this.updateUserUI();
            
            // カレンダー更新
            this.calendar.updateCalendar();
            
            // ログアウトボタン制御（退勤後も日報提出まで無効）
            this.updateLogoutButtonState();
            
            // ページ離脱防止が継続（退勤済みだが日報未提出）
            console.log('📄 ページ離脱防止: 継続（日報提出まで）');
            
            this.system.showNotification(`退勤しました（${adjustedTime}）`, 'success');
            console.log('✅ 退勤完了:', adjustedTime);
            
        } catch (error) {
            console.error('❌ 退勤エラー:', error);
            this.system.showNotification('退勤処理に失敗しました', 'danger');
        }
    }

    // =================================
    // 日報処理
    // =================================

    handleReportSubmit(e) {
        e.preventDefault();
        console.log('📝 日報提出開始');
        
        try {
            // フォームデータ収集
            const formData = this.collectFormData();
            
            // バリデーション実行
            const validationResult = this.validateReportData(formData);
            if (!validationResult.valid) {
                this.system.showNotification(validationResult.message, 'warning');
                return;
            }
            
            // データサニタイゼーション
            const sanitizedData = this.sanitizeReportData(formData);
            
            // 日報保存（上書き対応）
            const today = new Date().toDateString();
            const existingReport = this.getDailyReport(this.auth.currentUser.id, today);
            
            if (existingReport) {
                // 既存データがある場合は上書き（更新日時を追加）
                sanitizedData.updated_at = new Date().toISOString();
                sanitizedData.created_at = existingReport.created_at; // 作成日時は保持
                console.log('📝 日報を上書き更新');
            } else {
                console.log('📝 日報を新規作成');
            }
            
            this.saveDailyReport(this.auth.currentUser.id, today, sanitizedData);
            
            // セキュリティログ記録
            this.database.logSecurityEvent('DAILY_REPORT_SUBMIT', {
                userId: this.auth.currentUser.id,
                date: today,
                isUpdate: !!existingReport
            });
            
            this.system.showNotification('日報を提出しました', 'success');
            console.log('✅ 日報提出完了');
            
            // UI更新
            this.updateUserUI();
            
            // カレンダー更新
            this.calendar.updateCalendar();
            
            // ログアウトボタン制御
            this.updateLogoutButtonState();
            
            // ページ離脱防止が解除される（日報提出完了）
            console.log('📄 ページ離脱防止: 解除（日報提出完了）');
            
            // 自動ログアウト確認（1秒後に表示）
            setTimeout(() => {
                this.promptAutoLogout();
            }, 1000);
            
        } catch (error) {
            console.error('❌ 日報エラー:', error);
            this.system.showNotification('日報の提出に失敗しました', 'danger');
        }
    }

    collectFormData() {
        const getValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };
        
        return {
            workContent: getValue('workContent'),
            reflection: getValue('reflection'),
            temperature: getValue('temperatureSelect'),
            appetite: getValue('appetiteSelect'),
            sleepQuality: getValue('sleepQualitySelect'),
            interviewRequest: getValue('interviewRequestSelect'),
            medicationTime: getValue('medicationTime'),
            bedtime: `${getValue('bedtimeHour')}:${getValue('bedtimeMinute')}`,
            wakeupTime: `${getValue('wakeupHour')}:${getValue('wakeupMinute')}`
        };
    }

    validateReportData(data) {
        // 必須フィールドチェック
        const requiredFields = this.config.validation.requiredFields;
        for (const field of requiredFields) {
            if (!data[field]) {
                return { 
                    valid: false, 
                    message: `${this.getFieldDisplayName(field)}は必須です` 
                };
            }
        }
        
        // 個別フィールドバリデーション（勤務時間チェックは削除）
        const validations = [
            ValidationUtil.validateWorkContent(data.workContent),
            ValidationUtil.validateWorkContent(data.reflection),
            ValidationUtil.validateTemperature(data.temperature)
        ];
        
        for (const validation of validations) {
            if (!validation.valid) {
                return validation;
            }
        }
        
        return { valid: true };
    }

    sanitizeReportData(data) {
        const sanitized = {};
        
        for (const [key, value] of Object.entries(data)) {
            if (typeof value === 'string') {
                sanitized[key] = ValidationUtil.sanitizeInput(value);
            } else {
                sanitized[key] = value;
            }
        }
        
        sanitized.created_at = new Date().toISOString();
        sanitized.userId = this.auth.currentUser.id;
        
        return sanitized;
    }

    getFieldDisplayName(field) {
        const names = {
            'workContent': '作業内容',
            'reflection': '振り返り',
            'temperature': '体温',
            'appetite': '食欲',
            'sleepQuality': '睡眠状態'
        };
        return names[field] || field;
    }

    // =================================
    // 時間計算ユーティリティ
    // =================================

    roundUpToInterval(timeStr, intervalMinutes = 15) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        const totalMinutes = hours * 60 + minutes;
        const roundedMinutes = Math.ceil(totalMinutes / intervalMinutes) * intervalMinutes;
        const roundedHours = Math.floor(roundedMinutes / 60);
        const finalMinutes = roundedMinutes % 60;
        
        return `${String(roundedHours).padStart(2, '0')}:${String(finalMinutes).padStart(2, '0')}`;
    }

    adjustClockInTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        // 8:46以前は9:00に設定
        if (hours < 9 || (hours === 8 && minutes <= 46)) {
            return this.config.time.workStart;
        }
        
        return this.roundUpToInterval(timeStr, this.config.time.roundUpMinutes);
    }

    adjustClockOutTime(timeStr) {
        const [hours, minutes] = timeStr.split(':').map(Number);
        
        // 15:30以降は15:45に設定
        if (hours > 15 || (hours === 15 && minutes >= 30)) {
            return this.config.time.workEnd;
        }
        
        return this.roundUpToInterval(timeStr, this.config.time.roundUpMinutes);
    }

    // =================================
    // UI更新
    // =================================

    updateUserUI() {
        const statusDisplay = document.getElementById('statusDisplay');
        const reportSection = document.getElementById('reportSection');
        const statusCard = document.getElementById('attendanceStatus');
        const today = new Date().toDateString();
        const hasReport = this.getDailyReport(this.auth.currentUser.id, today);
        
        // 既存のクラスをクリア
        statusCard.classList.remove('status-working', 'status-completed');
        
        if (this.isWorking) {
            statusDisplay.innerHTML = `
                <p class="mb-3 text-success">
                    <i class="fas fa-play-circle"></i> 出勤中（${this.currentAttendance.clockIn}〜）
                </p>
                <button class="btn btn-clock btn-clock-out" id="clockOutBtn">
                    <i class="fas fa-clock"></i> 退勤
                </button>
            `;
            statusCard.classList.add('status-working');
            reportSection.style.display = 'none';
            
            this.addEventListenerSafe('clockOutBtn', 'click', () => this.handleClockOut());
            
        } else if (this.currentAttendance && this.currentAttendance.clockOut) {
            statusDisplay.innerHTML = `
                <p class="mb-3 text-info">
                    <i class="fas fa-check-circle"></i> 退勤済み（${this.currentAttendance.clockIn}〜${this.currentAttendance.clockOut}）
                </p>
                ${hasReport ? '<p class="text-success"><i class="fas fa-file-check"></i> 日報提出済み</p>' : '<p class="text-warning"><i class="fas fa-edit"></i> 日報提出をお願いします</p>'}
            `;
            statusCard.classList.add('status-completed');
            reportSection.style.display = 'block';
            
            this.updateReportTimes();
            
        } else {
            if (hasReport) {
                statusDisplay.innerHTML = `
                    <p class="mb-3 text-info">
                        <i class="fas fa-edit"></i> 本日は日報編集のみ可能です
                    </p>
                `;
                statusCard.classList.add('status-completed');
                reportSection.style.display = 'block';
            } else {
                statusDisplay.innerHTML = `
                    <p class="mb-3">本日はまだ出勤していません</p>
                    <button class="btn btn-clock btn-clock-in me-2" id="clockInBtn">
                        <i class="fas fa-clock"></i> 出勤
                    </button>
                `;
                reportSection.style.display = 'none';
                
                this.addEventListenerSafe('clockInBtn', 'click', () => this.handleClockIn());
            }
        }
        
        // ログアウトボタン状態更新
        this.updateLogoutButtonState();
    }

    updateReportTimes() {
        const displayClockIn = document.getElementById('displayClockIn');
        const displayClockOut = document.getElementById('displayClockOut');
        
        if (displayClockIn && this.currentAttendance) {
            displayClockIn.textContent = this.currentAttendance.clockIn || '-';
        }
        
        if (displayClockOut && this.currentAttendance) {
            displayClockOut.textContent = this.currentAttendance.clockOut || '-';
        }
    }

    // =================================
    // ログアウト制御
    // =================================
    
    updateLogoutButtonState() {
        const logoutBtn = document.getElementById('logoutBtn');
        if (!logoutBtn) return;
        
        const today = new Date().toDateString();
        const attendance = this.getAttendance(this.auth.currentUser.id, today);
        const hasReport = this.getDailyReport(this.auth.currentUser.id, today);
        
        // 出勤していない場合、または退勤＋日報提出済みの場合はログアウト可能
        if (!attendance || !attendance.clockIn || (attendance.clockOut && hasReport)) {
            logoutBtn.disabled = false;
            logoutBtn.title = '';
            logoutBtn.innerHTML = '<i class="fas fa-sign-out-alt"></i> ログアウト';
        } else {
            // 出勤後、退勤または日報提出が未完了の場合はログアウト不可
            logoutBtn.disabled = true;
            logoutBtn.title = '退勤と日報提出が完了するまでログアウトできません';
            logoutBtn.innerHTML = '<i class="fas fa-lock"></i> ログアウト不可';
            
            // クリック時の警告
            logoutBtn.onclick = (e) => {
                e.preventDefault();
                this.system.showNotification('退勤後、日報提出が完了するとログアウトできます', 'warning');
            };
        }
    }
    
    promptAutoLogout() {
        const result = confirm('お疲れ様でした。ログアウトしますか？\n\n「はい」: ログアウト\n「いいえ」: 継続（日報の再編集が可能）');
        
        if (result) {
            // ログアウト実行
            this.system.showNotification('お疲れ様でした', 'success');
            setTimeout(() => {
                this.system.handleLogout();
            }, 1500);
        } else {
            // 継続の場合、日報再編集モードに
            this.system.showNotification('日報の再編集が可能です', 'info');
        }
    }
    
    canLogout() {
        const today = new Date().toDateString();
        const attendance = this.getAttendance(this.auth.currentUser.id, today);
        const hasReport = this.getDailyReport(this.auth.currentUser.id, today);
        
        // 出勤していない、または退勤＋日報提出済みの場合のみログアウト可能
        return !attendance || !attendance.clockIn || (attendance.clockOut && hasReport);
    }

    saveAttendance(userId, date, data) {
        const key = `attendance_${userId}_${date}`;
        return this.database.set(key, data);
    }

    getAttendance(userId, date) {
        const key = `attendance_${userId}_${date}`;
        return this.database.get(key);
    }

    saveDailyReport(userId, date, report) {
        const key = `report_${userId}_${date}`;
        return this.database.set(key, report);
    }

    getDailyReport(userId, date) {
        const key = `report_${userId}_${date}`;
        return this.database.get(key);
    }

    getStaffComment(userId, date) {
        const key = `staff_comment_${userId}_${date}`;
        return this.database.get(key);
    }

    hasLoggedInToday(userId) {
        const today = new Date().toDateString();
        const loginKey = `login_today_${userId}_${today}`;
        return this.database.get(loginKey);
    }

    markLoggedInToday(userId) {
        const today = new Date().toDateString();
        const loginKey = `login_today_${userId}_${today}`;
        return this.database.set(loginKey, {
            timestamp: new Date().toISOString(),
            sessionId: this.auth.sessionId
        });
    }

    getLastWorkDate(userId) {
        const today = new Date();
        for (let i = 1; i <= 30; i++) {
            const checkDate = new Date(today);
            checkDate.setDate(today.getDate() - i);
            const dateStr = checkDate.toDateString();
            
            const attendance = this.getAttendance(userId, dateStr);
            if (attendance && attendance.clockOut) {
                return dateStr;
            }
        }
        return null;
    }

    loadReportData(report) {
        // 既存データの復元処理
        console.log('📄 既存日報データ読み込み:', report);
        
        try {
            // フォーム要素が存在する場合のみ値を設定
            const elements = {
                'workContent': report.workContent,
                'reflection': report.reflection,
                'temperatureSelect': report.temperature,
                'appetiteSelect': report.appetite,
                'sleepQualitySelect': report.sleepQuality,
                'interviewRequestSelect': report.interviewRequest,
                'medicationTime': report.medicationTime
            };
            
            Object.entries(elements).forEach(([id, value]) => {
                const element = document.getElementById(id);
                if (element && value) {
                    element.value = value;
                }
            });
            
            // 時間の復元
            if (report.bedtime) {
                const [bedHour, bedMinute] = report.bedtime.split(':');
                const bedHourEl = document.getElementById('bedtimeHour');
                const bedMinuteEl = document.getElementById('bedtimeMinute');
                if (bedHourEl) bedHourEl.value = bedHour;
                if (bedMinuteEl) bedMinuteEl.value = bedMinute;
            }
            
            if (report.wakeupTime) {
                const [wakeHour, wakeMinute] = report.wakeupTime.split(':');
                const wakeHourEl = document.getElementById('wakeupHour');
                const wakeMinuteEl = document.getElementById('wakeupMinute');
                if (wakeHourEl) wakeHourEl.value = wakeHour;
                if (wakeMinuteEl) wakeMinuteEl.value = wakeMinute;
            }
            
        } catch (error) {
            console.error('日報データ復元エラー:', error);
        }
    }

    // =================================
    // HTMLテンプレート
    // =================================

    getUserDashboardHTML() {
        const today = new Date().toDateString();
        const hasReport = this.getDailyReport(this.auth.currentUser.id, today);
        const attendance = this.currentAttendance;
        
        return `
            <div class="user-dashboard">
                <!-- 出勤状況カード -->
                <div class="status-card" id="attendanceStatus">
                    <h5><i class="fas fa-user-clock"></i> 出勤状況</h5>
                    <div id="statusDisplay">
                        <p class="mb-3">本日はまだ出勤していません</p>
                        <button class="btn btn-clock btn-clock-in me-2" id="clockInBtn">
                            <i class="fas fa-clock"></i> 出勤
                        </button>
                    </div>
                </div>

                <!-- カレンダー -->
                ${this.calendar.render()}
                
                <!-- 日報セクション -->
                <div id="reportSection" style="display: none;">
                    <div class="custom-card">
                        <div class="report-title">
                            <i class="fas fa-edit"></i> ${ValidationUtil.sanitizeInput(this.auth.currentUser.name)}さんの日報
                        </div>
                        <div class="card-body report-form">
                            <form id="dailyReportForm">
                                <!-- 勤務時間表示 -->
                                <div class="work-times mb-4">
                                    <div class="row">
                                        <div class="col-6">
                                            <div class="work-time-item">
                                                <div class="work-time-label">出勤時間</div>
                                                <div class="work-time-value" id="displayClockIn">${attendance ? attendance.clockIn : '-'}</div>
                                            </div>
                                        </div>
                                        <div class="col-6">
                                            <div class="work-time-item">
                                                <div class="work-time-label">退勤時間</div>
                                                <div class="work-time-value" id="displayClockOut">${attendance && attendance.clockOut ? attendance.clockOut : '-'}</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- 作業内容 -->
                                <div class="row mb-4">
                                    <div class="col-12">
                                        <label for="workContent" class="form-label">
                                            <i class="fas fa-tasks"></i> 作業内容 <span class="text-danger">*</span>
                                        </label>
                                        <textarea class="form-control form-control-lg" id="workContent" rows="2" required 
                                                  maxlength="${CONFIG.validation.maxTextLength}" 
                                                  placeholder="本日の作業内容を入力してください"></textarea>
                                    </div>
                                </div>
                                
                                <!-- 健康状態（Bootstrapグリッド使用） -->
                                <div class="row form-row">
                                    <div class="col-md-4">
                                        <label class="form-label">
                                            <i class="fas fa-thermometer-half"></i> 体温 <span class="text-danger">*</span>
                                        </label>
                                        <select class="form-control form-control-lg" id="temperatureSelect">
                                            <option value="">体温を選択してください</option>
                                        </select>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">
                                            <i class="fas fa-utensils"></i> 食欲 <span class="text-danger">*</span>
                                        </label>
                                        <select class="form-control form-control-lg" id="appetiteSelect">
                                            <option value="">食欲の状態を選択してください</option>
                                        </select>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">
                                            <i class="fas fa-pills"></i> 頓服服用時間
                                        </label>
                                        <select class="form-control form-control-lg" id="medicationTime">
                                            <option value="">服用していない</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- 睡眠情報（Bootstrapグリッド使用） -->
                                <div class="row form-row">
                                    <div class="col-md-4">
                                        <label class="form-label">
                                            <i class="fas fa-bed"></i> 就寝時間 <span class="text-danger">*</span>
                                        </label>
                                        <div class="time-selector">
                                            <select class="time-select" id="bedtimeHour"></select>
                                            <span class="time-separator">:</span>
                                            <select class="time-select" id="bedtimeMinute"></select>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">
                                            <i class="fas fa-sun"></i> 起床時間 <span class="text-danger">*</span>
                                        </label>
                                        <div class="time-selector">
                                            <select class="time-select" id="wakeupHour"></select>
                                            <span class="time-separator">:</span>
                                            <select class="time-select" id="wakeupMinute"></select>
                                        </div>
                                    </div>
                                    <div class="col-md-4">
                                        <label class="form-label">
                                            <i class="fas fa-moon"></i> 睡眠状態 <span class="text-danger">*</span>
                                        </label>
                                        <select class="form-control form-control-lg" id="sleepQualitySelect">
                                            <option value="">睡眠の質を選択してください</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- 振り返り -->
                                <div class="row mb-4">
                                    <div class="col-12">
                                        <label for="reflection" class="form-label">
                                            <i class="fas fa-lightbulb"></i> 振り返り・感想 <span class="text-danger">*</span>
                                        </label>
                                        <textarea class="form-control form-control-lg" id="reflection" rows="4" required 
                                                  maxlength="${CONFIG.validation.maxTextLength}" 
                                                  placeholder="今日の振り返り、気づき、感想などを自由に入力してください"></textarea>
                                    </div>
                                </div>
                                
                                <!-- 面談希望 -->
                                <div class="row mb-4">
                                    <div class="col-md-6 mx-auto">
                                        <label class="form-label">
                                            <i class="fas fa-comments"></i> 面談希望
                                        </label>
                                        <select class="form-control form-control-lg" id="interviewRequestSelect">
                                            <option value="">面談の希望はありません</option>
                                        </select>
                                    </div>
                                </div>
                                
                                <!-- 提出ボタン -->
                                <div class="text-center">
                                    <button type="submit" class="btn btn-success btn-xl px-5 py-3">
                                        <i class="fas fa-paper-plane me-2"></i> 日報を${hasReport ? '更新' : '提出'}する
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // =================================
    // クリーンアップ
    // =================================

    cleanup() {
        console.log('🧹 利用者モジュールクリーンアップ');
        // 必要に応じてイベントリスナーの削除などを行う
    }

    hasUnsavedChanges() {
        // フォームに変更があるかチェック
        const form = document.getElementById('dailyReportForm');
        if (!form) return false;
        
        const inputs = form.querySelectorAll('input, textarea, select');
        for (const input of inputs) {
            if (input.value && input.value.trim() !== '') {
                return true;
            }
        }
        
        return false;
    }
}