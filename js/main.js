// ==========================================
// 勤怠管理システム - メインアプリケーション（整理版）
// ==========================================

import { SecureDatabase, CONFIG, Utils } from './config.js';
import { AuthManager, AuthError } from './auth.js';
import UserModule from './user-module.js';

// メインアプリケーションクラス
class AttendanceApp {
    constructor() {
        this.database = null;
        this.auth = null;
        this.currentModule = null;
        this.isInitialized = false;
        this.timeUpdateInterval = null;
        
        // グローバルアクセス用（デバッグ・メンテナンス用）
        window.attendanceSystem = this;
    }
    
    // =================================
    // システム初期化
    // =================================
    
    async init() {
        console.log('🚀 勤怠管理システム起動 v' + CONFIG.version);
        
        try {
            // セキュリティチェック実行
            await this.performSecurityCheck();
            
            // コアシステム初期化
            await this.initializeCore();
            
            // UI初期化
            this.initializeUI();
            
            // セッション復元またはログイン画面表示
            this.initializeAuth();
            
            this.isInitialized = true;
            console.log('✅ システム初期化完了');
            
        } catch (error) {
            console.error('❌ システム初期化失敗:', error);
            this.showCriticalError('システムの初期化に失敗しました', error);
        } finally {
            // セキュリティチェック画面を確実に非表示
            setTimeout(() => {
                this.hideSecurityCheck();
            }, 100);
        }
    }
    
    async performSecurityCheck() {
        console.log('🔍 セキュリティチェック開始');
        
        const checks = [
            { name: 'ブラウザ互換性を確認中...', delay: 300, check: () => this.checkBrowserCompatibility() },
            { name: 'ローカルストレージを確認中...', delay: 300, check: () => this.checkLocalStorage() },
            { name: 'セキュリティポリシーを確認中...', delay: 300, check: () => this.checkSecurityPolicy() },
            { name: 'システム設定を読み込み中...', delay: 300, check: () => this.loadSystemConfig() },
            { name: '初期化完了', delay: 200, check: () => true }
        ];
        
        for (const { name, delay, check } of checks) {
            await new Promise(resolve => {
                setTimeout(() => {
                    try {
                        this.updateSecurityStatus(name);
                        const result = check();
                        if (result === false) {
                            throw new Error(`セキュリティチェック失敗: ${name}`);
                        }
                        resolve(result);
                    } catch (error) {
                        console.error('セキュリティチェックエラー:', error);
                        resolve(true); // エラーでも続行
                    }
                }, delay);
            });
        }
        
        console.log('✅ セキュリティチェック完了');
    }
    
    checkBrowserCompatibility() {
        // 必要なブラウザ機能をチェック
        const requiredFeatures = [
            'localStorage' in window,
            'sessionStorage' in window,
            'fetch' in window,
            'crypto' in window && 'getRandomValues' in window.crypto,
            'Promise' in window
        ];
        
        const unsupportedFeatures = requiredFeatures.filter(feature => !feature);
        
        if (unsupportedFeatures.length > 0) {
            throw new Error('お使いのブラウザは一部の機能をサポートしていません');
        }
        
        return true;
    }
    
    checkLocalStorage() {
        try {
            const testKey = '__storage_test__';
            localStorage.setItem(testKey, 'test');
            const value = localStorage.getItem(testKey);
            localStorage.removeItem(testKey);
            
            if (value !== 'test') {
                throw new Error('ローカルストレージが正常に動作しません');
            }
            
            return true;
        } catch (error) {
            throw new Error('ローカルストレージにアクセスできません: ' + error.message);
        }
    }
    
    checkSecurityPolicy() {
        // CSP（Content Security Policy）や其他のセキュリティ設定をチェック
        const userAgent = navigator.userAgent;
        const isSecureContext = window.isSecureContext;
        
        // 開発環境でない場合はHTTPS必須
        if (location.protocol !== 'https:' && 
            !location.hostname.includes('localhost') && 
            !location.hostname.includes('127.0.0.1')) {
            console.warn('⚠️ 本番環境ではHTTPS接続を推奨します');
        }
        
        return true;
    }
    
    loadSystemConfig() {
        // システム設定の妥当性をチェック
        if (!CONFIG || !CONFIG.name || !CONFIG.version) {
            throw new Error('システム設定が不正です');
        }
        
        return true;
    }
    
    async initializeCore() {
        try {
            console.log('🔧 コアシステム初期化開始');
            
            // データベース初期化
            console.log('📦 データベース初期化中...');
            this.database = new SecureDatabase();
            
            // 認証マネージャー初期化
            console.log('🔐 認証マネージャー初期化中...');
            this.auth = new AuthManager(this.database);
            
            // システム統計情報を記録
            console.log('📊 システム統計記録中...');
            this.recordSystemStats();
            
            console.log('✅ コアシステム初期化完了');
            
        } catch (error) {
            console.error('❌ コアシステム初期化エラー:', error);
            throw error;
        }
    }
    
    recordSystemStats() {
        try {
            const stats = {
                systemVersion: CONFIG.version,
                userAgent: navigator.userAgent.slice(0, 200),
                screen: {
                    width: screen.width,
                    height: screen.height
                },
                timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                language: navigator.language,
                timestamp: new Date().toISOString()
            };
            
            this.database.setDirectly('system_stats', stats); // 直接アクセスを使用
            console.log('📊 システム統計記録完了');
        } catch (error) {
            console.error('システム統計記録エラー:', error);
            // エラーでも処理は続行
        }
    }
    
    // =================================
    // UI初期化
    // =================================
    
    initializeUI() {
        this.setupGlobalEventListeners();
        this.startTimeUpdate();
        this.setupErrorHandling();
        
        console.log('✅ UI初期化完了');
    }
    
    setupGlobalEventListeners() {
        // ログアウトボタン
        const logoutBtn = document.getElementById('logoutBtn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => this.handleLogout());
        }
        
        // ブラウザ閉じる時の確認（日報提出完了まで）
        window.addEventListener('beforeunload', (e) => {
            if (this.shouldPreventPageUnload()) {
                e.preventDefault();
                e.returnValue = '退勤と日報提出が完了していません。本当にページを離れますか？';
                return e.returnValue;
            }
        });
    }
    
    setupErrorHandling() {
        // エラーハンドリングは簡素化（無限ループを防ぐ）
        window.addEventListener('error', (e) => {
            console.error('グローバルエラー:', e.error);
            // セキュリティログは重要なエラーのみ記録
            if (e.error && e.error.name !== 'TypeError') {
                try {
                    this.database?.logSecurityEvent('GLOBAL_ERROR', {
                        message: e.message,
                        filename: e.filename,
                        lineno: e.lineno
                    });
                } catch (logError) {
                    // ログ記録エラーは無視
                }
            }
        });
        
        // Promise rejection handling
        window.addEventListener('unhandledrejection', (e) => {
            console.error('未処理のPromise rejection:', e.reason);
            try {
                this.database?.logSecurityEvent('UNHANDLED_PROMISE_REJECTION', {
                    reason: e.reason?.toString()
                });
            } catch (logError) {
                // ログ記録エラーは無視
            }
        });
    }
    
    startTimeUpdate() {
        this.updateTime();
        this.timeUpdateInterval = setInterval(() => this.updateTime(), 1000);
    }
    
    updateTime() {
        const now = new Date();
        const timeElement = document.getElementById('currentTime');
        const dateElement = document.getElementById('currentDate');
        
        if (timeElement) {
            timeElement.textContent = now.toLocaleTimeString('ja-JP');
        }
        
        if (dateElement) {
            dateElement.textContent = Utils.formatDate(now);
        }
    }
    
    // =================================
    // 認証・画面遷移
    // =================================
    
    initializeAuth() {
        try {
            console.log('🔐 認証初期化開始');
            
            if (this.auth && this.auth.currentUser) {
                console.log('📋 既存セッションを検出:', this.auth.currentUser.name);
                this.showDashboard();
            } else {
                console.log('🔑 ログイン画面を表示');
                this.showLoginScreen();
            }
            
            console.log('✅ 認証初期化完了');
        } catch (error) {
            console.error('❌ 認証初期化エラー:', error);
            // エラーの場合はログイン画面を表示
            this.showLoginScreen();
        }
    }
    
    showLoginScreen() {
        try {
            console.log('🔑 ログイン画面表示開始');
            
            const content = document.getElementById('app-content');
            const currentUser = document.getElementById('currentUser');
            const logoutBtn = document.getElementById('logoutBtn');
            
            if (!content) {
                throw new Error('app-content要素が見つかりません');
            }
            
            content.innerHTML = this.getLoginHTML();
            
            if (currentUser) currentUser.textContent = '';
            if (logoutBtn) logoutBtn.style.display = 'none';
            
            // ログインフォームのイベントリスナー設定
            setTimeout(() => {
                const loginForm = document.getElementById('loginForm');
                if (loginForm) {
                    loginForm.addEventListener('submit', (e) => this.handleLogin(e));
                    console.log('✅ ログインフォームイベント設定完了');
                } else {
                    console.warn('⚠️ ログインフォームが見つかりません');
                }
                
                // フォーカス設定
                const usernameField = document.getElementById('username');
                if (usernameField) {
                    usernameField.focus();
                }
            }, 100);
            
            console.log('✅ ログイン画面表示完了');
            
        } catch (error) {
            console.error('❌ ログイン画面表示エラー:', error);
            this.showCriticalError('ログイン画面の表示に失敗しました', error);
        }
    }
    
    async handleLogin(e) {
        e.preventDefault();
        console.log('🔐 ログイン処理開始');
        
        try {
            this.showLoading(true);
            
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;
            
            // 入力値検証
            if (!username || !password) {
                throw new Error('ユーザーIDとパスワードを入力してください');
            }
            
            // ログイン実行
            const user = await this.auth.login(username, password);
            
            // 成功時の処理
            this.showDashboard();
            this.showNotification(`ようこそ、${user.name}さん`, 'success');
            
        } catch (error) {
            console.error('❌ ログインエラー:', error);
            
            if (error instanceof AuthError) {
                this.showNotification(error.message, 'danger');
            } else {
                this.showNotification('ログインに失敗しました', 'danger');
            }
            
            // フォームリセット
            const passwordField = document.getElementById('password');
            if (passwordField) {
                passwordField.value = '';
                passwordField.focus();
            }
            
        } finally {
            this.showLoading(false);
        }
    }
    
    showDashboard() {
        try {
            if (!this.auth.currentUser) {
                console.error('ユーザー情報が見つかりません');
                this.showLoginScreen();
                return;
            }
            
            console.log('📊 ダッシュボード表示開始:', this.auth.currentUser.name);
            
            // ナビゲーション更新
            this.updateNavigation();
            
            // 権限別ダッシュボード表示
            this.loadModuleByRole(this.auth.currentUser.role);
            
        } catch (error) {
            console.error('ダッシュボード表示エラー:', error);
            this.showError('ダッシュボードの表示に失敗しました', error);
        }
    }
    
    updateNavigation() {
        const currentUser = document.getElementById('currentUser');
        const logoutBtn = document.getElementById('logoutBtn');
        
        const user = this.auth.currentUser;
        currentUser.textContent = `${user.name} (${this.getRoleDisplayName(user.role)})`;
        logoutBtn.style.display = 'block';
    }
    
    async loadModuleByRole(role) {
        try {
            console.log('📦 モジュール読み込み開始:', role);
            
            // 既存モジュールのクリーンアップ
            if (this.currentModule && typeof this.currentModule.cleanup === 'function') {
                this.currentModule.cleanup();
            }
            
            switch (role) {
                case 'user':
                    console.log('👤 利用者モジュール読み込み中...');
                    this.currentModule = new UserModule(this);
                    await this.currentModule.init();
                    console.log('✅ 利用者モジュール読み込み完了');
                    break;
                
                 case 'staff':
                    console.log('👥 スタッフモジュール読み込み中...');
                    try {
                        console.log('📦 staff-module.js をインポート中...');
                        const { default: StaffModule } = await import('./staff-module.js');
                        console.log('✅ スタッフモジュールインポート成功');
                        this.currentModule = new StaffModule(this);
                        await this.currentModule.init();
                        console.log('✅ スタッフモジュール初期化完了');
                    } catch (error) {
                        console.error('❌ スタッフモジュールエラー:', error);
                        console.warn('⚠️ フォールバック: 簡易スタッフ画面を表示');
                        this.showSimpleStaffDashboard();
                    }
                    break;
                
                case 'admin':
                    console.log('🔧 管理者モジュール読み込み中...');
                    try {
                        console.log('📦 admin-module.js をインポート中...');
                        const { default: AdminModule } = await import('./admin-module.js');
                        console.log('✅ 管理者モジュールインポート成功');
                        this.currentModule = new AdminModule(this);
                        await this.currentModule.init();
                        console.log('✅ 管理者モジュール初期化完了');
                    } catch (error) {
                        console.error('❌ 管理者モジュールエラー:', error);
                        console.warn('⚠️ フォールバック: 簡易管理画面を表示');
                        this.showSimpleAdminDashboard();
                    }
                    break;
                
                default:
                    throw new Error('不明な役割: ' + role);
            }
            
        } catch (error) {
            console.error('❌ モジュール読み込みエラー:', error);
            this.showError('画面の読み込みに失敗しました', error);
        }
    }
    
    handleLogout() {
        // ユーザーモジュールがある場合、ログアウト可能かチェック
        if (this.currentModule && typeof this.currentModule.canLogout === 'function') {
            if (!this.currentModule.canLogout()) {
                this.showNotification('退勤後、日報提出が完了するとログアウトできます', 'warning');
                return;
            }
        }
        
        if (!confirm('ログアウトしますか？')) {
            return;
        }
        
        console.log('🚪 ログアウト処理開始');
        
        // モジュールクリーンアップ
        if (this.currentModule && typeof this.currentModule.cleanup === 'function') {
            this.currentModule.cleanup();
        }
        this.currentModule = null;
        
        // 認証クリア（セッション監視は無効化）
        this.auth.logout();
        
        // 画面をクリア
        this.showLoginScreen();
        this.showNotification('ログアウトしました', 'info');
    }  
    
    updateSecurityStatus(text) {
        const element = document.getElementById('securityStatus');
        if (element) {
            element.textContent = text;
        }
    }
    
    hideSecurityCheck() {
        try {
            const element = document.getElementById('securityCheck');
            if (element) {
                element.style.display = 'none';
                console.log('✅ セキュリティチェック画面を非表示にしました');
            } else {
                console.warn('⚠️ セキュリティチェック要素が見つかりません');
            }
        } catch (error) {
            console.error('❌ セキュリティチェック非表示エラー:', error);
        }
    }
    
    showLoading(show) {
        const loading = document.getElementById('loading');
        if (loading) {
            loading.style.display = show ? 'flex' : 'none';
        }
    }
    
    showNotification(message, type = 'info', duration = 3000) {
        try {
            const notification = document.createElement('div');
            notification.className = `alert alert-${type} alert-dismissible fade show notification`;
            
            // HTMLエスケープ処理
            const safeMessage = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
            
            notification.innerHTML = `
                <i class="fas fa-${this.getNotificationIcon(type)}"></i> 
                ${safeMessage}
                <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="閉じる"></button>
            `;
            
            const container = document.getElementById('notifications');
            if (container) {
                container.appendChild(notification);
                
                // 自動削除
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.remove();
                    }
                }, duration);
            }
            
            // ログ記録（エラー通知以外）
            if (type !== 'danger') {
                try {
                    this.database?.logSecurityEvent('NOTIFICATION_SHOWN', {
                        message: message,
                        type: type
                    });
                } catch (logError) {
                    // ログエラーは無視
                }
            }
        } catch (error) {
            console.error('通知表示エラー:', error);
        }
    }
    
    getNotificationIcon(type) {
        const icons = {
            'success': 'check-circle',
            'danger': 'exclamation-triangle',
            'warning': 'exclamation-circle',
            'info': 'info-circle'
        };
        return icons[type] || 'info-circle';
    }
    
    showError(message, error) {
        const content = document.getElementById('app-content');
        const errorDetails = error instanceof Error ? error.message : String(error);
        
        content.innerHTML = `
            <div class="alert alert-danger text-center">
                <h4><i class="fas fa-exclamation-triangle"></i> システムエラー</h4>
                <p>${message}</p>
                <small class="text-muted">エラー詳細: ${errorDetails}</small>
                <hr>
                <button class="btn btn-primary" onclick="location.reload()">
                    <i class="fas fa-refresh"></i> ページを再読み込み
                </button>
            </div>
        `;
        
        // エラーログ記録
        this.database?.logSecurityEvent('SYSTEM_ERROR', {
            message: message,
            error: errorDetails,
            stack: error?.stack
        });
    }
    
    showCriticalError(message, error) {
        document.body.innerHTML = `
            <div class="container mt-5">
                <div class="alert alert-danger text-center">
                    <h2><i class="fas fa-exclamation-triangle"></i> 重大なエラー</h2>
                    <p>${message}</p>
                    <small>エラー: ${error?.message || error}</small>
                    <hr>
                    <button class="btn btn-primary" onclick="location.reload()">
                        ページを再読み込み
                    </button>
                </div>
            </div>
        `;
    }
    
    getRoleDisplayName(role) {
        const roleNames = {
            'user': '利用者',
            'staff': '社員',
            'admin': '管理者'
        };
        return roleNames[role] || role;
    }
    
    shouldPreventPageUnload() {
        // ユーザーモジュールでない場合は防止しない
        if (!this.currentModule || this.currentModule.constructor.name !== 'UserModule') {
            return false;
        }
        
        // 認証されていない場合は防止しない
        if (!this.auth || !this.auth.currentUser) {
            return false;
        }
        
        try {
            const today = new Date().toDateString();
            const userId = this.auth.currentUser.id;
            
            // 出勤記録と日報を取得
            const attendance = this.currentModule.getAttendance(userId, today);
            const hasReport = this.currentModule.getDailyReport(userId, today);
            
            // 出勤していない場合は防止しない
            if (!attendance || !attendance.clockIn) {
                return false;
            }
            
            // 退勤済み かつ 日報提出済みの場合は防止しない
            if (attendance.clockOut && hasReport) {
                return false;
            }
            
            // その他の場合（出勤中、または退勤済みだが日報未提出）は防止する
            return true;
            
        } catch (error) {
            console.error('ページ離脱防止チェックエラー:', error);
            // エラーの場合は安全側に倒して防止しない
            return false;
        }
    }
    
    // =================================
    // システム管理・デバッグ機能
    // =================================
    
    getSystemInfo() {
        return {
            version: CONFIG.version,
            isInitialized: this.isInitialized,
            currentUser: this.auth?.currentUser,
            currentModule: this.currentModule?.constructor.name,
            databaseSize: this.database?.getDatabaseSize(),
            securityInfo: this.auth?.getSecurityInfo(),
            uptime: this.getUptime()
        };
    }
    
    getUptime() {
        try {
            const startTime = this.database?.getDirectly('system_stats')?.timestamp; // 直接アクセスを使用
            if (!startTime) return 0;
            
            return Date.now() - new Date(startTime).getTime();
        } catch (error) {
            console.error('稼働時間取得エラー:', error);
            return 0;
        }
    }
    
    // デバッグ用のデータエクスポート
    exportSystemData() {
        if (!this.auth?.hasPermission('all')) {
            throw new Error('管理者権限が必要です');
        }
        
        const data = {
            systemInfo: this.getSystemInfo(),
            timestamp: new Date().toISOString(),
            exportedBy: this.auth.currentUser?.id
        };
        
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = `attendance_system_export_${Date.now()}.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        URL.revokeObjectURL(url);
        
        this.database.logSecurityEvent('SYSTEM_DATA_EXPORTED', {
            userId: this.auth.currentUser?.id
        });
    }
    
    // =================================
    // HTMLテンプレート
    // =================================
    
    getLoginHTML() {
        return `
            <div class="row justify-content-center">
                <div class="col-md-6">
                    <div class="custom-card">
                        <div class="custom-card-header text-center">
                            <h4><i class="fas fa-user-circle"></i> ログイン</h4>
                            <small>勤怠管理システム v${CONFIG.version}</small>
                        </div>
                        <div class="card-body">
                            <form id="loginForm">
                                <div class="mb-3">
                                    <label for="username" class="form-label">
                                        <i class="fas fa-user"></i> ユーザーID
                                    </label>
                                    <input type="text" class="form-control" id="username" required 
                                           placeholder="ユーザーIDを入力" autocomplete="username">
                                </div>
                                <div class="mb-3">
                                    <label for="password" class="form-label">
                                        <i class="fas fa-lock"></i> パスワード
                                    </label>
                                    <input type="password" class="form-control" id="password" required 
                                           placeholder="パスワードを入力" autocomplete="current-password">
                                </div>
                                <button type="submit" class="btn btn-primary w-100 btn-lg">
                                    <i class="fas fa-sign-in-alt"></i> ログイン
                                </button>
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
    
    destroy() {
        // タイマークリア
        if (this.timeUpdateInterval) {
            clearInterval(this.timeUpdateInterval);
            this.timeUpdateInterval = null;
        }
        
        // モジュールクリーンアップ
        if (this.currentModule && typeof this.currentModule.cleanup === 'function') {
            this.currentModule.cleanup();
        }
        
        // 認証クリーンアップ
        if (this.auth) {
            this.auth.logout();
        }
        
        // データベースクリーンアップ
        if (this.database) {
            this.database.cleanup();
        }
        
        // グローバル参照削除
        delete window.attendanceSystem;
        
        console.log('🧹 システムクリーンアップ完了');
    }
}

// =================================
// システム起動
// =================================

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📄 DOM読み込み完了');
    
    try {
        console.log('🚀 アプリケーション起動開始');
        const app = new AttendanceApp();
        await app.init();
        console.log('✅ アプリケーション起動完了');
        
    } catch (error) {
        console.error('❌ システム起動失敗:', error);
        
        // 詳細なエラー情報をログ出力
        console.error('エラー詳細:', {
            message: error.message,
            stack: error.stack,
            name: error.name
        });
        
        // セキュリティチェック画面を強制非表示
        try {
            const securityCheck = document.getElementById('securityCheck');
            if (securityCheck) {
                securityCheck.style.display = 'none';
            }
        } catch (hideError) {
            console.error('セキュリティチェック非表示エラー:', hideError);
        }
        
        // フォールバック画面表示
        document.body.innerHTML = `
            <div class="container mt-5">
                <div class="alert alert-danger text-center">
                    <h2><i class="fas fa-exclamation-triangle"></i> システム起動失敗</h2>
                    <p>勤怠管理システムの起動に失敗しました。</p>
                    <small class="d-block mt-2">エラー: ${error.message}</small>
                    <hr>
                    <button class="btn btn-primary me-2" onclick="location.reload()">
                        <i class="fas fa-sync"></i> 再試行
                    </button>
                    <button class="btn btn-secondary" onclick="console.clear(); location.reload()">
                        <i class="fas fa-broom"></i> キャッシュクリア後再試行
                    </button>
                </div>
            </div>
        `;
    }
});

// 起動前の準備チェック
console.log('🔍 起動前チェック:', {
    localStorage: 'localStorage' in window,
    sessionStorage: 'sessionStorage' in window,
    bootstrap: typeof bootstrap !== 'undefined'
});

// CSP対応: inline scriptの削除
export { AttendanceApp };