// ==========================================
// 設定管理モジュール
// ==========================================

// システム設定（暗号化された形式で保存）
const SYSTEM_CONFIG = {
    name: "勤怠管理システム",
    version: "4.0.0",
    prefix: "att_sys_",
    security: {
       // sessionTimeout: 30 * 60 * 1000, // 30分
        maxLoginAttempts: 3,
       // lockoutDuration: 15 * 60 * 1000, // 15分
        encryptionEnabled: true
    },
    time: {
        workStart: "09:00",
        workEnd: "15:45",
        minHours: 1,
        roundUpMinutes: 15
    },
    validation: {
        maxTextLength: 500,
        requiredFields: ['workContent', 'reflection', 'temperature', 'appetite', 'sleepQuality']
    }
};

// セキュアなユーザー設定（開発用 - 本番環境では外部認証システムを使用推奨）
const SECURE_USERS = new Map([
    ['admin', { 
        password: 'admin123',  // 開発用：平文保存
        role: 'admin', 
        name: '管理者',
        permissions: ['all']
    }],
    ['staff1', { 
        password: 'staff123',  // 開発用：平文保存
        role: 'staff', 
        name: 'スタッフ1',
        permissions: ['view_reports', 'add_comments']
    }],
    ['user1', { 
        password: 'user123',  // 開発用：平文保存
        role: 'user', 
        name: '利用者1',
        permissions: ['self_report']
    }],
    ['user2', { 
        password: 'user123',  // 開発用：平文保存
        role: 'user', 
        name: '利用者2',
        permissions: ['self_report']
    }]
]);

// データベース管理クラス（セキュリティ強化版）
export class SecureDatabase {
    constructor() {
        this.prefix = SYSTEM_CONFIG.prefix;
        this.encryptionKey = this.generateEncryptionKey();
        this.logThrottle = new Map(); // ログ記録の抑制用
        this.init();
    }
    
    init() {
        try {
            if (!this.getDirectly('system_initialized')) {
                this.setDirectly('system_initialized', {
                    version: SYSTEM_CONFIG.version,
                    created_at: new Date().toISOString(),
                    security_level: 'enhanced'
                });
                console.log('✅ セキュアデータベース初期化完了');
            }
            
            // セキュリティ監査ログの初期化
            this.initSecurityLog();
        } catch (error) {
            console.error('❌ データベース初期化エラー:', error);
            throw new Error('データベースの初期化に失敗しました');
        }
    }
    
    generateEncryptionKey() {
        // 簡易暗号化キー生成（本番環境ではより強固な方式を使用）
        const userAgent = navigator.userAgent;
        const timeStamp = Date.now().toString();
        return btoa(userAgent + timeStamp).slice(0, 16);
    }
    
    initSecurityLog() {
        if (!this.getDirectly('security_log')) {
            this.setDirectly('security_log', []);
        }
    }
    
    // セキュリティログ記録（頻度制限付き）
    logSecurityEvent(event, details) {
        try {
            // 同じイベントの記録頻度を制限（1秒間隔）
            const throttleKey = event + '_' + (details?.key || '');
            const lastLog = this.logThrottle.get(throttleKey);
            const now = Date.now();
            
            if (lastLog && (now - lastLog) < 1000) {
                return; // 1秒以内の同じイベントはスキップ
            }
            
            this.logThrottle.set(throttleKey, now);
            
            // 循環参照を防ぐため、直接localStorageにアクセス
            const logs = this.getDirectly('security_log') || [];
            const logEntry = {
                timestamp: new Date().toISOString(),
                event: event,
                details: details,
                userAgent: navigator.userAgent.slice(0, 100), // 最初の100文字のみ
                sessionId: this.generateSessionId()
            };
            
            logs.push(logEntry);
            
            // ログは最新1000件まで保持
            if (logs.length > 1000) {
                logs.splice(0, logs.length - 1000);
            }
            
            this.setDirectly('security_log', logs);
            
            // 古いthrottleエントリをクリーンアップ（メモリリーク防止）
            if (this.logThrottle.size > 100) {
                const entries = Array.from(this.logThrottle.entries());
                entries.slice(0, 50).forEach(([key]) => {
                    this.logThrottle.delete(key);
                });
            }
            
        } catch (error) {
            console.error('セキュリティログ記録エラー:', error);
        }
    }
    
    generateSessionId() {
        return Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
    
    // 2. 暗号化処理の改善（UTF-8対応）
    // データの暗号化（簡易版）
    encrypt(data) {
        if (!SYSTEM_CONFIG.security.encryptionEnabled) {
            return data;
        }
        
        try {
            // データの検証
            if (data === null || data === undefined) {
                return data;
            }
            
            const jsonString = JSON.stringify(data);
            
            // 日本語や特殊文字を安全にBase64エンコード
            const utf8Bytes = new TextEncoder().encode(jsonString);
            const base64String = btoa(String.fromCharCode(...utf8Bytes));
            
            return base64String;
        } catch (error) {
            console.error('暗号化エラー:', error);
            console.warn('暗号化に失敗したため、元のデータを返します');
            return data;
        }
    }

        // 3. 復号化処理の改善（エラーハンドリング強化）
        // データの復号化（簡易版）
        decrypt(encryptedData) {
            if (!SYSTEM_CONFIG.security.encryptionEnabled || !encryptedData) {
                return encryptedData;
            }
            
            try {
                // データ形式の検証
                if (typeof encryptedData !== 'string') {
                    console.warn('復号化対象が文字列ではありません:', typeof encryptedData);
                    return encryptedData;
                }
                
                // Base64形式の検証
                const base64Regex = /^[A-Za-z0-9+/]*={0,2}$/;
                if (!base64Regex.test(encryptedData)) {
                    console.warn('Base64形式ではありません、平文として返します');
                    return encryptedData;
                }
                
                // 安全にBase64デコード
                const binaryString = atob(encryptedData);
                const bytes = new Uint8Array(binaryString.length);
                for (let i = 0; i < binaryString.length; i++) {
                    bytes[i] = binaryString.charCodeAt(i);
                }
                const jsonString = new TextDecoder().decode(bytes);
                
                return JSON.parse(jsonString);
            } catch (error) {
                console.error('復号化エラー:', error);
                console.warn('復号化に失敗したため、元のデータを返します');
                return encryptedData;
            }
        }
    
    // データ取得（セキュア版）
    get(key) {
        try {
            const fullKey = this.prefix + key;
            const rawData = localStorage.getItem(fullKey);
            
            if (!rawData) {
                return null;
            }
            
            // セキュリティログ記録（security_log自体の取得時は記録しない）
            if (key !== 'security_log') {
                this.logSecurityEvent('DATA_ACCESS', { key: key });
            }
            
            const parsedData = JSON.parse(rawData);
            
            // 暗号化されたデータの場合は復号化
            if (parsedData && parsedData.encrypted) {
                return this.decrypt(parsedData.data);
            }
            
            return parsedData;
        } catch (error) {
            console.error('データ取得エラー:', error);
            if (key !== 'security_log') {
                this.logSecurityEvent('DATA_ACCESS_ERROR', { key: key, error: error.message });
            }
            return null;
        }
    }
    
    // 直接アクセス（ログ記録なし）
    getDirectly(key) {
        try {
            const fullKey = this.prefix + key;
            const rawData = localStorage.getItem(fullKey);
            
            if (!rawData) {
                return null;
            }
            
            const parsedData = JSON.parse(rawData);
            
            // 暗号化されたデータの場合は復号化
            if (parsedData && parsedData.encrypted) {
                return this.decrypt(parsedData.data);
            }
            
            return parsedData;
        } catch (error) {
            console.error('直接データ取得エラー:', error);
            return null;
        }
    }
    
    // データ保存（セキュア版）
    set(key, value) {
        try {
            const fullKey = this.prefix + key;
            
            // 機密データの場合は暗号化
            const shouldEncrypt = this.shouldEncryptKey(key);
            let dataToStore;
            
            if (shouldEncrypt) {
                dataToStore = {
                    encrypted: true,
                    data: this.encrypt(value),
                    timestamp: new Date().toISOString()
                };
            } else {
                dataToStore = value;
            }
            
            localStorage.setItem(fullKey, JSON.stringify(dataToStore));
            
            // セキュリティログ記録（security_log自体の保存時は記録しない）
            if (key !== 'security_log') {
                this.logSecurityEvent('DATA_WRITE', { key: key, encrypted: shouldEncrypt });
            }
            
            return true;
        } catch (error) {
            console.error('データ保存エラー:', error);
            if (key !== 'security_log') {
                this.logSecurityEvent('DATA_WRITE_ERROR', { key: key, error: error.message });
            }
            return false;
        }
    }
    
    // 直接保存（ログ記録なし）
    setDirectly(key, value) {
        try {
            const fullKey = this.prefix + key;
            
            // 機密データの場合は暗号化
            const shouldEncrypt = this.shouldEncryptKey(key);
            let dataToStore;
            
            if (shouldEncrypt) {
                dataToStore = {
                    encrypted: true,
                    data: this.encrypt(value),
                    timestamp: new Date().toISOString()
                };
            } else {
                dataToStore = value;
            }
            
            localStorage.setItem(fullKey, JSON.stringify(dataToStore));
            return true;
        } catch (error) {
            console.error('直接データ保存エラー:', error);
            return false;
        }
    }
    
    // キーが暗号化対象かどうかを判定
    shouldEncryptKey(key) {
        const sensitiveKeys = [
            'login_attempts',
            'session_data',
            'security_log',
            'user_activity'
        ];
        
        return sensitiveKeys.some(pattern => key.includes(pattern));
    }
    
    // データ削除（セキュア版）
    delete(key) {
        try {
            const fullKey = this.prefix + key;
            localStorage.removeItem(fullKey);
            
            this.logSecurityEvent('DATA_DELETE', { key: key });
            return true;
        } catch (error) {
            console.error('データ削除エラー:', error);
            return false;
        }
    }
    
    // セキュリティ監査用：データサイズ取得
    getDatabaseSize() {
        try {
            let totalSize = 0;
            const prefix = this.prefix;
            
            for (let i = 0; i < localStorage.length; i++) {
                const key = localStorage.key(i);
                if (key && key.startsWith(prefix)) {
                    const value = localStorage.getItem(key);
                    totalSize += key.length + (value ? value.length : 0);
                }
            }
            
            return {
                totalSize: totalSize,
                readableSize: this.formatBytes(totalSize),
                itemCount: this.getItemCount()
            };
        } catch (error) {
            console.error('データサイズ取得エラー:', error);
            return { totalSize: 0, readableSize: '0 B', itemCount: 0 };
        }
    }
    
    getItemCount() {
        let count = 0;
        const prefix = this.prefix;
        
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(prefix)) {
                count++;
            }
        }
        
        return count;
    }
    
    formatBytes(bytes) {
        if (bytes === 0) return '0 B';
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(1024));
        return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    }
    
    // セキュリティクリーンアップ
    cleanup() {
        try {
            // 古いセキュリティログを削除
            const logs = this.getDirectly('security_log') || [];
            const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            
            const recentLogs = logs.filter(log => new Date(log.timestamp) > oneWeekAgo);
            this.setDirectly('security_log', recentLogs);
            
            console.log('✅ データベースクリーンアップ完了');
        } catch (error) {
            console.error('❌ クリーンアップエラー:', error);
        }
    }
}

// バリデーションユーティリティ
export class ValidationUtil {
    static validateWorkContent(content) {
        if (!content || content.trim().length === 0) {
            return { valid: false, message: '作業内容は必須です' };
        }
        
        if (content.length > SYSTEM_CONFIG.validation.maxTextLength) {
            return { valid: false, message: `作業内容は${SYSTEM_CONFIG.validation.maxTextLength}文字以内で入力してください` };
        }
        
        return { valid: true };
    }
    
    static validateTemperature(temp) {
        const tempNum = parseFloat(temp);
        if (isNaN(tempNum) || tempNum < 35.0 || tempNum > 40.0) {
            return { valid: false, message: '体温は35.0℃〜40.0℃の範囲で入力してください' };
        }
        
        return { valid: true };
    }
    
    static validateTimeRange(startTime, endTime) {
        if (!startTime || !endTime) {
            return { valid: false, message: '時間は必須です' };
        }
        
        const start = new Date(`1970-01-01 ${startTime}`);
        const end = new Date(`1970-01-01 ${endTime}`);
        
        if (start >= end) {
            return { valid: false, message: '終了時間は開始時間より後にしてください' };
        }
        
        return { valid: true };
    }
    
    static sanitizeInput(input) {
        if (typeof input !== 'string') return input;
        
        return input
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#x27;')
            .replace(/\//g, '&#x2F;');
    }
}

// 設定データのエクスポート
export const CONFIG = SYSTEM_CONFIG;
export const USERS = SECURE_USERS;

// ユーティリティ関数
export const Utils = {
    getCurrentTimeString() {
        const now = new Date();
        return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    },
    
    formatDate(date) {
        return date.toLocaleDateString('ja-JP', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            weekday: 'long'
        });
    },
    
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
};