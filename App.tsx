
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://172.20.10.3:3001';

const FAVORITES_KEY = '@shopping-guide-favorites';
const SETTINGS_KEY = '@shopping-guide-settings';
const OUTFITS_KEY = '@shopping-guide-outfits';
const WARDROBE_KEY = '@shopping-guide-wardrobe';

type Settings = {
  country: string;
  city: string;
  currency: string;
  storeScope: 'local' | 'international';
};

type Product = {
  id: string;
  name: string;
  brand?: string;
  category: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productUrl?: string;
  retailer?: string;
};

type Outfit = {
  id: string;
  name: string;
  date: string;
  itemIds: string[];
};

const DEFAULT_SETTINGS: Settings = {
  country: 'Netherlands',
  city: 'Amsterdam',
  currency: 'EUR',
  storeScope: 'local',
};

const DEMO_PRODUCTS: Product[] = [
  { id: '1', name: 'Classic blazer', brand: 'Wardrobe edit', category: 'Clothing', price: 89, currency: 'EUR' },
  { id: '2', name: 'White cotton shirt', brand: 'Wardrobe edit', category: 'Clothing', price: 39, currency: 'EUR' },
  { id: '3', name: 'Tailored trousers', brand: 'Wardrobe edit', category: 'Clothing', price: 59, currency: 'EUR' },
  { id: '4', name: 'Shoulder bag', brand: 'Wardrobe edit', category: 'Accessories', price: 65, currency: 'EUR' },
];

const CATEGORIES = ['All', 'Clothing', 'Accessories', 'Shoes', 'Beauty'];

const makeId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

function money(value: number, currency: string) {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency: currency || 'EUR',
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency || 'EUR'}`;
  }
}

export default function App() {
  const [tab, setTab] = useState<'Discover' | 'Looks' | 'Favorites' | 'Profile'>('Discover');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  // Гардероб и сохранённые образы
  const [wardrobe, setWardrobe] = useState<Product[]>(DEMO_PRODUCTS);
  const [outfits, setOutfits] = useState<Outfit[]>([]);

  // Поиск товаров через существующий сервер
  const [query, setQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('100');
  const [realProducts, setRealProducts] = useState<Product[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState(
    'Live retailer sources are not connected yet.',
  );
  const [searchAttempted, setSearchAttempted] = useState(false);

  // Создание образа
  const [outfitModal, setOutfitModal] = useState(false);
  const [outfitName, setOutfitName] = useState('');
  const [outfitDate, setOutfitDate] = useState('');
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);

  // Добавление вещи в гардероб
  const [itemModal, setItemModal] = useState(false);
  const [itemName, setItemName] = useState('');
  const [itemCategory, setItemCategory] = useState('Clothing');
  const [itemPrice, setItemPrice] = useState('');

  // Настройки профиля
  const [settingsModal, setSettingsModal] = useState(false);
  const [editCountry, setEditCountry] = useState(DEFAULT_SETTINGS.country);
  const [editCity, setEditCity] = useState(DEFAULT_SETTINGS.city);
  const [editCurrency, setEditCurrency] = useState(DEFAULT_SETTINGS.currency);
  const [editScope, setEditScope] = useState<Settings['storeScope']>('local');

  const [category, setCategory] = useState('All');

  useEffect(() => {
    async function loadData() {
      try {
        const [savedFavorites, savedSettings, savedOutfits, savedWardrobe] =
          await Promise.all([
            AsyncStorage.getItem(FAVORITES_KEY),
            AsyncStorage.getItem(SETTINGS_KEY),
            AsyncStorage.getItem(OUTFITS_KEY),
            AsyncStorage.getItem(WARDROBE_KEY),
          ]);

        if (savedFavorites) setFavorites(JSON.parse(savedFavorites));
        if (savedSettings) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(savedSettings) });
        if (savedOutfits) setOutfits(JSON.parse(savedOutfits));
        if (savedWardrobe) setWardrobe(JSON.parse(savedWardrobe));
      } catch {
        Alert.alert('Notice', 'Some saved data could not be loaded.');
      } finally {
        setLoaded(true);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)).catch(() => {});
  }, [favorites, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {});
  }, [settings, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(OUTFITS_KEY, JSON.stringify(outfits)).catch(() => {});
  }, [outfits, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(WARDROBE_KEY, JSON.stringify(wardrobe)).catch(() => {});
  }, [wardrobe, loaded]);

  const favoriteProducts = useMemo(
    () => [...DEMO_PRODUCTS, ...realProducts].filter((p) => favorites.includes(p.id)),
    [favorites, realProducts],
  );

  const filteredDemoProducts = useMemo(
    () => DEMO_PRODUCTS.filter((p) => category === 'All' || p.category === category),
    [category],
  );

  const toggleFavorite = (id: string) => {
    setFavorites((previous) =>
      previous.includes(id) ? previous.filter((item) => item !== id) : [...previous, id],
    );
  };

  async function searchProducts() {
    if (!query.trim()) {
      Alert.alert('Search', 'Enter a product or style to search for.');
      return;
    }

    setSearchLoading(true);
    setSearchAttempted(true);
    setRealProducts([]);

    try {
      const params = new URLSearchParams({
        query: query.trim(),
        country: settings.country,
        city: settings.city,
        currency: settings.currency,
        category: category === 'All' ? '' : category,
        maxPrice: maxPrice.trim(),
        storeScope: settings.storeScope,
      });

      const response = await fetch(`${API_URL}/api/products?${params.toString()}`);
      if (!response.ok) throw new Error(`Server returned ${response.status}`);

      const data = await response.json();
      setRealProducts(Array.isArray(data.products) ? data.products : []);
      setSearchMessage(
        data.message || 'Search complete. Check the results below.',
      );
    } catch {
      setSearchMessage(
        'Could not connect to the product server. Check that your server is running and the phone is on the same Wi-Fi network.',
      );
    } finally {
      setSearchLoading(false);
    }
  }

  function openSettings() {
    setEditCountry(settings.country);
    setEditCity(settings.city);
    setEditCurrency(settings.currency);
    setEditScope(settings.storeScope);
    setSettingsModal(true);
  }

  function saveSettings() {
    if (!editCountry.trim() || !editCity.trim() || !editCurrency.trim()) {
      Alert.alert('Missing information', 'Please fill in country, city and currency.');
      return;
    }

    setSettings({
      country: editCountry.trim(),
      city: editCity.trim(),
      currency: editCurrency.trim().toUpperCase(),
      storeScope: editScope,
    });
    setSettingsModal(false);
  }

  function openOutfitCreator() {
    setOutfitName('');
    setOutfitDate(new Date().toISOString().slice(0, 10));
    setSelectedItemIds([]);
    setOutfitModal(true);
  }

  function toggleOutfitItem(id: string) {
    setSelectedItemIds((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id],
    );
  }

  function saveOutfit() {
    if (!outfitName.trim()) {
      Alert.alert('Name your outfit', 'Enter a name for this outfit.');
      return;
    }
    if (selectedItemIds.length === 0) {
      Alert.alert('Choose clothing', 'Select at least one item for your outfit.');
      return;
    }

    const newOutfit: Outfit = {
      id: makeId(),
      name: outfitName.trim(),
      date: outfitDate.trim() || new Date().toISOString().slice(0, 10),
      itemIds: selectedItemIds,
    };

    setOutfits((previous) => [newOutfit, ...previous]);
    setOutfitModal(false);
    setTab('Looks');
  }

  function addWardrobeItem() {
    if (!itemName.trim()) {
      Alert.alert('Item name', 'Enter a name for your clothing item.');
      return;
    }

    const price = itemPrice.trim() ? Number(itemPrice.replace(',', '.')) : 0;
    if (!Number.isFinite(price) || price < 0) {
      Alert.alert('Price', 'Enter a valid price, or leave it empty.');
      return;
    }

    const newItem: Product = {
      id: makeId(),
      name: itemName.trim(),
      category: itemCategory,
      price,
      currency: settings.currency,
    };

    setWardrobe((previous) => [newItem, ...previous]);
    setItemModal(false);
    setItemName('');
    setItemPrice('');
  }

  function deleteOutfit(id: string) {
    Alert.alert('Delete outfit?', 'This outfit will be removed from your planner.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setOutfits((previous) => previous.filter((o) => o.id !== id)),
      },
    ]);
  }

  function renderProductCard(product: Product, isDemo = false) {
    const isFavorite = favorites.includes(product.id);

    return (
      <View key={product.id} style={styles.productCard}>
        <View style={styles.productVisual}>
          <Text style={styles.productVisualText}>
            {product.category === 'Accessories' ? 'BAG' : 'STYLE'}
          </Text>
          <Pressable
            onPress={() => toggleFavorite(product.id)}
            style={styles.favoriteButton}
            accessibilityLabel={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          >
            <Text style={styles.favoriteIcon}>{isFavorite ? '♥' : '♡'}</Text>
          </Pressable>
        </View>

        <View style={styles.productInfo}>
          <Text style={styles.productName}>{product.name}</Text>
          {!!product.brand && <Text style={styles.muted}>{product.brand}</Text>}
          <Text style={styles.productPrice}>
            {money(product.price, product.currency || settings.currency)}
          </Text>
          <Text style={styles.muted}>
            {isDemo ? 'Illustrative item · not a live offer' : product.retailer || 'Search result'}
          </Text>
          {!!product.productUrl && (
            <Pressable
              onPress={() => Linking.openURL(product.productUrl!).catch(() =>
                Alert.alert('Link unavailable', 'Could not open this product link.'),
              )}
            >
              <Text style={styles.linkText}>View product ↗</Text>
            </Pressable>
          )}
          <Pressable
            style={styles.smallOutlineButton}
            onPress={() => {
              setItemName(product.name);
              setItemCategory(product.category || 'Clothing');
              setItemPrice(String(product.price));
              setItemModal(true);
            }}
          >
            <Text style={styles.smallOutlineButtonText}>Add to wardrobe</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  function renderDiscover() {
    return (
      <>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>YOUR PERSONAL STYLE SPACE</Text>
          <Text style={styles.heroTitle}>Find your next{'\n'}favourite thing.</Text>
          <Text style={styles.heroDescription}>
            Discover ideas, save favourites and plan outfits that fit your style.
          </Text>
          <Pressable style={styles.primaryButton} onPress={() => setTab('Looks')}>
            <Text style={styles.primaryButtonText}>Plan an outfit</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeading}>Search products</Text>
        <View style={styles.panel}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Try: beige blazer"
            placeholderTextColor="#9C958B"
            style={styles.input}
            returnKeyType="search"
            onSubmitEditing={searchProducts}
          />
          <Text style={styles.fieldLabel}>Maximum price ({settings.currency})</Text>
          <TextInput
            value={maxPrice}
            onChangeText={setMaxPrice}
            placeholder="100"
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <Pressable
            style={[styles.primaryButton, searchLoading && styles.disabledButton]}
            onPress={searchProducts}
            disabled={searchLoading}
          >
            {searchLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.primaryButtonText}>Search</Text>
            )}
          </Pressable>
          <Text style={styles.muted}>{searchMessage}</Text>
          {searchAttempted && realProducts.length === 0 && !searchLoading && (
            <Text style={styles.muted}>
              No live products returned. Demo items below are examples, not current retailer offers.
            </Text>
          )}
        </View>

        <Text style={styles.sectionHeading}>Explore by category</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryScroll}>
          {CATEGORIES.map((item) => (
            <Pressable
              key={item}
              onPress={() => setCategory(item)}
              style={[styles.categoryChip, category === item && styles.categoryChipActive]}
            >
              <Text style={[styles.categoryChipText, category === item && styles.categoryChipTextActive]}>
                {item}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {realProducts.length > 0 && (
          <>
            <Text style={styles.sectionHeading}>Search results</Text>
            {realProducts.map((product) => renderProductCard(product))}
          </>
        )}

        <Text style={styles.sectionHeading}>Demo collection</Text>
        <Text style={styles.sectionSubtitle}>Illustrative items · not live retailer offers</Text>
        {filteredDemoProducts.map((product) => renderProductCard(product, true))}
      </>
    );
  }

  function renderLooks() {
    return (
      <>
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>YOUR PERSONAL WARDROBE</Text>
          <Text style={styles.pageTitle}>Outfit planner</Text>
          <Text style={styles.sectionSubtitle}>
            Build looks from your wardrobe and plan what to wear.
          </Text>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{outfits.length}</Text>
            <Text style={styles.statLabel}>Saved looks</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statNumber}>{wardrobe.length}</Text>
            <Text style={styles.statLabel}>Wardrobe items</Text>
          </View>
        </View>

        <Pressable style={styles.primaryButton} onPress={openOutfitCreator}>
          <Text style={styles.primaryButtonText}>＋ Create an outfit</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={() => setItemModal(true)}>
          <Text style={styles.secondaryButtonText}>＋ Add clothing to wardrobe</Text>
        </Pressable>

        <Text style={styles.sectionHeading}>My outfits</Text>
        {outfits.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>✳</Text>
            <Text style={styles.emptyTitle}>Your first look starts here</Text>
            <Text style={styles.emptyText}>
              Choose a few items from your wardrobe, give the outfit a name and set a date.
            </Text>
            <Pressable style={styles.primaryButton} onPress={openOutfitCreator}>
              <Text style={styles.primaryButtonText}>Create my first look</Text>
            </Pressable>
          </View>
        ) : (
          outfits.map((outfit) => {
            const items = outfit.itemIds
              .map((id) => wardrobe.find((item) => item.id === id))
              .filter((item): item is Product => Boolean(item));
            const total = items.reduce((sum, item) => sum + item.price, 0);

            return (
              <View key={outfit.id} style={styles.outfitCard}>
                <View style={styles.outfitHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.outfitName}>{outfit.name}</Text>
                    <Text style={styles.muted}>Planned for {outfit.date || 'No date'}</Text>
                  </View>
                  <Pressable onPress={() => deleteOutfit(outfit.id)} style={styles.deleteButton}>
                    <Text style={styles.deleteButtonText}>Delete</Text>
                  </Pressable>
                </View>
                <View style={styles.outfitItems}>
                  {items.map((item) => (
                    <View key={item.id} style={styles.outfitItemPill}>
                      <Text style={styles.outfitItemText}>{item.name}</Text>
                    </View>
                  ))}
                </View>
                <View style={styles.outfitFooter}>
                  <Text style={styles.muted}>{items.length} items</Text>
                  <Text style={styles.productPrice}>{money(total, settings.currency)}</Text>
                </View>
              </View>
            );
          })
        )}

        <Text style={styles.sectionHeading}>My wardrobe</Text>
        <Text style={styles.sectionSubtitle}>
          Add your own pieces; photos are optional.
        </Text>
        {wardrobe.map((item) => (
          <View key={item.id} style={styles.wardrobeRow}>
            <View style={styles.wardrobeIcon}>
              <Text style={styles.wardrobeIconText}>✳</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.productName}>{item.name}</Text>
              <Text style={styles.muted}>{item.category}</Text>
            </View>
            <Text style={styles.productPrice}>{money(item.price, settings.currency)}</Text>
          </View>
        ))}
      </>
    );
  }

  function renderFavorites() {
    return (
      <>
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>SAVED FOR LATER</Text>
          <Text style={styles.pageTitle}>Favourites</Text>
          <Text style={styles.sectionSubtitle}>
            Keep your favourite pieces in one place.
          </Text>
        </View>
        {favoriteProducts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>♡</Text>
            <Text style={styles.emptyTitle}>Nothing saved yet</Text>
            <Text style={styles.emptyText}>
              Tap the heart on an item to add it to your favourites.
            </Text>
          </View>
        ) : (
          favoriteProducts.map((product) => renderProductCard(product, !realProducts.some((p) => p.id === product.id)))
        )}
      </>
    );
  }

  function renderProfile() {
    return (
      <>
        <View style={styles.pageIntro}>
          <Text style={styles.eyebrow}>PERSONALISE YOUR EXPERIENCE</Text>
          <Text style={styles.pageTitle}>Your profile</Text>
          <Text style={styles.sectionSubtitle}>
            Set your location, currency and preferred store coverage.
          </Text>
        </View>

        <View style={styles.profileCard}>
          <View style={styles.profileAvatar}>
            <Text style={styles.profileAvatarText}>SG</Text>
          </View>
          <Text style={styles.profileName}>Shopping Guide</Text>
          <Text style={styles.muted}>Your personal shopping companion</Text>
        </View>

        <Text style={styles.sectionHeading}>Shopping preferences</Text>
        <View style={styles.panel}>
          <SettingRow label="Country" value={settings.country} />
          <SettingRow label="City" value={settings.city} />
          <SettingRow label="Currency" value={settings.currency} />
          <SettingRow
            label="Store coverage"
            value={settings.storeScope === 'local' ? 'Local stores' : 'Local + international'}
          />
          <Pressable style={styles.primaryButton} onPress={openSettings}>
            <Text style={styles.primaryButtonText}>Edit preferences</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionHeading}>Your activity</Text>
        <View style={styles.panel}>
          <SettingRow label="Favourite items" value={String(favorites.length)} />
          <SettingRow label="Saved outfits" value={String(outfits.length)} />
          <SettingRow label="Wardrobe items" value={String(wardrobe.length)} />
        </View>

        <Text style={styles.footerNote}>
          Product discovery is in development. Demo items are illustrative and are not live retailer offers.
        </Text>
      </>
    );
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loadingScreen}>
        <StatusBar barStyle="dark-content" backgroundColor="#F8F5EF" />
        <ActivityIndicator size="large" color="#6B6255" />
        <Text style={styles.muted}>Loading your Shopping Guide...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F5EF" />
      <View style={styles.topBar}>
        <View>
          <Text style={styles.brandName}>SHOPPING GUIDE</Text>
          <Text style={styles.brandSubtitle}>A thoughtful way to shop</Text>
        </View>
        <Pressable style={styles.topProfileButton} onPress={() => setTab('Profile')}>
          <Text style={styles.topProfileText}>SG</Text>
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {tab === 'Discover' && renderDiscover()}
        {tab === 'Looks' && renderLooks()}
        {tab === 'Favorites' && renderFavorites()}
        {tab === 'Profile' && renderProfile()}
      </ScrollView>

      <View style={styles.bottomNav}>
        <NavButton label="Discover" icon="⌕" active={tab === 'Discover'} onPress={() => setTab('Discover')} />
        <NavButton label="My looks" icon="✳" active={tab === 'Looks'} onPress={() => setTab('Looks')} />
        <NavButton label="Saved" icon="♡" active={tab === 'Favorites'} onPress={() => setTab('Favorites')} />
        <NavButton label="Profile" icon="○" active={tab === 'Profile'} onPress={() => setTab('Profile')} />
      </View>

      {/* Создание образа */}
      <Modal visible={outfitModal} animationType="slide" transparent onRequestClose={() => setOutfitModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Create an outfit</Text>
              <Pressable onPress={() => setOutfitModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled">
              <Text style={styles.fieldLabel}>Outfit name</Text>
              <TextInput
                value={outfitName}
                onChangeText={setOutfitName}
                placeholder="e.g. Everyday chic"
                placeholderTextColor="#9C958B"
                style={styles.input}
              />
              <Text style={styles.fieldLabel}>Date (YYYY-MM-DD)</Text>
              <TextInput
                value={outfitDate}
                onChangeText={setOutfitDate}
                placeholder="2026-10-24"
                placeholderTextColor="#9C958B"
                style={styles.input}
                autoCapitalize="none"
              />

              <Text style={styles.sectionHeading}>Choose items</Text>
              {wardrobe.map((item) => {
                const selected = selectedItemIds.includes(item.id);
                return (
                  <Pressable
                    key={item.id}
                    onPress={() => toggleOutfitItem(item.id)}
                    style={[styles.selectItemRow, selected && styles.selectItemRowActive]}
                  >
                    <View style={[styles.checkbox, selected && styles.checkboxActive]}>
                      {selected && <Text style={styles.checkboxTick}>✓</Text>}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.productName}>{item.name}</Text>
                      <Text style={styles.muted}>{item.category}</Text>
                    </View>
                    <Text style={styles.productPrice}>{money(item.price, settings.currency)}</Text>
                  </Pressable>
                );
              })}

              <Pressable style={styles.primaryButton} onPress={saveOutfit}>
                <Text style={styles.primaryButtonText}>Save outfit</Text>
              </Pressable>
              <Pressable style={styles.cancelButton} onPress={() => setOutfitModal(false)}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Добавление вещи */}
      <Modal visible={itemModal} animationType="slide" transparent onRequestClose={() => setItemModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Add wardrobe item</Text>
              <Pressable onPress={() => setItemModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Item name</Text>
            <TextInput
              value={itemName}
              onChangeText={setItemName}
              placeholder="e.g. Black loafers"
              placeholderTextColor="#9C958B"
              style={styles.input}
            />
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryOptions}>
              {['Clothing', 'Accessories', 'Shoes', 'Beauty'].map((item) => (
                <Pressable
                  key={item}
                  onPress={() => setItemCategory(item)}
                  style={[styles.categoryChip, itemCategory === item && styles.categoryChipActive]}
                >
                  <Text style={[styles.categoryChipText, itemCategory === item && styles.categoryChipTextActive]}>
                    {item}
                  </Text>
                </Pressable>
              ))}
            </View>
            <Text style={styles.fieldLabel}>Price ({settings.currency}, optional)</Text>
            <TextInput
              value={itemPrice}
              onChangeText={setItemPrice}
              placeholder="0"
              placeholderTextColor="#9C958B"
              keyboardType="decimal-pad"
              style={styles.input}
            />
            <Text style={styles.muted}>
              You can add items you already own. A price of 0 is fine if you don't want to track the cost.
            </Text>
            <Pressable style={styles.primaryButton} onPress={addWardrobeItem}>
              <Text style={styles.primaryButtonText}>Save item</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setItemModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Настройки */}
      <Modal visible={settingsModal} animationType="slide" transparent onRequestClose={() => setSettingsModal(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <View style={styles.modalTitleRow}>
              <Text style={styles.modalTitle}>Preferences</Text>
              <Pressable onPress={() => setSettingsModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.fieldLabel}>Country</Text>
            <TextInput value={editCountry} onChangeText={setEditCountry} style={styles.input} placeholder="Country" />
            <Text style={styles.fieldLabel}>City</Text>
            <TextInput value={editCity} onChangeText={setEditCity} style={styles.input} placeholder="City" />
            <Text style={styles.fieldLabel}>Currency code (e.g. EUR, USD)</Text>
            <TextInput
              value={editCurrency}
              onChangeText={setEditCurrency}
              style={styles.input}
              placeholder="EUR"
              autoCapitalize="characters"
            />

            <Text style={styles.fieldLabel}>Store coverage</Text>
            <Pressable
              onPress={() => setEditScope('local')}
              style={[styles.scopeOption, editScope === 'local' && styles.scopeOptionActive]}
            >
              <Text style={styles.productName}>Local stores only</Text>
              <Text style={styles.muted}>Stores in my selected country</Text>
            </Pressable>
            <Pressable
              onPress={() => setEditScope('international')}
              style={[styles.scopeOption, editScope === 'international' && styles.scopeOptionActive]}
            >
              <Text style={styles.productName}>Local + international</Text>
              <Text style={styles.muted}>Include stores delivering to my country</Text>
            </Pressable>

            <Pressable style={styles.primaryButton} onPress={saveSettings}>
              <Text style={styles.primaryButtonText}>Save preferences</Text>
            </Pressable>
            <Pressable style={styles.cancelButton} onPress={() => setSettingsModal(false)}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function NavButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={styles.navButton}>
      <Text style={[styles.navIcon, active && styles.navActive]}>{icon}</Text>
      <Text style={[styles.navLabel, active && styles.navActive]}>{label}</Text>
      {active && <View style={styles.navDot} />}
    </Pressable>
  );
}

function SettingRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F5EF' },
  loadingScreen: { flex: 1, backgroundColor: '#F8F5EF', alignItems: 'center', justifyContent: 'center', gap: 14 },
  topBar: {
    paddingHorizontal: 22,
    paddingTop: 10,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE4DA',
  },
  brandName: { color: '#292820', fontSize: 13, letterSpacing: 2.2, fontWeight: '700' },
  brandSubtitle: { color: '#898174', fontSize: 11, marginTop: 4 },
  topProfileButton: { width: 40, height: 40, borderRadius: 20, backgroundColor: '#EAE2D5', alignItems: 'center', justifyContent: 'center' },
  topProfileText: { color: '#625849', fontWeight: '700', fontSize: 12 },
  content: { flex: 1 },
  contentContainer: { paddingHorizontal: 20, paddingTop: 18, paddingBottom: 28 },
  hero: { backgroundColor: '#EDE5D8', borderRadius: 24, padding: 22, marginBottom: 24 },
  eyebrow: { fontSize: 10, letterSpacing: 1.8, color: '#817462', fontWeight: '700', marginBottom: 12 },
  heroTitle: { color: '#292820', fontSize: 34, lineHeight: 40, fontWeight: '500', letterSpacing: -0.8 },
  heroDescription: { color: '#6E665B', fontSize: 14, lineHeight: 21, marginTop: 12, marginBottom: 20 },
  pageIntro: { marginBottom: 20 },
  pageTitle: { fontSize: 32, fontWeight: '500', letterSpacing: -0.7, color: '#292820', marginBottom: 8 },
  sectionHeading: { fontSize: 20, color: '#302E27', fontWeight: '600', marginTop: 22, marginBottom: 12 },
  sectionSubtitle: { fontSize: 13, lineHeight: 19, color: '#898174', marginBottom: 10 },
  panel: { backgroundColor: '#FFFEFB', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EEE8DE', gap: 10 },
  input: { borderWidth: 1, borderColor: '#E5DED3', backgroundColor: '#FFFEFB', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 14, color: '#302E27', marginBottom: 8 },
  fieldLabel: { fontSize: 12, fontWeight: '600', color: '#665E52', marginTop: 8, marginBottom: 6 },
  primaryButton: { minHeight: 48, borderRadius: 13, backgroundColor: '#39372F', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginTop: 8 },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  disabledButton: { opacity: 0.65 },
  secondaryButton: { minHeight: 46, borderRadius: 13, borderWidth: 1, borderColor: '#D9D0C3', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, marginTop: 10 },
  secondaryButtonText: { color: '#39372F', fontSize: 14, fontWeight: '600' },
  categoryScroll: { marginBottom: 6 },
  categoryChip: { borderWidth: 1, borderColor: '#DDD5C9', borderRadius: 24, paddingVertical: 9, paddingHorizontal: 15, marginRight: 8, backgroundColor: '#FFFEFB' },
  categoryChipActive: { backgroundColor: '#39372F', borderColor: '#39372F' },
  categoryChipText: { fontSize: 12, color: '#665E52' },
  categoryChipTextActive: { color: '#FFFFFF' },
  productCard: { flexDirection: 'row', backgroundColor: '#FFFEFB', borderRadius: 18, overflow: 'hidden', marginBottom: 14, borderWidth: 1, borderColor: '#EEE8DE' },
  productVisual: { width: 112, minHeight: 150, backgroundColor: '#EDE5D8', alignItems: 'center', justifyContent: 'center' },
  productVisualText: { color: '#A69A87', fontSize: 12, letterSpacing: 2, fontWeight: '600' },
  favoriteButton: { position: 'absolute', top: 9, right: 9, width: 30, height: 30, borderRadius: 15, backgroundColor: '#FFFEFB', alignItems: 'center', justifyContent: 'center' },
  favoriteIcon: { fontSize: 19, color: '#4B443B' },
  productInfo: { flex: 1, padding: 13, justifyContent: 'center' },
  productName: { fontSize: 14, fontWeight: '600', color: '#302E27' },
  productPrice: { fontSize: 14, fontWeight: '700', color: '#39372F', marginTop: 7 },
  muted: { color: '#898174', fontSize: 11, lineHeight: 16, marginTop: 4 },
  linkText: { color: '#625849', textDecorationLine: 'underline', marginTop: 7, fontSize: 12 },
  smallOutlineButton: { borderWidth: 1, borderColor: '#D9D0C3', paddingHorizontal: 9, paddingVertical: 7, borderRadius: 9, alignSelf: 'flex-start', marginTop: 9 },
  smallOutlineButtonText: { fontSize: 11, color: '#4F483D', fontWeight: '600' },
  bottomNav: { flexDirection: 'row', paddingTop: 10, paddingBottom: 6, backgroundColor: '#FFFEFB', borderTopWidth: 1, borderTopColor: '#EAE4DA', justifyContent: 'space-around' },
  navButton: { minWidth: 66, alignItems: 'center', paddingVertical: 3 },
  navIcon: { fontSize: 21, color: '#A49A8C', marginBottom: 3 },
  navLabel: { fontSize: 10, color: '#938A7D' },
  navActive: { color: '#39372F', fontWeight: '700' },
  navDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: '#39372F', marginTop: 4 },
  emptyState: { backgroundColor: '#F0EAE0', padding: 22, borderRadius: 18, alignItems: 'center', marginTop: 8 },
  emptyIcon: { fontSize: 32, color: '#877A67', marginBottom: 8 },
  emptyTitle: { color: '#302E27', fontWeight: '600', fontSize: 16, textAlign: 'center' },
  emptyText: { color: '#81786B', fontSize: 13, lineHeight: 20, textAlign: 'center', marginTop: 8, marginBottom: 10 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 12 },
  statCard: { flex: 1, borderRadius: 16, backgroundColor: '#EDE5D8', padding: 16 },
  statNumber: { color: '#39372F', fontSize: 27, fontWeight: '600' },
  statLabel: { color: '#817462', fontSize: 11, marginTop: 5 },
  outfitCard: { backgroundColor: '#FFFEFB', borderRadius: 18, padding: 16, marginBottom: 12, borderWidth: 1, borderColor: '#EEE8DE' },
  outfitHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  outfitName: { color: '#302E27', fontSize: 17, fontWeight: '600' },
  deleteButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 9, backgroundColor: '#F4EAE4' },
  deleteButtonText: { color: '#895C4C', fontSize: 11, fontWeight: '600' },
  outfitItems: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginTop: 14 },
  outfitItemPill: { backgroundColor: '#F0EAE0', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 7 },
  outfitItemText: { color: '#625849', fontSize: 11 },
  outfitFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderTopWidth: 1, borderTopColor: '#EEE8DE', marginTop: 14, paddingTop: 10 },
  wardrobeRow: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: '#FFFEFB', borderRadius: 14, padding: 12, marginBottom: 9, borderWidth: 1, borderColor: '#EEE8DE' },
  wardrobeIcon: { width: 42, height: 42, borderRadius: 12, backgroundColor: '#EDE5D8', alignItems: 'center', justifyContent: 'center' },
  wardrobeIconText: { color: '#887A66', fontSize: 18 },
  profileCard: { alignItems: 'center', backgroundColor: '#EDE5D8', padding: 22, borderRadius: 18 },
  profileAvatar: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#D8CBB8', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  profileAvatarText: { fontSize: 17, fontWeight: '700', color: '#514839' },
  profileName: { color: '#302E27', fontSize: 18, fontWeight: '600' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#F0EAE0' },
  settingLabel: { color: '#898174', fontSize: 13 },
  settingValue: { color: '#39372F', fontSize: 13, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  footerNote: { fontSize: 11, lineHeight: 17, color: '#898174', marginTop: 22, marginBottom: 20 },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(37,34,29,0.35)' },
  modalSheet: { maxHeight: '92%', backgroundColor: '#F8F5EF', paddingHorizontal: 20, paddingTop: 12, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  modalHandle: { width: 42, height: 4, backgroundColor: '#D8D0C4', borderRadius: 3, alignSelf: 'center', marginBottom: 18 },
  modalTitleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  modalTitle: { fontSize: 23, fontWeight: '600', color: '#302E27' },
  closeButton: { fontSize: 20, color: '#81786B', padding: 5 },
  selectItemRow: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12, borderRadius: 13, borderWidth: 1, borderColor: '#E5DED3', backgroundColor: '#FFFEFB', marginBottom: 8 },
  selectItemRowActive: { borderColor: '#746754', backgroundColor: '#F0EAE0' },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: '#CFC5B7', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#39372F', borderColor: '#39372F' },
  checkboxTick: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  cancelButton: { alignItems: 'center', padding: 13, marginTop: 5 },
  cancelButtonText: { color: '#6F665A', fontSize: 14, fontWeight: '600' },
  categoryOptions: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 6 },
  scopeOption: { borderWidth: 1, borderColor: '#E5DED3', backgroundColor: '#FFFEFB', borderRadius: 12, padding: 13, marginBottom: 9 },
  scopeOptionActive: { borderColor: '#746754', backgroundColor: '#F0EAE0' },
});
