import { CheckAdminAccessUseCase } from '../application/use-cases/CheckAdminAccessUseCase';
import { CreateStationUseCase } from '../application/use-cases/CreateStationUseCase';
import { GetAdminSessionUseCase } from '../application/use-cases/GetAdminSessionUseCase';
import { GetStationsUseCase } from '../application/use-cases/GetStationsUseCase';
import { SignOutAdminUseCase } from '../application/use-cases/SignOutAdminUseCase';
import { UpdateStationPricesUseCase } from '../application/use-cases/UpdateStationPricesUseCase';
import { SupabaseStationRepository } from '../data/repositories/SupabaseStationRepository';
import type { FuelAvailability, Station, StationFuelData } from '../domain/entities/Station';
import { MARINDUQUE_TOWNS } from '../shared/constants/marinduqueTowns';

type PickerTarget = 'create' | 'update';

class FuelPriceAdminDashboardPage {
  private readonly defaultCenter: google.maps.LatLngLiteral = { lat: 13.4447, lng: 121.8306 };

  private readonly stationRepository = new SupabaseStationRepository();
  private readonly getStationsUseCase = new GetStationsUseCase(this.stationRepository);
  private readonly createStationUseCase = new CreateStationUseCase(this.stationRepository);
  private readonly updateStationPricesUseCase = new UpdateStationPricesUseCase(this.stationRepository);
  private readonly signOutAdminUseCase = new SignOutAdminUseCase();
  private readonly getAdminSessionUseCase = new GetAdminSessionUseCase();
  private readonly checkAdminAccessUseCase = new CheckAdminAccessUseCase();

  private readonly dashboardSection = this.getRequiredElement<HTMLElement>('dashboardSection');
  private readonly dashboardForms = this.getRequiredElement<HTMLElement>('dashboardForms');
  private readonly logoutButton = this.getRequiredElement<HTMLButtonElement>('logoutButton');
  private readonly createStationForm = this.getRequiredElement<HTMLFormElement>('createStationForm');
  private readonly updatePriceForm = this.getRequiredElement<HTMLFormElement>('updatePriceForm');
  private readonly stationSelect = this.getRequiredElement<HTMLSelectElement>('stationId');
  private readonly createTownSelect = this.getRequiredElement<HTMLSelectElement>('town');
  private readonly updateTownSelect = this.getRequiredElement<HTMLSelectElement>('update_town');
  private readonly pickerTargetSelect = this.getRequiredElement<HTMLSelectElement>('pickerTarget');
  private readonly mapHint = this.getRequiredElement<HTMLElement>('mapHint');
  private readonly stationCountChip = this.getRequiredElement<HTMLElement>('stationCountChip');
  private readonly townCountChip = this.getRequiredElement<HTMLElement>('townCountChip');
  private readonly stationTableBody = this.getRequiredElement<HTMLTableSectionElement>('stationTableBody');
  private readonly authStateText = this.getRequiredElement<HTMLParagraphElement>('authStateText');
  private readonly adminErrorBanner = this.getRequiredElement<HTMLDivElement>('adminErrorBanner');
  private readonly adminSuccessBanner = this.getRequiredElement<HTMLDivElement>('adminSuccessBanner');
  private readonly adminLoadingBanner = this.getRequiredElement<HTMLDivElement>('adminLoadingBanner');
  private readonly mapContainer = this.getRequiredElement<HTMLElement>('adminMap');

  private stations: Station[] = [];
  private map: google.maps.Map | null = null;
  private stationMarkers: google.maps.Marker[] = [];
  private selectionMarker: google.maps.Marker | null = null;
  private pickerTarget: PickerTarget = 'create';

  public async initialize(): Promise<void> {
    this.populateTownSelects();
    this.registerEventListeners();
    await this.guardAndLoad();
  }

  private registerEventListeners(): void {
    this.logoutButton.addEventListener('click', async () => {
      await this.handleSignOut();
    });

    this.createStationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleCreateStation();
    });

    this.updatePriceForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleUpdateStation();
    });

    this.stationSelect.addEventListener('change', () => {
      this.syncUpdateFormFromSelection();
      this.setPickerTarget('update');
    });

    this.createStationForm.addEventListener('focusin', () => this.setPickerTarget('create'));
    this.updatePriceForm.addEventListener('focusin', () => this.setPickerTarget('update'));

    this.pickerTargetSelect.addEventListener('change', () => {
      const nextTarget = this.pickerTargetSelect.value === 'update' ? 'update' : 'create';
      this.setPickerTarget(nextTarget);
    });
  }

  private async guardAndLoad(): Promise<void> {
    try {
      this.setLoadingState(true);
      this.setErrorState('');
      this.setSuccessState('');

      const session = await this.getAdminSessionUseCase.execute();

      if (!session?.user) {
        window.location.replace('/admin.html');
        return;
      }

      const hasAdminAccess = await this.checkAdminAccessUseCase.execute();
      if (!hasAdminAccess) {
        this.dashboardSection.hidden = true;
        this.dashboardForms.hidden = true;
        throw new Error(
          'This authenticated user is not allowed to manage stations. Add the user to public.admin_users first.'
        );
      }

      await this.ensureGoogleMapsLoaded();
      this.initializeMap();

      this.dashboardSection.hidden = false;
      this.dashboardForms.hidden = false;
      this.authStateText.textContent = `Signed in as ${session.user.email ?? 'admin user'}`;

      await this.refreshStationData();
      this.setPickerTarget('create');
    } catch (error: unknown) {
      this.handleError(error, 'Unable to load the admin dashboard.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async ensureGoogleMapsLoaded(): Promise<void> {
    if (window.google?.maps) {
      return;
    }

    const existingScript = document.getElementById('googleMapsScript') as HTMLScriptElement | null;
    if (existingScript) {
      await new Promise<void>((resolve, reject) => {
        existingScript.addEventListener('load', () => resolve(), { once: true });
        existingScript.addEventListener('error', () => reject(new Error('Unable to load Google Maps.')), {
          once: true,
        });
      });
      return;
    }

    const script = document.createElement('script');
    script.id = 'googleMapsScript';
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(
      import.meta.env.VITE_GOOGLE_MAPS_API_KEY
    )}`;

    await new Promise<void>((resolve, reject) => {
      script.addEventListener('load', () => resolve(), { once: true });
      script.addEventListener('error', () => reject(new Error('Unable to load Google Maps.')), { once: true });
      document.head.appendChild(script);
    });
  }

  private initializeMap(): void {
    this.map = new google.maps.Map(this.mapContainer, {
      center: this.defaultCenter,
      zoom: 11,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      clickableIcons: false,
      zoomControl: true,
      gestureHandling: 'greedy',
      styles: [{ featureType: 'poi.business', stylers: [{ visibility: 'off' }] }],
    });

    this.map.addListener('click', (event: google.maps.MapMouseEvent) => {
      if (!event.latLng) {
        return;
      }

      this.applyPickedCoordinates(
        event.latLng.lat(),
        event.latLng.lng(),
        this.pickerTarget
      );
    });
  }

  private populateTownSelects(): void {
    const optionsMarkup = MARINDUQUE_TOWNS.map(
      (town) => `<option value="${this.escapeHtmlAttribute(town)}">${this.escapeHtml(town)}</option>`
    ).join('');

    this.createTownSelect.innerHTML = optionsMarkup;
    this.updateTownSelect.innerHTML = optionsMarkup;
  }

  private setPickerTarget(target: PickerTarget): void {
    this.pickerTarget = target;
    this.pickerTargetSelect.value = target;
    this.mapHint.textContent =
      target === 'create'
        ? 'Map clicks will fill the Create form coordinates.'
        : 'Map clicks will fill the Update form coordinates.';
  }

  private applyPickedCoordinates(latitude: number, longitude: number, target: PickerTarget): void {
    const lat = latitude.toFixed(6);
    const lng = longitude.toFixed(6);

    if (target === 'create') {
      this.setFormValue(this.createStationForm, 'latitude', lat);
      this.setFormValue(this.createStationForm, 'longitude', lng);
    } else {
      this.setFormValue(this.updatePriceForm, 'update_latitude', lat);
      this.setFormValue(this.updatePriceForm, 'update_longitude', lng);
    }

    this.placeSelectionMarker(latitude, longitude, target);
    this.mapHint.textContent =
      target === 'create'
        ? `Create form location set to ${lat}, ${lng}.`
        : `Update form location set to ${lat}, ${lng}.`;
  }

  private placeSelectionMarker(latitude: number, longitude: number, target: PickerTarget): void {
    if (!this.map) {
      return;
    }

    if (!this.selectionMarker) {
      this.selectionMarker = new google.maps.Marker({
        map: this.map,
        zIndex: 999,
      });
    }

    this.selectionMarker.setPosition({ lat: latitude, lng: longitude });
    this.selectionMarker.setTitle(
      target === 'create' ? 'New station location' : 'Updated station location'
    );
    this.selectionMarker.setIcon({
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: target === 'create' ? '#22c55e' : '#ef4444',
      fillOpacity: 1,
      strokeColor: '#ffffff',
      strokeWeight: 2,
      scale: 8,
    });

    this.map.panTo({ lat: latitude, lng: longitude });
  }

  private async handleSignOut(): Promise<void> {
    try {
      this.setLoadingState(true);
      this.setErrorState('');
      this.setSuccessState('');
      await this.signOutAdminUseCase.execute();
      window.location.replace('/admin.html');
    } catch (error: unknown) {
      this.handleError(error, 'Unable to sign out.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async handleCreateStation(): Promise<void> {
    try {
      this.setLoadingState(true);
      this.setErrorState('');
      this.setSuccessState('');

      const formData = new FormData(this.createStationForm);

      await this.createStationUseCase.execute({
        name: this.getRequiredString(formData, 'name'),
        town: this.getRequiredString(formData, 'town'),
        latitude: this.getRequiredNumber(formData, 'latitude'),
        longitude: this.getRequiredNumber(formData, 'longitude'),
        fuels: this.extractFuels(formData, ''),
      });

      this.createStationForm.reset();
      this.populateTownSelects();
      this.createTownSelect.value = 'Boac';
      this.clearCreateCoordinates();

      this.setSuccessState('New station added successfully.');
      await this.refreshStationData();
      this.setPickerTarget('create');
    } catch (error: unknown) {
      this.handleError(error, 'Unable to create station.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async handleUpdateStation(): Promise<void> {
    try {
      this.setLoadingState(true);
      this.setErrorState('');
      this.setSuccessState('');

      const formData = new FormData(this.updatePriceForm);

      await this.updateStationPricesUseCase.execute({
        stationId: this.getRequiredNumber(formData, 'stationId'),
        name: this.getRequiredString(formData, 'update_name'),
        town: this.getRequiredString(formData, 'update_town'),
        latitude: this.getRequiredNumber(formData, 'update_latitude'),
        longitude: this.getRequiredNumber(formData, 'update_longitude'),
        fuels: this.extractFuels(formData, 'update_'),
      });

      this.setSuccessState('Station updated successfully.');
      await this.refreshStationData();
      this.setPickerTarget('update');
    } catch (error: unknown) {
      this.handleError(error, 'Unable to update station.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async refreshStationData(): Promise<void> {
    this.stations = await this.getStationsUseCase.execute();

    this.stationCountChip.textContent = `${this.stations.length} station${this.stations.length === 1 ? '' : 's'}`;
    this.townCountChip.textContent = `${MARINDUQUE_TOWNS.length} Marinduque towns`;

    if (this.stations.length === 0) {
      this.stationSelect.innerHTML = '<option value="">No stations found</option>';
      this.stationTableBody.innerHTML = `
        <tr>
          <td colspan="6">
            <div class="empty-state">No stations found yet. Add the first station from the Create form.</div>
          </td>
        </tr>
      `;
      this.renderStationMarkers();
      return;
    }

    this.stationSelect.innerHTML = this.stations
      .map(
        (station) =>
          `<option value="${station.id}">${this.escapeHtml(station.town)} · ${this.escapeHtml(station.name)}</option>`
      )
      .join('');

    this.stationTableBody.innerHTML = this.stations
      .map((station) => {
        const formatCell = (fuel: { price: number | null; availability: FuelAvailability }) => {
          if (fuel.availability === 'out_of_stock') return 'Out of stock';
          if (fuel.availability === 'no_data' || fuel.price === null) return 'No data';
          return `PHP ${fuel.price.toFixed(2)}`;
        };

        return `
          <tr>
            <td>${this.escapeHtml(station.name)}</td>
            <td>${this.escapeHtml(station.town)}</td>
            <td>${station.latitude.toFixed(4)}, ${station.longitude.toFixed(4)}</td>
            <td>${formatCell(station.fuels.unleaded)}</td>
            <td>${formatCell(station.fuels.premium)}</td>
            <td>${formatCell(station.fuels.diesel)}</td>
          </tr>
        `;
      })
      .join('');

    this.renderStationMarkers();
    this.syncUpdateFormFromSelection();
  }

  private renderStationMarkers(): void {
    if (!this.map) {
      return;
    }

    this.stationMarkers.forEach((marker) => marker.setMap(null));
    this.stationMarkers = [];

    const bounds = new google.maps.LatLngBounds();

    this.stations.forEach((station) => {
      const marker = new google.maps.Marker({
        map: this.map!,
        position: { lat: station.latitude, lng: station.longitude },
        title: `${station.town} · ${station.name}`,
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#3b82f6',
          fillOpacity: 0.95,
          strokeColor: '#ffffff',
          strokeWeight: 2,
          scale: 7,
        },
      });

      marker.addListener('click', () => {
        this.stationSelect.value = String(station.id);
        this.syncUpdateFormFromSelection();
        this.setPickerTarget('update');
        this.placeSelectionMarker(station.latitude, station.longitude, 'update');
      });

      this.stationMarkers.push(marker);
      bounds.extend({ lat: station.latitude, lng: station.longitude });
    });

    if (this.stations.length === 1) {
      this.map.setCenter(bounds.getCenter());
      this.map.setZoom(14);
      return;
    }

    if (!bounds.isEmpty()) {
      this.map.fitBounds(bounds, 70);
    } else {
      this.map.setCenter(this.defaultCenter);
      this.map.setZoom(11);
    }
  }

  private syncUpdateFormFromSelection(): void {
    const selectedStation = this.stations.find((station) => station.id === Number(this.stationSelect.value));

    if (!selectedStation) {
      return;
    }

    this.setFormValue(this.updatePriceForm, 'update_name', selectedStation.name);
    this.setFormValue(this.updatePriceForm, 'update_town', selectedStation.town);
    this.setFormValue(this.updatePriceForm, 'update_latitude', String(selectedStation.latitude));
    this.setFormValue(this.updatePriceForm, 'update_longitude', String(selectedStation.longitude));
    this.setFormValue(
      this.updatePriceForm,
      'update_unleaded_price',
      selectedStation.fuels.unleaded.price?.toFixed(2) ?? ''
    );
    this.setFormValue(
      this.updatePriceForm,
      'update_premium_price',
      selectedStation.fuels.premium.price?.toFixed(2) ?? ''
    );
    this.setFormValue(
      this.updatePriceForm,
      'update_diesel_price',
      selectedStation.fuels.diesel.price?.toFixed(2) ?? ''
    );
    this.setFormValue(
      this.updatePriceForm,
      'update_unleaded_status',
      selectedStation.fuels.unleaded.availability
    );
    this.setFormValue(
      this.updatePriceForm,
      'update_premium_status',
      selectedStation.fuels.premium.availability
    );
    this.setFormValue(
      this.updatePriceForm,
      'update_diesel_status',
      selectedStation.fuels.diesel.availability
    );

    if (this.map) {
      this.placeSelectionMarker(selectedStation.latitude, selectedStation.longitude, 'update');
    }
  }

  private clearCreateCoordinates(): void {
    this.setFormValue(this.createStationForm, 'latitude', '');
    this.setFormValue(this.createStationForm, 'longitude', '');
  }

  private setFormValue(form: HTMLFormElement, name: string, value: string): void {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (field) {
      field.value = value;
    }
  }

  private extractFuels(formData: FormData, prefix: string): StationFuelData {
    return {
      unleaded: {
        price: this.getOptionalNumber(formData, `${prefix}unleaded_price`),
        availability: this.getAvailability(formData, `${prefix}unleaded_status`),
      },
      premium: {
        price: this.getOptionalNumber(formData, `${prefix}premium_price`),
        availability: this.getAvailability(formData, `${prefix}premium_status`),
      },
      diesel: {
        price: this.getOptionalNumber(formData, `${prefix}diesel_price`),
        availability: this.getAvailability(formData, `${prefix}diesel_status`),
      },
    };
  }

  private getAvailability(formData: FormData, fieldName: string): FuelAvailability {
    const value = this.getRequiredString(formData, fieldName);
    if (value === 'available' || value === 'no_data' || value === 'out_of_stock') {
      return value;
    }
    throw new Error(`Invalid availability value for ${fieldName}.`);
  }

  private getRequiredString(formData: FormData, fieldName: string): string {
    const value = formData.get(fieldName);
    if (typeof value !== 'string' || value.trim().length === 0) {
      throw new Error(`The field "${fieldName}" is required.`);
    }
    return value.trim();
  }

  private getRequiredNumber(formData: FormData, fieldName: string): number {
    const value = Number(this.getRequiredString(formData, fieldName));
    if (!Number.isFinite(value)) {
      throw new Error(`The field "${fieldName}" must be a valid number.`);
    }
    return value;
  }

  private getOptionalNumber(formData: FormData, fieldName: string): number | null {
    const value = formData.get(fieldName);
    if (typeof value !== 'string' || value.trim() === '') {
      return null;
    }

    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) {
      throw new Error(`The field "${fieldName}" must be a valid number.`);
    }

    return numericValue;
  }

  private setLoadingState(isLoading: boolean): void {
    this.adminLoadingBanner.hidden = !isLoading;
  }

  private setErrorState(message: string): void {
    this.adminErrorBanner.textContent = message;
    this.adminErrorBanner.hidden = message.length === 0;
  }

  private setSuccessState(message: string): void {
    this.adminSuccessBanner.textContent = message;
    this.adminSuccessBanner.hidden = message.length === 0;
  }

  private handleError(error: unknown, fallbackMessage: string): void {
    const message = error instanceof Error ? error.message : fallbackMessage;
    this.setErrorState(message);
    console.error('[FuelPriceAdminDashboardPage]', error);
  }

  private getRequiredElement<TElement extends HTMLElement>(elementId: string): TElement {
    const element = document.getElementById(elementId);
    if (!element) {
      throw new Error(`Required element with id "${elementId}" was not found.`);
    }
    return element as TElement;
  }

  private escapeHtml(value: string): string {
    const container = document.createElement('div');
    container.textContent = value;
    return container.innerHTML;
  }

  private escapeHtmlAttribute(value: string): string {
    return this.escapeHtml(value).replace(/"/g, '&quot;');
  }
}

const page = new FuelPriceAdminDashboardPage();
void page.initialize();