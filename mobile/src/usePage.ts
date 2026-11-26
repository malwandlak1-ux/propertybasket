import { useCallback, useEffect, useState } from 'react';
import { api, errorText, PageResponse } from './api';

/**
 * Loads one API page (the website page's props) and keeps it in state.
 * For screens that need the data outside the scroll area too (a floating
 * add button, sheets); simpler screens can use <DataScreen>.
 */
export function usePage<T>(path: string) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const reload = useCallback(async () => {
    try {
      setError(null);
      setData((await api.get<PageResponse<T>>(path)).data);
    } catch (e) {
      setError(errorText(e));
    }
  }, [path]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await reload();
    setRefreshing(false);
  }, [reload]);

  return { data, setData, error, refreshing, reload, onRefresh };
}
