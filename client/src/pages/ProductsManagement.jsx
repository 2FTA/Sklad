import { useState, useEffect, useCallback } from 'react';
import { api } from '../api';
import AdminTopBar from '../components/AdminTopBar';
import './Dashboard.css';
import './AdminPages.css';

function ProductsManagement() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [newProductName, setNewProductName] = useState('');

  const flash = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3000);
  };

  const loadProducts = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getAggregatedProducts();
      setProducts(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const handleRename = async (productId) => {
    if (!editName.trim()) {
      setError('Введите название');
      return;
    }

    try {
      await api.updateGlobalProduct(productId, editName);
      setEditingId(null);
      flash('Название изменено у всех пользователей');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleDelete = async (product) => {
    if (!confirm(`Удалить товар "${product.name}" у всех пользователей?`)) return;

    try {
      await api.deleteGlobalProduct(product.id);
      flash('Товар удалён у всех пользователей');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  const handleAddProduct = async (e) => {
    e.preventDefault();
    try {
      await api.createGlobalProduct(newProductName);
      setNewProductName('');
      flash('Товар добавлен всем пользователям');
      await loadProducts();
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div className="page-layout">
      <AdminTopBar title="Управление товарами" />

      <div className="content-area">
        {error && (
          <div className="error-banner" onClick={() => setError('')}>
            {error}
          </div>
        )}
        {success && <div className="success-banner">{success}</div>}

        {loading ? (
          <div className="loading">Загрузка...</div>
        ) : products.length === 0 ? (
          <div className="empty-state">Товаров пока нет</div>
        ) : (
          <div className="products-table-wrapper">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Название</th>
                  <th>Общее количество</th>
                  <th>Действия</th>
                </tr>
              </thead>
              <tbody>
                {products.map((product) => (
                  <tr key={product.id}>
                    <td>
                      {editingId === product.id ? (
                        <div className="inline-edit">
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                          />
                          <button
                            className="btn-sm btn-update"
                            onClick={() => handleRename(product.id)}
                          >
                            Сохранить
                          </button>
                          <button
                            className="btn-sm btn-cancel"
                            onClick={() => setEditingId(null)}
                          >
                            Отмена
                          </button>
                        </div>
                      ) : (
                        product.name
                      )}
                    </td>
                    <td className="quantity-cell">{product.total_quantity}</td>
                    <td>
                      <div className="actions-cell">
                        {editingId !== product.id && (
                          <button
                            className="btn-sm btn-rename"
                            onClick={() => {
                              setEditingId(product.id);
                              setEditName(product.name);
                            }}
                          >
                            ✏️ Изменить название
                          </button>
                        )}
                        <button
                          className="btn-sm btn-delete"
                          onClick={() => handleDelete(product)}
                        >
                          ✕ Удалить товар
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="bottom-form">
          <h2>Добавить товар</h2>
          <p style={{ color: '#64748b', marginBottom: '1rem', fontSize: '0.9rem' }}>
            Товар будет добавлен всем пользователям системы
          </p>
          <form onSubmit={handleAddProduct}>
            <div className="bottom-form-row">
              <div className="form-group">
                <label>Название товара</label>
                <input
                  value={newProductName}
                  onChange={(e) => setNewProductName(e.target.value)}
                  placeholder="Например: футболки"
                  required
                />
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

export default ProductsManagement;
