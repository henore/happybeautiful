// ==========================================
// 認証管理モジュール（セキュリティ強化版・新規登録ユーザー対応）
// ==========================================

import { CONFIG, USERS } from './config.js';

export class AuthManager {
    constructor(database) {
        this.database = database;
        this.currentUser = null;
        this.sessionTimeout = CONFIG.security.sessionTimeout;
        this.maxLoginAttempts = CONFIG.security.maxLoginAttempts;
        this.lockoutDuration = CONFIG.security.lockoutDuration;
        this.sessionId = null;
        
        this.init();
    }
    
    init() {
        // セッション復元の試行
        this.attemptSessionRestore();
        
        // セッション監視の開始
        this.startSessionMonitoring();
        
        // セキュリティイベントの初期化
        this.initSecurityEvents();
    }
    
    // セッション復元
    attemptSessionRestore() {
        try {
            const session = this.getStoredSession();
            
            if (session && this.isSessionValid(session)) {
                this.currentUser = session.user;
                this.sessionId = session.sessionId;
                
                // セッション更新
                this.updateSessionActivity();
                
                this.database.logSecurityEvent('SESSION_RESTORED', {
                    userId: this.currentUser.id,
                    sessionId: this.sessionId
                });
                
                console.log('📋 セッション復元:', this.currentUser.name);
                return true;
            } else if (session) {
                // 無効なセッションをクリーンアップ
                this.clearSession();
                this.database.logSecurityEvent('SESSION_EXPIRED', {
                    sessionId: session.sessionId
                });
            }
        } catch (error) {
            console.error('セッション復元エラー:', error);
            this.clearSession();
        }
        
        return false;
    }
    
    // 全ユーザー情報の取得（デフォルト＋登録済み）
    getAllUsersMap() {
        const allUsers = new Map(USERS); // デフォルトユーザーをコピー
        
        // 登録済みユーザーを追加
        const registeredUsers = this.database.get('registered_users') || [];
        registeredUsers.forEach(user => {
            if (!user.isRetired && user.password) { // 退職者と有効なパスワードがないユーザーは除外
                allUsers.set(user.id, {
                    password: user.password,
                    role: user.role,
                    name: user.name,
                    permissions: this.getRolePermissions(user.role)
                });
            }
        });
        
        return allUsers;
    }
    
    // 役割に基づく権限の取得
    getRolePermissions(role) {
        const permissionMap = {
            'admin': ['all'],
            'staff': ['view_reports', 'add_comments'],
            'parttime': ['view_reports', 'add_comments'],
            'user': ['self_report']
        };
        
        return permissionMap[role] || [];
    }
    
    // ログイン処理（セキュリティ強化版）
    async login(username, password) {
        try {
            console.log('🔐 ログイン処理開始:', username);
            
            // 入力値の検証
            if (!username || !password) {
                throw new AuthError('ユーザーIDとパスワードを入力してください', 'MISSING_CREDENTIALS');
            }
            
            // ログイン試行回数チェック
            if (this.isAccountLocked(username)) {
                const lockInfo = this.getLockInfo(username);
                const remainingTime = Math.ceil((lockInfo.lockedUntil - Date.now()) / 1000 / 60);
                throw new AuthError(`アカウントがロックされています。${remainingTime}分後に再試行してください`, 'ACCOUNT_LOCKED');
            }
            
            // 全ユーザーから検索（デフォルト＋登録済み）
            const allUsers = this.getAllUsersMap();
            const user = allUsers.get(username);
            
            if (!user) {
                console.log('❌ ユーザーが見つかりません:', username);
                this.recordFailedLogin(username, 'USER_NOT_FOUND');
                throw new AuthError('ユーザーIDまたはパスワードが間違っています', 'INVALID_CREDENTIALS');
            }
            
            console.log('✅ ユーザー情報取得:', user.name);
            
            // パスワード検証（開発用：平文比較）
            const isPasswordValid = (user.password === password);
            
            console.log('🔑 パスワード検証結果:', isPasswordValid);
            
            if (!isPasswordValid) {
                console.log('❌ パスワードが一致しません');
                this.recordFailedLogin(username, 'INVALID_PASSWORD');
                throw new AuthError('ユーザーIDまたはパスワードが間違っています', 'INVALID_CREDENTIALS');
            }
            
            // ログイン成功処理
            this.clearFailedLogins(username);
            
            this.currentUser = {
                id: username,
                name: user.name,
                role: user.role,
                permissions: user.permissions,
                loginTime: new Date().toISOString()
            };
            
            this.sessionId = this.generateSecureSessionId();
            this.saveSession();
            
            // セキュリティログ記録
            this.database.logSecurityEvent('LOGIN_SUCCESS', {
                userId: username,
                sessionId: this.sessionId,
                userAgent: navigator.userAgent.slice(0, 100)
            });
            
            console.log('✅ ログイン成功:', this.currentUser.name);
            return this.currentUser;
            
        } catch (error) {
            if (error instanceof AuthError) {
                console.log('❌ 認証エラー:', error.message);
                throw error;
            }
            
            console.error('❌ ログインエラー:', error);
            throw new AuthError('ログイン処理中にエラーが発生しました', 'LOGIN_ERROR');
        }
    }
    
    // ログアウト処理
    logout() {
        if (this.currentUser) {
            this.database.logSecurityEvent('LOGOUT', {
                userId: this.currentUser.id,
                sessionId: this.sessionId,
                sessionDuration: this.getSessionDuration()
            });
            
            console.log('🚪 ログアウト:', this.currentUser.name);
        }
        
        this.currentUser = null;
        this.sessionId = null;
        this.clearSession();
        this.stopSessionMonitoring();
    }
    
    // セッション管理
    saveSession() {
        try {
            const session = {
                user: this.currentUser,
                sessionId: this.sessionId,
                timestamp: Date.now(),
                lastActivity: Date.now(),
                userAgent: navigator.userAgent.slice(0, 100)
            };
            
            // セッションストレージに保存（機密データとして暗号化）
            const sessionKey = 'session_data';
            this.database.set(sessionKey, session);
            
            // セッション活動記録も保存
            this.updateSessionActivity();
            
        } catch (error) {
            console.error('セッション保存エラー:', error);
        }
    }
    
    getStoredSession() {
        try {
            const sessionKey = 'session_data';
            return this.database.getDirectly(sessionKey); // 直接アクセスを使用
        } catch (error) {
            console.error('セッション取得エラー:', error);
            return null;
        }
    }
    
    isSessionValid(session) {
        if (!session || !session.timestamp || !session.lastActivity) {
            return false;
        }
        
        const now = Date.now();
        const sessionAge = now - session.timestamp;
        const lastActivity = now - session.lastActivity;
        
        // セッション全体の有効期限チェック（24時間）
        const maxSessionAge = 24 * 60 * 60 * 1000;
        if (sessionAge > maxSessionAge) {
            return false;
        }
        
        // 非活動タイムアウトチェック
        return lastActivity < this.sessionTimeout;
    }
    
    updateSessionActivity() {
        try {
            const session = this.getStoredSession();
            if (session) {
                session.lastActivity = Date.now();
                this.database.set('session_data', session);
            }
        } catch (error) {
            console.error('セッション活動更新エラー:', error);
        }
    }
    
    clearSession() {
        try {
            this.database.delete('session_data');
        } catch (error) {
            console.error('セッションクリアエラー:', error);
        }
    }
    
    // セッション監視
    startSessionMonitoring() {
        // 1分ごとにセッションの有効性をチェック
        this.sessionTimer = setInterval(() => {
            if (this.currentUser) {
                const session = this.getStoredSession();
                if (!session || !this.isSessionValid(session)) {
                    this.handleSessionExpired();
                }
            }
        }, 60000); // 1分
        
        // ユーザー活動検知
        this.setupActivityDetection();
    }
    
    stopSessionMonitoring() {
        if (this.sessionTimer) {
            clearInterval(this.sessionTimer);
            this.sessionTimer = null;
        }
        
        this.removeActivityDetection();
    }
    
    setupActivityDetection() {
        const updateActivity = () => {
            if (this.currentUser) {
                this.updateSessionActivity();
            }
        };
        
        // ユーザー活動イベント
        const events = ['click', 'keypress', 'scroll', 'mousemove'];
        events.forEach(event => {
            document.addEventListener(event, updateActivity, { passive: true });
        });
        
        this.activityListeners = events.map(event => ({
            event,
            handler: updateActivity
        }));
    }
    
    removeActivityDetection() {
        if (this.activityListeners) {
            this.activityListeners.forEach(({ event, handler }) => {
                document.removeEventListener(event, handler);
            });
            this.activityListeners = null;
        }
    }
    
    handleSessionExpired() {
        this.database.logSecurityEvent('SESSION_EXPIRED', {
            userId: this.currentUser?.id,
            sessionId: this.sessionId
        });
        
        // セッション期限切れの通知
        if (window.attendanceSystem && typeof window.attendanceSystem.showNotification === 'function') {
            window.attendanceSystem.showNotification('セッションが期限切れです。再度ログインしてください。', 'warning');
        }
        
        // 強制ログアウト
        this.logout();
        
        // ログイン画面に戻る
        if (window.attendanceSystem && typeof window.attendanceSystem.showLoginScreen === 'function') {
            window.attendanceSystem.showLoginScreen();
        }
    }
    
    // ログイン試行管理
    recordFailedLogin(username, reason) {
        try {
            const key = `login_attempts_${username}`;
            const attempts = this.database.get(key) || {
                count: 0,
                lastAttempt: null,
                lockedUntil: null
            };
            
            attempts.count++;
            attempts.lastAttempt = Date.now();
            
            // 最大試行回数に達した場合はロック
            if (attempts.count >= this.maxLoginAttempts) {
                attempts.lockedUntil = Date.now() + this.lockoutDuration;
                
                this.database.logSecurityEvent('ACCOUNT_LOCKED', {
                    userId: username,
                    attempts: attempts.count,
                    reason: reason,
                    lockedUntil: attempts.lockedUntil
                });
            }
            
            this.database.set(key, attempts);
            
            this.database.logSecurityEvent('LOGIN_FAILED', {
                userId: username,
                reason: reason,
                attemptCount: attempts.count
            });
            
        } catch (error) {
            console.error('ログイン試行記録エラー:', error);
        }
    }
    
    clearFailedLogins(username) {
        try {
            const key = `login_attempts_${username}`;
            this.database.delete(key);
        } catch (error) {
            console.error('ログイン試行クリアエラー:', error);
        }
    }
    
    isAccountLocked(username) {
        try {
            const key = `login_attempts_${username}`;
            const attempts = this.database.get(key);
            
            if (!attempts || !attempts.lockedUntil) {
                return false;
            }
            
            if (Date.now() > attempts.lockedUntil) {
                // ロック期間が過ぎている場合はクリア
                this.clearFailedLogins(username);
                return false;
            }
            
            return true;
        } catch (error) {
            console.error('アカウントロック確認エラー:', error);
            return false;
        }
    }
    
    getLockInfo(username) {
        const key = `login_attempts_${username}`;
        return this.database.get(key) || {};
    }
    
    // セキュリティユーティリティ
    generateSecureSessionId() {
        const array = new Uint8Array(32);
        crypto.getRandomValues(array);
        return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
    }
    
    getSessionDuration() {
        const session = this.getStoredSession();
        if (!session || !session.timestamp) {
            return 0;
        }
        
        return Date.now() - session.timestamp;
    }
    
    // 権限チェック
    hasPermission(permission) {
        if (!this.currentUser || !this.currentUser.permissions) {
            return false;
        }
        
        return this.currentUser.permissions.includes('all') || 
               this.currentUser.permissions.includes(permission);
    }
    
    requirePermission(permission) {
        if (!this.hasPermission(permission)) {
            throw new AuthError('この操作を実行する権限がありません', 'INSUFFICIENT_PERMISSIONS');
        }
    }
    
    // セキュリティイベント初期化
    initSecurityEvents() {
        // ページの可視性変更を監視
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && this.currentUser) {
                this.updateSessionActivity();
            }
        });
        
        // ページ離脱時のクリーンアップ
        window.addEventListener('beforeunload', () => {
            if (this.currentUser) {
                this.database.logSecurityEvent('PAGE_UNLOAD', {
                    userId: this.currentUser.id,
                    sessionId: this.sessionId
                });
            }
        });
    }
    
    // セキュリティ情報取得
    getSecurityInfo() {
        return {
            currentUser: this.currentUser,
            sessionId: this.sessionId,
            sessionValid: this.currentUser ? this.isSessionValid(this.getStoredSession()) : false,
            sessionDuration: this.getSessionDuration(),
            lastActivity: this.getStoredSession()?.lastActivity
        };
    }
}

// カスタム認証エラークラス
export class AuthError extends Error {
    constructor(message, code) {
        super(message);
        this.name = 'AuthError';
        this.code = code;
        this.timestamp = new Date().toISOString();
    }
}