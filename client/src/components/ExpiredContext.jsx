import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, getStoredUser } from '../api';

const CHECKED_STORAGE_KEY = 'expired_checked_lots';
const POLL_INTERVAL_MS = 30000;

const ExpiredContext = createContext(null);

function loadCheckedIds() {
  try {
    const raw = localStorage.getItem(CHECKED_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function saveCheckedIds(checkedIds) {
  localStorage.setItem(CHECKED_STORAGE_KEY, JSON.stringify([...checkedIds]));
}

export function ExpiredProvider({ children }) {
  const [items, setItems] = useState([]);
  const [checkedIds, setCheckedIds] = useState(loadCheckedIds);
  const [loading, setLoading] = useState(false);

  const syncCheckedIds = useCallback((nextItems) => {
    const validIds = new Set(
      nextItems.filter((item) => item.lotId != null).map((item) => String(item.lotId))
    );

    setCheckedIds((prev) => {
      const next = new Set([...prev].filter((id) => validIds.has(id)));
      saveCheckedIds(next);
      return next;
    });
  }, []);

  const refreshExpired = useCallback(async () => {
    const user = getStoredUser();
    if (user?.role !== 'admin') {
      setItems([]);
      return;
    }

    setLoading(true);

    try {
      const data = await api.getExpiredLots();
      setItems(data);
      syncCheckedIds(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [syncCheckedIds]);

  useEffect(() => {
    const user = getStoredUser();
    if (user?.role !== 'admin') {
      return undefined;
    }

    refreshExpired();
    const intervalId = setInterval(refreshExpired, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [refreshExpired]);

  const markChecked = useCallback((lotId) => {
    if (lotId == null) {
      return;
    }

    setCheckedIds((prev) => {
      const next = new Set(prev);
      next.add(String(lotId));
      saveCheckedIds(next);
      return next;
    });
  }, []);

  const isChecked = useCallback(
    (lotId) => {
      if (lotId == null) {
        return false;
      }
      return checkedIds.has(String(lotId));
    },
    [checkedIds]
  );

  const shouldBlink = useMemo(() => {
    if (items.length === 0) {
      return false;
    }

    return items.some((item) => item.lotId != null && !checkedIds.has(String(item.lotId)));
  }, [items, checkedIds]);

  const value = useMemo(
    () => ({
      items,
      loading,
      refreshExpired,
      markChecked,
      isChecked,
      shouldBlink,
    }),
    [items, loading, refreshExpired, markChecked, isChecked, shouldBlink]
  );

  return <ExpiredContext.Provider value={value}>{children}</ExpiredContext.Provider>;
}

export function useExpired() {
  const context = useContext(ExpiredContext);
  if (!context) {
    throw new Error('useExpired must be used within ExpiredProvider');
  }
  return context;
}
