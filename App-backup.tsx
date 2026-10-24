
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Linking,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const API_URL = 'http://172.20.10.3:3001';
const FAVORITES_KEY = 'forme-favorites';
const SETTINGS_KEY = 'shopping-guide-settings';

const countries = [
  { name: 'Netherlands', flag: '🇳🇱', currency: 'EUR' },
  { name: 'United Kingdom', flag: '🇬🇧', currency: 'GBP' },
  { name: 'United States', flag: '🇺🇸', currency: 'USD' },
  { name: 'France', flag: '🇫🇷', currency: 'EUR' },
  { name: 'Germany', flag: '🇩🇪', currency: 'EUR' },
  { name: 'Italy', flag: '🇮🇹', currency: 'EUR' },
  { name: 'Spain', flag: '🇪🇸', currency: 'EUR' },
  { name: 'Portugal', flag: '🇵🇹', currency: 'EUR' },
  { name: 'Belgium', flag: '🇧🇪', currency: 'EUR' },
  { name: 'Switzerland', flag: '🇨🇭', currency: 'CHF' },
  { name: 'Sweden', flag: '🇸🇪', currency: 'SEK' },
  { name: 'Denmark', flag: '🇩🇰', currency: 'DKK' },
  { name: 'Norway', flag: '🇳🇴', currency: 'NOK' },
  { name: 'Poland', flag: '🇵🇱', currency: 'PLN' },
  { name: 'Czechia', flag: '🇨🇿', currency: 'CZK' },
  { name: 'Turkey', flag: '🇹🇷', currency: 'TRY' },
  { name: 'Canada', flag: '🇨🇦', currency: 'CAD' },
  { name: 'Australia', flag: '🇦🇺', currency: 'AUD' },
  { name: 'Japan', flag: '🇯🇵', currency: 'JPY' },
  { name: 'United Arab Emirates', flag: '🇦🇪', currency: 'AED' },
];

const currencies = [
  'EUR', 'GBP', 'USD', 'CHF', 'SEK', 'DKK', 'NOK',
  'PLN', 'CZK', 'TRY', 'CAD', 'AUD', 'JPY', 'AED',
];

const demoProducts = [
  {
    id: '1',
    name: 'The Everyday Blazer',
    brand: 'STUDIO EDIT',
    category: 'Outerwear',
    price: 89,
    color: '#D7C8B7',
    description: 'Relaxed fit · Neutral beige',
  },
  {
    id: '2',
    name: 'Classic White Shirt',
    brand: 'FORME ESSENTIALS',
    category: 'Tops',
    price: 45,
    color: '#EAE5DC',
    description: 'Cotton blend · Timeless fit',
  },
  {
    id: '3',
    name: 'Tailored Trousers',
    brand: 'STUDIO EDIT',
    category: 'Trousers',
    price: 65,
    color: '#B7B1A8',
    description: 'Straight leg · High waist',
  },
  {
    id: '4',
    name: 'Everyday Shoulder Bag',
    brand: 'OBJECTS',
    category: 'Accessories',
    price: 72,
    color: '#B18B70',
    description: 'Minimal shape · Everyday wear',
  },
];

type Settings = {
  country: string;
  city: string;
  currency: string;
  storeScope: 'both' | 'local';
};

type RealProduct = {
  id: string;
  name: string;
  brand?: string;
  category?: string;
  price: number;
  currency: string;
  imageUrl?: string;
  productUrl?: string;
  retailer?: string;
};

type ProductSearchResponse = {
  products: RealProduct[];
  filters?: {
    query: string;
    country: string;
    city: string;
    currency: string;
    category: string;
    maxPrice: number | null;
    storeScope: string;
  };
  sourceStatus: string;
  message?: string;
};

const defaultSettings: Settings = {
  country: 'Netherlands',
  city: 'Amsterdam',
  currency: 'EUR',
  storeScope: 'both',
};

const categories = [
  'All',
  'Tops',
  'Trousers',
  'Outerwear',
  'Accessories',
];

function formatPrice(price: number, currency: string) {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      maximumFractionDigits: 2,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'shop' | 'favorites' | 'settings'>('shop');

  const [countryModal, setCountryModal] = useState(false);
  const [currencyModal, setCurrencyModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');
  const [cityDraft, setCityDraft] = useState('Amsterdam');
  const [loaded, setLoaded] = useState(false);
  const [savedMessage, setSavedMessage] = useState('');

  const [searchQuery, setSearchQuery] = useState('');
  const [maxPrice, setMaxPrice] = useState('100');
  const [realProducts, setRealProducts] = useState<RealProduct[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchMessage, setSearchMessage] = useState('');
  const [searchAttempted, setSearchAttempted] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const savedFavorites = await AsyncStorage.getItem(FAVORITES_KEY);
        const savedSettings = await AsyncStorage.getItem(SETTINGS_KEY);

        if (savedFavorites) {
          const parsed = JSON.parse(savedFavorites);
          if (Array.isArray(parsed)) {
            setFavorites(
              parsed.filter(
                (id): id is string =>
                  typeof id === 'string' &&
                  demoProducts.some((product) => product.id === id)
              )
            );
          }
        }

        if (savedSettings) {
          const parsed = JSON.parse(savedSettings);
          const validCountry = countries.some(
            (country) => country.name === parsed.country
          );

          if (validCountry) {
            const nextSettings: Settings = {
              ...defaultSettings,
              ...parsed,
              country: parsed.country,
              currency: currencies.includes(parsed.currency)
                ? parsed.currency
                : countries.find((c) => c.name === parsed.country)!.currency,
              storeScope: parsed.storeScope === 'local' ? 'local' : 'both',
            };

            setSettings(nextSettings);
            setCityDraft(nextSettings.city);
          }
        }
      } catch (error) {
        console.warn('Could not load saved data', error);
      } finally {
        setLoaded(true);
      }
    }

    loadData();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(favorites)).catch(
      (error) => console.warn('Could not save favorites', error)
    );
  }, [favorites, loaded]);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(
      (error) => console.warn('Could not save settings', error)
    );
  }, [settings, loaded]);

  const selectedCountry =
    countries.find((country) => country.name === settings.country) ??
    countries[0];

  const visibleProducts = demoProducts.filter((product) => {
    const matchesCategory =
      activeCategory === 'All' || product.category === activeCategory;
    const matchesTab =
      activeTab !== 'favorites' || favorites.includes(product.id);

    return matchesCategory && matchesTab;
  });

  function chooseCountry(countryName: string) {
    const country = countries.find((item) => item.name === countryName);
    if (!country) return;

    setSettings((current) => ({
      ...current,
      country: country.name,
      currency: country.currency,
    }));
    setCountryModal(false);
    setCountrySearch('');
  }

  function saveCity() {
    const city = cityDraft.trim();

    if (!city) {
      Alert.alert('Enter your city', 'Please enter the city where you live.');
      return;
    }

    setSettings((current) => ({ ...current, city }));
    setSavedMessage('Your preferences have been saved.');
    setTimeout(() => setSavedMessage(''), 2500);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) =>
      current.includes(id)
        ? current.filter((favorite) => favorite !== id)
        : [...current, id]
    );
  }

  async function searchRealProducts() {
    const query = searchQuery.trim();

    if (!query) {
      Alert.alert(
        'What are you looking for?',
        'Enter a product name, for example: bag, coat or shoes.'
      );
      return;
    }

    const parsedMaxPrice =
      maxPrice.trim() === '' ? '' : Number(maxPrice.replace(',', '.'));

    if (
      parsedMaxPrice !== '' &&
      (!Number.isFinite(parsedMaxPrice) || parsedMaxPrice < 0)
    ) {
      Alert.alert(
        'Check your budget',
        'Enter a valid price, or leave the field empty for no price limit.'
      );
      return;
    }

    setSearchLoading(true);
    setSearchAttempted(true);
    setRealProducts([]);
    setSearchMessage('Searching the Shopping Guide server...');

    try {
      const params = new URLSearchParams({
        query,
        country: settings.country,
        city: settings.city,
        currency: settings.currency,
        category: activeCategory === 'All' ? '' : activeCategory,
        storeScope: settings.storeScope,
      });

      if (parsedMaxPrice !== '') {
        params.set('maxPrice', String(parsedMaxPrice));
      }

      const response = await fetch(
        `${API_URL}/api/products?${params.toString()}`
      );

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data: ProductSearchResponse = await response.json();
      const foundProducts = Array.isArray(data.products) ? data.products : [];

      setRealProducts(foundProducts);
      setSearchMessage(
        data.message ||
          (foundProducts.length
            ? `Found ${foundProducts.length} products.`
            : 'No products found for this search.')
      );
    } catch (error) {
      console.warn('Product search failed:', error);
      setSearchMessage(
        'Could not connect to the server. Check that it is running and your phone is on the same network.'
      );
    } finally {
      setSearchLoading(false);
    }
  }

  async function openProduct(url?: string) {
    if (!url) return;

    try {
      const supported = await Linking.canOpenURL(url);
      if (supported) {
        await Linking.openURL(url);
      } else {
        Alert.alert('Cannot open link', 'This product link is not supported.');
      }
    } catch {
      Alert.alert('Could not open link', 'Please try again later.');
    }
  }

  if (!loaded) {
    return (
      <SafeAreaView style={styles.loading}>
        <ActivityIndicator size="large" color="#6D655B" />
        <Text style={styles.loadingText}>Loading your Shopping Guide...</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8F6F2" />

      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>Shopping Guide</Text>
          <Text style={styles.tagline}>YOUR PERSONAL SHOPPING ASSISTANT</Text>
        </View>
        <Pressable
          style={styles.profileButton}
          onPress={() => setActiveTab('settings')}
        >
          <Text style={styles.profileLetter}>S</Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {activeTab === 'settings' ? (
          <View>
            <Text style={styles.eyebrow}>YOUR PERSONAL SPACE</Text>
            <Text style={styles.pageTitle}>Your preferences</Text>
            <Text style={styles.subtitle}>
              Choose where you shop. We’ll use these preferences for product searches.
            </Text>

            <View style={styles.settingsCard}>
              <Text style={styles.fieldLabel}>COUNTRY OF RESIDENCE</Text>
              <Pressable
                style={styles.selectButton}
                onPress={() => setCountryModal(true)}
              >
                <Text style={styles.selectValue}>
                  {selectedCountry.flag}  {selectedCountry.name}
                </Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
              <Text style={styles.helperText}>
                This helps determine which shops may deliver to you.
              </Text>

              <Text style={styles.fieldLabel}>YOUR CITY</Text>
              <TextInput
                value={cityDraft}
                onChangeText={setCityDraft}
                placeholder="Enter your city"
                placeholderTextColor="#A49B90"
                style={styles.textInput}
                autoCapitalize="words"
                returnKeyType="done"
                onSubmitEditing={saveCity}
              />

              <Text style={styles.fieldLabel}>SHOPPING CURRENCY</Text>
              <Pressable
                style={styles.selectButton}
                onPress={() => setCurrencyModal(true)}
              >
                <Text style={styles.selectValue}>{settings.currency}</Text>
                <Text style={styles.chevron}>⌄</Text>
              </Pressable>
              <Text style={styles.helperText}>
                Currency settings are sent to the search server. Actual conversion
                depends on the connected product source.
              </Text>

              <Text style={styles.fieldLabel}>WHICH STORES SHOULD WE SEARCH?</Text>

              <Pressable
                style={[
                  styles.optionButton,
                  settings.storeScope === 'both' && styles.optionSelected,
                ]}
                onPress={() =>
                  setSettings((current) => ({ ...current, storeScope: 'both' }))
                }
              >
                <View style={styles.optionRadio}>
                  {settings.storeScope === 'both' && (
                    <View style={styles.optionRadioInner} />
                  )}
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Local + international</Text>
                  <Text style={styles.optionDescription}>
                    Local shops and international stores that deliver to your country.
                  </Text>
                </View>
              </Pressable>

              <Pressable
                style={[
                  styles.optionButton,
                  settings.storeScope === 'local' && styles.optionSelected,
                ]}
                onPress={() =>
                  setSettings((current) => ({ ...current, storeScope: 'local' }))
                }
              >
                <View style={styles.optionRadio}>
                  {settings.storeScope === 'local' && (
                    <View style={styles.optionRadioInner} />
                  )}
                </View>
                <View style={styles.optionTextContainer}>
                  <Text style={styles.optionTitle}>Local stores only</Text>
                  <Text style={styles.optionDescription}>
                    Prioritise retailers based in your country.
                  </Text>
                </View>
              </Pressable>

              <Pressable style={styles.primaryButton} onPress={saveCity}>
                <Text style={styles.primaryButtonText}>Save preferences</Text>
              </Pressable>

              {savedMessage ? (
                <Text style={styles.successText}>{savedMessage}</Text>
              ) : null}
            </View>

            <View style={styles.noteCard}>
              <Text style={styles.noteTitle}>Product sources</Text>
              <Text style={styles.noteText}>
                The search server is configured, but live retailer catalogues
                have not been connected yet.
              </Text>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.hero}>
              <Text style={styles.eyebrow}>LESS SEARCHING, MORE STYLE</Text>
              <Text style={styles.heroTitle}>Pieces that feel like you.</Text>
              <Text style={styles.heroSubtitle}>
                Thoughtful finds for your everyday wardrobe.
              </Text>

              <Pressable
                style={styles.locationPill}
                onPress={() => setActiveTab('settings')}
              >
                <Text style={styles.locationText}>
                  {selectedCountry.flag}  {settings.city || 'Choose city'},{' '}
                  {settings.country}  ·  {settings.currency}  ↗
                </Text>
              </Pressable>
            </View>

            {activeTab === 'shop' && (
              <View style={styles.searchCard}>
                <Text style={styles.searchTitle}>Find your next piece</Text>
                <Text style={styles.searchDescription}>
                  Search by product, choose your budget and location.
                </Text>

                <TextInput
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  placeholder="e.g. bag, coat, shoes"
                  placeholderTextColor="#A49B90"
                  style={styles.textInput}
                  autoCapitalize="none"
                  returnKeyType="search"
                  onSubmitEditing={searchRealProducts}
                />

                <Text style={styles.fieldLabel}>
                  MAXIMUM PRICE ({settings.currency})
                </Text>
                <TextInput
                  value={maxPrice}
                  onChangeText={setMaxPrice}
                  placeholder="100, or leave empty"
                  placeholderTextColor="#A49B90"
                  style={styles.textInput}
                  keyboardType="decimal-pad"
                />

                <Pressable
                  style={styles.primaryButton}
                  onPress={searchRealProducts}
                  disabled={searchLoading}
                >
                  {searchLoading ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.primaryButtonText}>Search products</Text>
                  )}
                </Pressable>

                {searchMessage ? (
                  <Text style={styles.searchStatus}>{searchMessage}</Text>
                ) : null}

                {searchAttempted && realProducts.length === 0 ? (
                  <Text style={styles.searchEmpty}>
                    No live products are available yet. Retailer catalogues still
                    need to be connected.
                  </Text>
                ) : null}

                {realProducts.map((product) => (
                  <View key={product.id} style={styles.realProductRow}>
                    <View style={styles.realProductInfo}>
                      <Text style={styles.productName}>{product.name}</Text>
                      {product.brand ? (
                        <Text style={styles.productDescription}>{product.brand}</Text>
                      ) : null}
                      {product.retailer ? (
                        <Text style={styles.productDescription}>{product.retailer}</Text>
                      ) : null}
                      <Text style={styles.productPrice}>
                        {formatPrice(product.price, product.currency || settings.currency)}
                      </Text>
                    </View>
                    {product.productUrl ? (
                      <Pressable onPress={() => openProduct(product.productUrl)}>
                        <Text style={styles.textLink}>View ↗</Text>
                      </Pressable>
                    ) : null}
                  </View>
                ))}
              </View>
            )}

            <View style={styles.sectionHeading}>
              <View>
                <Text style={styles.sectionTitle}>
                  {activeTab === 'favorites' ? 'Your saved pieces' : 'Demo collection'}
                </Text>
                <Text style={styles.sectionSubtitle}>
                  {activeTab === 'favorites'
                    ? `${favorites.length} saved items`
                    : 'Illustrative items · not live retailer offers'}
                </Text>
              </View>
              <Pressable onPress={() => setActiveTab('settings')}>
                <Text style={styles.textLink}>Your region ↗</Text>
              </Pressable>
            </View>

            {activeTab === 'shop' && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.categoryRow}
              >
                {categories.map((category) => (
                  <Pressable
                    key={category}
                    onPress={() => setActiveCategory(category)}
                    style={[
                      styles.categoryChip,
                      activeCategory === category && styles.categoryChipActive,
                    ]}
                  >
                    <Text
                      style={[
                        styles.categoryText,
                        activeCategory === category && styles.categoryTextActive,
                      ]}
                    >
                      {category}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}

            {visibleProducts.length === 0 ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyHeart}>♡</Text>
                <Text style={styles.emptyTitle}>Nothing saved just yet</Text>
                <Text style={styles.emptyText}>
                  Tap the heart on a piece you love and it will appear here.
                </Text>
                <Pressable
                  style={styles.secondaryButton}
                  onPress={() => setActiveTab('shop')}
                >
                  <Text style={styles.secondaryButtonText}>Explore pieces</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.productGrid}>
                {visibleProducts.map((product) => {
                  const isFavorite = favorites.includes(product.id);

                  return (
                    <View key={product.id} style={styles.productCard}>
                      <View
                        style={[styles.productImage, { backgroundColor: product.color }]}
                      >
                        <Text style={styles.imagePlaceholder}>
                          {product.category === 'Outerwear'
                            ? 'JACKET'
                            : product.category === 'Tops'
                            ? 'SHIRT'
                            : product.category === 'Trousers'
                            ? 'TROUSERS'
                            : 'BAG'}
                        </Text>
                        <Pressable
                          style={styles.heartButton}
                          onPress={() => toggleFavorite(product.id)}
                          accessibilityLabel={
                            isFavorite ? 'Remove from favorites' : 'Add to favorites'
                          }
                        >
                          <Text style={styles.heartIcon}>
                            {isFavorite ? '♥' : '♡'}
                          </Text>
                        </Pressable>
                      </View>
                      <Text style={styles.productBrand}>{product.brand}</Text>
                      <Text style={styles.productName}>{product.name}</Text>
                      <Text style={styles.productDescription}>{product.description}</Text>
                      <Text style={styles.productPrice}>
                        {formatPrice(product.price, settings.currency)}
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            <View style={styles.aiCard}>
              <Text style={styles.aiEyebrow}>YOUR PERSONAL STYLIST</Text>
              <Text style={styles.aiTitle}>A little help finding your style?</Text>
              <Text style={styles.aiDescription}>
                Personalised outfit suggestions are on the way.
              </Text>
              <Pressable
                style={styles.secondaryButton}
                onPress={() =>
                  Alert.alert(
                    'Coming soon',
                    'Your AI stylist will be connected in a future stage.'
                  )
                }
              >
                <Text style={styles.secondaryButtonText}>Meet your stylist ↗</Text>
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.bottomNav}>
        <Pressable style={styles.navItem} onPress={() => setActiveTab('shop')}>
          <Text style={[styles.navIcon, activeTab === 'shop' && styles.navActive]}>◇</Text>
          <Text style={[styles.navLabel, activeTab === 'shop' && styles.navActive]}>SHOP</Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => setActiveTab('favorites')}>
          <Text style={[styles.navIcon, activeTab === 'favorites' && styles.navActive]}>♡</Text>
          <Text style={[styles.navLabel, activeTab === 'favorites' && styles.navActive]}>
            SAVED ({favorites.length})
          </Text>
        </Pressable>
        <Pressable style={styles.navItem} onPress={() => setActiveTab('settings')}>
          <Text style={[styles.navIcon, activeTab === 'settings' && styles.navActive]}>⚙</Text>
          <Text style={[styles.navLabel, activeTab === 'settings' && styles.navActive]}>PROFILE</Text>
        </Pressable>
      </View>

      <Modal
        visible={countryModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCountryModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose your country</Text>
              <Pressable onPress={() => setCountryModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search countries..."
              placeholderTextColor="#A49B90"
              style={styles.textInput}
              autoCorrect={false}
            />
            <ScrollView style={styles.countryList}>
              {countries
                .filter((country) =>
                  country.name.toLowerCase().includes(countrySearch.toLowerCase())
                )
                .map((country) => (
                  <Pressable
                    key={country.name}
                    style={styles.countryRow}
                    onPress={() => chooseCountry(country.name)}
                  >
                    <Text style={styles.countryName}>
                      {country.flag}  {country.name}
                    </Text>
                    <Text style={styles.countryCurrency}>{country.currency}</Text>
                  </Pressable>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal
        visible={currencyModal}
        animationType="slide"
        transparent
        onRequestClose={() => setCurrencyModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Choose currency</Text>
              <Pressable onPress={() => setCurrencyModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </Pressable>
            </View>
            <Text style={styles.helperText}>
              Demo prices are illustrative and are not converted using live exchange rates.
            </Text>
            {currencies.map((currency) => (
              <Pressable
                key={currency}
                style={styles.countryRow}
                onPress={() => {
                  setSettings((current) => ({ ...current, currency }));
                  setCurrencyModal(false);
                }}
              >
                <Text style={styles.countryName}>{currency}</Text>
                <Text style={styles.countryCurrency}>
                  {settings.currency === currency ? '✓ Selected' : 'Choose'}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F8F6F2' },
  loading: {
    flex: 1,
    backgroundColor: '#F8F6F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingText: { marginTop: 12, color: '#746D64', fontSize: 13 },
  header: {
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 17,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#EAE5DE',
  },
  logo: { fontSize: 24, letterSpacing: 0.3, color: '#292720', fontWeight: '500' },
  tagline: { fontSize: 8, letterSpacing: 1.5, color: '#81796E', marginTop: 5 },
  profileButton: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8E0D6',
    alignItems: 'center', justifyContent: 'center',
  },
  profileLetter: { fontSize: 15, color: '#39342D' },
  scrollContent: { paddingHorizontal: 22, paddingBottom: 28 },
  hero: { backgroundColor: '#EDE6DC', paddingHorizontal: 21, paddingVertical: 27, marginTop: 18, borderRadius: 4 },
  eyebrow: { fontSize: 9, letterSpacing: 1.7, color: '#807366', fontWeight: '600', marginBottom: 11 },
  heroTitle: { fontSize: 32, lineHeight: 38, letterSpacing: -0.8, color: '#292720', fontWeight: '400', maxWidth: 270 },
  heroSubtitle: { fontSize: 13, lineHeight: 20, color: '#746D64', marginTop: 10, maxWidth: 255 },
  locationPill: { alignSelf: 'flex-start', backgroundColor: '#F8F6F2', paddingHorizontal: 11, paddingVertical: 9, marginTop: 19, borderRadius: 3 },
  locationText: { fontSize: 10, color: '#4F493F' },
  searchCard: { marginTop: 22, marginBottom: 10, padding: 17, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DE' },
  searchTitle: { fontSize: 21, color: '#292720', fontWeight: '400' },
  searchDescription: { fontSize: 12, color: '#81796E', lineHeight: 18, marginTop: 7, marginBottom: 8 },
  searchStatus: { fontSize: 11, color: '#746D64', lineHeight: 17, marginTop: 12 },
  searchEmpty: { fontSize: 11, color: '#81796E', lineHeight: 17, marginTop: 8 },
  realProductRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#EAE5DE', paddingVertical: 13 },
  realProductInfo: { flex: 1, paddingRight: 10 },
  sectionHeading: { marginTop: 27, marginBottom: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  sectionTitle: { fontSize: 22, color: '#292720', fontWeight: '400' },
  sectionSubtitle: { marginTop: 5, color: '#81796E', fontSize: 12 },
  textLink: { fontSize: 11, color: '#62584C' },
  categoryRow: { gap: 8, paddingBottom: 19 },
  categoryChip: { paddingVertical: 9, paddingHorizontal: 14, borderRadius: 3, borderWidth: 1, borderColor: '#DED8CF' },
  categoryChipActive: { backgroundColor: '#37332D', borderColor: '#37332D' },
  categoryText: { fontSize: 11, color: '#6D655B' },
  categoryTextActive: { color: '#FFFFFF' },
  productGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 22 },
  productCard: { width: '48.2%' },
  productImage: { height: 190, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  imagePlaceholder: { color: '#6D6256', opacity: 0.65, fontSize: 11, letterSpacing: 2 },
  heartButton: { position: 'absolute', top: 10, right: 10, width: 32, height: 32, backgroundColor: '#F8F6F2', borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  heartIcon: { fontSize: 20, color: '#37332D' },
  productBrand: { fontSize: 8, letterSpacing: 1.1, color: '#8A8074', marginTop: 12 },
  productName: { fontSize: 14, color: '#292720', marginTop: 5, fontWeight: '500' },
  productDescription: { color: '#8A8074', fontSize: 10, marginTop: 4, lineHeight: 15 },
  productPrice: { fontSize: 13, color: '#39342D', marginTop: 8, fontWeight: '500' },
  aiCard: { marginTop: 30, padding: 22, backgroundColor: '#EDE6DC' },
  aiEyebrow: { fontSize: 9, letterSpacing: 1.5, color: '#807366' },
  aiTitle: { fontSize: 22, color: '#292720', marginTop: 10, lineHeight: 29 },
  aiDescription: { fontSize: 12, lineHeight: 19, color: '#746D64', marginTop: 8 },
  secondaryButton: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#B8AC9D', paddingVertical: 11, paddingHorizontal: 15, marginTop: 17 },
  secondaryButtonText: { fontSize: 11, color: '#39342D' },
  bottomNav: { minHeight: 62, borderTopWidth: 1, borderTopColor: '#EAE5DE', backgroundColor: '#F8F6F2', flexDirection: 'row', justifyContent: 'space-around', alignItems: 'center', paddingBottom: 4 },
  navItem: { alignItems: 'center', justifyContent: 'center', minWidth: 75, paddingVertical: 6 },
  navIcon: { fontSize: 21, color: '#9A9084' },
  navLabel: { fontSize: 8, letterSpacing: 1, color: '#9A9084', marginTop: 3 },
  navActive: { color: '#39342D' },
  pageTitle: { fontSize: 30, color: '#292720', fontWeight: '400', marginBottom: 8 },
  subtitle: { color: '#81796E', fontSize: 13, lineHeight: 20, marginBottom: 23 },
  settingsCard: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#EAE5DE', padding: 17 },
  fieldLabel: { fontSize: 9, letterSpacing: 1.2, color: '#746D64', marginTop: 17, marginBottom: 9, fontWeight: '600' },
  selectButton: { minHeight: 48, borderWidth: 1, borderColor: '#DED8CF', paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  selectValue: { fontSize: 13, color: '#39342D' },
  chevron: { fontSize: 20, color: '#81796E' },
  helperText: { color: '#93897D', fontSize: 11, lineHeight: 17, marginTop: 7 },
  textInput: { minHeight: 48, borderWidth: 1, borderColor: '#DED8CF', paddingHorizontal: 12, color: '#39342D', fontSize: 13, backgroundColor: '#FFFFFF' },
  optionButton: { flexDirection: 'row', padding: 12, borderWidth: 1, borderColor: '#DED8CF', marginTop: 8, alignItems: 'flex-start' },
  optionSelected: { borderColor: '#766B5E', backgroundColor: '#F8F6F2' },
  optionRadio: { width: 17, height: 17, borderRadius: 9, borderWidth: 1, borderColor: '#8D8173', marginRight: 10, marginTop: 2, alignItems: 'center', justifyContent: 'center' },
  optionRadioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#5C5146' },
  optionTextContainer: { flex: 1 },
  optionTitle: { fontSize: 12, color: '#39342D', fontWeight: '500' },
  optionDescription: { fontSize: 11, color: '#81796E', lineHeight: 16, marginTop: 4 },
  primaryButton: { marginTop: 22, minHeight: 48, backgroundColor: '#37332D', alignItems: 'center', justifyContent: 'center' },
  primaryButtonText: { color: '#FFFFFF', fontSize: 12, letterSpacing: 0.5 },
  successText: { color: '#50734D', textAlign: 'center', fontSize: 12, marginTop: 12 },
  noteCard: { marginTop: 15, padding: 17, backgroundColor: '#EDE6DC' },
  noteTitle: { fontSize: 14, color: '#39342D', fontWeight: '500' },
  noteText: { fontSize: 12, color: '#746D64', lineHeight: 18, marginTop: 7 },
  emptyState: { alignItems: 'center', paddingVertical: 45, paddingHorizontal: 20 },
  emptyHeart: { fontSize: 38, color: '#A99D90' },
  emptyTitle: { fontSize: 18, color: '#39342D', marginTop: 12 },
  emptyText: { fontSize: 12, color: '#81796E', textAlign: 'center', lineHeight: 19, marginTop: 7 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(35, 31, 26, 0.4)', justifyContent: 'flex-end' },
  modalCard: { maxHeight: '82%', backgroundColor: '#F8F6F2', borderTopLeftRadius: 16, borderTopRightRadius: 16, paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  modalTitle: { fontSize: 21, color: '#292720' },
  closeButton: { fontSize: 18, color: '#746D64', padding: 5 },
  countryList: { marginTop: 10 },
  countryRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#EAE5DE' },
  countryName: { fontSize: 13, color: '#39342D' },
  countryCurrency: { fontSize: 11, color: '#81796E' },
});
