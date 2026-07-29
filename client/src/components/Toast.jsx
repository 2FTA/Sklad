import { useEffect, useState } from 'react';
import './Toast.css';

function Toast({ message, type = 'success', duration = 2000, onClose }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const enterTimer = requestAnimationFrame(() => setVisible(true));

    const exitTimer = setTimeout(() => {
      setLeaving(true);
    }, duration);

    const closeTimer = setTimeout(() => {
      onClose();
    }, duration + 200);

    return () => {
      cancelAnimationFrame(enterTimer);
      clearTimeout(exitTimer);
      clearTimeout(closeTimer);
    };
  }, [duration, onClose]);

  return (
    <div
      className={`toast toast-${type} ${visible ? 'toast-visible' : ''} ${
        leaving ? 'toast-leaving' : ''
      }`}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  );
}

export default Toast;
