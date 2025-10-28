// App.js
import React, { useState, useEffect, useCallback } from 'react';

//const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/todos';
const API = process.env.REACT_APP_API_URL || '/todos';

function App() {
  const [todos, setTodos] = useState([]);
  const [newTodo, setNewTodo] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionId, setActionId] = useState(null); // id currently being updated/deleted
  const [editingId, setEditingId] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [msg, setMsg] = useState(null);

  const showMsg = (text, type = 'info') => {
    setMsg({ text, type });
    setTimeout(() => setMsg(null), 2500);
  };

  // ✅ Fixed: removed `API` from dependency list
  const fetchTodos = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch(API, { cache: 'no-store' });
      if (!res.ok) throw new Error('Failed to fetch todos');
      const data = await res.json();
      setTodos(data);
    } catch (err) {
      console.error(err);
      showMsg('Failed to load todos', 'error');
    } finally {
      setLoading(false);
    }
  }, []); // ✅ clean — API is constant, so no dependency needed

  useEffect(() => {
    fetchTodos();
  }, [fetchTodos]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const title = newTodo.trim();
    if (!title) return;
    setActionId('create');
    try {
      const res = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Create failed');
      setNewTodo('');
      await fetchTodos();
      showMsg('Todo added', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Could not add todo', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleUpdate = async (id, completed) => {
    setActionId(id);
    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ completed: !completed }),
      });
      if (!res.ok) throw new Error('Update failed');
      await fetchTodos();
      showMsg('Todo updated', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Could not update todo', 'error');
    } finally {
      setActionId(null);
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm('Delete this todo?');
    if (!ok) return;
    setActionId(id);
    try {
      const res = await fetch(`${API}/${id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 204) throw new Error('Delete failed');
      await fetchTodos();
      showMsg('Todo deleted', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Could not delete todo', 'error');
    } finally {
      setActionId(null);
    }
  };

  const startEdit = (todo) => {
    setEditingId(todo.id);
    setEditingText(todo.title);
  };

  const saveEdit = async (id) => {
    const title = editingText.trim();
    if (!title) return showMsg('Title cannot be empty', 'error');
    setActionId(id);
    try {
      const res = await fetch(`${API}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title }),
      });
      if (!res.ok) throw new Error('Save failed');
      setEditingId(null);
      setEditingText('');
      await fetchTodos();
      showMsg('Todo saved', 'success');
    } catch (err) {
      console.error(err);
      showMsg('Could not save todo', 'error');
    } finally {
      setActionId(null);
    }
  };

  return (
    <div style={{ maxWidth: 700, margin: '2rem auto', fontFamily: 'sans-serif' }}>
      <h1>To-Do List</h1>

      {msg && (
        <div
          style={{
            padding: '0.5rem 1rem',
            marginBottom: '1rem',
            borderRadius: 4,
            background: msg.type === 'error' ? '#e99393ff' : '#e6ffe6',
            color: msg.type === 'error' ? '#900' : '#060',
          }}
        >
          {msg.text}
        </div>
      )}

      <form onSubmit={handleSubmit} style={{ marginBottom: '1rem', display: 'flex', gap: 8 }}>
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="Add a new todo..."
          style={{ padding: '0.5rem', flex: 1 }}
        />
        <button type="submit" style={{ padding: '0.5rem 1rem' }} disabled={actionId === 'create'}>
          {actionId === 'create' ? 'Adding…' : 'Add'}
        </button>
      </form>

      {loading ? (
        <p>Loading todos…</p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0 }}>
          {todos.length === 0 && <li>No todos yet.</li>}
          {todos.map((todo) => {
            const busy = actionId === todo.id;
            return (
              <li
                key={todo.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0.5rem 0',
                  borderBottom: '1px solid #eee',
                  gap: 8,
                }}
              >
                <input
                  type="checkbox"
                  checked={!!todo.completed}
                  onChange={() => handleUpdate(todo.id, !!todo.completed)}
                  disabled={busy}
                />

                {editingId === todo.id ? (
                  <>
                    <input
                      style={{ flex: 1, padding: '0.4rem' }}
                      value={editingText}
                      onChange={(e) => setEditingText(e.target.value)}
                    />
                    <button onClick={() => saveEdit(todo.id)} disabled={busy} style={{ padding: '0.4rem 0.6rem' }}>
                      Save
                    </button>
                    <button
                      onClick={() => {
                        setEditingId(null);
                        setEditingText('');
                      }}
                      disabled={busy}
                      style={{ padding: '0.4rem 0.6rem' }}
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <span style={{ flex: 1, textDecoration: todo.completed ? 'line-through' : 'none' }}>
                      {todo.title}
                    </span>
                    <button onClick={() => startEdit(todo)} style={{ padding: '0.4rem 0.6rem' }}>
                      Edit
                    </button>
                    <button onClick={() => handleDelete(todo.id)} disabled={busy} style={{ padding: '0.4rem 0.6rem' }}>
                      {busy ? '…' : 'Delete'}
                    </button>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default App;
