import { supabase } from './supa';
import { logger } from './log';

export async function getRuntimeFlags(): Promise<Record<string, any>> {
  try {
    const { data, error } = await supabase
      .from('runtime_flags')
      .select('*')
      .limit(1)
      .single();

    if (error) {
      logger.error('Failed to fetch runtime flags:', error);
      return {};
    }

    return data || {};
  } catch (error) {
    logger.error('Error getting runtime flags:', error);
    return {};
  }
}

export async function updateRuntimeFlag(key: string, value: any): Promise<void> {
  try {
    const { error } = await supabase
      .from('runtime_flags')
      .upsert({ [key]: value });

    if (error) {
      logger.error('Failed to update runtime flag:', error);
      throw error;
    }
  } catch (error) {
    logger.error('Error updating runtime flag:', error);
    throw error;
  }
}