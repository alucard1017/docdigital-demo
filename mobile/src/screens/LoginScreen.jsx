// mobile/src/screens/LoginScreen.jsx
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, HelperText, ActivityIndicator } from 'react-native-paper';
import { login } from '../api/client';

export default function LoginScreen({ navigation }) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    // Validación
    if (!identifier.trim()) {
      setError('Ingresa tu RUN o email');
      return;
    }
    
    if (!password) {
      setError('Ingresa tu contraseña');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await login(identifier, password);
      
      // Login exitoso
      console.log('✅ Navegando a Home...');
      navigation.replace('Home');
      
    } catch (err) {
      console.error('❌ Login error caught in component:', err);
      
      // Mostrar mensaje de error amigable
      const errorMessage = err.userMessage || 'Error al iniciar sesión. Intenta de nuevo.';
      setError(errorMessage);
      
      // Opcionalmente mostrar alert para errores críticos
      if (err.code === 'ECONNABORTED') {
        Alert.alert(
          'Servidor Lento',
          'El servidor está tardando más de lo esperado. Puede estar iniciando. ¿Quieres seguir esperando?',
          [
            { text: 'Cancelar', style: 'cancel' },
            { text: 'Reintentar', onPress: () => handleLogin() }
          ]
        );
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.content}>
          {/* Header */}
          <View style={styles.header}>
            <Text variant="displaySmall" style={styles.logo}>
              📝
            </Text>
            <Text variant="headlineLarge" style={styles.title}>
              VeriFirma
            </Text>
            <Text variant="bodyMedium" style={styles.subtitle}>
              Plataforma de Firma Digital Segura
            </Text>
          </View>

          {/* Formulario */}
          <View style={styles.form}>
            <TextInput
              label="RUN o Email"
              value={identifier}
              onChangeText={(text) => {
                setIdentifier(text);
                setError('');
              }}
              mode="outlined"
              keyboardType="default"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="off"
              style={styles.input}
              disabled={loading}
              error={!!error}
              placeholder="Ej: 12345678-9"
              left={<TextInput.Icon icon="account" />}
            />
            
            <TextInput
              label="Contraseña"
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                setError('');
              }}
              mode="outlined"
              secureTextEntry
              style={styles.input}
              disabled={loading}
              error={!!error}
              onSubmitEditing={handleLogin}
              left={<TextInput.Icon icon="lock" />}
            />

            {error ? (
              <HelperText type="error" visible={!!error} style={styles.errorText}>
                {error}
              </HelperText>
            ) : null}

            <Button
              mode="contained"
              onPress={handleLogin}
              loading={loading}
              disabled={loading}
              style={styles.button}
              contentStyle={styles.buttonContent}
              labelStyle={styles.buttonLabel}
            >
              {loading ? 'Conectando...' : 'Iniciar Sesión'}
            </Button>
          </View>

          {/* Info */}
          {loading && (
            <View style={styles.loadingInfo}>
              <ActivityIndicator size="small" color="#1e40af" />
              <Text variant="bodySmall" style={styles.loadingText}>
                Conectando con el servidor...
              </Text>
              <Text variant="bodySmall" style={styles.loadingSubtext}>
                Puede tardar hasta 2 minutos si el servidor está iniciando
              </Text>
            </View>
          )}

          {!loading && (
            <View style={styles.infoBox}>
              <Text variant="bodySmall" style={styles.infoText}>
                🔒 Conexión segura SSL/TLS
              </Text>
              <Text variant="bodySmall" style={styles.infoText}>
                ☁️ Servidor: Render (Producción)
              </Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 48,
  },
  logo: {
    fontSize: 72,
    marginBottom: 16,
  },
  title: {
    textAlign: 'center',
    marginBottom: 8,
    color: '#1e40af',
    fontWeight: 'bold',
  },
  subtitle: {
    textAlign: 'center',
    color: '#64748b',
  },
  form: {
    marginBottom: 24,
  },
  input: {
    marginBottom: 16,
    backgroundColor: 'white',
  },
  button: {
    marginTop: 8,
    backgroundColor: '#1e40af',
  },
  buttonContent: {
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 13,
    marginTop: -8,
    marginBottom: 8,
  },
  loadingInfo: {
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#e0f2fe',
    borderRadius: 12,
    marginBottom: 16,
  },
  loadingText: {
    marginTop: 12,
    color: '#0369a1',
    fontWeight: '600',
  },
  loadingSubtext: {
    marginTop: 4,
    color: '#075985',
    textAlign: 'center',
    fontStyle: 'italic',
  },
  infoBox: {
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 8,
  },
  infoText: {
    color: '#64748b',
    marginVertical: 2,
  },
});