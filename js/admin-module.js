// ==========================================
// 管理者機能モジュール（個人別月次出勤簿版）
// ==========================================

import { CONFIG, Utils, ValidationUtil } from './config.js';

export default class AdminModule {
    constructor(systemInstance) {
        this.system = systemInstance;
        this.config = CONFIG;
        this.database = systemInstance.database;
        this.auth = systemInstance.auth;
        this.currentView = 'handoverSection'; // デフォルトビューを申し送り事項に設定
        this.selectedYear = new Date().getFullYear();
        this.selectedMonth = new Date().getMonth() + 1;
        this.selectedUserId = null;
        this.lastHandoverUpdate = 0; // 申し送り事項の最終更新時刻
    }

    async init() {
        console.log('🔧 管理者モジュール初期化開始');
        
        try {
            // 権限チェック
            this.auth.requirePermission('all');
            
            // ダッシュボード表示
            this.showAdminDashboard();
            
            // 申し送り事項読み込み
            this.loadHandoverData();
            
            console.log('✅ 管理者モジュール初期化完了');
            
        } catch (error) {
            console.error('❌ 管理者モジュール初期化エラー:', error);
            this.system.showError('管理者機能の初期化に失敗しました', error);
        }
    }

    showAdminDashboard() {
        const content = document.getElementById('app-content');
        content.innerHTML = `
            <div class="admin-dashboard">
                <!-- 管理者メニュー -->
                <div class="staff-menu mb-4">
                    <div class="btn-group w-100" role="group">
                        <button class="btn btn-outline-primary admin-menu-btn active" data-target="handoverSection">
                            <i class="fas fa-exchange-alt"></i> 申し送り
                        </button>
                        <button class="btn btn-outline-primary admin-menu-btn" data-target="dashboardSection">
                            <i class="fas fa-tachometer-alt"></i> ダッシュボード
                        </button>
                        <button class="btn btn-outline-primary admin-menu-btn" data-target="userRegistrationSection">
                            <i class="fas fa-user-plus"></i> ユーザー登録
                        </button>
                        <button class="btn btn-outline-primary admin-menu-btn" data-target="attendanceBookSection">
                            <i class="fas fa-calendar-check"></i> 出勤簿
                        </button>
                    </div>
                </div>

                <!-- 1. 申し送り事項セクション（デフォルト表示） -->
                <div id="handoverSection" class="admin-section mb-4">
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
                                <textarea class="form-control" id="handoverContent" rows="12" 
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

                <!-- 2. ダッシュボードセクション -->
                <div id="dashboardSection" class="admin-section mb-4" style="display: none;">
                    <div class="custom-card">
                        <div class="custom-card-header">
                            <h5><i class="fas fa-users"></i> 全体出勤状況</h5>
                            <button class="btn btn-outline-light btn-sm" id="refreshDashboardBtn">
                                <i class="fas fa-sync"></i> 更新
                            </button>
                        </div>
                        <div class="card-body">
                            <div id="allUserStatusList">
                                <!-- 全員の出勤状況一覧がここに表示される -->
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 3. ユーザー登録セクション -->
                <div id="userRegistrationSection" class="admin-section mb-4" style="display: none;">
                    <div class="custom-card">
                        <div class="custom-card-header">
                            <h5><i class="fas fa-user-plus"></i> ユーザー登録</h5>
                        </div>
                        <div class="card-body">
                            <div class="row justify-content-center">
                                <div class="col-lg-10">
                                    <form id="userRegistrationForm">
                                        <div class="row mb-3">
                                            <div class="col-md-6">
                                        <label for="userName" class="form-label">
                                            <i class="fas fa-user"></i> ユーザー名（漢字）<span class="text-danger">*</span>
                                        </label>
                                        <input type="text" class="form-control" id="userName" required 
                                               placeholder="山田 太郎">
                                    </div>
                                    <div class="col-md-6">
                                        <label for="userPassword" class="form-label">
                                            <i class="fas fa-lock"></i> パスワード <span class="text-danger">*</span>
                                        </label>
                                        <input type="password" class="form-control" id="userPassword" required 
                                               placeholder="パスワードを入力">
                                    </div>
                                </div>
                                
                                <div class="row mb-3">
                                    <div class="col-md-6">
                                        <label for="recipientNumber" class="form-label">
                                            <i class="fas fa-id-card"></i> 受給者番号
                                        </label>
                                        <input type="text" class="form-control" id="recipientNumber" 
                                               placeholder="利用者のみ入力（社員・アルバイト・管理者は空白）">
                                        <small class="text-muted">社員・アルバイト・管理者の場合は空白のままにしてください</small>
                                    </div>
                                    <div class="col-md-6">
                                        <label for="userRole" class="form-label">
                                            <i class="fas fa-user-tag"></i> 権限 <span class="text-danger">*</span>
                                        </label>
                                        <select class="form-control" id="userRole" required>
                                            <option value="">権限を選択してください</option>
                                            <option value="user">利用者</option>
                                            <option value="staff">社員</option>
                                            <option value="parttime">アルバイト</option>
                                            <option value="admin">管理者</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="row mb-3" id="serviceTypeRow" style="display: none;">
                                    <div class="col-md-6">
                                        <label for="serviceType" class="form-label">
                                            <i class="fas fa-home"></i> サービス区分 <span class="text-danger">*</span>
                                        </label>
                                        <select class="form-control" id="serviceType">
                                            <option value="">サービス区分を選択してください</option>
                                            <option value="commute">通所</option>
                                            <option value="home">在宅</option>
                                        </select>
                                    </div>
                                </div>

                                        <div class="text-center">
                                            <button type="submit" class="btn btn-primary btn-lg">
                                                <i class="fas fa-user-plus"></i> ユーザーを登録
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            </div>

                            <hr class="my-4">

                            <!-- 既存ユーザー一覧 -->
                            <div class="row justify-content-center mt-4">
                                <div class="col-lg-11">
                                    <h6><i class="fas fa-list"></i> 登録済みユーザー</h6>
                                    <div id="existingUsersList">
                                        <!-- 既存ユーザー一覧がここに表示される -->
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 4. 出勤簿セクション（個人別月次表示） -->
                <div id="attendanceBookSection" class="admin-section mb-4" style="display: none;">
                    <div class="custom-card">
                        <div class="custom-card-header">
                            <h5><i class="fas fa-calendar-check"></i> 個人別月次出勤簿</h5>
                        </div>
                        <div class="card-body">
                            <!-- 年月・ユーザー選択エリア -->
                            <div class="row mb-4">
                                <div class="col-md-3">
                                    <label for="yearSelect" class="form-label">年を選択</label>
                                    <select class="form-control" id="yearSelect">
                                        ${this.generateYearOptions()}
                                    </select>
                                </div>
                                <div class="col-md-3">
                                    <label for="monthSelect" class="form-label">月を選択</label>
                                    <select class="form-control" id="monthSelect">
                                        ${this.generateMonthOptions()}
                                    </select>
                                </div>
                                <div class="col-md-4">
                                    <label for="userSelect" class="form-label">ユーザーを選択</label>
                                    <select class="form-control" id="userSelect">
                                        <option value="">ユーザーを選択してください</option>
                                        ${this.generateUserOptions()}
                                    </select>
                                </div>
                                <div class="col-md-2 d-flex align-items-end">
                                    <button class="btn btn-primary w-100" id="showMonthlyAttendanceBtn">
                                        <i class="fas fa-search"></i> 表示
                                    </button>
                                </div>
                            </div>

                            <!-- 月次出勤記録表示エリア -->
                            <div id="monthlyAttendanceDisplay">
                                <p class="text-muted text-center">年月とユーザーを選択して「表示」ボタンをクリックしてください</p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // イベントリスナー設定
        this.setupEventListeners();
        
        // 初期表示
        this.loadAllUserStatus();
        this.loadExistingUsers();
    }

    setupEventListeners() {
        // メニューボタン（画面切り替え）
        document.querySelectorAll('.admin-menu-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const targetId = e.target.closest('button').getAttribute('data-target');
                this.switchToSection(targetId);
                
                // ボタンのアクティブ状態を更新
                document.querySelectorAll('.admin-menu-btn').forEach(b => b.classList.remove('active'));
                e.target.closest('button').classList.add('active');
            });
        });

        // ダッシュボード更新
        this.addEventListenerSafe('refreshDashboardBtn', 'click', () => this.refreshDashboard());

        // 申し送り事項
        this.addEventListenerSafe('updateHandoverBtn', 'click', () => this.updateHandover());
        this.addEventListenerSafe('refreshHandoverBtn', 'click', () => this.refreshHandover());

        // 申し送り事項の編集監視
        const handoverTextarea = document.getElementById('handoverContent');
        if (handoverTextarea) {
            handoverTextarea.addEventListener('input', () => {
                this.onHandoverContentChange();
            });
        }

        // ユーザー登録フォーム
        const userForm = document.getElementById('userRegistrationForm');
        if (userForm) {
            userForm.addEventListener('submit', (e) => this.handleUserRegistration(e));
        }

        // 権限選択時のサービス区分表示切り替え
        const roleSelect = document.getElementById('userRole');
        if (roleSelect) {
            roleSelect.addEventListener('change', (e) => {
                const serviceTypeRow = document.getElementById('serviceTypeRow');
                if (e.target.value === 'user') {
                    serviceTypeRow.style.display = 'block';
                    document.getElementById('serviceType').required = true;
                } else {
                    serviceTypeRow.style.display = 'none';
                    document.getElementById('serviceType').required = false;
                }
            });
        }

        // 月次出勤記録表示ボタン
        this.addEventListenerSafe('showMonthlyAttendanceBtn', 'click', () => this.showMonthlyAttendance());
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
        document.querySelectorAll('.admin-section').forEach(section => {
            section.style.display = 'none';
        });
        
        // 指定されたセクションのみ表示
        const targetSection = document.getElementById(sectionId);
        if (targetSection) {
            targetSection.style.display = 'block';
            this.currentView = sectionId;
            
            // セクション別の初期化処理
            if (sectionId === 'handoverSection') {
                this.loadHandoverData();
            } else if (sectionId === 'dashboardSection') {
                this.loadAllUserStatus();
            } else if (sectionId === 'userRegistrationSection') {
                this.loadExistingUsers();
            }
        }
    }

    // =================================
    // ダッシュボード機能
    // =================================

    loadAllUserStatus() {
        const container = document.getElementById('allUserStatusList');
        if (!container) return;
        
        container.innerHTML = this.generateAllUserStatusList();
    }

    generateAllUserStatusList() {
        const users = this.getAllUsers().filter(user => !user.isRetired);
        const today = new Date().toDateString();
        let html = '';
        
        if (users.length === 0) {
            return '<p class="text-muted text-center">登録されているユーザーがありません</p>';
        }

        users.forEach(user => {
            const userData = this.getUserStatusData(user, today);
            html += this.generateUserStatusRow(userData);
        });
        
        return html;
    }

    getUserStatusData(user, date) {
        const attendance = this.getAttendance(user.id, date);
        
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
            id: user.id,
            name: user.name,
            role: this.getRoleDisplayName(user.role),
            serviceType: user.serviceType ? this.getServiceTypeDisplayName(user.serviceType) : '-',
            status: status,
            statusClass: statusClass,
            statusIcon: statusIcon,
            clockIn: attendance ? attendance.clockIn : null,
            clockOut: attendance ? attendance.clockOut : null,
            workDuration: this.calculateWorkDuration(attendance)
        };
    }

    generateUserStatusRow(userData) {
        const workDurationText = userData.workDuration 
            ? `<br><small class="text-muted">勤務時間: ${userData.workDuration}</small>`
            : '';

        return `
            <div class="user-status-row mb-3 p-3 border rounded">
                <div class="row align-items-center">
                    <div class="col-md-3">
                        <div class="d-flex align-items-center">
                            <span class="badge ${userData.statusClass} me-2">
                                <i class="fas ${userData.statusIcon}"></i>
                            </span>
                            <div>
                                <h6 class="mb-0">${userData.name}</h6>
                                <small class="text-muted">${userData.role} ${userData.serviceType !== '-' ? '(' + userData.serviceType + ')' : ''}</small>
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
                        <span class="badge ${userData.statusClass}">${userData.status}</span>
                        ${workDurationText}
                    </div>
                    <div class="col-md-2 text-end">
                        <small class="text-muted">${userData.status}</small>
                    </div>
                </div>
            </div>
        `;
    }

    refreshDashboard() {
        this.loadAllUserStatus();
        this.system.showNotification('ダッシュボードを更新しました', 'info');
    }

    // =================================
    // ユーザー登録機能
    // =================================

    handleUserRegistration(e) {
        e.preventDefault();
        
        try {
            const formData = this.collectUserFormData();
            const validation = this.validateUserData(formData);
            
            if (!validation.valid) {
                this.system.showNotification(validation.message, 'warning');
                return;
            }
            
            // ユーザーID生成（名前から）
            const userId = this.generateUserId(formData.name);
            
            // 重複チェック
            if (this.isUserExists(userId)) {
                this.system.showNotification('同じ名前のユーザーが既に存在します', 'warning');
                return;
            }
            
            // ユーザー登録
            this.registerUser(userId, formData);
            
            // フォームリセット
            document.getElementById('userRegistrationForm').reset();
            document.getElementById('serviceTypeRow').style.display = 'none';
            
            // 一覧更新
            this.loadExistingUsers();
            
            // 出勤簿のユーザー選択も更新
            this.updateUserSelectOptions();
            
            this.system.showNotification(`${formData.name}さんを登録しました`, 'success');
            
        } catch (error) {
            console.error('ユーザー登録エラー:', error);
            this.system.showNotification('ユーザー登録に失敗しました', 'danger');
        }
    }

    collectUserFormData() {
        return {
            name: document.getElementById('userName').value.trim(),
            password: document.getElementById('userPassword').value,
            recipientNumber: document.getElementById('recipientNumber').value.trim(),
            role: document.getElementById('userRole').value,
            serviceType: document.getElementById('serviceType').value
        };
    }

    validateUserData(data) {
        if (!data.name || !data.password || !data.role) {
            return { valid: false, message: '必須項目を入力してください' };
        }
        
        if (data.role === 'user' && !data.serviceType) {
            return { valid: false, message: '利用者のサービス区分を選択してください' };
        }
        
        if (data.password.length < 4) {
            return { valid: false, message: 'パスワードは4文字以上で入力してください' };
        }
        
        return { valid: true };
    }

    generateUserId(name) {
        // 名前から英数字のIDを生成（簡易版）
        const baseId = name.replace(/\s+/g, '').toLowerCase();
        const romanized = this.toRomaji(baseId);
        return romanized || 'user' + Date.now().toString().slice(-4);
    }

    toRomaji(str) {
        // 簡易的なローマ字変換（実際の実装では、より高度な変換が必要）
        const kanaMap = {
            'あ': 'a', 'い': 'i', 'う': 'u', 'え': 'e', 'お': 'o',
            'か': 'ka', 'き': 'ki', 'く': 'ku', 'け': 'ke', 'こ': 'ko',
            'さ': 'sa', 'し': 'shi', 'す': 'su', 'せ': 'se', 'そ': 'so',
            'た': 'ta', 'ち': 'chi', 'つ': 'tsu', 'て': 'te', 'と': 'to',
            'な': 'na', 'に': 'ni', 'ぬ': 'nu', 'ね': 'ne', 'の': 'no',
            'は': 'ha', 'ひ': 'hi', 'ふ': 'fu', 'へ': 'he', 'ほ': 'ho',
            'ま': 'ma', 'み': 'mi', 'む': 'mu', 'め': 'me', 'も': 'mo',
            'や': 'ya', 'ゆ': 'yu', 'よ': 'yo',
            'ら': 'ra', 'り': 'ri', 'る': 'ru', 'れ': 're', 'ろ': 'ro',
            'わ': 'wa', 'ゐ': 'wi', 'ゑ': 'we', 'を': 'wo', 'ん': 'n'
        };
        
        // 基本的には名前の最初の2文字 + 番号で生成
        const firstChar = str.charAt(0);
        const mapped = kanaMap[firstChar] || firstChar;
        return mapped + Date.now().toString().slice(-3);
    }

    isUserExists(userId) {
        const users = this.getAllUsers();
        return users.some(user => user.id === userId);
    }

    registerUser(userId, userData) {
        const userRecord = {
            id: userId,
            name: userData.name,
            password: userData.password,
            role: userData.role,
            recipientNumber: userData.recipientNumber || null,
            serviceType: userData.serviceType || null,
            created_at: new Date().toISOString(),
            created_by: this.auth.currentUser.id
        };
        
        // ユーザーリストに追加
        const users = this.getAllUsers();
        users.push(userRecord);
        this.saveAllUsers(users);
        
        // セキュリティログ記録
        this.database.logSecurityEvent('USER_REGISTERED', {
            newUserId: userId,
            newUserName: userData.name,
            newUserRole: userData.role,
            registeredBy: this.auth.currentUser.id
        });
    }

    loadExistingUsers() {
        const container = document.getElementById('existingUsersList');
        if (!container) return;
        
        const users = this.getAllUsers().filter(user => !user.isRetired);
        if (users.length === 0) {
            container.innerHTML = '<p class="text-muted">登録されているユーザーがありません</p>';
            return;
        }
        
        let html = `
            <div class="table-responsive">
                <table class="table table-sm table-bordered">
                    <thead class="table-light">
                        <tr>
                            <th width="12%">ユーザーID</th>
                            <th width="15%">名前</th>
                            <th width="13%">パスワード</th>
                            <th width="10%">権限</th>
                            <th width="12%">サービス区分</th>
                            <th width="12%">受給者番号</th>
                            <th width="11%">登録日</th>
                            <th width="15%">操作</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        users.forEach(user => {
            const isDefaultUser = ['admin', 'staff1', 'user1', 'user2'].includes(user.id);
            const buttonHtml = !isDefaultUser ? 
                `<button class="btn btn-danger btn-sm retire-user-btn px-2 py-1" 
                        data-user-id="${user.id}" 
                        data-user-name="${user.name}"
                        title="退職処理（非表示化）"
                        style="font-size: 0.8rem;">
                    <i class="fas fa-user-slash"></i> 退職
                </button>` : 
                '<span class="text-muted">-</span>';
                
            html += `
                <tr>
                    <td><code>${user.id}</code></td>
                    <td>${user.name}</td>
                    <td><code>${user.password || '****'}</code></td>
                    <td><span class="badge bg-primary">${this.getRoleDisplayName(user.role)}</span></td>
                    <td>${user.serviceType ? this.getServiceTypeDisplayName(user.serviceType) : '-'}</td>
                    <td>${user.recipientNumber || '-'}</td>
                    <td><small>${new Date(user.created_at).toLocaleDateString('ja-JP').replace(/\//g, '-')}</small></td>
                    <td>${buttonHtml}</td>
                </tr>
            `;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        `;
        
        container.innerHTML = html;
        
        // 退職ボタンのイベントリスナー設定
        setTimeout(() => {
            const retireButtons = container.querySelectorAll('.retire-user-btn');
            console.log('退職ボタン数:', retireButtons.length);
            retireButtons.forEach(btn => {
                btn.addEventListener('click', (e) => this.handleUserRetirement(e));
            });
        }, 100);
    }

    // =================================
    // 個人別月次出勤簿機能
    // =================================

    handleUserRetirement(e) {
        const userId = e.target.closest('button').getAttribute('data-user-id');
        const userName = e.target.closest('button').getAttribute('data-user-name');
        
        // 確認ダイアログを表示
        if (!confirm(`${userName}さんを退職処理（非表示）にしますか？\n\n※この操作により、このユーザーは一覧から非表示になりますが、過去の記録は保持されます。`)) {
            return;
        }
        
        try {
            // ユーザーを非表示に設定
            const users = this.database.get('registered_users') || [];
            const userIndex = users.findIndex(u => u.id === userId);
            
            if (userIndex !== -1) {
                users[userIndex].isRetired = true;
                users[userIndex].retiredAt = new Date().toISOString();
                users[userIndex].retiredBy = this.auth.currentUser.id;
                this.database.set('registered_users', users);
                
                // セキュリティログ記録
                this.database.logSecurityEvent('USER_RETIRED', {
                    retiredUserId: userId,
                    retiredUserName: userName,
                    retiredBy: this.auth.currentUser.id
                });
                
                // 一覧を再読み込み
                this.loadExistingUsers();
                this.updateUserSelectOptions();
                
                this.system.showNotification(`${userName}さんを退職処理しました`, 'success');
            }
        } catch (error) {
            console.error('退職処理エラー:', error);
            this.system.showNotification('退職処理に失敗しました', 'danger');
        }
    }

    generateYearOptions() {
        const currentYear = new Date().getFullYear();
        let html = '';
        for (let year = currentYear - 2; year <= currentYear + 1; year++) {
            const selected = year === this.selectedYear ? 'selected' : '';
            html += `<option value="${year}" ${selected}>${year}年</option>`;
        }
        return html;
    }

    generateMonthOptions() {
        let html = '';
        for (let month = 1; month <= 12; month++) {
            const selected = month === this.selectedMonth ? 'selected' : '';
            html += `<option value="${month}" ${selected}>${month}月</option>`;
        }
        return html;
    }

    generateUserOptions() {
        const users = this.getAllUsers().filter(user => !user.isRetired);
        let html = '';
        users.forEach(user => {
            const roleDisplay = this.getRoleDisplayName(user.role);
            const serviceDisplay = user.serviceType ? ` (${this.getServiceTypeDisplayName(user.serviceType)})` : '';
            html += `<option value="${user.id}">${user.name} - ${roleDisplay}${serviceDisplay}</option>`;
        });
        return html;
    }

    updateUserSelectOptions() {
        const userSelect = document.getElementById('userSelect');
        if (userSelect) {
            const currentValue = userSelect.value;
            userSelect.innerHTML = '<option value="">ユーザーを選択してください</option>' + this.generateUserOptions();
            userSelect.value = currentValue;
        }
    }

    showMonthlyAttendance() {
        const yearSelect = document.getElementById('yearSelect');
        const monthSelect = document.getElementById('monthSelect');
        const userSelect = document.getElementById('userSelect');
        const displayContainer = document.getElementById('monthlyAttendanceDisplay');
        
        if (!yearSelect || !monthSelect || !userSelect || !displayContainer) return;
        
        const year = parseInt(yearSelect.value);
        const month = parseInt(monthSelect.value);
        const userId = userSelect.value;
        
        if (!userId) {
            this.system.showNotification('ユーザーを選択してください', 'warning');
            return;
        }
        
        // 選択値を保存
        this.selectedYear = year;
        this.selectedMonth = month;
        this.selectedUserId = userId;
        
        // ユーザー情報を取得（退職者も含めて検索）
        const allUsers = this.getAllUsers();
        const user = allUsers.find(u => u.id === userId);
        if (!user) {
            this.system.showNotification('ユーザーが見つかりません', 'danger');
            return;
        }
        
        // 月次出勤記録を生成
        displayContainer.innerHTML = this.generateMonthlyAttendanceReport(year, month, user);
        
        // セキュリティログ記録
        this.database.logSecurityEvent('MONTHLY_ATTENDANCE_VIEWED', {
            viewedUserId: userId,
            viewedUserName: user.name,
            year: year,
            month: month,
            viewedBy: this.auth.currentUser.id
        });
    }

    generateMonthlyAttendanceReport(year, month, user) {
        const monthName = `${year}年${month}月`;
        const daysInMonth = new Date(year, month, 0).getDate();
        const dayNames = ['日', '月', '火', '水', '木', '金', '土'];
        
        let html = `
            <div class="monthly-attendance-report">
                <h5 class="mb-3">
                    <i class="fas fa-user"></i> ${user.name}さんの${monthName}出勤記録
                    <small class="text-muted ms-2">
                        ${this.getRoleDisplayName(user.role)}
                        ${user.serviceType ? '・' + this.getServiceTypeDisplayName(user.serviceType) : ''}
                    </small>
                </h5>
                
                <div class="table-responsive">
                    <table class="table table-bordered table-striped">
                        <thead class="table-primary">
                            <tr>
                                <th width="10%">日付</th>
                                <th width="10%">曜日</th>
                                <th width="12%">勤務場所</th>
                                <th width="14%">出勤時間</th>
                                <th width="14%">退勤時間</th>
                                <th width="14%">勤務時間</th>
                                <th width="26%">備考</th>
                            </tr>
                        </thead>
                        <tbody>
        `;
        
        let totalWorkDays = 0;
        let totalWorkHours = 0;
        
        // 1日から月末まで表示
        for (let day = 1; day <= daysInMonth; day++) {
            const date = new Date(year, month - 1, day);
            const dateStr = date.toDateString();
            const dayOfWeek = date.getDay();
            const dayName = dayNames[dayOfWeek];
            
            const attendance = this.getAttendance(user.id, dateStr);
            const report = this.getDailyReport(user.id, dateStr);
            
            let rowClass = '';
            if (dayOfWeek === 0) rowClass = 'table-danger'; // 日曜日
            else if (dayOfWeek === 6) rowClass = 'table-info'; // 土曜日
            
            if (attendance && attendance.clockIn) {
                totalWorkDays++;
                const workHours = this.calculateWorkHours(attendance);
                if (workHours > 0) totalWorkHours += workHours;
                
                const serviceDisplay = user.serviceType ? 
                    this.getServiceTypeDisplayName(user.serviceType) : 
                    (user.role === 'staff' || user.role === 'parttime' || user.role === 'admin' ? '事業所' : '-');
                
                html += `
                    <tr class="${rowClass}">
                        <td class="text-center">${day}日</td>
                        <td class="text-center">${dayName}</td>
                        <td class="text-center">${serviceDisplay}</td>
                        <td class="text-center">${attendance.clockIn}</td>
                        <td class="text-center">${attendance.clockOut || '未退勤'}</td>
                        <td class="text-center">${workHours > 0 ? workHours.toFixed(1) + '時間' : '-'}</td>
                        <td class="small">
                            ${report ? '<span class="badge bg-success">日報提出済み</span>' : ''}
                            ${report && report.staffComment ? '<span class="badge bg-info">社員コメントあり</span>' : ''}
                        </td>
                    </tr>
                `;
            } else {
                html += `
                    <tr class="${rowClass}">
                        <td class="text-center">${day}日</td>
                        <td class="text-center">${dayName}</td>
                        <td class="text-center">-</td>
                        <td class="text-center">-</td>
                        <td class="text-center">-</td>
                        <td class="text-center">-</td>
                        <td class="small text-muted">未出勤</td>
                    </tr>
                `;
            }
        }
        
        html += `
                        </tbody>
                        <tfoot class="table-secondary">
                            <tr>
                                <th colspan="5" class="text-end">月間集計</th>
                                <th class="text-center">${totalWorkHours.toFixed(1)}時間</th>
                                <th>出勤日数: ${totalWorkDays}日</th>
                            </tr>
                        </tfoot>
                    </table>
                </div>
                
                <div class="mt-3 text-end">
                    <button class="btn btn-primary" onclick="window.print()">
                        <i class="fas fa-print"></i> 印刷
                    </button>
                </div>
            </div>
        `;
        
        return html;
    }

    calculateWorkHours(attendance) {
        if (!attendance || !attendance.clockIn || !attendance.clockOut) {
            return 0;
        }
        
        try {
            const clockIn = new Date('1970-01-01 ' + attendance.clockIn);
            const clockOut = new Date('1970-01-01 ' + attendance.clockOut);
            const durationMs = clockOut - clockIn;
            return durationMs / (1000 * 60 * 60);
        } catch (error) {
            console.error('勤務時間計算エラー:', error);
            return 0;
        }
    }

    // =================================
    // 申し送り事項機能
    // =================================

    loadHandoverData() {
        try {
            const handoverData = this.getHandoverData();
            
            const textarea = document.getElementById('handoverContent');
            const updateInfo = document.getElementById('handoverUpdateInfo');
            
            if (handoverData) {
                if (textarea) textarea.value = handoverData.content || '';
                
                const updateText = handoverData.lastUpdated ? 
                    `<i class="fas fa-clock"></i> 最終更新: ${new Date(handoverData.lastUpdated).toLocaleString('ja-JP')}${handoverData.updatedBy ? ` (${handoverData.updatedBy})` : ''}` :
                    '<i class="fas fa-clock"></i> 最終更新: 未設定';
                
                if (updateInfo) updateInfo.innerHTML = updateText;
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
            
            // 日時と管理者名を追記
            const updateTimestamp = new Date().toLocaleString('ja-JP');
            const updateNote = `（${updateTimestamp} ${this.auth.currentUser.name}更新）`;
            const finalContent = content + ' ' + updateNote;
            
            const handoverData = {
                content: finalContent,
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
                role: 'admin'
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

    // =================================
    // ユーティリティ
    // =================================

    getAllUsers() {
        const registeredUsers = this.database.get('registered_users') || [];
        // デフォルトユーザー（退職不可）
        const defaultUsers = [
            { id: 'admin', name: '管理者', role: 'admin', password: 'admin123', created_at: new Date().toISOString(), isRetired: false },
            { id: 'staff1', name: 'スタッフ1', role: 'staff', password: 'staff123', created_at: new Date().toISOString(), isRetired: false },
            { id: 'user1', name: '利用者1', role: 'user', password: 'user123', serviceType: 'commute', created_at: new Date().toISOString(), isRetired: false },
            { id: 'user2', name: '利用者2', role: 'user', password: 'user123', serviceType: 'home', created_at: new Date().toISOString(), isRetired: false }
        ];
        
        return [...defaultUsers, ...registeredUsers];
    }

    saveAllUsers(users) {
        // デフォルトユーザーを除外して保存
        const customUsers = users.filter(user => !['admin', 'staff1', 'user1', 'user2'].includes(user.id));
        this.database.set('registered_users', customUsers);
    }

    getAttendance(userId, date) {
        const key = `attendance_${userId}_${date}`;
        return this.database.get(key);
    }

    getDailyReport(userId, date) {
        const key = `daily_report_${userId}_${date}`;
        return this.database.get(key);
    }

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

    cleanup() {
        console.log('🔧 管理者モジュールクリーンアップ完了');
    }

    hasUnsavedChanges() {
        return false;
    }
}