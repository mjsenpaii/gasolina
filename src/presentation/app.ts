import { GetStationsUseCase } from '../application/use-cases/GetStationsUseCase';
import { SupabaseStationRepository } from '../data/repositories/SupabaseStationRepository';
import type {
  FuelAvailability,
  FuelType,
  PriceLegendCategory,
  Station,
} from '../domain/entities/Station';
import {
  MARINDUQUE_TOWNS,
  MARINDUQUE_TOWN_VIEW,
  type MarinduqueTown,
} from '../shared/constants/marinduqueTowns';

type TownFilterValue = 'all' | MarinduqueTown;

interface FuelTheme {
  accent: string;
  surface: string;
  glow: string;
  icon: string;
  label: string;
}

declare global {
  interface Window {
    __fuelTrackerGoogleMapsPromise?: Promise<void>;
  }
}

class FuelPriceTrackerApplication {
  private readonly defaultCenter: google.maps.LatLngLiteral = { lat: 13.4447, lng: 121.8306 };

  private readonly mapContainer = this.getRequiredElement<HTMLElement>('map');
  private readonly fuelTypeSelect = this.getRequiredElement<HTMLSelectElement>('fuelType');
  private readonly townSelect = this.getRequiredElement<HTMLSelectElement>('townFilter');
  private readonly fuelSelectIcon = this.getRequiredElement<HTMLElement>('fuelSelectIcon');
  private readonly fuelThemeChip = this.getRequiredElement<HTMLElement>('fuelThemeChip');
  private readonly loadingBanner = this.getRequiredElement<HTMLDivElement>('loadingState');
  private readonly errorBanner = this.getRequiredElement<HTMLDivElement>('errorBanner');
  private readonly averagePill = this.getRequiredElement<HTMLSpanElement>('averagePill');
  private readonly resultPill = this.getRequiredElement<HTMLSpanElement>('resultPill');

  private readonly stationRepository = new SupabaseStationRepository();
  private readonly getStationsUseCase = new GetStationsUseCase(this.stationRepository);

  private map: google.maps.Map | null = null;
  private markers: google.maps.Marker[] = [];
  private activeInfoWindow: google.maps.InfoWindow | null = null;
  private stations: Station[] = [];
  private hasInitialized = false;

  public async initialize(): Promise<void> {
    if (this.hasInitialized) {
      if (this.map) {
        google.maps.event.trigger(this.map, 'resize');
      }
      await this.renderStations();
      return;
    }

    await this.ensureGoogleMapsLoaded();
    this.initializeTownFilter();
    this.initializeMap();
    this.registerEventListeners();
    this.applyFuelTheme();
    await this.loadStations();
    await this.renderStations();
    this.hasInitialized = true;
  }

  private async ensureGoogleMapsLoaded(): Promise<void> {
    if (window.google?.maps) {
      return;
    }

    if (window.__fuelTrackerGoogleMapsPromise) {
      await window.__fuelTrackerGoogleMapsPromise;
      return;
    }

    const googleMapsApiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined;
    if (!googleMapsApiKey || googleMapsApiKey.trim().length === 0) {
      throw new Error('Missing VITE_GOOGLE_MAPS_API_KEY. Add it to your .env file, then restart the dev server.');
    }

    window.__fuelTrackerGoogleMapsPromise = new Promise<void>((resolve, reject) => {
      const existingScript = document.getElementById('googleMapsScript') as HTMLScriptElement | null;

      if (existingScript) {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Unable to load Google Maps.')), {
          once: true,
        });
        return;
      }

      const script = document.createElement('script');
      script.id = 'googleMapsScript';
      script.async = true;
      script.defer = true;
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(googleMapsApiKey)}`;

      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('Unable to load Google Maps.')), { once: true });
      document.head.appendChild(script);
    });

    await window.__fuelTrackerGoogleMapsPromise;
  }

  private initializeTownFilter(): void {
    this.townSelect.innerHTML = [
      '<option value="all">All Towns</option>',
      ...MARINDUQUE_TOWNS.map((town) => `<option value="${this.escapeHtmlAttribute(town)}">${this.escapeHtml(town)}</option>`),
    ].join('');
  }

  private initializeMap(): void {
    this.map = new google.maps.Map(this.mapContainer, {
      center: this.defaultCenter,
      zoom: 14,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: [{ featureType: 'poi.business', stylers: [{ visibility: 'off' }] }],
    });
  }

  private registerEventListeners(): void {
    this.fuelTypeSelect.addEventListener('change', async () => {
      this.applyFuelTheme();
      await this.renderStations();
    });

    this.townSelect.addEventListener('change', async () => {
      await this.renderStations();
    });

    window.addEventListener('pageshow', async () => {
      if (this.map) {
        google.maps.event.trigger(this.map, 'resize');
        await this.renderStations();
      }
    });
  }

  private async loadStations(): Promise<void> {
    this.stations = await this.getStationsUseCase.execute();
  }

  private async renderStations(): Promise<void> {
    try {
      this.setLoadingState(true);
      this.setErrorState('');

      if (this.stations.length === 0) {
        await this.loadStations();
      }

      const selectedFuelType = this.getSelectedFuelType();
      const selectedTown = this.getSelectedTownFilter();
      const filteredStations = this.getFilteredStations(selectedTown);
      const averagePrice = this.calculateAveragePrice(filteredStations, selectedFuelType);

      this.clearMapMarkers();
      this.renderStationMarkers(filteredStations, selectedFuelType, averagePrice);
      this.applyMapView(filteredStations, selectedTown);
      this.updateSummaryPills(filteredStations.length, averagePrice);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to load station data.';
      this.setErrorState(message);
      console.error('[FuelPriceTrackerApplication] renderStations', error);
    } finally {
      this.setLoadingState(false);
    }
  }

  private getFilteredStations(selectedTown: TownFilterValue): Station[] {
    if (selectedTown === 'all') {
      return this.stations;
    }

    return this.stations.filter(
      (station) => station.town.trim().toLowerCase() === selectedTown.toLowerCase()
    );
  }

  private renderStationMarkers(
    stations: Station[],
    selectedFuelType: FuelType,
    averagePrice: number | null
  ): void {
    if (!this.map) {
      return;
    }

    stations.forEach((station) => {
      const fuelData = station.fuels[selectedFuelType];
      const category = this.getLegendCategory(fuelData.price, fuelData.availability, averagePrice);

      const marker = new google.maps.Marker({
        map: this.map,
        position: { lat: station.latitude, lng: station.longitude },
        title: `${station.name} - ${this.getDisplayPrice(fuelData.price, fuelData.availability)}`,
        icon: this.createMarkerIcon(station, selectedFuelType, category),
        animation: google.maps.Animation.DROP,
      });

      const infoWindow = new google.maps.InfoWindow({
        content: this.buildInfoWindowMarkup(station, selectedFuelType, category),
        maxWidth: 360,
      });

      marker.addListener('click', () => {
        if (this.activeInfoWindow) {
          this.activeInfoWindow.close();
        }

        infoWindow.open({
          anchor: marker,
          map: this.map!,
          shouldFocus: false,
        });

        this.activeInfoWindow = infoWindow;
      });

      this.markers.push(marker);
    });
  }

  private createMarkerIcon(
    station: Station,
    selectedFuelType: FuelType,
    category: PriceLegendCategory
  ): google.maps.Icon {
    const fuelTheme = this.getFuelTheme(selectedFuelType);
    const categoryTheme = this.getLegendTheme(category);
    const fuelData = station.fuels[selectedFuelType];
    const displayPrice = this.getDisplayPrice(fuelData.price, fuelData.availability);
    const stationLabel = this.escapeSvgText(
      station.name.length > 18 ? `${station.name.slice(0, 18)}…` : station.name
    );
    const townLabel = this.escapeSvgText(station.town);
    const priceLabel = this.escapeSvgText(displayPrice);

    const svgMarkup = `
      <svg xmlns="http://www.w3.org/2000/svg" width="238" height="86" viewBox="0 0 238 86">
        <defs>
          <linearGradient id="surfaceGradient" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ffffff"/>
            <stop offset="100%" stop-color="#eef6ff"/>
          </linearGradient>
          <filter id="shadow" x="-20%" y="-20%" width="160%" height="180%">
            <feDropShadow dx="0" dy="12" stdDeviation="9" flood-color="rgba(15,23,42,0.28)"/>
          </filter>
        </defs>
        <g filter="url(#shadow)">
          <rect x="8" y="10" rx="18" ry="18" width="186" height="54" fill="url(#surfaceGradient)" stroke="${categoryTheme.stroke}" stroke-width="3"/>
          <path d="M194 28 L222 37 L194 46 Z" fill="#ffffff" stroke="${categoryTheme.stroke}" stroke-width="3" stroke-linejoin="round"/>
          <rect x="18" y="20" rx="14" ry="14" width="42" height="34" fill="${fuelTheme.surface}"/>
          <text x="39" y="43" text-anchor="middle" font-size="18">⛽</text>
          <text x="70" y="30" font-size="11" font-family="Inter, Arial, sans-serif" font-weight="800" fill="#64748b">${townLabel}</text>
          <text x="70" y="44" font-size="11" font-family="Inter, Arial, sans-serif" font-weight="700" fill="#334155">${stationLabel}</text>
          <text x="70" y="59" font-size="18" font-family="Inter, Arial, sans-serif" font-weight="900" fill="${fuelTheme.accent}">${priceLabel}</text>
          <circle cx="181" cy="20" r="7" fill="${categoryTheme.dot}"/>
        </g>
      </svg>
    `.trim();

    return {
      url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svgMarkup)}`,
      scaledSize: new google.maps.Size(238, 86),
      anchor: new google.maps.Point(119, 70),
    };
  }

  private buildInfoWindowMarkup(
    station: Station,
    selectedFuelType: FuelType,
    category: PriceLegendCategory
  ): string {
    const fuelTheme = this.getFuelTheme(selectedFuelType);
    const fuelData = station.fuels[selectedFuelType];
    const displayPrice = this.getDisplayPrice(fuelData.price, fuelData.availability);
    const legendLabel = this.formatLegendLabel(category);

    return `
      <div class="info-window">
        <div class="info-window__header">
          <h3 class="info-window__title">${this.escapeHtml(station.name)}</h3>
          <p class="info-window__subtitle">${this.escapeHtml(station.town)}, Marinduque</p>
        </div>
        <div class="info-window__meta" style="background:${fuelTheme.surface}; color:${fuelTheme.accent};">
          <i class="fa-solid ${fuelTheme.icon}" aria-hidden="true"></i>
          <span>${fuelTheme.label}</span>
        </div>
        <div class="info-window__price">${this.escapeHtml(displayPrice)} <span>/ liter</span></div>
        <div class="info-window__subtitle" style="margin-top:0.4rem; color:#475569; font-weight:700;">
          Pin color: ${this.escapeHtml(legendLabel)}
        </div>
        <dl class="info-window__grid">
          <div><dt>Unleaded</dt><dd>${this.getDisplayPrice(station.fuels.unleaded.price, station.fuels.unleaded.availability)}</dd></div>
          <div><dt>Premium</dt><dd>${this.getDisplayPrice(station.fuels.premium.price, station.fuels.premium.availability)}</dd></div>
          <div><dt>Diesel</dt><dd>${this.getDisplayPrice(station.fuels.diesel.price, station.fuels.diesel.availability)}</dd></div>
          <div><dt>Coordinates</dt><dd>${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}</dd></div>
        </dl>
      </div>
    `;
  }

  private getLegendCategory(
    price: number | null,
    availability: FuelAvailability,
    averagePrice: number | null
  ): PriceLegendCategory {
    if (availability === 'out_of_stock') {
      return 'out_of_stock';
    }

    if (availability === 'no_data' || price === null) {
      return 'no_data';
    }

    if (averagePrice === null) {
      return 'near_avg';
    }

    const delta = price - averagePrice;
    if (delta <= -0.5) {
      return 'below_avg';
    }

    if (delta >= 0.5) {
      return 'above_avg';
    }

    return 'near_avg';
  }

  private calculateAveragePrice(stations: Station[], selectedFuelType: FuelType): number | null {
    const prices = stations
      .map((station) => station.fuels[selectedFuelType])
      .filter((fuel) => fuel.availability === 'available' && fuel.price !== null)
      .map((fuel) => fuel.price as number);

    if (prices.length === 0) {
      return null;
    }

    const total = prices.reduce((sum, value) => sum + value, 0);
    return total / prices.length;
  }

  private updateSummaryPills(resultCount: number, averagePrice: number | null): void {
    this.resultPill.textContent = `${resultCount} station${resultCount === 1 ? '' : 's'} shown`;
    this.averagePill.textContent = averagePrice === null ? 'Avg unavailable' : `Avg PHP ${averagePrice.toFixed(2)}`;
  }

  private applyFuelTheme(): void {
    const fuelTheme = this.getFuelTheme(this.getSelectedFuelType());
    this.fuelThemeChip.style.background = fuelTheme.surface;
    this.fuelThemeChip.style.borderColor = fuelTheme.glow;
    this.fuelThemeChip.style.color = fuelTheme.accent;
    this.fuelThemeChip.textContent = `${fuelTheme.label} active`;
    this.fuelSelectIcon.className = `fa-solid ${fuelTheme.icon}`;
    this.fuelSelectIcon.style.color = fuelTheme.accent;
  }

  private getFuelTheme(selectedFuelType: FuelType): FuelTheme {
    const fuelThemeMap: Record<FuelType, FuelTheme> = {
      premium: {
        accent: '#ef4444',
        surface: 'rgba(254, 226, 226, 0.94)',
        glow: 'rgba(239, 68, 68, 0.3)',
        icon: 'fa-bolt',
        label: 'Premium',
      },
      unleaded: {
        accent: '#22c55e',
        surface: 'rgba(220, 252, 231, 0.94)',
        glow: 'rgba(34, 197, 94, 0.3)',
        icon: 'fa-leaf',
        label: 'Unleaded',
      },
      diesel: {
        accent: '#3b82f6',
        surface: 'rgba(219, 234, 254, 0.94)',
        glow: 'rgba(59, 130, 246, 0.3)',
        icon: 'fa-truck-front',
        label: 'Diesel',
      },
    };

    return fuelThemeMap[selectedFuelType];
  }

  private getLegendTheme(category: PriceLegendCategory): { dot: string; stroke: string } {
    const legendThemeMap: Record<PriceLegendCategory, { dot: string; stroke: string }> = {
      below_avg: { dot: '#22c55e', stroke: '#22c55e' },
      near_avg: { dot: '#facc15', stroke: '#facc15' },
      above_avg: { dot: '#ef4444', stroke: '#ef4444' },
      no_data: { dot: '#94a3b8', stroke: '#94a3b8' },
      out_of_stock: { dot: '#111827', stroke: '#111827' },
    };

    return legendThemeMap[category];
  }

  private formatLegendLabel(category: PriceLegendCategory): string {
    const legendLabelMap: Record<PriceLegendCategory, string> = {
      below_avg: 'Below avg',
      near_avg: 'Near avg',
      above_avg: 'Above avg',
      no_data: 'No data',
      out_of_stock: 'Out of stock',
    };

    return legendLabelMap[category];
  }

  private getDisplayPrice(price: number | null, availability: FuelAvailability): string {
    if (availability === 'out_of_stock') {
      return 'Out of stock';
    }

    if (availability === 'no_data' || price === null) {
      return 'No data';
    }

    return `PHP ${price.toFixed(2)}`;
  }

  private applyMapView(stations: Station[], selectedTown: TownFilterValue): void {
    if (!this.map) {
      return;
    }

    if (selectedTown !== 'all') {
      const townView = MARINDUQUE_TOWN_VIEW[selectedTown];
      this.map.setCenter(townView.center);
      this.map.setZoom(townView.zoom);

      if (stations.length === 1) {
        this.map.setCenter({ lat: stations[0].latitude, lng: stations[0].longitude });
      }

      return;
    }

    this.fitMapToStationBounds(stations);
  }

  private fitMapToStationBounds(stations: Station[]): void {
    if (!this.map) {
      return;
    }

    if (stations.length === 0) {
      this.map.setCenter(this.defaultCenter);
      this.map.setZoom(13);
      return;
    }

    if (stations.length === 1) {
      this.map.setCenter({ lat: stations[0].latitude, lng: stations[0].longitude });
      this.map.setZoom(15);
      return;
    }

    const bounds = new google.maps.LatLngBounds();
    stations.forEach((station) => bounds.extend({ lat: station.latitude, lng: station.longitude }));
    this.map.fitBounds(bounds, 72);
  }

  private clearMapMarkers(): void {
    this.markers.forEach((marker) => marker.setMap(null));
    this.markers = [];

    if (this.activeInfoWindow) {
      this.activeInfoWindow.close();
      this.activeInfoWindow = null;
    }
  }

  private getSelectedFuelType(): FuelType {
    const value = this.fuelTypeSelect.value;
    if (value === 'premium' || value === 'diesel' || value === 'unleaded') {
      return value;
    }
    return 'unleaded';
  }

  private getSelectedTownFilter(): TownFilterValue {
    const selectedValue = this.townSelect.value;

    if (selectedValue === 'all') {
      return 'all';
    }

    if (MARINDUQUE_TOWNS.includes(selectedValue as MarinduqueTown)) {
      return selectedValue as MarinduqueTown;
    }

    return 'all';
  }

  private setLoadingState(isLoading: boolean): void {
    this.loadingBanner.hidden = !isLoading;
  }

  private setErrorState(message: string): void {
    this.errorBanner.textContent = message;
    this.errorBanner.hidden = message.length === 0;
  }

  private getRequiredElement<TElement extends HTMLElement>(elementId: string): TElement {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Required element with id "${elementId}" was not found.`);
    }
    return element as TElement;
  }

  private escapeHtml(value: string): string {
    const el = document.createElement('div');
    el.textContent = value;
    return el.innerHTML;
  }

  private escapeHtmlAttribute(value: string): string {
    return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
  }

  private escapeSvgText(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

const application = new FuelPriceTrackerApplication();
void application.initialize();