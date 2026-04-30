import { api } from '../services/api';
import type {
  KronosAnalysis,
  KronosAnalysisRequest,
  KronosDashboard,
} from '../types';

export const kronosApi = {
  getDashboard: (): Promise<KronosDashboard> => api.getKronosDashboard(),
  getHistory: (limit = 20): Promise<KronosAnalysis[]> => api.getKronosHistory(limit),
  streamAnalysis: (payload: KronosAnalysisRequest = {}): Promise<Response> =>
    api.streamKronosAnalysis(payload),
};
