import makeWASocket, { 
  ConnectionState, 
  DisconnectReason, 
  useMultiFileAuthState,
  WASocket,
  BaileysEventMap
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { updateWaSession, logAudit } from '../supa.js';
import { logger } from '../log.js';
import { env } from '../env.js';
import { SupabaseAuthState } from './stateStore.js';
import { RuntimeFlagWatcher } from '../runtimeFlags.js';

export class WhatsAppClient {
  private socket: WASocket | null = null;
  private authState: SupabaseAuthState;
  private flagWatcher: RuntimeFlagWatcher;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  constructor() {
    this.authState = new SupabaseAuthState();
    this.flagWatcher = new RuntimeFlagWatcher(env.WORKER_POLL_MS);
  }

  async start(): Promise<void> {
    try {
      logger.info('Starting WhatsApp client...');
      
      // Ensure session row exists
      await this.authState.load();
      
      // Start flag watcher
      this.flagWatcher.start();
      
      // Connect to WhatsApp
      await this.connect();
      
      logger.info('WhatsApp client started successfully');
    } catch (error) {
      logger.error('Failed to start WhatsApp client:', error);
      throw error;
    }
  }

  async stop(): Promise<void> {
    try {
      logger.info('Stopping WhatsApp client...');
      
      // Stop flag watcher
      this.flagWatcher.stop();
      
      // Disconnect socket
      if (this.socket) {
        await this.socket.logout();
        this.socket = null;
      }
      
      // Update session status
      await updateWaSession({ status: 'disconnected' });
      await logAudit('disconnect', { reason: 'manual' });
      
      logger.info('WhatsApp client stopped');
    } catch (error) {
      logger.error('Failed to stop WhatsApp client:', error);
    }
  }

  private async connect(): Promise<void> {
    try {
      await updateWaSession({ status: 'connecting' });
      
      const { state, saveCreds } = await this.authState.load();
      
      this.socket = makeWASocket({
        auth: state,
        printQRInTerminal: false,
        logger: logger.child({ component: 'baileys' }),
        browser: ['WA Monitor', 'Chrome', '1.0.0'],
        generateHighQualityLinkPreview: true
      });

      // Handle connection updates
      this.socket.ev.on('connection.update', async (update) => {
        await this.handleConnectionUpdate(update);
      });

      // Handle QR code
      this.socket.ev.on('creds.update', saveCreds);

      // Handle messages (will be implemented in handlers.ts)
      this.socket.ev.on('messages.upsert', async (m) => {
        logger.debug('Received messages:', m.messages.length);
        // TODO: Implement message handling
      });

      // Handle connection state
      this.socket.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        if (qr) {
          await this.handleQRCode(qr);
        }
        
        if (connection === 'close') {
          await this.handleDisconnect(lastDisconnect);
        } else if (connection === 'open') {
          await this.handleConnect();
        }
      });

    } catch (error) {
      logger.error('Failed to connect to WhatsApp:', error);
      await updateWaSession({ status: 'disconnected' });
      throw error;
    }
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>): Promise<void> {
    const { connection, lastDisconnect, qr } = update;
    
    if (qr) {
      await this.handleQRCode(qr);
    }
    
    if (connection === 'close') {
      await this.handleDisconnect(lastDisconnect);
    } else if (connection === 'open') {
      await this.handleConnect();
    }
  }

  private async handleQRCode(qr: string): Promise<void> {
    try {
      const expiresAt = new Date(Date.now() + 60 * 1000).toISOString(); // 60 seconds
      
      await updateWaSession({
        detail: {
          qr,
          expiresAt
        }
      });
      
      await logAudit('qr_generated', {});
      logger.info('QR code generated and saved to database');
    } catch (error) {
      logger.error('Failed to handle QR code:', error);
    }
  }

  private async handleConnect(): Promise<void> {
    try {
      this.reconnectAttempts = 0;
      
      const user = this.socket?.user;
      const waName = user?.name || user?.pushName || null;
      const waNumber = user?.id?.split(':')[0] || null;
      
      await updateWaSession({
        status: 'connected',
        detail: null,
        wa_name: waName,
        wa_number: waNumber
      });
      
      await logAudit('connect', {
        name: waName,
        number: waNumber
      });
      
      logger.info(`Connected to WhatsApp as ${waName} (${waNumber})`);
    } catch (error) {
      logger.error('Failed to handle connect:', error);
    }
  }

  private async handleDisconnect(lastDisconnect: any): Promise<void> {
    try {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      
      await updateWaSession({ status: 'disconnected' });
      await logAudit('disconnect', { 
        reason: lastDisconnect?.error?.message || 'unknown',
        shouldReconnect 
      });
      
      logger.info(`Disconnected from WhatsApp. Should reconnect: ${shouldReconnect}`);
      
      if (shouldReconnect && this.reconnectAttempts < this.maxReconnectAttempts) {
        await this.scheduleReconnect();
      }
    } catch (error) {
      logger.error('Failed to handle disconnect:', error);
    }
  }

  private async scheduleReconnect(): Promise<void> {
    this.reconnectAttempts++;
    const backoffMs = Math.min(
      env.WORKER_BACKOFF_MAX_MS,
      env.WORKER_BACKOFF_BASE_MS * Math.pow(2, this.reconnectAttempts - 1)
    ) + Math.random() * 500; // Add jitter
    
    logger.info(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${backoffMs}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        logger.error(`Reconnect attempt ${this.reconnectAttempts} failed:`, error);
      }
    }, backoffMs);
  }
}
