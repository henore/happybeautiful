// ==========================================
// スタッフ機能モジュール（完全版・出勤簿機能追加）
// ==========================================

import { CONFIG, Utils, ValidationUtil } from './config.js';

// スタッフ出勤簿カレンダーウィジェットクラス
class StaffAttendanceCalendar {
    constructor(staffModule) {
        this.staffModule = staffModule;
        this.currentDate = new Date();
        this.selectedDate = null;
    }

    render() {
        return `
            <div class="calendar-container">
                <div class="calendar-header">
                    <button class="calendar-nav-btn" id="prevMonthStaff">
                        <i class="fas fa-chevron-left"></i>
                    </button>
                    <h6 class="calendar-title" id="calendarTitleStaff">${this.currentDate.toLocaleDateString('ja-JP', {
                        year: 'numeric',
                        month: 'long'
                    })}</h6>
                    <button class="calendar-nav-btn" id="nextMonthStaff">
                        <i class="fas fa-chevron-right"></i>
                    </button>
                </div>
                <div class="calendar-grid" id="calendarGridStaff">
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
        const prevBtn = document.getElementById('prevMonthStaff');
        const nextBtn = document.getElementById('nextMonthStaff');

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
        const titleElement = document.getElementById('calendarTitleStaff');
        const gridElement = document.getElementById('calendarGridStaff');

        if (!gridElement) return;

        if (titleElement) {
            titleElement.textContent = this.currentDate.toLocaleDateString('ja-JP', {
                year: 'numeric',
                month: 'long'
            });
        }

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
            const attendanceData = this.getAttendanceData(current);
            
            let classes = ['calendar-day'];
            if (!isCurrentMonth) classes.push('other-month');
            if (isToday) classes.push('today');
            
            // 出勤状況による色分け
            if (attendanceData) {
                if (attendanceData.clockOut) {
                    classes.push('has-work'); // 正常勤務完了（緑）
                } else if (attendanceData.clockIn) {
                    classes.push('has-comment'); // 出勤中または未退勤（黄）
                }
            }

            html += `
                <div class="${classes.join(' ')}" data-date="${current.toDateString()}">
                    <div class="calendar-day-number">${current.getDate()}</div>
                    ${this.generateWorkIndicators(attendanceData)}
                </div>
            `;

            current.setDate(current.getDate() + 1);
        }

        return html;
    }

    generateWorkIndicators(attendanceData) {
        if (!attendanceData || !attendanceData.clockIn) return '';

        let html = '<div class="calendar-day-indicators">';
        
        // 出勤マーク
        html += '<span class="calendar-indicator indicator-work" title="出勤記録あり"></span>';
        
        // 休憩マーク
        if (attendanceData.breaks && attendanceData.breaks.length > 0) {
            html += '<span class="calendar-indicator indicator-break" title="休憩記録あり" style="background: #17a2b8;"></span>';
        }
        
        html += '</div>';

        return html;
    }

    getAttendanceData(date) {
        if (!this.staffModule.auth.currentUser) return null;
        
        const dateStr = date.toDateString();
        return this.staffModule.getAttendance(this.staffModule.auth.currentUser.id, dateStr);
    }

    setupDateClickHandlers() {
        const dayElements = document.querySelectorAll('#calendarGridStaff .calendar-day:not(.other-month)');
        dayElements.forEach(dayElement => {
            dayElement.addEventListener('click', () => {
                const dateStr = dayElement.getAttribute('data-date');
                this.onDateClick(dateStr);
            });
        });
    }

    onDateClick(dateStr) {
        if (!this.staffModule.auth.currentUser) return;

        const attendanceData = this.getAttendanceData(new Date(dateStr));
        
        if (attendanceData && attendanceData.clockIn) {
            this.showAttendanceDetail(dateStr, attendanceData);
        } else {
            this.staffModule.system.showNotification('この日の出勤記録はありません', 'info');
        }
    }

    showAttendanceDetail(dateStr, attendanceData) {
        const date = new Date(dateStr);
        const formattedDate = date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });

        // モーダルを動的に作成または既存のものを使用
        let modal = document.getElementById('staffAttendanceDetailModal');
        
        if (!modal) {
            this.createAttendanceDetailModal();
            modal = document.getElementById('staffAttendanceDetailModal');
        }

        const title = document.getElementById('staffAttendanceDetailTitle');
        const content = document.getElementById('staffAttendanceDetailContent');

        title.innerHTML = `<i class="fas fa-calendar-check"></i> ${formattedDate}の出勤記録`;

        let html = '<div class="staff-attendance-detail">';

        // 基本的な出勤情報
        html += `
            <div class="row mb-3">
                <div class="col-6">
                    <div class="detail-section">
                        <h6><i class="fas fa-clock text-success"></i> 出勤時間</h6>
                        <div class="detail-value h4 text-success">${attendanceData.clockIn}</div>
                        ${attendanceData.originalClockIn && attendanceData.originalClockIn !== attendanceData.clockIn ? 
                            `<small class="text-muted">実際: ${attendanceData.originalClockIn}</small>` : ''}
                    </div>
                </div>
                <div class="col-6">
                    <div class="detail-section">
                        <h6><i class="fas fa-clock text-info"></i> 退勤時間</h6>
                        <div class="detail-value h4 ${attendanceData.clockOut ? 'text-info' : 'text-muted'}">${attendanceData.clockOut || '未退勤'}</div>
                        ${attendanceData.originalClockOut && attendanceData.originalClockOut !== attendanceData.clockOut ? 
                            `<small class="text-muted">実際: ${attendanceData.originalClockOut}</small>` : ''}
                    </div>
                </div>
            </div>
        `;

        // 勤務時間計算
        if (attendanceData.clockOut) {
            const workDuration = this.calculateWorkDuration(attendanceData.clockIn, attendanceData.clockOut);
            html += `
                <div class="row mb-3">
                    <div class="col-12">
                        <div class="detail-section bg-light">
                            <h6><i class="fas fa-stopwatch text-primary"></i> 勤務時間</h6>
                            <div class="detail-value h4 text-primary">${workDuration}</div>
                            ${attendanceData.isEarlyLeave ? '<span class="badge bg-warning">早退</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }

        // 休憩記録
        if (attendanceData.breaks && attendanceData.breaks.length > 0) {
            html += `
                <div class="detail-section">
                    <h6><i class="fas fa-coffee text-warning"></i> 休憩記録</h6>
                    <div class="break-records">
            `;
            
            attendanceData.breaks.forEach((breakRecord, index) => {
                const breakDuration = breakRecord.duration || 
                    (breakRecord.end ? this.calculateBreakDuration(breakRecord.start, breakRecord.end) : null);
                
                html += `
                    <div class="break-record-item">
                        <div class="row align-items-center">
                            <div class="col-3">
                                <strong>休憩${index + 1}</strong>
                            </div>
                            <div class="col-3">
                                <small class="text-muted">開始</small><br>
                                <span class="break-record-time">${breakRecord.start}</span>
                            </div>
                            <div class="col-3">
                                <small class="text-muted">終了</small><br>
                                <span class="break-record-time">${breakRecord.end || '未終了'}</span>
                            </div>
                            <div class="col-3">
                                <small class="text-muted">時間</small><br>
                                <span class="break-record-duration">${breakDuration ? breakDuration + '分' : '-'}</span>
                            </div>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
        }

        // セッション情報（管理者向け詳細）
        if (attendanceData.sessionId) {
            html += `
                <div class="detail-section mt-3">
                    <h6><i class="fas fa-info-circle text-secondary"></i> 詳細情報</h6>
                    <div class="row">
                        <div class="col-6">
                            <small class="text-muted">記録日時</small><br>
                            <span>${new Date(attendanceData.created_at).toLocaleString('ja-JP')}</span>
                        </div>
                        ${attendanceData.updated_at ? `
                            <div class="col-6">
                                <small class="text-muted">更新日時</small><br>
                                <span>${new Date(attendanceData.updated_at).toLocaleString('ja-JP')}</span>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        }

        html += '</div>';
        content.innerHTML = html;

        const bootstrapModal = new bootstrap.Modal(modal);
        bootstrapModal.show();
    }

    createAttendanceDetailModal() {
        const modalHTML = `
        <div class="modal fade" id="staffAttendanceDetailModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-primary text-white">
                        <h5 class="modal-title" id="staffAttendanceDetailTitle">
                            <i class="fas fa-calendar-check"></i> 出勤記録詳細
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="staffAttendanceDetailContent">
                        <!-- 出勤記録詳細がここに表示される -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> 閉じる
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    calculateWorkDuration(clockIn, clockOut) {
        try {
            const startTime = new Date(`1970-01-01 ${clockIn}`);
            const endTime = new Date(`1970-01-01 ${clockOut}`);
            const durationMs = endTime - startTime;
            const hours = durationMs / (1000 * 60 * 60);
            
            if (hours > 0) {
                return `${hours.toFixed(1)}時間`;
            }
        } catch (error) {
            console.error('勤務時間計算エラー:', error);
        }
        
        return '計算不可';
    }

    calculateBreakDuration(startTime, endTime) {
        try {
            const start = new Date(`1970-01-01 ${startTime}`);
            const end = new Date(`1970-01-01 ${endTime}`);
            const durationMs = end - start;
            return Math.round(durationMs / (1000 * 60)); // 分単位
        } catch (error) {
            console.error('休憩時間計算エラー:', error);
            return 0;
        }
    }
}

export default class StaffModule {
    constructor(systemInstance) {
        this.system = systemInstance;
        this.config = CONFIG;
        this.database = systemInstance.database;
        this.auth = systemInstance.auth;
        this.isWorking = false;
        this.currentAttendance = null;
        this.commentLocks = new Map(); // コメント記入のバッティング回避用
        this.reportCheckInterval = null; // 日報提出監視用
        this.lastReportCheck = new Map(); // 最後にチェックした日報のタイムスタンプ
        this.dashboardUpdateInterval = null; // ダッシュボード自動更新用
        this.breakCheckInterval = null; // 休憩時間監視用
        this.isOnBreak = false; // 休憩中フラグ
        this.currentBreakStart = null; // 現在の休憩開始時間
        this.attendanceCalendar = new StaffAttendanceCalendar(this); // 出勤簿カレンダー
    }

    async init() {
        console.log('👥 スタッフモジュール初期化開始');
        
        try {
            // 権限チェック
            this.auth.requirePermission('view_reports');
            
            // ダッシュボード表示
            this.showStaffDashboard();
            
            // 今日の出勤状況読み込み
            this.loadTodayAttendance();
            
            // 申し送り事項読み込み
            this.loadHandoverData();
            
            // 日報提出監視開始
            this.startReportNotificationMonitoring();
            
            // ダッシュボード自動更新開始
            this.startDashboardAutoUpdate();
            
            // 休憩状態の復元
            this.loadBreakState();
            
            console.log('✅ スタッフモジュール初期化完了');
            
        } catch (error) {
            console.error('❌ スタッフモジュール初期化エラー:', error);
            this.system.showError('スタッフ機能の初期化に失敗しました', error);
        }
    }

    showStaffDashboard() {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div class="staff-dashboard">
                <!-- スタッフメニュー（画面切り替え） -->
                <div class="staff-menu mb-4">
                    <div class="btn-group w-100" role="group">
                        <button class="btn btn-outline-primary staff-menu-btn active" data-target="attendanceSection">
                            <i class="fas fa-clock"></i> 出退勤
                        </button>
                        <button class="btn btn-outline-primary staff-menu-btn" data-target="dashboardSection">
                            <i class="fas fa-tachometer-alt"></i> ダッシュボード
                        </button>
                        <button class="btn btn-outline-primary staff-menu-btn" data-target="handoverSection">
                            <i class="fas fa-exchange-alt"></i> 申し送り
                        </button>
                        <button class="btn btn-outline-primary staff-menu-btn" data-target="attendanceBookSection">
                            <i class="fas fa-calendar-check"></i> 出勤簿
                        </button>
                    </div>
                </div>

                <!-- 1. 出退勤セクション -->
                <div id="attendanceSection" class="staff-section mb-4">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="status-card">
                                <h5><i class="fas fa-user-clock"></i> スタッフ出勤状況</h5>
                                <div id="staffAttendanceStatus">
                                    <p class="mb-3">本日はまだ出勤していません</p>
                                    <button class="btn btn-clock btn-clock-in" id="staffClockInBtn">
                                        <i class="fas fa-clock"></i> 出勤
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="status-card">
                                <h6><i class="fas fa-coffee"></i> 休憩管理</h6>
                                <div id="breakManagementStatus">
                                    <p class="text-muted">出勤後に休憩機能が利用できます</p>
                                    <button class="btn btn-info" id="breakStartBtn" disabled>
                                        <i class="fas fa-pause"></i> 休憩開始
                                    </button>
                                </div>
                                <div id="breakTimeDisplay" class="mt-2" style="display: none;">
                                    <small class="text-muted">休憩時間: <span id="breakDuration">00:00</span></small>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <!-- 申し送り事項（常時表示） -->
                    <div class="row mt-4">
                        <div class="col-12">
                            <div class="custom-card">
                                <div class="custom-card-header">
                                    <h6><i class="fas fa-exchange-alt"></i> 申し送り事項</h6>
                                    <button class="btn btn-outline-light btn-sm" id="quickRefreshHandoverBtn">
                                        <i class="fas fa-sync"></i> 更新
                                    </button>
                                </div>
                                <div class="card-body">
                                    <div class="mb-3">
                                        <textarea class="form-control" id="quickHandoverContent" rows="9" 
                                                  placeholder="申し送り事項を入力してください..."></textarea>
                                    </div>
                                    <div class="d-flex justify-content-between align-items-center">
                                        <small class="text-muted" id="quickHandoverUpdateInfo">
                                            <i class="fas fa-clock"></i> 最終更新: 未設定
                                        </small>
                                        <div>
                                            <button class="btn btn-outline-secondary btn-sm me-2" data-target="handoverSection" id="editHandoverDetailBtn">
                                                <i class="fas fa-edit"></i> 詳細編集
                                            </button>
                                            <button class="btn btn-primary btn-sm" id="quickUpdateHandoverBtn">
                                                <i class="fas fa-save"></i> 更新
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. ダッシュボードセクション -->
                <div id="dashboardSection" class="staff-section mb-4" style="display: none;">
                    <div class="custom-card">
                        <div class="custom-card-header">
                            <h5><i class="fas fa-users"></i> 利用者出勤状況</h5>
                            <button class="btn btn-outline-light btn-sm" id="refreshDashboardBtn">
                                <i class="fas fa-sync"></i> 更新
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="userStatusList">
                                <!-- 利用者の出勤状況一覧がここに表示される -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. 申し送り事項セクション -->
                <div id="handoverSection" class="staff-section mb-4" style="display: none;">
                    <div class="custom-card">
                        <div class="custom-card-header">
                            <h5><i class="fas fa-exchange-alt"></i> 申し送り事項</h5>
                            <button class="btn btn-outline-light btn-sm" id="refreshHandoverBtn">
                                <i class="fas fa-sync"></i> 更新
                            </button>
                        </div>
                        <div class="card-body">
                            <div class="mb-3">
                                <label for="handoverContent" class="form-label">
                                    <i class="fas fa-info-circle"></i> 申し送り事項（更新は5分間隔、空白にできません）
                                </label>
                                <textarea class="form-control" id="handoverContent" rows="9" 
                                          placeholder="申し送り事項を入力してください..."></textarea>
                            </div>
                            <div class="d-flex justify-content-between align-items-center">
                                <small class="text-muted" id="handoverUpdateInfo">
                                    <i class="fas fa-clock"></i> 最終更新: 未設定
                                </small>
                                <button class="btn btn-primary" id="updateHandoverBtn">
                                    <i class="fas fa-save"></i> 申し送り更新
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. 出勤簿セクション -->
                <div id="attendanceBookSection" class="staff-section mb-4" style="display: none;">
                    <div class="custom-card">
                        <div class="custom-card-header">
                            <h5><i class="fas fa-calendar-check"></i> 出勤簿</h5>
                            <button class="btn btn-outline-light btn-sm" id="refreshAttendanceBookBtn">
                                <i class="fas fa-sync"></i> 更新
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="attendanceCalendarContainer">
                                <!-- 出勤簿カレンダーがここに表示される -->
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // イベントリスナー設定
        this.setupEventListeners();
    }

    setupEventListeners() {
        // メニューボタン（画面切り替え）
        document.querySelectorAll('.staff-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.closest('button').getAttribute('data-target');
                this.switchToSection(targetId);
                
                // ボタンのアクティブ状態を更新
                document.querySelectorAll('.staff-menu-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('button').classList.add('active');
            });
        });
        
        // 出退勤ボタン
        this.addEventListenerSafe('staffClockInBtn', 'click', () => this.handleClockIn());
        this.addEventListenerSafe('staffClockOutBtn', 'click', () => this.handleClockOut());
        
        // 休憩ボタン
        this.addEventListenerSafe('breakStartBtn', 'click', () => this.handleBreakStart());
        this.addEventListenerSafe('breakEndBtn', 'click', () => this.handleBreakEnd());
        
        // 申し送り事項
        this.addEventListenerSafe('updateHandoverBtn', 'click', () => this.updateHandover());
        this.addEventListenerSafe('refreshHandoverBtn', 'click', () => this.refreshHandover());
        
        // クイック申し送り事項（デフォルト画面用）
        this.addEventListenerSafe('quickUpdateHandoverBtn', 'click', () => this.updateHandoverQuick());
        this.addEventListenerSafe('quickRefreshHandoverBtn', 'click', () => this.refreshHandoverQuick());
        this.addEventListenerSafe('editHandoverDetailBtn', 'click', (e) => {
            const targetId = e.target.closest('button').getAttribute('data-target');
            this.switchToSection(targetId);
            // ボタンのアクティブ状態を更新
            document.querySelectorAll('.staff-menu-btn').forEach(b => b.classList.remove('active'));
            document.querySelector('[data-target="handoverSection"]').classList.add('active');
        });
        
        // ダッシュボード更新
        this.addEventListenerSafe('refreshDashboardBtn', 'click', () => this.refreshDashboard());
        
        // 出勤簿更新
        this.addEventListenerSafe('refreshAttendanceBookBtn', 'click', () => this.refreshAttendanceBook());
        
        // 申し送り事項の編集監視
        const handoverTextarea = document.getElementById('handoverContent');
        if (handoverTextarea) {
            handoverTextarea.addEventListener('input', () => {
                this.onHandoverContentChange();
            });
        }
        
        // クイック申し送り事項の編集監視
        const quickHandoverTextarea = document.getElementById('quickHandoverContent');
        if (quickHandoverTextarea) {
            quickHandoverTextarea.addEventListener('input', () => {
                this.onHandoverContentChangeQuick();
            });
        }
    }

    addEventListenerSafe(elementId, event, handler) {
        const element = document.getElementById(elementId);
        if (element) {
            element.addEventListener(event, handler);
        }
    }

    // 画面切り替え機能
    switchToSection(sectionId) {
        // 全てのセクションを非表示
        document.querySelectorAll('.staff-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // 指定されたセクションのみ表示
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            
            // ダッシュボードが選択された場合はデータを更新
            if (sectionId === 'dashboardSection') {
                this.loadDashboardData();
                // ダッシュボード自動更新を再開
                this.startDashboardAutoUpdate();
            } else if (sectionId === 'attendanceBookSection') {
                // 出勤簿が選択された場合はカレンダーを表示
                this.loadAttendanceBook();
                // 他の画面では自動更新を停止
                this.stopDashboardAutoUpdate();
            } else {
                // 他の画面では自動更新を停止
                this.stopDashboardAutoUpdate();
            }
        }
    }

    // =================================
    // 出勤簿機能
    // =================================

    loadAttendanceBook() {
        const container = document.getElementById('attendanceCalendarContainer');
        if (!container) return;
        
        // カレンダーHTML挿入
        container.innerHTML = this.attendanceCalendar.render();
        
        // カレンダー初期化
        this.attendanceCalendar.init();
        
        console.log('📅 出勤簿カレンダー表示完了');
    }

    refreshAttendanceBook() {
        if (this.attendanceCalendar) {
            this.attendanceCalendar.updateCalendar();
            this.system.showNotification('出勤簿を更新しました', 'info');
        }
    }

    // ダッシュボードデータの読み込み
    loadDashboardData() {
        const userStatusContainer = document.getElementById('userStatusList');
        if (!userStatusContainer) return;
        
        userStatusContainer.innerHTML = this.generateUserStatusList();
    }

    // 利用者状況一覧の生成
    generateUserStatusList() {
        // データベースから全ユーザーを取得（利用者のみフィルタ）
        const allUsers = this.getAllUsers();
        console.log('全ユーザー:', allUsers);
        
        const users = allUsers.filter(user => user.role === 'user' && !user.isRetired);
        console.log('利用者のみ:', users);
        
        const today = new Date().toDateString();
        let html = '';
        
        users.forEach(user => {
            const userData = this.getUserData(user.id, user.name, today);
            html += this.generateUserStatusRow(userData);
        });
        
        return html || '<p class="text-muted text-center">利用者データがありません</p>';
    }

    // 利用者データの取得
    getUserData(userId, userName, date) {
        const attendance = this.getAttendance(userId, date);
        const report = this.getDailyReport(userId, date);
        
        // ユーザーの詳細情報を取得
        const users = this.getAllUsers();
        const userInfo = users.find(u => u.id === userId);
        
        let status = '未出勤';
        let statusClass = 'bg-secondary';
        let statusIcon = 'fa-minus-circle';
        
        if (attendance && attendance.clockIn) {
            if (attendance.clockOut) {
                status = '退勤済み';
                statusClass = 'bg-info';
                statusIcon = 'fa-check-circle';
            } else {
                status = '出勤中';
                statusClass = 'bg-success';
                statusIcon = 'fa-play-circle';
            }
        }
        
        return {
            id: userId,
            name: userName,
            serviceType: userInfo ? userInfo.serviceType : null,
            status: status,
            statusClass: statusClass,
            statusIcon: statusIcon,
            clockIn: attendance ? attendance.clockIn : null,
            clockOut: attendance ? attendance.clockOut : null,
            hasReport: !!report,
            workDuration: this.calculateWorkDuration(attendance)
        };
    }

    // 利用者状況行の生成
    generateUserStatusRow(userData) {
        const reportBadge = userData.hasReport 
            ? '<span class="badge bg-success"><i class="fas fa-file-check"></i> 提出済み</span>'
            : '<span class="badge bg-warning"><i class="fas fa-file-times"></i> 未提出</span>';
        
        const workDurationText = userData.workDuration 
            ? `<br><small class="text-muted">勤務時間: ${userData.workDuration}</small>`
            : '';
            
        // サービス区分の表示
        const serviceTypeText = userData.serviceType 
            ? `<small class="text-muted"> (${this.getServiceTypeDisplayName(userData.serviceType)})</small>`
            : '';

        // スタッフコメントの状態確認
        const hasComment = this.hasStaffComment(userData.id);
        
        // コメント状態のバッジとボタンの設定
        let commentBadge = '';
        let commentBtnText = '';
        let commentBtnClass = '';
        let rowClass = '';
        
        if (userData.hasReport) {
            if (hasComment) {
                commentBadge = '<span class="badge bg-info ms-2"><i class="fas fa-comment-check"></i> コメント済み</span>';
                commentBtnText = 'コメント編集';
                commentBtnClass = 'btn-outline-info';
            } else {
                commentBadge = '<span class="badge bg-danger ms-2"><i class="fas fa-comment-exclamation"></i> コメント未記入</span>';
                commentBtnText = 'コメント記入';
                commentBtnClass = 'btn-outline-primary';
                rowClass = 'border-warning';
            }
        }
        
        return `
            <div class="user-status-row mb-3 p-3 border rounded ${rowClass}">
                <div class="row align-items-center">
                    <div class="col-md-3">
                        <div class="d-flex align-items-center">
                            <span class="badge ${userData.statusClass} me-2">
                                <i class="fas ${userData.statusIcon}"></i>
                            </span>
                            <div>
                                <h6 class="mb-0">${userData.name}</h6>
                                <small class="text-muted">${userData.status}${serviceTypeText}</small>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-2 text-center">
                        <div class="time-display">
                            <i class="fas fa-clock text-success"></i>
                            <div class="fw-bold">${userData.clockIn || '-'}</div>
                            <small class="text-muted">出勤</small>
                        </div>
                    </div>
                    <div class="col-md-2 text-center">
                        <div class="time-display">
                            <i class="fas fa-clock text-info"></i>
                            <div class="fw-bold">${userData.clockOut || '-'}</div>
                            <small class="text-muted">退勤</small>
                        </div>
                    </div>
                    <div class="col-md-3 text-center">
                        ${reportBadge}
                        ${commentBadge}
                        ${workDurationText}
                    </div>
                    <div class="col-md-2 text-end">
                        <button class="btn ${commentBtnClass} btn-sm" 
                                onclick="window.attendanceSystem.currentModule.openStaffCommentModal('${userData.id}', '${userData.name}')"
                                ${!userData.hasReport ? 'disabled title="日報提出後にコメント可能"' : ''}>
                            <i class="fas fa-comment"></i> ${commentBtnText}
                        </button>
                    </div>
                </div>
            </div>
        `;
    }

    // 勤務時間の計算
    calculateWorkDuration(attendance) {
        if (!attendance || !attendance.clockIn || !attendance.clockOut) {
            return null;
        }
        
        try {
            const clockIn = new Date('1970-01-01 ' + attendance.clockIn);
            const clockOut = new Date('1970-01-01 ' + attendance.clockOut);
            const durationMs = clockOut - clockIn;
            const hours = durationMs / (1000 * 60 * 60);
            
            if (hours > 0) {
                return `${hours.toFixed(1)}時間`;
            }
        } catch (error) {
            console.error('勤務時間計算エラー:', error);
        }
        
        return null;
    }

    // ダッシュボードの更新
    refreshDashboard() {
        this.loadDashboardData();
        this.system.showNotification('ダッシュボードを更新しました', 'info');
    }

    // 日報データの取得
    getDailyReport(userId, date) {
        const key = `report_${userId}_${date}`;
        return this.database.get(key);
    }

    // スタッフコメントの存在確認
    hasStaffComment(userId) {
        const today = new Date().toDateString();
        const comment = this.getStaffComment(userId, today);
        return comment && comment.comment;
    }

    // スタッフコメントの取得
    getStaffComment(userId, date) {
        const key = `staff_comment_${userId}_${date}`;
        return this.database.get(key);
    }

    // スタッフコメントの保存
    saveStaffComment(userId, date, commentData) {
        const key = `staff_comment_${userId}_${date}`;
        return this.database.set(key, commentData);
    }

    // スタッフコメントモーダルを開く
    openStaffCommentModal(userId, userName) {
        const today = new Date().toDateString();
        const report = this.getDailyReport(userId, today);
        
        if (!report) {
            this.system.showNotification('この利用者の日報がまだ提出されていません', 'warning');
            return;
        }

        // コメント記入のバッティング回避チェック
        if (this.isCommentLocked(userId)) {
            const lockInfo = this.commentLocks.get(userId);
            this.system.showNotification(
                `他のスタッフ（${lockInfo.staffName}）がコメントを編集中です`, 
                'warning'
            );
            return;
        }

        // コメントロックを設定
        this.setCommentLock(userId);

        // モーダルの内容を生成
        const modalContent = this.generateStaffCommentModalContent(userId, userName, report, today);
        
        // HTMLのモーダルに内容を設定
        const modalElement = document.getElementById('staffCommentInputModal');
        
        // モーダルが存在しない場合は動的に作成
        if (!modalElement) {
            this.createStaffCommentInputModal();
        }
        
        const actualModalElement = document.getElementById('staffCommentInputModal');
        const actualTitleElement = document.getElementById('staffCommentInputModalTitle');
        const actualContentElement = document.getElementById('staffCommentInputModalContent');
        
        actualTitleElement.innerHTML = `<i class="fas fa-comment-plus"></i> ${userName}さんの日報にコメント記入`;
        actualContentElement.innerHTML = modalContent;

        // モーダル表示
        const modal = new bootstrap.Modal(actualModalElement);
        modal.show();

        // モーダル閉じた時のクリーンアップ
        actualModalElement.addEventListener('hidden.bs.modal', () => {
            this.removeCommentLock(userId);
        }, { once: true });

        // 保存ボタンのイベントリスナー
        const saveBtn = document.getElementById('saveStaffCommentInputBtn');
        if (saveBtn) {
            saveBtn.onclick = () => this.saveStaffCommentFromModal(userId, userName, modal);
        }

        // 文字数カウント機能
        setTimeout(() => {
            const commentTextarea = document.getElementById('staffCommentInputText');
            const charCountElement = document.getElementById('commentInputCharCount');
            
            if (commentTextarea && charCountElement) {
                commentTextarea.addEventListener('input', () => {
                    const length = commentTextarea.value.length;
                    charCountElement.textContent = length;
                    
                    // 文字数制限の視覚的フィードバック
                    if (length > 450) {
                        charCountElement.style.color = '#dc3545';
                    } else if (length > 400) {
                        charCountElement.style.color = '#ffc107';
                    } else {
                        charCountElement.style.color = '#6c757d';
                    }
                });
            }
        }, 100);
    }

    // スタッフコメント入力用モーダルを動的に作成
    createStaffCommentInputModal() {
        const modalHTML = `
        <div class="modal fade" id="staffCommentInputModal" tabindex="-1">
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header bg-info text-white">
                        <h5 class="modal-title" id="staffCommentInputModalTitle">
                            <i class="fas fa-comment-plus"></i> 日報にコメント記入
                        </h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body" id="staffCommentInputModalContent">
                        <!-- 動的にコンテンツが挿入される -->
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                            <i class="fas fa-times"></i> キャンセル
                        </button>
                        <button type="button" class="btn btn-primary" id="saveStaffCommentInputBtn">
                            <i class="fas fa-save"></i> 保存
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
        
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // スタッフコメントモーダルの内容生成
    generateStaffCommentModalContent(userId, userName, report, date) {
        const attendance = this.getAttendance(userId, date);
        const existingComment = this.getStaffComment(userId, date);
        
        // 既存コメントの編集権限チェック
        const canEdit = !existingComment || 
                       existingComment.staffId === this.auth.currentUser.id;
        
        const editWarning = !canEdit ? 
            `<div class="alert alert-warning">
                <i class="fas fa-lock"></i> このコメントは${existingComment.staffName}さんが記入したため、編集できません。
            </div>` : '';

        // 既存コメントから自動追記された署名を除去して表示
        let displayComment = '';
        if (existingComment && existingComment.comment) {
            const signature = `（記入者：${existingComment.staffName}）`;
            displayComment = existingComment.comment.replace(new RegExp('\n\n' + signature.replace(/[()]/g, '\\$&') + '$'), '');
        }

        return `
            <!-- 日報内容表示（読み取り専用） -->
            <div class="report-summary mb-4">
                <h6><i class="fas fa-file-alt"></i> ${userName}さんの日報内容</h6>
                
                <!-- 勤務時間表示 -->
                <div class="row mb-3">
                    <div class="col-6">
                        <label class="past-form-label"><i class="fas fa-clock"></i> 出勤時間</label>
                        <div class="past-form-value">${attendance ? attendance.clockIn : '-'}</div>
                    </div>
                    <div class="col-6">
                        <label class="past-form-label"><i class="fas fa-clock"></i> 退勤時間</label>
                        <div class="past-form-value">${attendance ? attendance.clockOut : '-'}</div>
                    </div>
                </div>

                <!-- 作業内容 -->
                <div class="mb-3">
                    <label class="past-form-label"><i class="fas fa-tasks"></i> 作業内容</label>
                    <div class="text-content">${ValidationUtil.sanitizeInput(report.workContent)}</div>
                </div>

                <!-- 健康状態 -->
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

                <!-- 睡眠情報 -->
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

                <!-- 振り返り -->
                <div class="mb-3">
                    <label class="past-form-label"><i class="fas fa-lightbulb"></i> 振り返り・感想</label>
                    <div class="text-content">${ValidationUtil.sanitizeInput(report.reflection)}</div>
                </div>

                <!-- 面談希望 -->
                ${report.interviewRequest ? `
                    <div class="mb-3">
                        <label class="past-form-label"><i class="fas fa-comments"></i> 面談希望</label>
                        <div class="past-form-value text-info">${this.getInterviewRequestLabel(report.interviewRequest)}</div>
                    </div>
                ` : ''}
            </div>

            <hr>

            <!-- スタッフコメント記入欄 -->
            <div class="staff-comment-section">
                <h6><i class="fas fa-comment-plus"></i> スタッフコメント</h6>
                ${editWarning}
                
                <div class="mb-3">
                    <textarea class="form-control" id="staffCommentInputText" rows="4" 
                              placeholder="利用者への返信、アドバイス、気づいた点などを記入してください..."
                              ${!canEdit ? 'readonly' : ''}
                              maxlength="500">${displayComment}</textarea>
                    <div class="comment-char-count">
                        <small class="text-muted">
                            <span id="commentInputCharCount">${displayComment.length}</span>/500文字
                        </small>
                    </div>
                </div>

                ${existingComment ? `
                    <div class="existing-comment-info">
                        <small class="text-muted">
                            <i class="fas fa-info-circle"></i> 
                            記入者: ${existingComment.staffName} | 
                            ${existingComment.updated_at ? '最終更新' : '記入日時'}: 
                            ${new Date(existingComment.updated_at || existingComment.created_at).toLocaleString('ja-JP')}
                        </small>
                    </div>
                ` : ''}
            </div>
        `;
    }

    // ラベル変換関数
    getAppetiteLabel(value) {
        const labels = { 'good': 'あり', 'none': 'なし' };
        return labels[value] || value;
    }

    getSleepQualityLabel(value) {
        const labels = { 'good': '眠れた', 'poor': 'あまり眠れない', 'bad': '眠れない' };
        return labels[value] || value;
    }

    getInterviewRequestLabel(value) {
        const labels = { 'consultation': '相談がある', 'interview': '面談希望' };
        return labels[value] || value;
    }

    // コメントロック管理
    isCommentLocked(userId) {
        const lock = this.commentLocks.get(userId);
        if (!lock) return false;
        
        // 自分のロックは除外
        if (lock.staffId === this.auth.currentUser.id) return false;
        
        // 5分経過したロックは自動解除
        const fiveMinutes = 5 * 60 * 1000;
        if (Date.now() - lock.timestamp > fiveMinutes) {
            this.commentLocks.delete(userId);
            return false;
        }
        
        return true;
    }

    setCommentLock(userId) {
        this.commentLocks.set(userId, {
            staffId: this.auth.currentUser.id,
            staffName: this.auth.currentUser.name,
            timestamp: Date.now()
        });
    }

    removeCommentLock(userId) {
        const lock = this.commentLocks.get(userId);
        if (lock && lock.staffId === this.auth.currentUser.id) {
            this.commentLocks.delete(userId);
        }
    }

    // スタッフコメント保存
    saveStaffCommentFromModal(userId, userName, modal) {
        try {
            const textarea = document.getElementById('staffCommentInputText');
            const comment = textarea ? textarea.value.trim() : '';
            
            if (!comment) {
                this.system.showNotification('コメントを入力してください', 'warning');
                return;
            }

            // コメント内容の最後にスタッフ名を自動追記
            const staffSignature = `（記入者：${this.auth.currentUser.name}）`;
            let finalComment = comment;
            
            // 既に同じスタッフの署名がある場合は重複を避ける
            if (!comment.includes(staffSignature)) {
                finalComment = comment + '\n\n' + staffSignature;
            }

            const today = new Date().toDateString();
            const existingComment = this.getStaffComment(userId, today);
            
            const commentData = {
                comment: ValidationUtil.sanitizeInput(finalComment),
                staffId: this.auth.currentUser.id,
                staffName: this.auth.currentUser.name,
                userId: userId,
                userName: userName,
                created_at: existingComment ? existingComment.created_at : new Date().toISOString(),
                updated_at: existingComment ? new Date().toISOString() : undefined
            };

            this.saveStaffComment(userId, today, commentData);
            
            // セキュリティログ記録
            this.database.logSecurityEvent('STAFF_COMMENT_SAVED', {
                userId: userId,
                staffId: this.auth.currentUser.id,
                isUpdate: !!existingComment,
                commentLength: finalComment.length
            });

            this.system.showNotification(
                `${userName}さんの日報にコメントを${existingComment ? '更新' : '記入'}しました`, 
                'success'
            );

            // モーダルを閉じる
            modal.hide();
            
            // ダッシュボード更新
            this.loadDashboardData();

        } catch (error) {
            console.error('スタッフコメント保存エラー:', error);
            this.system.showNotification('コメントの保存に失敗しました', 'danger');
        }
    }

    // 申し送り事項関連
    loadHandoverData() {
        try {
            const handoverData = this.getHandoverData();
            
            // 詳細画面のテキストエリア
            const textarea = document.getElementById('handoverContent');
            const updateInfo = document.getElementById('handoverUpdateInfo');
            
            // クイック画面のテキストエリア
            const quickTextarea = document.getElementById('quickHandoverContent');
            const quickUpdateInfo = document.getElementById('quickHandoverUpdateInfo');
            
            if (handoverData) {
                // 両方のテキストエリアに同じ内容を設定
                if (textarea) textarea.value = handoverData.content || '';
                if (quickTextarea) quickTextarea.value = handoverData.content || '';
                
                // 更新情報も両方に設定
                const updateText = handoverData.lastUpdated ? 
                    `<i class="fas fa-clock"></i> 最終更新: ${new Date(handoverData.lastUpdated).toLocaleString('ja-JP')}${handoverData.updatedBy ? ` (${handoverData.updatedBy})` : ''}` :
                    '<i class="fas fa-clock"></i> 最終更新: 未設定';
                
                if (updateInfo) updateInfo.innerHTML = updateText;
                if (quickUpdateInfo) quickUpdateInfo.innerHTML = updateText;
            }
        } catch (error) {
            console.error('申し送り事項読み込みエラー:', error);
        }
    }

    updateHandover() {
        try {
            const textarea = document.getElementById('handoverContent');
            const content = textarea ? textarea.value.trim() : '';
            
            // 完全削除チェック（部分削除はOK）
            if (!content) {
                this.system.showNotification('申し送り事項を完全に削除することはできません', 'warning');
                // 既存の内容を復元
                this.loadHandoverData();
                return;
            }
            
            // 5分間隔制限チェック
            const lastUpdate = this.getLastHandoverUpdate();
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdate;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (timeSinceLastUpdate < fiveMinutes) {
                const remainingSeconds = Math.ceil((fiveMinutes - timeSinceLastUpdate) / 1000);
                const remainingMinutes = Math.ceil(remainingSeconds / 60);
                this.system.showNotification(
                    `申し送り事項の更新は${remainingMinutes}分後に可能です`, 
                    'warning'
                );
                return;
            }
            
            // 日時とスタッフ名を追記
            const updateTimestamp = new Date().toLocaleString('ja-JP');
            const updateNote = `（${updateTimestamp} ${this.auth.currentUser.name}更新）`;
            const finalContent = content + ' ' + updateNote;
            
            const handoverData = {
                content: finalContent, // sanitizeInputを削除
                lastUpdated: new Date().toISOString(),
                updatedBy: this.auth.currentUser.name,
                userId: this.auth.currentUser.id
            };
            
            this.saveHandoverData(handoverData);
            this.setLastHandoverUpdate(now);
            
            // UI更新
            this.loadHandoverData();
            
            this.system.showNotification('申し送り事項を更新しました', 'success');
            
            // セキュリティログ記録
            this.database.logSecurityEvent('HANDOVER_UPDATED', {
                userId: this.auth.currentUser.id,
                contentLength: finalContent.length
            });
            
        } catch (error) {
            console.error('申し送り更新エラー:', error);
            this.system.showNotification('申し送り事項の更新に失敗しました', 'danger');
        }
    }

    refreshHandover() {
        this.loadHandoverData();
        this.system.showNotification('申し送り事項を更新しました', 'info');
    }

    // クイック申し送り機能（デフォルト画面用）
    updateHandoverQuick() {
        try {
            const textarea = document.getElementById('quickHandoverContent');
            const content = textarea ? textarea.value.trim() : '';
            
            // 完全削除チェック（部分削除はOK）
            if (!content) {
                this.system.showNotification('申し送り事項を完全に削除することはできません', 'warning');
                // 既存の内容を復元
                this.loadHandoverData();
                return;
            }
            
            // 5分間隔制限チェック
            const lastUpdate = this.getLastHandoverUpdate();
            const now = Date.now();
            const timeSinceLastUpdate = now - lastUpdate;
            const fiveMinutes = 5 * 60 * 1000;
            
            if (timeSinceLastUpdate < fiveMinutes) {
                const remainingSeconds = Math.ceil((fiveMinutes - timeSinceLastUpdate) / 1000);
                const remainingMinutes = Math.ceil(remainingSeconds / 60);
                this.system.showNotification(
                    `申し送り事項の更新は${remainingMinutes}分後に可能です`, 
                    'warning'
                );
                return;
            }
            
            // 日時とスタッフ名を追記
            const updateTimestamp = new Date().toLocaleString('ja-JP');
            const updateNote = `（${updateTimestamp} ${this.auth.currentUser.name}更新）`;
            const finalContent = content + ' ' + updateNote;
            
            const handoverData = {
                content: finalContent, // sanitizeInputを削除
                lastUpdated: new Date().toISOString(),
                updatedBy: this.auth.currentUser.name,
                userId: this.auth.currentUser.id
            };
            
            this.saveHandoverData(handoverData);
            this.setLastHandoverUpdate(now);
            
            // UI更新
            this.loadHandoverData();
            
            this.system.showNotification('申し送り事項を更新しました', 'success');
            
            // セキュリティログ記録
            this.database.logSecurityEvent('HANDOVER_UPDATED', {
                userId: this.auth.currentUser.id,
                contentLength: finalContent.length,
                source: 'quick_edit'
            });
            
        } catch (error) {
            console.error('クイック申し送り更新エラー:', error);
            this.system.showNotification('申し送り事項の更新に失敗しました', 'danger');
        }
    }

    refreshHandoverQuick() {
        this.loadHandoverData();
        this.system.showNotification('申し送り事項を更新しました', 'info');
    }

    onHandoverContentChange() {
        const textarea = document.getElementById('handoverContent');
        const updateBtn = document.getElementById('updateHandoverBtn');
        
        if (textarea && updateBtn) {
            const hasContent = textarea.value.trim().length > 0;
            const isChanged = this.isHandoverContentChanged(textarea.value.trim());
            
            // ボタンの状態更新
            if (hasContent && isChanged) {
                updateBtn.classList.remove('btn-primary');
                updateBtn.classList.add('btn-warning');
                updateBtn.innerHTML = '<i class="fas fa-save"></i> 変更を保存';
            } else {
                updateBtn.classList.remove('btn-warning');
                updateBtn.classList.add('btn-primary');
                updateBtn.innerHTML = '<i class="fas fa-save"></i> 申し送り更新';
            }
        }
    }

    onHandoverContentChangeQuick() {
        const textarea = document.getElementById('quickHandoverContent');
        const updateBtn = document.getElementById('quickUpdateHandoverBtn');
        
        if (textarea && updateBtn) {
            const hasContent = textarea.value.trim().length > 0;
            const isChanged = this.isHandoverContentChanged(textarea.value.trim());
            
            // ボタンの状態更新
            if (hasContent && isChanged) {
                updateBtn.classList.remove('btn-primary');
                updateBtn.classList.add('btn-warning');
                updateBtn.innerHTML = '<i class="fas fa-save"></i> 変更を保存';
            } else {
                updateBtn.classList.remove('btn-warning');
                updateBtn.classList.add('btn-primary');
                updateBtn.innerHTML = '<i class="fas fa-save"></i> 更新';
            }
        }
    }

    isHandoverContentChanged(currentContent) {
        const handoverData = this.getHandoverData();
        const originalContent = handoverData ? handoverData.content || '' : '';
        return currentContent !== originalContent;
    }

    getHandoverData() {
        return this.database.get('handover_data') || { 
            content: '', 
            lastUpdated: new Date().toISOString() 
        };
    }

    saveHandoverData(data) {
        return this.database.set('handover_data', data);
    }

    getLastHandoverUpdate() {
        return this.database.get('last_handover_update') || 0;
    }

    setLastHandoverUpdate(timestamp) {
        return this.database.set('last_handover_update', timestamp);
    }

    // 出退勤関連
    loadTodayAttendance() {
        const today = new Date().toDateString();
        const attendance = this.getAttendance(this.auth.currentUser.id, today);
        
        if (attendance) {
            this.currentAttendance = attendance;
            this.isWorking = attendance.clockIn && !attendance.clockOut;
            
            // 休憩状態の復元
            if (attendance.breaks) {
                const openBreak = attendance.breaks.find(breakRecord => !breakRecord.end);
                if (openBreak) {
                    this.isOnBreak = true;
                    this.currentBreakStart = openBreak.start;
                    this.startBreakTimeMonitoring();
                }
            }
            
            this.updateAttendanceUI();
            console.log('📅 スタッフ出勤状況読み込み:', attendance);
        }
    }

    updateAttendanceUI() {
        const statusElement = document.getElementById('staffAttendanceStatus');
        const breakElement = document.getElementById('breakManagementStatus');
        if (!statusElement) return;

        if (this.isWorking) {
            statusElement.innerHTML = `
                <p class="mb-3 text-success">
                    <i class="fas fa-play-circle"></i> 出勤中（${this.currentAttendance.clockIn}〜）
                </p>
                <button class="btn btn-clock btn-clock-out" id="staffClockOutBtn">
                    <i class="fas fa-clock"></i> 退勤
                </button>
            `;
            this.addEventListenerSafe('staffClockOutBtn', 'click', () => this.handleClockOut());
            
            // 休憩ボタンを有効化
            this.updateBreakUI();
        } else if (this.currentAttendance && this.currentAttendance.clockOut) {
            statusElement.innerHTML = `
                <p class="mb-3 text-info">
                    <i class="fas fa-check-circle"></i> 退勤済み（${this.currentAttendance.clockIn}〜${this.currentAttendance.clockOut}）
                </p>
            `;
            
            // 休憩ボタンを無効化
            if (breakElement) {
                breakElement.innerHTML = `
                    <p class="text-muted">退勤済みです</p>
                    <button class="btn btn-info" disabled>
                        <i class="fas fa-pause"></i> 休憩開始
                    </button>
                `;
            }
        }
    }

    updateBreakUI() {
        const breakElement = document.getElementById('breakManagementStatus');
        const breakDisplay = document.getElementById('breakTimeDisplay');
        if (!breakElement) return;

        // 1日1回の制限チェック
        const hasUsedBreakToday = this.hasUsedBreakToday();

        if (this.isOnBreak) {
            breakElement.innerHTML = `
                <p class="mb-3 text-warning">
                    <i class="fas fa-pause-circle"></i> 休憩中（${this.currentBreakStart}〜）
                </p>
                <button class="btn btn-warning" id="breakEndBtn">
                    <i class="fas fa-play"></i> 休憩終了
                </button>
            `;
            if (breakDisplay) breakDisplay.style.display = 'block';
            this.addEventListenerSafe('breakEndBtn', 'click', () => this.handleBreakEnd());
        } else if (hasUsedBreakToday) {
            breakElement.innerHTML = `
                <p class="text-muted">本日の休憩は既に利用済みです（1日1回まで）</p>
                <button class="btn btn-info" disabled>
                    <i class="fas fa-pause"></i> 休憩済み
                </button>
            `;
            if (breakDisplay) breakDisplay.style.display = 'none';
        } else {
            breakElement.innerHTML = `
                <p class="text-muted">休憩時間を記録できます（1日1回、最大60分）</p>
                <button class="btn btn-info" id="breakStartBtn">
                    <i class="fas fa-pause"></i> 休憩開始
                </button>
            `;
            if (breakDisplay) breakDisplay.style.display = 'none';
            this.addEventListenerSafe('breakStartBtn', 'click', () => this.handleBreakStart());
        }
    }

    handleClockIn() {
        const currentTime = Utils.getCurrentTimeString();
        const today = new Date().toDateString();
        
        const attendanceData = {
            clockIn: currentTime,
            clockOut: null,
            userId: this.auth.currentUser.id,
            sessionId: this.auth.sessionId,
            created_at: new Date().toISOString(),
            breaks: [] // 休憩記録を初期化
        };
        
        this.saveAttendance(this.auth.currentUser.id, today, attendanceData);
        this.currentAttendance = attendanceData;
        this.isWorking = true;
        this.updateAttendanceUI();
        
        this.system.showNotification(`出勤しました（${currentTime}）`, 'success');
    }

    handleClockOut() {
        if (!this.currentAttendance || !this.currentAttendance.clockIn) {
            this.system.showNotification('出勤記録が見つかりません', 'danger');
            return;
        }

        // 休憩中の場合は退勤不可
        if (this.isOnBreak) {
            this.system.showNotification('休憩中です。休憩を終了してから退勤してください', 'warning');
            return;
        }

        // 未終了の休憩がある場合は警告
        const hasOpenBreak = this.hasOpenBreak();
        if (hasOpenBreak) {
            if (!confirm('未終了の休憩記録があります。このまま退勤しますか？')) {
                return;
            }
            // 未終了の休憩を自動終了
            this.forceEndCurrentBreak();
        }

        // コメント義務チェック
        const uncommentedReports = this.checkUncommentedReports();
        if (uncommentedReports.length > 0) {
            const userNames = uncommentedReports.map(report => report.userName).join('、');
            const confirmMessage = `以下の利用者の日報にまだコメントが記入されていません：\n${userNames}\n\nコメント記入は必須です。このまま退勤しますか？`;
            
            if (!confirm(confirmMessage)) {
                this.system.showNotification('日報へのコメント記入を完了してから退勤してください', 'warning');
                return;
            }
        }
        
        const currentTime = Utils.getCurrentTimeString();
        const today = new Date().toDateString();
        
        const attendanceData = {
            ...this.currentAttendance,
            clockOut: currentTime,
            updated_at: new Date().toISOString()
        };
        
        this.saveAttendance(this.auth.currentUser.id, today, attendanceData);
        this.currentAttendance = attendanceData;
        this.isWorking = false;
        this.isOnBreak = false;
        this.currentBreakStart = null;
        this.stopBreakTimeMonitoring();
        this.updateAttendanceUI();
        
        this.system.showNotification(`退勤しました（${currentTime}）`, 'success');
    }

    // 未コメントの日報をチェック
    checkUncommentedReports() {
        const today = new Date().toDateString();
        // データベースから全ユーザーを取得（利用者のみフィルタ）
        const users = this.getAllUsers()
            .filter(user => user.role === 'user' && !user.isRetired);
        
        const uncommentedReports = [];
        
        users.forEach(user => {
            const report = this.getDailyReport(user.id, today);
            const comment = this.getStaffComment(user.id, today);
            
            // 日報は提出済みだがコメントが未記入の場合
            if (report && (!comment || !comment.comment)) {
                uncommentedReports.push({
                    userId: user.id,
                    userName: user.name
                });
            }
        });
        
        return uncommentedReports;
    }

    saveAttendance(userId, date, data) {
        const key = `attendance_${userId}_${date}`;
        return this.database.set(key, data);
    }

    getAttendance(userId, date) {
        const key = `attendance_${userId}_${date}`;
        return this.database.get(key);
    }

    // 日報提出通知機能
    startReportNotificationMonitoring() {
        // 現在の日報状況を初期化
        this.initializeReportCheckBaseline();
        
        // 30秒ごとに日報の変更をチェック
        this.reportCheckInterval = setInterval(() => {
            this.checkForNewReports();
        }, 30000);
        
        console.log('📋 日報提出監視を開始しました');
    }

    // 日報監視停止
    stopReportNotificationMonitoring() {
        if (this.reportCheckInterval) {
            clearInterval(this.reportCheckInterval);
            this.reportCheckInterval = null;
        }
    }

    // 日報チェックのベースライン初期化
    initializeReportCheckBaseline() {
        const today = new Date().toDateString();
        // データベースから全ユーザーを取得（利用者のみフィルタ）
        const users = this.getAllUsers()
            .filter(user => user.role === 'user' && !user.isRetired);
        
        users.forEach(user => {
            const report = this.getDailyReport(user.id, today);
            if (report && report.created_at) {
                this.lastReportCheck.set(user.id, report.created_at);
            }
        });
    }

    // 新しい日報の提出をチェック
    checkForNewReports() {
        const today = new Date().toDateString();
        // データベースから全ユーザーを取得（利用者のみフィルタ）
        const users = this.getAllUsers()
            .filter(user => user.role === 'user' && !user.isRetired);
        
        users.forEach(user => {
            const report = this.getDailyReport(user.id, today);
            if (report && report.created_at) {
                const lastChecked = this.lastReportCheck.get(user.id);
                
                // 新しい日報が提出された場合
                if (!lastChecked || report.created_at !== lastChecked) {
                    this.showReportSubmissionNotification(user.name);
                    this.lastReportCheck.set(user.id, report.created_at);
                    
                    // ダッシュボードが表示されている場合は更新
                    const dashboardSection = document.getElementById('dashboardSection');
                    if (dashboardSection && dashboardSection.style.display !== 'none') {
                        this.loadDashboardData();
                    }
                }
            }
        });
    }

    // 日報提出通知の表示
    showReportSubmissionNotification(userName) {
        try {
            // Windows標準音を再生
            this.playWindowsNotificationSound();
            
            // ポップアップ通知を表示
            this.system.showNotification(
                `📋 ${userName}さんの日報が提出されました！`, 
                'info', 
                5000 // 5秒間表示
            );
            
            // セキュリティログ記録
            this.database.logSecurityEvent('REPORT_SUBMISSION_NOTIFIED', {
                userName: userName,
                notifiedStaff: this.auth.currentUser.id,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error('日報提出通知エラー:', error);
        }
    }

    // Windows標準音の再生
    playWindowsNotificationSound() {
        try {
            // Web Audio APIを使用してWindows標準音風の音を生成
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            
            // シンプルなビープ音を生成（Windows通知音風）
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // 周波数設定（Windows通知音風）
            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(600, audioContext.currentTime + 0.1);
            
            // 音量設定
            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);
            
            // 音の再生
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
            
        } catch (error) {
            console.error('通知音再生エラー:', error);
            // フォールバック: ブラウザのbeep音
            try {
                const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmAZBz2V3PKcaB4FKYXH8+KLSA0NGlmy5L6xWxMEOrHd9c2S');
                audio.play();
            } catch (fallbackError) {
                console.error('フォールバック通知音エラー:', fallbackError);
            }
        }
    }

    // =================================
    // ユーティリティ
    // =================================

    getAllUsers() {
        const registeredUsers = this.database.get('registered_users') || [];
        // デフォルトユーザー
        const defaultUsers = [
            { id: 'admin', name: '管理者', role: 'admin', password: 'admin123', created_at: new Date().toISOString(), isRetired: false },
            { id: 'staff1', name: 'スタッフ1', role: 'staff', password: 'staff123', created_at: new Date().toISOString(), isRetired: false },
            { id: 'user1', name: '利用者1', role: 'user', password: 'user123', serviceType: 'commute', created_at: new Date().toISOString(), isRetired: false },
            { id: 'user2', name: '利用者2', role: 'user', password: 'user123', serviceType: 'home', created_at: new Date().toISOString(), isRetired: false }
        ];
        
        return [...defaultUsers, ...registeredUsers];
    }

    getRoleDisplayName(role) {
        const names = {
            'user': '利用者',
            'staff': '社員',
            'parttime': 'アルバイト',
            'admin': '管理者'
        };
        return names[role] || role;
    }

    getServiceTypeDisplayName(serviceType) {
        const names = {
            'commute': '通所',
            'home': '在宅'
        };
        return names[serviceType] || serviceType;
    }

    canLogout() {
        const today = new Date().toDateString();
        const attendance = this.getAttendance(this.auth.currentUser.id, today);
        
        // 出勤していない、または退勤済みの場合のみログアウト可能
        return !attendance || !attendance.clockIn || attendance.clockOut;
    }

    cleanup() {
        // コメントロックをクリア
        this.commentLocks.clear();
        
        // 日報監視を停止
        this.stopReportNotificationMonitoring();
        
        // ダッシュボード自動更新を停止
        this.stopDashboardAutoUpdate();
        
        // 休憩時間監視を停止
        this.stopBreakTimeMonitoring();
        
        console.log('👥 スタッフモジュールクリーンアップ完了');
    }

    // 休憩機能
    handleBreakStart() {
        if (!this.isWorking) {
            this.system.showNotification('出勤中のみ休憩できます', 'warning');
            return;
        }

        // 1日1回の制限チェック
        if (this.hasUsedBreakToday()) {
            this.system.showNotification('休憩は1日1回までです', 'warning');
            return;
        }

        const currentTime = Utils.getCurrentTimeString();
        this.currentBreakStart = currentTime;
        this.isOnBreak = true;
        
        // 休憩記録を出勤データに追加
        if (!this.currentAttendance.breaks) {
            this.currentAttendance.breaks = [];
        }
        
        const newBreak = {
            start: currentTime,
            end: null,
            duration: null
        };
        
        this.currentAttendance.breaks.push(newBreak);
        
        // データベースに保存
        const today = new Date().toDateString();
        this.saveAttendance(this.auth.currentUser.id, today, this.currentAttendance);
        
        // UI更新
        this.updateBreakUI();
        
        // 休憩時間監視開始
        this.startBreakTimeMonitoring();
        
        this.system.showNotification(`休憩開始（${currentTime}）最大60分まで`, 'info');
    }

    handleBreakEnd() {
        if (!this.isOnBreak || !this.currentBreakStart) {
            this.system.showNotification('休憩中ではありません', 'warning');
            return;
        }

        const currentTime = Utils.getCurrentTimeString();
        let breakDuration = this.calculateBreakDuration(this.currentBreakStart, currentTime);
        
        // 60分制限の適用
        if (breakDuration > 60) {
            breakDuration = 60;
            this.system.showNotification(
                '休憩時間が60分を超えたため、60分として記録しました', 
                'warning'
            );
        }
        
        // 最後の休憩記録を更新
        const lastBreakIndex = this.currentAttendance.breaks.length - 1;
        this.currentAttendance.breaks[lastBreakIndex].end = currentTime;
        this.currentAttendance.breaks[lastBreakIndex].duration = breakDuration;
        
        // データベースに保存
        const today = new Date().toDateString();
        this.saveAttendance(this.auth.currentUser.id, today, this.currentAttendance);
        
        this.isOnBreak = false;
        this.currentBreakStart = null;
        
        // 休憩時間監視停止
        this.stopBreakTimeMonitoring();
        
        // UI更新
        this.updateBreakUI();
        
        this.system.showNotification(
            `休憩終了（${currentTime}）休憩時間: ${breakDuration}分`, 
            'success'
        );
    }

    // 1日1回の休憩制限チェック
    hasUsedBreakToday() {
        if (!this.currentAttendance || !this.currentAttendance.breaks) {
            return false;
        }
        
        // 終了済みの休憩があるかチェック
        return this.currentAttendance.breaks.some(breakRecord => breakRecord.end);
    }

    calculateBreakDuration(startTime, endTime) {
        const start = new Date(`1970-01-01 ${startTime}`);
        const end = new Date(`1970-01-01 ${endTime}`);
        const durationMs = end - start;
        return Math.round(durationMs / (1000 * 60)); // 分単位
    }

    hasOpenBreak() {
        if (!this.currentAttendance || !this.currentAttendance.breaks) {
            return false;
        }
        
        return this.currentAttendance.breaks.some(breakRecord => !breakRecord.end);
    }

    forceEndCurrentBreak() {
        if (!this.currentAttendance || !this.currentAttendance.breaks) {
            return;
        }
        
        const currentTime = Utils.getCurrentTimeString();
        this.currentAttendance.breaks.forEach(breakRecord => {
            if (!breakRecord.end) {
                breakRecord.end = currentTime;
                breakRecord.duration = this.calculateBreakDuration(breakRecord.start, currentTime);
            }
        });
        
        this.isOnBreak = false;
        this.currentBreakStart = null;
    }

    // 休憩時間監視
    startBreakTimeMonitoring() {
        this.breakCheckInterval = setInterval(() => {
            this.updateBreakTimeDisplay();
            this.checkBreakTimeLimit();
        }, 60000); // 1分ごと
    }

    stopBreakTimeMonitoring() {
        if (this.breakCheckInterval) {
            clearInterval(this.breakCheckInterval);
            this.breakCheckInterval = null;
        }
    }

    updateBreakTimeDisplay() {
        if (!this.isOnBreak || !this.currentBreakStart) return;
        
        const currentTime = Utils.getCurrentTimeString();
        const duration = this.calculateBreakDuration(this.currentBreakStart, currentTime);
        const durationElement = document.getElementById('breakDuration');
        
        if (durationElement) {
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            durationElement.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
        }
    }

    checkBreakTimeLimit() {
        if (!this.isOnBreak || !this.currentBreakStart) return;
        
        const currentTime = Utils.getCurrentTimeString();
        const duration = this.calculateBreakDuration(this.currentBreakStart, currentTime);
        
        // 60分に達した場合は自動終了
        if (duration >= 60) {
            this.system.showNotification(
                '⚠️ 休憩時間が60分に達したため自動終了します', 
                'warning',
                5000
            );
            // 自動で休憩終了
            this.handleBreakEnd();
            return;
        }
        
        // 55分を超えた場合にアラート（60分制限に合わせて調整）
        if (duration >= 55) {
            this.system.showNotification(
                '⚠️ 休憩時間が55分を超えました！60分で自動終了されます。', 
                'warning',
                10000 // 10秒間表示
            );
            
            // ボタンを点滅させる
            const breakEndBtn = document.getElementById('breakEndBtn');
            if (breakEndBtn) {
                breakEndBtn.classList.add('btn-danger');
                breakEndBtn.classList.remove('btn-warning');
                breakEndBtn.innerHTML = '<i class="fas fa-exclamation-triangle"></i> 休憩終了（残り5分）';
            }
        }
    }

    loadBreakState() {
        const today = new Date().toDateString();
        const attendance = this.getAttendance(this.auth.currentUser.id, today);
        
        if (attendance && attendance.breaks) {
            // 未終了の休憩があるかチェック
            const openBreak = attendance.breaks.find(breakRecord => !breakRecord.end);
            if (openBreak) {
                this.isOnBreak = true;
                this.currentBreakStart = openBreak.start;
                this.startBreakTimeMonitoring();
            }
        }
    }

    // ダッシュボード自動更新機能
    startDashboardAutoUpdate() {
        // 既存の間隔をクリア
        this.stopDashboardAutoUpdate();
        
        // 10分間隔でダッシュボード更新
        this.dashboardUpdateInterval = setInterval(() => {
            const dashboardSection = document.getElementById('dashboardSection');
            if (dashboardSection && dashboardSection.style.display !== 'none') {
                this.loadDashboardData();
                console.log('📊 ダッシュボード自動更新実行');
            }
        }, 10 * 60 * 1000); // 10分
        
        console.log('📊 ダッシュボード自動更新開始（10分間隔）');
    }

    stopDashboardAutoUpdate() {
        if (this.dashboardUpdateInterval) {
            clearInterval(this.dashboardUpdateInterval);
            this.dashboardUpdateInterval = null;
        }
    }
}