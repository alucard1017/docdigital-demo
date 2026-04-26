// mobile/src/screens/SignDocumentScreen.jsx
import React, { useState } from 'react';
import { View, StyleSheet, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { Text, Button, TextInput } from 'react-native-paper';
import { signDocument } from '../api/client';

export default function SignDocumentScreen({ route, navigation }) {
  const { documentId, document } = route.params;
  const [signatureName, setSignatureName] = useState(''); // ← CAMBIO AQUÍ
  const [loading, setLoading] = useState(false);

  const handleSign = async () => {
    if (!signatureName.trim()) { // ← CAMBIO AQUÍ
      Alert.alert('Error', 'Debes ingresar tu nombre para firmar');
      return;
    }

    Alert.alert(
      'Confirmar Firma',
      `¿Estás seguro de firmar "${document.title}" como "${signatureName}"?`, // ← CAMBIO AQUÍ
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Firmar',
          onPress: async () => {
            try {
              setLoading(true);
              await signDocument(documentId, signatureName); // ← CAMBIO AQUÍ
              
              Alert.alert(
                'Éxito',
                'Documento firmado correctamente',
                [
                  {
                    text: 'OK',
                    onPress: () => navigation.navigate('Home'),
                  },
                ]
              );
            } catch (error) {
              console.error('Error firmando:', error);
              Alert.alert(
                'Error',
                error.response?.data?.message || 'No se pudo firmar el documento'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <View style={styles.content}>
        <Text variant="headlineSmall" style={styles.title}>
          Firmar Documento
        </Text>
        
        <Text variant="bodyMedium" style={styles.subtitle}>
          {document.title}
        </Text>

        <View style={styles.signatureBox}>
          <Text variant="bodyLarge" style={[
            styles.signaturePreview,
            { color: signatureName ? '#1e40af' : '#cbd5e1' } // ← CAMBIO AQUÍ
          ]}>
            {signatureName || 'Tu firma aparecerá aquí'} 
          </Text>
        </View>

        <TextInput
          label="Ingresa tu nombre completo"
          value={signatureName} // ← CAMBIO AQUÍ
          onChangeText={setSignatureName} // ← CAMBIO AQUÍ
          mode="outlined"
          style={styles.input}
          disabled={loading}
          placeholder="Ej: Juan Pérez"
        />

        <Button
          mode="contained"
          onPress={handleSign}
          loading={loading}
          disabled={loading || !signatureName.trim()} // ← CAMBIO AQUÍ
          style={styles.button}
          icon="pen"
        >
          Confirmar Firma
        </Button>

        <Button
          mode="outlined"
          onPress={() => navigation.goBack()}
          disabled={loading}
          style={styles.cancelButton}
        >
          Cancelar
        </Button>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  title: {
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
  },
  subtitle: {
    color: '#64748b',
    marginBottom: 24,
  },
  signatureBox: {
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#1e40af',
    borderStyle: 'dashed',
    borderRadius: 12,
    padding: 32,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
  },
  signaturePreview: {
    fontFamily: 'cursive',
    fontSize: 24,
    fontStyle: 'italic',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#1e40af',
    paddingVertical: 6,
    marginBottom: 12,
  },
  cancelButton: {
    borderColor: '#64748b',
  },
});