// mobile/src/api/client.js
import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/* ================================
   CONFIGURACIÓN
   ================================ */

const API_URL = 'https://verifirma-api.onrender.com/api';

console.log('========================================');
console.log('🚀 VERIFIRMA MOBILE API CLIENT');
console.log('🌐 API URL:', API_URL);
console.log('📱 Platform:', Platform.OS);
console.log('========================================');

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
  timeout: 120000, // 2 minutos para cold starts de Render
  withCredentials: false,
});

/* ================================
   INTERCEPTORS
   ================================ */

// Request Interceptor - Agregar token y logs
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await SecureStore.getItemAsync('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] 📤 ${config.method.toUpperCase()} ${config.url}`);
      
      // Log seguro del body (ocultar contraseñas)
      if (config.data && ['post', 'put', 'patch'].includes(config.method.toLowerCase())) {
        const safeData = { ...config.data };
        if (safeData.password) safeData.password = '***';
        console.log('📦 Request body:', JSON.stringify(safeData).substring(0, 150));
      }
      
      config.metadata = { startTime: Date.now() };
    } catch (error) {
      console.error('❌ Request interceptor error:', error.message);
    }
    
    return config;
  },
  (error) => {
    console.error('❌ Request setup error:', error.message);
    return Promise.reject(error);
  }
);

// Response Interceptor - Logs y manejo de errores
api.interceptors.response.use(
  (response) => {
    const duration = Date.now() - response.config.metadata.startTime;
    const timestamp = new Date().toLocaleTimeString();
    console.log(`[${timestamp}] ✅ ${response.status} ${response.config.url} (${duration}ms)`);
    
    return response;
  },
  async (error) => {
    const timestamp = new Date().toLocaleTimeString();
    const status = error.response?.status;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const duration = error.config?.metadata ? Date.now() - error.config.metadata.startTime : 0;
    
    console.error(`[${timestamp}] ❌ ${method} ${url} - Error`);
    console.error('Status:', status || 'No response');
    console.error('Code:', error.code);
    console.error('Message:', error.message);
    if (duration) console.error('Duration:', duration + 'ms');
    
    // Mensajes descriptivos por tipo de error
    if (error.code === 'ECONNABORTED') {
      console.error('⏱️ TIMEOUT: Request timed out after 2 minutes');
      console.error('💡 Tip: Server may be cold starting on Render');
    } else if (error.code === 'ENOTFOUND') {
      console.error('🌐 DNS ERROR: Could not resolve server address');
      console.error('💡 Check API_URL:', API_URL);
    } else if (error.code === 'ECONNREFUSED') {
      console.error('🚫 CONNECTION REFUSED: Server is not accepting connections');
    } else if (error.code === 'ERR_NETWORK') {
      console.error('📡 NETWORK ERROR: No internet connection');
    }
    
    // Manejo específico por status code
    if (status === 401 && !url?.includes('/auth/login')) {
      console.error('🔓 UNAUTHORIZED: Clearing token and requiring re-login');
      try {
        await SecureStore.deleteItemAsync('auth_token');
      } catch (err) {
        console.error('Error clearing token:', err);
      }
    } else if (status === 403) {
      console.error('🔒 FORBIDDEN: Insufficient permissions');
    } else if (status === 404) {
      console.error('🔍 NOT FOUND: Resource does not exist');
    } else if (status >= 500) {
      console.error('🔥 SERVER ERROR: Backend issue');
      if (error.response?.data) {
        console.error('Server response:', error.response.data);
      }
    }
    
    return Promise.reject(error);
  }
);

/* ================================
   HELPER FUNCTIONS
   ================================ */

const handleApiError = (error, context) => {
  console.error(`❌ ${context} failed:`, error.message);
  
  // Crear mensaje de error amigable
  let userMessage = 'Ocurrió un error inesperado';
  
  if (error.code === 'ECONNABORTED') {
    userMessage = 'El servidor tardó demasiado en responder. Por favor intenta de nuevo.';
  } else if (error.code === 'ENOTFOUND' || error.code === 'ERR_NETWORK') {
    userMessage = 'No hay conexión a internet. Verifica tu red.';
  } else if (error.response?.status === 401) {
    userMessage = 'Credenciales incorrectas';
  } else if (error.response?.status === 403) {
    userMessage = 'No tienes permisos para esta acción';
  } else if (error.response?.status === 404) {
    userMessage = 'Recurso no encontrado';
  } else if (error.response?.status >= 500) {
    userMessage = 'Error del servidor. Intenta más tarde.';
  } else if (error.response?.data?.message) {
    userMessage = error.response.data.message;
  }
  
  error.userMessage = userMessage;
  throw error;
};

/* ================================
   AUTENTICACIÓN
   ================================ */

export const login = async (identifier, password) => {
  try {
    console.log('========================================');
    console.log('🔐 LOGIN STARTED');
    console.log('👤 Identifier:', identifier);
    console.log('⏳ Note: First request may take 30-120s (Render cold start)');
    console.log('========================================');
    
    const loginData = {
      identifier: identifier.trim(),
      password: password,
      rememberMe: false
    };
    
    const { data } = await api.post('/auth/login', loginData);
    
    console.log('========================================');
    console.log('✅ LOGIN SUCCESSFUL');
    console.log('👤 User:', data.user?.email || data.user?.run || 'N/A');
    console.log('🏢 Company:', data.user?.company_name || 'N/A');
    console.log('========================================');
    
    if (data.accessToken) {
      await SecureStore.setItemAsync('auth_token', data.accessToken);
      console.log('💾 Access token saved to SecureStore');
    } else {
      console.warn('⚠️ No accessToken received from server');
    }
    
    return data;
  } catch (error) {
    return handleApiError(error, 'Login');
  }
};

export const logout = async () => {
  try {
    console.log('👋 Logging out...');
    await SecureStore.deleteItemAsync('auth_token');
    console.log('✅ Token cleared successfully');
  } catch (error) {
    console.error('❌ Logout error:', error.message);
    throw error;
  }
};

export const getCurrentUser = async () => {
  try {
    console.log('👤 Fetching current user...');
    const { data } = await api.get('/auth/me');
    console.log('✅ User fetched:', data.email || data.run);
    return data;
  } catch (error) {
    return handleApiError(error, 'Get current user');
  }
};

export const hasAuthToken = async () => {
  try {
    const token = await SecureStore.getItemAsync('auth_token');
    const hasToken = !!token;
    console.log(hasToken ? '✅ Auth token found' : 'ℹ️ No auth token');
    return hasToken;
  } catch (error) {
    console.error('❌ Error checking token:', error.message);
    return false;
  }
};

/* ================================
   DOCUMENTOS
   ================================ */

export const getDocuments = async () => {
  try {
    console.log('📄 Fetching documents list...');
    const { data } = await api.get('/documents');
    
    const count = data.data?.length || 0;
    console.log(`✅ ${count} document${count !== 1 ? 's' : ''} fetched`);
    
    if (data.stats) {
      console.log('📊 Stats:', JSON.stringify(data.stats));
    }
    
    return data;
  } catch (error) {
    return handleApiError(error, 'Get documents');
  }
};

export const getDocument = async (id) => {
  try {
    console.log(`📄 Fetching document #${id}...`);
    const { data } = await api.get(`/documents/${id}`);
    const title = data.document?.title || data.title || 'Untitled';
    console.log(`✅ Document loaded: "${title}"`);
    return data;
  } catch (error) {
    return handleApiError(error, `Get document ${id}`);
  }
};

export const signDocument = async (id, signature) => {
  try {
    console.log(`✍️ Signing document #${id} as "${signature}"...`);
    const { data } = await api.post(`/documents/${id}/sign`, { signature });
    console.log('✅ Document signed successfully');
    return data;
  } catch (error) {
    return handleApiError(error, `Sign document ${id}`);
  }
};

export const reviewDocument = async (id) => {
  try {
    console.log(`👁️ Reviewing document #${id}...`);
    const { data } = await api.post(`/documents/${id}/review`);
    console.log('✅ Document reviewed successfully');
    return data;
  } catch (error) {
    return handleApiError(error, `Review document ${id}`);
  }
};

export const rejectDocument = async (id, reason) => {
  try {
    console.log(`❌ Rejecting document #${id}...`);
    console.log(`📝 Reason: ${reason.substring(0, 50)}${reason.length > 50 ? '...' : ''}`);
    const { data } = await api.post(`/documents/${id}/reject`, { 
      rejection_reason: reason 
    });
    console.log('✅ Document rejected');
    return data;
  } catch (error) {
    return handleApiError(error, `Reject document ${id}`);
  }
};

export const getDocumentTimeline = async (id) => {
  try {
    console.log(`📅 Fetching timeline for document #${id}...`);
    const { data } = await api.get(`/documents/${id}/timeline`);
    const eventCount = data.events?.length || 0;
    console.log(`✅ ${eventCount} event${eventCount !== 1 ? 's' : ''} in timeline`);
    return data;
  } catch (error) {
    return handleApiError(error, `Get timeline for document ${id}`);
  }
};

export const createDocument = async (formData) => {
  try {
    console.log('📝 Creating new document...');
    const { data } = await api.post('/documents', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    const docId = data.document?.id || data.id;
    console.log(`✅ Document created: #${docId}`);
    return data;
  } catch (error) {
    return handleApiError(error, 'Create document');
  }
};

export const deleteDocument = async (id) => {
  try {
    console.log(`🗑️ Deleting document #${id}...`);
    const { data } = await api.delete(`/documents/${id}`);
    console.log('✅ Document deleted');
    return data;
  } catch (error) {
    return handleApiError(error, `Delete document ${id}`);
  }
};

/* ================================
   UTILIDADES
   ================================ */

export const testConnection = async () => {
  try {
    console.log('🔍 Testing backend connection...');
    const { data } = await api.get('/health', { timeout: 10000 });
    console.log('✅ Backend is available:', data);
    return { available: true, data };
  } catch (error) {
    console.error('❌ Backend unavailable:', error.message);
    return { available: false, error: error.message };
  }
};

export default api;