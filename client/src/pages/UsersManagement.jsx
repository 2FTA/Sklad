import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import './Dashboard.css';
import './AdminPages.css';

function UsersManagement() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [editingPassword, setEditingPassword] = useState(null);
  const [newPassword, setNewPassword] = useState('');
  const [newUser, setNewUser] = useState({ login: '', password: '', role: 'user' });
  const [capacityInputs, setCapacityInputs] = useState({});

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
      const inputs = {};
      data.forEach((u) => {
        if (u.role === 'user') {
          inputs[u.id] = u.capacity ?? 1000;
        }
      });
      setCapacityInputs(inputs);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleShowPassword = async (user) => {
    if (visiblePasswords[user.id]) {
      const next = { ...visiblePasswords };
      delete next[user.id];
      setVisiblePasswords(next);
      return;
    }

    try {
      const data = await api.getUserPassword(user.id);
      setVisiblePasswords({ ...visiblePasswords, [user.id]: data.password });
    } catch (err) {
      setError(err.message);
    }
  };

  const handleChangePassword = async (userId) => {
    if (!newPassword.trim()) {
      setError('Введите новый пароль');
      return;
    }

    try {
      await api.changeUserPassword(userId, newPassword);
      setEditingPassword(null);
      setNewPassword('');
      setVisiblePasswords({ ...visiblePasswords, [userId]: newPassword });
      flash('Пароль изменён');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDeleteUser = async (user) => {
    if (user.login === 'admin') return;
    if (!confirm(`Удалить пользователя "${user.login}" и весь его склад?`)) return;

    try {
      await api.deleteUser(user.id);
      flash('Пользователь удалён');
      setVisiblePasswords({});
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    try {
      await api.createUser(newUser.login, newUser.password, newUser.role);
      setNewUser({ login: '', password: '', role: 'user' });
      flash('Пользователь добавлен');
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleCapacitySave = async (userId) => {
    const value = capacityInputs[userId];
    if (value === undefined || value === '') return;

    const capacity = parseInt(value, 10);
    if (isNaN(capacity) || capacity < 0) {
      setError('Вместимость должна быть числом ≥ 0');
      return;
    }

    try {
      await api.updateUserCapacity(userId, capacity);
      flash('Вместимость обновлена');
      await loadUsers();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-layout">
      <AdminTopBar title="Управление пользователями" />

      <div className="content-area">
        {error && (
          <div className="error-banner" onClick={() => setError('')}>
            {error}
          </div>
        )}
        {success && <div className="success-banner">{success}</div>}

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Логин</th>
                  <th>Роль</th>
                  <th>Вместимость</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>{user.login}</td>
                    <td>{user.role}</td>
                    <td>
                      {user.role === 'user' ? (
                        <input
                          type="number"
                          className="capacity-input"
                          min="0"
                          value={capacityInputs[user.id] ?? user.capacity ?? 1000}
                          onChange={(e) =>
                            setCapacityInputs({ ...capacityInputs, [user.id]: e.target.value })
                          }
                          onBlur={() => handleCapacitySave(user.id)}
                        />
                      ) : (
                        '—'
                      )}
                    </td>
                    <td>
                      <div className="actions-cell">
                        <button
                          className="btn-sm btn-show"
                          onClick={() => handleShowPassword(user)}
                        >
                          {visiblePasswords[user.id]
                            ? 'Скрыть пароль'
                            : 'Показать пароль'}
                        </button>
                        {visiblePasswords[user.id] && (
                          <span className="password-display">{visiblePasswords[user.id]}</span>
                        )}
                        {editingPassword === user.id ? (
                          <div className="inline-edit">
                            <input
                              type="password"
                              placeholder="Новый пароль"
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                            />
                            <button
                              className="btn-sm btn-update"
                              onClick={() => handleChangePassword(user.id)}
                            >
                              Сохранить
                            </button>
                            <button
                              className="btn-sm btn-cancel"
                              onClick={() => {
                                setEditingPassword(null);
                                setNewPassword('');
                              }}
                            >
                              Отмена
                            </button>
                          </div>
                        ) : (
                          <button
                            className="btn-sm btn-change"
                            onClick={() => {
                              setEditingPassword(user.id);
                              setNewPassword('');
                            }}
                          >
                            Изменить пароль
                          </button>
                        )}
                        {user.login !== 'admin' && (
                          <button
                            className="btn-sm btn-delete"
                            onClick={() => handleDeleteUser(user)}
                          >
                            ✕ Удалить пользователя
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bottom-form">
          <h2>Добавить пользователя</h2>
          <form onSubmit={handleAddUser}>
            <div className="bottom-form-row">
              <div className="form-group">
                <label>Логин</label>
                <input
                  value={newUser.login}
                  onChange={(e) => setNewUser({ ...newUser, login: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Пароль</label>
                <input
                  type="password"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Роль</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value="user">user</option>
                  <option value="admin">admin</option>
                </select>
              </div>
              <button type="submit" className="btn-primary">
                Добавить
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

export default UsersManagement;
