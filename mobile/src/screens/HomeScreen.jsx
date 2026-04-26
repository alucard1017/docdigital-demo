import React, { useEffect, useState } from 'react';
import { View, FlatList, StyleSheet, RefreshControl, TouchableOpacity, Alert } from 'react-native';
import { Text, Card, Chip, ActivityIndicator, Searchbar, IconButton } from 'react-native-paper';
import { getDocuments, logout } from '../api/client';
import { formatDate } from '../utils/formatters';

export default function HomeScreen({ navigation }) {
  const [documents, setDocuments] = useState([]);
  const [filteredDocs, setFilteredDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState(null);

  const fetchDocuments = async () => {
    try {
      const data = await getDocuments();
      console.log('Documentos cargados:', data);
      
      const docs = data.data || data.documents || [];
      setDocuments(docs);
      setFilteredDocs(docs);
      setStats(data.stats);
    } catch (error) {
      console.error('Error cargando documentos:', error);
      
      // Si hay error de autenticación, ir a login
      if (error.response?.status === 401) {
        Alert.alert('Sesión Expirada', 'Por favor inicia sesión de nuevo', [
          { text: 'OK', onPress: () => navigation.replace('Login') }
        ]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
    
    // Configurar botón de logout en header
    navigation.setOptions({
      headerRight: () => (
        <IconButton
          icon="logout"
          iconColor="white"
          onPress={handleLogout}
        />
      ),
    });
  }, [navigation]);

  const handleLogout = () => {
    Alert.alert(
      'Cerrar Sesión',
      '¿Estás seguro de que quieres cerrar sesión?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Cerrar Sesión',
          style: 'destructive',
          onPress: async () => {
            await logout();
            navigation.replace('Login');
          },
        },
      ]
    );
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchDocuments();
  };

  const handleSearch = (query) => {
    setSearchQuery(query);
    
    if (!query.trim()) {
      setFilteredDocs(documents);
      return;
    }
    
    const filtered = documents.filter((doc) =>
      doc.title.toLowerCase().includes(query.toLowerCase()) ||
      doc.numero_contrato_interno?.toLowerCase().includes(query.toLowerCase())
    );
    
    setFilteredDocs(filtered);
  };

  const getStatusColor = (status) => {
    const statusMap = {
      'PENDIENTE_FIRMA': '#f59e0b',
      'FIRMADO': '#10b981',
      'COMPLETADO': '#10b981',
      'RECHAZADO': '#ef4444',
      'PENDIENTE_VISTO_BUENO': '#3b82f6',
    };
    return statusMap[status] || '#6b7280';
  };

  const getStatusLabel = (status) => {
    const labelMap = {
      'PENDIENTE_FIRMA': 'Pendiente',
      'FIRMADO': 'Firmado',
      'COMPLETADO': 'Completado',
      'RECHAZADO': 'Rechazado',
      'PENDIENTE_VISTO_BUENO': 'En Revisión',
    };
    return labelMap[status] || status;
  };

  const renderDocument = ({ item }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('DocumentDetail', { documentId: item.id })}
      activeOpacity={0.7}
    >
      <Card style={styles.card}>
        <Card.Content>
          <View style={styles.cardHeader}>
            <Text variant="titleMedium" style={styles.docTitle} numberOfLines={2}>
              {item.title}
            </Text>
            <Chip
              mode="flat"
              compact
              style={{ backgroundColor: getStatusColor(item.status) }}
              textStyle={{ color: 'white', fontSize: 11 }}
            >
              {getStatusLabel(item.status)}
            </Chip>
          </View>
          
          {item.numero_contrato_interno && (
            <Text variant="bodySmall" style={styles.contractNumber}>
              📄 {item.numero_contrato_interno}
            </Text>
          )}
          
          <View style={styles.cardFooter}>
            <Text variant="bodySmall" style={styles.metaText}>
              👥 {item.signers_count || 0} firmante{item.signers_count !== '1' ? 's' : ''}
            </Text>
            <Text variant="bodySmall" style={styles.dateText}>
              {formatDate(item.created_at)}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </TouchableOpacity>
  );

  const renderHeader = () => (
    <View style={styles.header}>
      <Searchbar
        placeholder="Buscar documentos..."
        onChangeText={handleSearch}
        value={searchQuery}
        style={styles.searchbar}
      />
      
      {stats && (
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Text style={styles.statNumber}>{stats.total || 0}</Text>
            <Text style={styles.statLabel}>Total</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#f59e0b' }]}>
              {stats.pendientes || 0}
            </Text>
            <Text style={styles.statLabel}>Pendientes</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#10b981' }]}>
              {stats.firmados || 0}
            </Text>
            <Text style={styles.statLabel}>Firmados</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={[styles.statNumber, { color: '#ef4444' }]}>
              {stats.rechazados || 0}
            </Text>
            <Text style={styles.statLabel}>Rechazados</Text>
          </View>
        </View>
      )}
    </View>
  );

  if (loading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1e40af" />
        <Text style={styles.loadingText}>Cargando documentos...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <FlatList
        data={filteredDocs}
        renderItem={renderDocument}
        keyExtractor={(item) => item.id.toString()}
        ListHeaderComponent={renderHeader}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="displaySmall" style={styles.emptyIcon}>📄</Text>
            <Text variant="bodyLarge" style={styles.emptyText}>
              {searchQuery ? 'No se encontraron documentos' : 'No hay documentos'}
            </Text>
            <Text variant="bodySmall" style={styles.emptySubtext}>
              {searchQuery ? 'Intenta con otro término de búsqueda' : 'Crea tu primer documento'}
            </Text>
          </View>
        }
      />
    </View>
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
  loadingText: {
    marginTop: 12,
    color: '#64748b',
  },
  header: {
    padding: 16,
    paddingBottom: 8,
  },
  searchbar: {
    marginBottom: 16,
    elevation: 2,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    elevation: 2,
  },
  statBox: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e40af',
  },
  statLabel: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
  },
  list: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  card: {
    marginBottom: 12,
    elevation: 2,
    backgroundColor: 'white',
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  docTitle: {
    flex: 1,
    marginRight: 8,
    fontWeight: '600',
    color: '#1e293b',
  },
  contractNumber: {
    color: '#64748b',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  metaText: {
    color: '#64748b',
  },
  dateText: {
    color: '#94a3b8',
  },
  empty: {
    padding: 48,
    alignItems: 'center',
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    color: '#64748b',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptySubtext: {
    color: '#94a3b8',
    textAlign: 'center',
  },
});