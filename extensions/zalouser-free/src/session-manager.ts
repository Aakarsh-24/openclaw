/**
 * Zalo Session Manager
 * Handles session storage, login, and message listening
 */

import { Zalo, ThreadType, LoginQRCallbackEventType, type API, type Message, type Credentials, type Cookie, type DestType } from "zca-js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import type { ZaloSession, SessionStore, IncomingMessage, ChatType, SendResult, StatusResult, ZaloUserFreeAccountConfig } from "./types.js";
import { resolveAccount } from "./accounts.js";

// Windows 11 Chrome user agent
const DEFAULT_USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36";

export class ZaloSessionManager {
    private sessions: Map<string, ZaloSession> = new Map();
    private sessionStorePath: string;
    private messageHandler?: (msg: IncomingMessage, accountId: string) => void;
    private logger: any;
    private configProvider?: () => any;
    private chatTypes: Map<string, ChatType> = new Map();

    constructor(sessionPath?: string, logger?: any) {
        this.sessionStorePath =
            sessionPath || path.join(os.homedir(), ".openclaw", "zalouser-free", "sessions.json");
        this.logger = logger || console;
        this.ensureDir();
    }

    setConfigProvider(provider: () => any): void {
        this.configProvider = provider;
    }

    setMessageHandler(handler: (msg: IncomingMessage, accountId: string) => void): void {
        this.messageHandler = handler;
    }

    getChatType(threadId: string): ChatType {
        return this.chatTypes.get(threadId) || "direct";
    }

    private ensureDir(): void {
        const dir = path.dirname(this.sessionStorePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    private loadStore(): SessionStore {
        try {
            if (fs.existsSync(this.sessionStorePath)) {
                const data = fs.readFileSync(this.sessionStorePath, "utf-8");
                return JSON.parse(data);
            }
        } catch (err) {
            this.logger.warn?.("[zalouser-free] Failed to load session store:", err);
        }
        return {};
    }

    private saveStore(store: SessionStore): void {
        try {
            fs.writeFileSync(this.sessionStorePath, JSON.stringify(store, null, 2));
        } catch (err) {
            this.logger.error?.("[zalouser-free] Failed to save session store:", err);
        }
    }

    hasSavedCredentials(accountId: string): boolean {
        const store = this.loadStore();
        return Boolean(store[accountId]?.credentials);
    }

    async loginWithQR(
        accountId: string,
        options?: { userAgent?: string; qrCallback?: (qrData: string) => void }
    ): Promise<{ ok: boolean; userId?: string; error?: string }> {
        try {
            this.logger.info?.(`[zalouser-free] Starting QR login for account: ${accountId}`);

            let imei: string | null = null;
            let userAgent: string | null = null;

            const zalo = new Zalo({
                selfListen: false,
                checkUpdate: false,
                logging: false,
            });

            const api = await zalo.loginQR(
                null,
                (event) => {
                    this.logger.info?.(`[zalouser-free] QR Login event: ${event.type}`);

                    if (event.type === LoginQRCallbackEventType.QRCodeGenerated && event.data) {
                        console.log("\n📱 QR Code Generated!");
                        const data = event.data as any;
                        if (options?.qrCallback && data.qr) {
                            options.qrCallback(data.qr);
                        }
                    }

                    if (event.type === LoginQRCallbackEventType.QRCodeScanned && event.data) {
                        const scanData = event.data as any;
                        console.log(`\n✅ QR Code scanned by: ${scanData.display_name}`);
                        console.log("   Waiting for confirmation on mobile...\n");
                    }

                    if (event.type === LoginQRCallbackEventType.QRCodeExpired) {
                        console.log("\n⚠️  QR Code expired. Generating new one...\n");
                    }

                    if (event.type === LoginQRCallbackEventType.QRCodeDeclined) {
                        console.log("\n❌ Login declined on mobile device\n");
                    }

                    if (event.type === LoginQRCallbackEventType.GotLoginInfo) {
                        if (event.data.imei) {
                            imei = event.data.imei;
                        }
                        if (event.data.userAgent) {
                            userAgent = event.data.userAgent;
                        }
                        console.log("\n✅ Login success\n");
                    }
                }
            );

            const userId = api.getOwnId();
            const cookieJar = api.getCookie();

            // Convert CookieJar to cookie array format
            let cookies: Cookie[] = [];
            if (cookieJar) {
                try {
                    const serialized = (cookieJar.toJSON()).cookies;
                    if (serialized && Array.isArray(serialized)) {
                        cookies = serialized.map((c: any) => ({
                            key: c.key,
                            name: c.key,
                            value: c.value,
                            domain: c.domain,
                            path: c.path,
                            hostOnly: c.hostOnly,
                            httpOnly: c.httpOnly,
                            secure: c.secure,
                            sameSite: c.sameSite || 'unspecified',
                            session: !c.expires,
                            storeId: '0',
                            maxAge: c.maxAge,
                            creation: c.creation,
                            lastAccessed: c.lastAccessed,
                        }));
                        this.logger.info?.(`[zalouser-free] Extracted ${cookies.length} cookies from CookieJar`);
                    }
                } catch (err) {
                    this.logger.error?.("[zalouser-free] Failed to extract cookies:", err);
                }
            }

            if (!imei || !userAgent) {
                this.logger.error?.("[zalouser-free] Failed to extract IMEI or userAgent");
                return { ok: false, error: "Failed to extract IMEI or userAgent" };
            }

            const formattedCredentials: Credentials = {
                cookie: cookies,
                imei,
                userAgent
            };

            const session: ZaloSession = {
                accountId,
                api,
                credentials: formattedCredentials,
                userId,
                isListening: false,
                startedAt: Date.now(),
            };

            this.sessions.set(accountId, session);

            // Save credentials
            const store = this.loadStore();
            store[accountId] = {
                credentials: formattedCredentials,
                userId,
                lastLogin: Date.now(),
            };
            this.saveStore(store);

            this.logger.info?.(`[zalouser-free] Login successful for account: ${accountId}, userId: ${userId}`);

            return { ok: true, userId };
        } catch (err: any) {
            this.logger.error?.("[zalouser-free] Login failed:", err);
            return { ok: false, error: err.message || String(err) };
        }
    }

    async loginWithCredentials(
        accountId: string,
        credentials: Credentials
    ): Promise<{ ok: boolean; userId?: string; error?: string }> {
        try {
            this.logger.info?.(`[zalouser-free] Logging in with saved credentials: ${accountId}`);

            const zalo = new Zalo({
                selfListen: false,
                checkUpdate: false,
                logging: false,
            });

            const api = await zalo.login(credentials);

            const userId = api.getOwnId();

            const session: ZaloSession = {
                accountId,
                api,
                credentials,
                userId,
                isListening: false,
                startedAt: Date.now(),
            };

            this.sessions.set(accountId, session);

            this.logger.info?.(`[zalouser-free] Credential login successful, userId: ${userId}`);

            return { ok: true, userId };
        } catch (err: any) {
            this.logger.error?.("[zalouser-free] Credential login failed:");
            return { ok: false, error: err.message || String(err) };
        }
    }

    async restoreSession(accountId: string): Promise<{ ok: boolean; userId?: string; error?: string }> {
        const store = this.loadStore();
        const saved = store[accountId];

        if (!saved?.credentials) {
            return { ok: false, error: "No saved credentials found" };
        }

        return this.loginWithCredentials(accountId, saved.credentials);
    }

    private convertMessage(message: Message, selfUserId: string): IncomingMessage {
        const data = message.data as any;
        const isGroup = message.type === ThreadType.Group;
        const senderId = data.uidFrom || data.senderId || "";

        return {
            messageId: data.msgId || data.messageId || String(Date.now()),
            threadId: isGroup ? (data.idTo || data.groupId || "") : senderId,
            chatType: isGroup ? "group" : "direct",
            senderId: String(senderId),
            senderName: data.dName || data.displayName,
            text: data.content || data.text,
            timestamp: data.ts || Date.now(),
            isSelf: String(senderId) === String(selfUserId),
            raw: message,
        };
    }

    private async checkAccess(accountId: string, msg: IncomingMessage): Promise<boolean> {
        const cfg = this.configProvider?.();
        const account = resolveAccount(cfg, accountId);
        const accountConfig = account.config;

        this.logger.debug?.(`[zalouser-free] checkAccess for account ${accountId}, chatType: ${msg.chatType}`);

        if (!accountConfig) {
            this.logger.warn?.(`[zalouser-free] No account config found for ${accountId}, denying access`);
            return false;
        }

        const dmAccess = accountConfig.dmAccess ?? "whitelist";
        const groupAccess = accountConfig.groupAccess ?? "mention";
        const allowedUsers = accountConfig.allowedUsers ?? [];
        const allowedGroups = accountConfig.allowedGroups ?? [];

        const isAllowedUser = allowedUsers.includes(msg.senderId) || allowedUsers.includes("*");
        const isAllowedGroup = msg.chatType === "group" && (allowedGroups.includes(msg.threadId) || allowedGroups.includes("*"));

        if (msg.chatType === "direct") {
            if (dmAccess === "open") {
                this.logger.info?.("[zalouser-free] DM access ALLOWED (open mode)");
                return true;
            } else if (dmAccess === "whitelist") {
                const allowed = isAllowedUser;
                this.logger.info?.(`[zalouser-free] DM access ${allowed ? 'ALLOWED' : 'DENIED'} (whitelist mode)`);
                return allowed;
            }
        } else if (msg.chatType === "group") {
            if (groupAccess === "open") {
                this.logger.info?.("[zalouser-free] Group access ALLOWED (open mode)");
                return true;
            } else if (groupAccess === "whitelist") {
                const allowed = isAllowedGroup;
                this.logger.info?.(`[zalouser-free] Group access ${allowed ? 'ALLOWED' : 'DENIED'} (whitelist mode)`);
                return allowed;
            } else if (groupAccess === "mention") {
                const mentions = (msg.raw as any).data?.mentions || [];
                const session = this.sessions.get(accountId);
                if (!session) return false;

                const botUserId = session.userId;
                // Check mentions using 'uid' property as seen in logs
                const isMentioned = mentions.some((m: any) => String(m.uid) === String(botUserId));

                const allowed = isMentioned;
                this.logger.info?.(`[zalouser-free] Group access ${allowed ? 'ALLOWED' : 'DENIED'} (mention mode)`);
                return allowed;
            }
        }

        this.logger.warn?.("[zalouser-free] Access DENIED (no matching rule)");
        return false;
    }

    async startListening(accountId: string): Promise<{ ok: boolean; error?: string }> {
        const session = this.sessions.get(accountId);
        if (!session) {
            return { ok: false, error: "Session not found. Please login first." };
        }

        if (session.isListening) {
            return { ok: true };
        }

        try {
            session.api.listener.on("message", async (message: Message) => {
                this.logger.info?.(`[zalouser-free] Received message on account ${accountId}`);

                const incomingMsg = this.convertMessage(message, session.userId);

                // Cache chat type
                this.chatTypes.set(incomingMsg.threadId, incomingMsg.chatType);

                this.logger.info?.(`[zalouser-free] Converted message - from: ${incomingMsg.senderId}, thread: ${incomingMsg.threadId}, type: ${incomingMsg.chatType}`);

                if (this.messageHandler && !incomingMsg.isSelf) {
                    // Send delivered event automatically
                    this.sendDeliveredEvent(accountId, [incomingMsg.messageId], incomingMsg.chatType, false)
                        .catch(err => this.logger.warn?.(`[zalouser-free] Failed to send delivered event: ${err}`));

                    const allowed = await this.checkAccess(accountId, incomingMsg);
                    this.logger.info?.(`[zalouser-free] Access control result: ${allowed ? 'ALLOWED' : 'DENIED'}`);

                    if (allowed) {
                        this.messageHandler(incomingMsg, accountId);
                    } else {
                        this.logger.warn?.(`[zalouser-free] Access denied for message from ${incomingMsg.senderId}`);
                    }
                }
            });

            session.api.listener.start();
            session.isListening = true;

            this.logger.info?.(`[zalouser-free] Started listening for account: ${accountId}`);

            return { ok: true };
        } catch (err: any) {
            return { ok: false, error: err.message || String(err) };
        }
    }

    async stopListening(accountId: string): Promise<void> {
        const session = this.sessions.get(accountId);
        if (session?.isListening) {
            session.api.listener.stop();
            session.isListening = false;
            this.logger.info?.(`[zalouser-free] Stopped listening for account: ${accountId}`);
        }
    }

    async sendText(
        accountId: string,
        threadId: string,
        chatType: ChatType,
        text: string,
        options?: { replyTo?: string }
    ): Promise<SendResult> {
        const session = this.sessions.get(accountId);
        if (!session) {
            return { ok: false, error: "Session not found" };
        }

        try {
            const threadType = chatType === "group" ? ThreadType.Group : ThreadType.User;
            const result = await session.api.sendMessage({ msg: text }, threadId, threadType);
            return { ok: true, messageId: (result as any)?.msgId };
        } catch (err: any) {
            return { ok: false, error: err.message || String(err) };
        }
    }

    getStatus(accountId: string): StatusResult {
        const session = this.sessions.get(accountId);
        if (!session) {
            return { accountId, connected: false, isListening: false };
        }

        return {
            accountId,
            connected: true,
            userId: session.userId,
            displayName: session.displayName,
            isListening: session.isListening,
            uptime: Date.now() - session.startedAt,
        };
    }

    getSession(accountId: string): ZaloSession | undefined {
        return this.sessions.get(accountId);
    }

    async disconnect(accountId: string): Promise<void> {
        await this.stopListening(accountId);
        this.sessions.delete(accountId);
    }

    async disconnectAll(): Promise<void> {
        for (const accountId of this.sessions.keys()) {
            await this.disconnect(accountId);
        }
    }

    // ========================================================================
    // Event APIs
    // ========================================================================

    /**
     * Send typing indicator event
     * @param accountId Account ID
     * @param threadId Thread/conversation ID
     * @param chatType 'direct' or 'group'
     */
    async sendTypingEvent(
        accountId: string,
        threadId: string,
        chatType: ChatType
    ): Promise<{ ok: boolean; error?: string }> {
        const session = this.sessions.get(accountId);
        if (!session) {
            return { ok: false, error: "Session not found" };
        }

        try {
            // sendTypingEvent(threadId, type?, destType?)
            const type = chatType === "group" ? ThreadType.Group : ThreadType.User;
            await session.api.sendTypingEvent(threadId, type);
            return { ok: true };
        } catch (err: any) {
            this.logger.error?.("[zalouser-free] sendTypingEvent failed:", err);
            return { ok: false, error: err.message || String(err) };
        }
    }

    /**
     * Send seen/read receipt event
     * @param accountId Account ID
     * @param threadId Thread/conversation ID
     * @param messageIds Array of message IDs that were seen
     * @param chatType 'direct' or 'group'
     */
    async sendSeenEvent(
        accountId: string,
        threadId: string,
        messageIds: string[],
        chatType: ChatType
    ): Promise<{ ok: boolean; error?: string }> {
        const session = this.sessions.get(accountId);
        if (!session) {
            return { ok: false, error: "Session not found" };
        }

        try {
            const threadType = chatType === "group" ? ThreadType.Group : ThreadType.User;
            // Build message objects for seen event
            const messages = messageIds.map(msgId => ({
                cliMsgId: msgId,
                globalMsgId: msgId,
                uidFrom: threadId,
                idTo: threadId,
            }));
            // sendSeenEvent(messages, threadId[, type]) - type is optional ThreadType
            await session.api.sendSeenEvent(messages as any, threadType);
            return { ok: true };
        } catch (err: any) {
            this.logger.error?.("[zalouser-free] sendSeenEvent failed:", err);
            return { ok: false, error: err.message || String(err) };
        }
    }

    /**
     * Send delivered receipt event
     * @param accountId Account ID
     * @param messageIds Array of message IDs that were delivered
     * @param chatType 'direct' or 'group'
     * @param isSeen Whether messages were also seen
     */
    async sendDeliveredEvent(
        accountId: string,
        messageIds: string[],
        chatType: ChatType,
        isSeen: boolean = false
    ): Promise<{ ok: boolean; error?: string }> {
        const session = this.sessions.get(accountId);
        if (!session) {
            return { ok: false, error: "Session not found" };
        }

        try {
            const threadType = chatType === "group" ? ThreadType.Group : ThreadType.User;
            // Build message objects for delivered event  
            const messages = messageIds.map(msgId => ({
                msgId,
                cliMsgId: msgId,
                globalMsgId: msgId,
                uidFrom: "",
                idTo: "",
                msgType: 0,
                st: 0,
                at: Date.now(),
                ts: Date.now(),
            }));
            // sendDeliveredEvent(isSeen, messages[, type])
            await session.api.sendDeliveredEvent(isSeen, messages as any, threadType);
            return { ok: true };
        } catch (err: any) {
            this.logger.error?.("[zalouser-free] sendDeliveredEvent failed:", err);
            return { ok: false, error: err.message || String(err) };
        }
    }
}

