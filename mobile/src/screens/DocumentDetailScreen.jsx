import React, { useEffect, useState } from 'react';
import { View, ScrollView, StyleSheet, Alert } from 'react-native';
import { Text, Card, Button, Chip, ActivityIndicator, Divider } from 'react-native-paper';
import { getDocument, signDocument, rejectDocument } from '../api/client';
import { formatDateTime } from '../utils/formatters';

export default function DocumentDetailScreen({ route, navigation }) {
  const { documentId } = route.params;
  const [document, setDocument] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchDocument = async () => {
    try {
      setLoading(true);
      const data = await getDocument(documentId);
      setDocument(data.document || data);
    } catch (error) {
      console.error('Error cargando documento:', error);
      Alert.alert('Error', 'No se pudo cargar el documento');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [documentId]);

  const handleSign = () => {
    navigation.navigate('SignDocument', { documentId, document });
  };

  const handleReject = () => {
    Alert.prompt(
      'Rechazar Documento',
      'Ingresa el motivo del rechazo:',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Rechazar',
          style: 'destructive',
          onPress: async (reason) => {
            if (!reason?.trim()) {
              Alert.alert('Error', 'Debes ingresar un motivo');
              return;
            }

            try {
              setActionLoading(true);
              await rejectDocument(documentId, reason);
              Alert.alert('Éxito', 'Documento rechazado');
              fetchDocument();
            } catch (error) {
              Alert.alert('Error', 'No se pudo rechazar el documento');
            } finally {
              setActionLoading(false);
            }
          },
        },
      ],
      'plain-text'
    );
  };

  const getStatusColor = (status) => {
    const colors = {
      'PENDIENTE_FIRMA': '#f59e0b',
      'FIRMADO': '#10b981',
      'COMPLETADO': '#10b981',
      'RECHAZADO': '#ef4444',
      'PENDIENTE_VISTO_BUENO': '#3b82f6',
    };
    return colors[status] || '#6b7280';
  };

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
      </View>
    );
  }

  if (!document) {
    return (
      <View style={styles.centered}>
        <Text>Documento no encontrado</Text>
      </View>
    );
  }

  const canSign = document.status === 'PENDIENTE_FIRMA';
  const canReject = document.status === 'PENDIENTE_FIRMA' || document.status === 'PENDIENTE_VISTO_BUENO';

  return (
    <ScrollView style={styles.container}>
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.header}>
            <Text variant="headlineSmall" style={styles.title}>
              {document.title}
            </Text>
            <Chip
              mode="flat"
              style={{ backgroundColor: getStatusColor(document.status) }}
              textStyle={{ color: 'white' }}
            >
              {document.status}
            </Chip>
          </View>

          {document.numero_contrato_interno && (
            <Text style={styles.contractNumber}>
              📄 {document.numero_contrato_interno}
            </Text>
          )}

          {document.description && (
            <>
              <Divider style={styles.divider} />
              <Text variant="bodyMedium" style={styles.description}>
                {document.description}
              </Text>
            </>
          )}

          <Divider style={styles.divider} />

          <View style={styles.infoRow}>
            <Text style={styles.label}>Creado:</Text>
            <Text style={styles.value}>{formatDateTime(document.created_at)}</Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>Actualizado:</Text>
            <Text style={styles.value}>{formatDateTime(document.updated_at)}</Text>
          </View>

          {document.verification_code && (
            <View style={styles.infoRow}>
              <Text style={styles.label}>Código de verificación:</Text>
              <Text style={[styles.value, styles.code]}>{document.verification_code}</Text>
            </View>
          )}
        </Card.Content>
      </Card>

      {(canSign || canReject) && (
        <View style={styles.actions}>
          {canSign && (
            <Button
              mode="contained"
              onPress={handleSign}
              style={styles.signButton}
              disabled={actionLoading}
              icon="pen"
            >
              Firmar Documento
            </Button>
          )}

          {canReject && (
            <Button
              mode="outlined"
              onPress={handleReject}
              style={styles.rejectButton}
              disabled={actionLoading}
              textColor="#ef4444"
              icon="close-circle-outline"
            >
              Rechazar
            </Button>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    margin: 16,
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#1e293b',
  },
  contractNumber: {
    color: '#64748b',
    marginBottom: 8,
  },
  divider: {
    marginVertical: 16,
  },
  description: {
    color: '#475569',
    lineHeight: 22,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  label: {
    fontWeight: '600',
    color: '#64748b',
  },
  value: {
    color: '#1e293b',
  },
  code: {
    fontFamily: 'monospace',
    fontWeight: 'bold',
    color: '#1e40af',
  },
  actions: {
    padding: 16,
    gap: 12,
  },
  signButton: {
    backgroundColor: '#1e40af',
    paddingVertical: 6,
  },
  rejectButton: {
    borderColor: '#ef4444',
    paddingVertical: 6,
  },
});