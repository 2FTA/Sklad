import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { api, getStoredUser, getToken } from '../api';

const CHECKED_STORAGE_KEY = 'expired_checked_lots';
const POLL_INTERVAL_MS = 600000;

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

function isAdminAuthenticated() {
  const token = getToken();
  const user = getStoredUser();
  return Boolean(token && user?.role === 'admin');
}

export function ExpiredProvider({ children }) {
  const [items, setItems] = useState([]);
  const [checkedIds, setCheckedIds] = useState(loadCheckedIds);
  const [loading, setLoading] = useState(false);
  const [expiredCount, setExpiredCount] = useState(0);
  const [authVersion, setAuthVersion] = useState(0);

  useEffect(() => {
    const onAuthChanged = () => setAuthVersion((value) => value + 1);
    window.addEventListener('auth-changed', onAuthChanged);
    return () => window.removeEventListener('auth-changed', onAuthChanged);
  }, []);

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

  const clearExpiredState = useCallback(() => {
    setItems([]);
    setExpiredCount(0);
  }, []);

  const refreshExpired = useCallback(
    async ({ silent = false } = {}) => {
      if (!isAdminAuthenticated()) {
        clearExpiredState();
        return;
      }

      if (!silent) {
        setLoading(true);
      }

      try {
        const data = await api.getExpiredLots();
        setItems(data);
        setExpiredCount(data.length);
        syncCheckedIds(data);
      } catch {
        clearExpiredState();
      } finally {
        if (!silent) {
          setLoading(false);
        }
      }
    },
    [clearExpiredState, syncCheckedIds]
  );

  const checkExpired = useCallback(async () => {
    if (!isAdminAuthenticated()) {
      clearExpiredState();
      return;
    }

    try {
      const { hasExpired, count } = await api.checkExpiredLots();
      setExpiredCount(count ?? 0);

      if (hasExpired) {
        await refreshExpired({ silent: true });
      } else {
        clearExpiredState();
        syncCheckedIds([]);
      }
    } catch {
      // Фоновая проверка не должна мешать работе интерфейса.
    }
  }, [clearExpiredState, refreshExpired, syncCheckedIds]);

  useEffect(() => {
    if (!isAdminAuthenticated()) {
      clearExpiredState();
      return undefined;
    }

    checkExpired();
    const intervalId = setInterval(checkExpired, POLL_INTERVAL_MS);
    return () => clearInterval(intervalId);
  }, [authVersion, checkExpired, clearExpiredState]);

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

  const resetExpiredStatus = useCallback(() => {
    setCheckedIds((prev) => {
      const next = new Set(prev);
      items.forEach((item) => {
        if (item.lotId != null) {
          next.add(String(item.lotId));
        }
      });
      saveCheckedIds(next);
      return next;
    });
  }, [items]);

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

  const hasUncheckedExpired = shouldBlink;

  const value = useMemo(
    () => ({
      items,
      loading,
      expiredCount,
      refreshExpired,
      markChecked,
      isChecked,
      shouldBlink,
      hasUncheckedExpired,
      resetExpiredStatus,
    }),
    [
      items,
      loading,
      expiredCount,
      refreshExpired,
      markChecked,
      isChecked,
      shouldBlink,
      hasUncheckedExpired,
      resetExpiredStatus,
    ]
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
