// frontend/src/components/NotificationBell.jsx
import { useState, useEffect } from "react";
import axios from "axios";

export default function NotificationBell() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // cada 30s
    return () => clearInterval(interval);
  }, []);

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get("/api/notifications?limit=10", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setNotifications(res.data.notifications);
      setUnreadCount(res.data.unread_count);
    } catch (err) {
      console.error("Error cargando notificaciones:", err);
    }
  };

  const markAsRead = async (id) => {
    try {
      const token = localStorage.getItem("token");
      await axios.post(`/api/notifications/${id}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (err) {
      console.error("Error marcando como leída:", err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const token = localStorage.getItem("token");
      await axios.post("/api/notifications/read-all", {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchNotifications();
    } catch (err) {
      console.error("Error marcando todas:", err);
    }
  };

  const getTypeColor = (type) => {
    switch (type) {
      case "success":
        return "bg-green-100 text-green-800";
      case "warning":
        return "bg-yellow-100 text-yellow-800";
      case "error":
        return "bg-red-100 text-red-800";
      default:
        return "bg-blue-100 text-blue-800";
    }
  };

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-gray-100 rounded-full transition"
      >
        <span className="text-2xl">🔔</span>
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 bg-red-500 text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <div
          className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50"
          style={{ maxHeight: "500px", overflowY: "auto" }}
        >
          <div className="p-4 border-b border-gray-200 flex justify-between items-center">
            <h3 className="font-bold text-lg">Notificaciones</h3>
            {unreadCount > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800"
              >
                Marcar todas como leídas
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <p>No hay notificaciones</p>
            </div>
          ) : (
            <div>
              {notifications.map((notif) => (
                <div
                  key={notif.id}
                  className={`p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer ${
                    !notif.read ? "bg-blue-50" : ""
                  }`}
                  onClick={() => !notif.read && markAsRead(notif.id)}
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className={`text-xs px-2 py-1 rounded ${getTypeColor(notif.type)}`}>
                      {notif.type}
                    </span>
                    <span className="text-xs text-gray-500">
                      {new Date(notif.created_at).toLocaleString("es-CL")}
                    </span>
                  </div>
                  <h4 className="font-semibold text-sm mb-1">{notif.title}</h4>
                  <p className="text-sm text-gray-600">{notif.message}</p>
                  {!notif.read && (
                    <span className="text-xs text-blue-600 font-semibold mt-2 inline-block">
                      • Nueva
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
