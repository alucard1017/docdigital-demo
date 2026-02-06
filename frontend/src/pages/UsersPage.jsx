import { useEffect, useState } from 'react';

function UsersPage() {
  const [users, setUsers] = useState([]);
  const [roleFilter, setRoleFilter] = useState('');
  const token = localStorage.getItem('token'); // o tu hook de auth

  useEffect(() => {
    const fetchUsers = async () => {
      const params = roleFilter ? `?role=${roleFilter}` : '';
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/users${params}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        }
      );
      const data = await res.json();
      if (res.ok) setUsers(data);
      else console.error(data);
    };
    fetchUsers();
  }, [roleFilter, token]);

  return (
    <div className="usuarios-page">
      <h1>Usuarios del sistema</h1>

      <div>
        <label>Filtrar por rol: </label>
        <select
          value={roleFilter}
          onChange={e => setRoleFilter(e.target.value)}
        >
          <option value="">Todos</option>
          <option value="admin">Administradores</option>
          <option value="visador">Visadores</option>
          <option value="user">Usuarios</option>
        </select>
      </div>

      <table>
        <thead>
          <tr>
            <th>RUN</th>
            <th>Nombre</th>
            <th>Email</th>
            <th>Plan</th>
            <th>Rol</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.run}</td>
              <td>{u.name}</td>
              <td>{u.email}</td>
              <td>{u.plan}</td>
              <td>{u.role}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default UsersPage;
