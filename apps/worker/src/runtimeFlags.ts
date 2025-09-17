import { getRuntimeFlag, clearRuntimeFlag, logAudit } from './supa.js';
import { logger } from './log.js';

export interface FlagState {
  lastHandled: string | null;
}

export class RuntimeFlagWatcher {
  private flags: Map<string, FlagState> = new Map();
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(private pollMs: number) {
    this.flags.set('fetch_groups_requested', { lastHandled: null });
    this.flags.set('wa_refresh_qr_requested', { lastHandled: null });
    this.flags.set('wa_disconnect_requested', { lastHandled: null });
  }

  start(): void {
    this.pollInterval = setInterval(() => {
      this.checkFlags().catch(err => {
        logger.error('Error checking runtime flags:', err);
      });
    }, this.pollMs);

    logger.info('Runtime flag watcher started');
  }

  stop(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
    logger.info('Runtime flag watcher stopped');
  }

  private async checkFlags(): Promise<void> {
    for (const [flagName, state] of this.flags) {
      const flag = await getRuntimeFlag(flagName);
      if (!flag || !flag.value) continue;

      const flagTimestamp = flag.value.at || flag.updated_at;
      if (!flagTimestamp) continue;

      // Check if this is a new flag request
      if (!state.lastHandled || new Date(flagTimestamp) > new Date(state.lastHandled)) {
        logger.info(`Processing runtime flag: ${flagName}`);
        
        try {
          await this.handleFlag(flagName, flag.value);
          state.lastHandled = flagTimestamp;
          await clearRuntimeFlag(flagName);
        } catch (error) {
          logger.error(`Error handling flag ${flagName}:`, error);
          await logAudit('error', {
            code: 'FLAG_HANDLER_ERROR',
            flag: flagName,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
    }
  }

  private async handleFlag(flagName: string, value: any): Promise<void> {
    switch (flagName) {
      case 'fetch_groups_requested':
        await this.handleFetchGroups();
        break;
      case 'wa_refresh_qr_requested':
        await this.handleRefreshQR();
        break;
      case 'wa_disconnect_requested':
        await this.handleDisconnect();
        break;
      default:
        logger.warn(`Unknown runtime flag: ${flagName}`);
    }
  }

  private async handleFetchGroups(): Promise<void> {
    // This will be implemented when we have the Baileys client
    logger.info('Fetch groups requested - will be handled by Baileys client');
    await logAudit('discovery', { triggered: true });
  }

  private async handleRefreshQR(): Promise<void> {
    // This will be implemented when we have the Baileys client
    logger.info('Refresh QR requested - will be handled by Baileys client');
  }

  private async handleDisconnect(): Promise<void> {
    // This will be implemented when we have the Baileys client
    logger.info('Disconnect requested - will be handled by Baileys client');
  }
}
