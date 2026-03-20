import { CreateStationUseCase } from '../application/use-cases/CreateStationUseCase';
import { GetAdminSessionUseCase } from '../application/use-cases/GetAdminSessionUseCase';
import { GetStationsUseCase } from '../application/use-cases/GetStationsUseCase';
import { SignInAdminUseCase } from '../application/use-cases/SignInAdminUseCase';
import { SignOutAdminUseCase } from '../application/use-cases/SignOutAdminUseCase';
import { UpdateStationPricesUseCase } from '../application/use-cases/UpdateStationPricesUseCase';
import { SupabaseStationRepository } from '../data/repositories/SupabaseStationRepository';
import { supabaseClient } from '../infrastructure/supabase/supabaseClient';
import type { FuelAvailability, Station, StationFuelData } from '../domain/entities/Station';

class FuelPriceAdminApplication {
  private readonly stationRepository = new SupabaseStationRepository();
  private readonly getStationsUseCase = new GetStationsUseCase(this.stationRepository);
  private readonly createStationUseCase = new CreateStationUseCase(this.stationRepository);
  private readonly updateStationPricesUseCase = new UpdateStationPricesUseCase(this.stationRepository);
  private readonly signInAdminUseCase = new SignInAdminUseCase();
  private readonly signOutAdminUseCase = new SignOutAdminUseCase();
  private readonly getAdminSessionUseCase = new GetAdminSessionUseCase();

  private readonly loginView = this.getRequiredElement<HTMLElement>('loginView');
  private readonly dashboardView = this.getRequiredElement<HTMLElement>('dashboardView');
  private readonly loginForm = this.getRequiredElement<HTMLFormElement>('loginForm');
  private readonly logoutButton = this.getRequiredElement<HTMLButtonElement>('logoutButton');
  private readonly createStationForm = this.getRequiredElement<HTMLFormElement>('createStationForm');
  private readonly updateStationForm = this.getRequiredElement<HTMLFormElement>('updateStationForm');
  private readonly stationSelect = this.getRequiredElement<HTMLSelectElement>('stationId');
  private readonly stationTableBody = this.getRequiredElement<HTMLTableSectionElement>('stationTableBody');
  private readonly adminIdentity = this.getRequiredElement<HTMLElement>('adminIdentity');
  private readonly adminStats = this.getRequiredElement<HTMLElement>('adminStats');
  private readonly loginErrorBanner = this.getRequiredElement<HTMLDivElement>('loginErrorBanner');
  private readonly adminErrorBanner = this.getRequiredElement<HTMLDivElement>('adminErrorBanner');
  private readonly adminSuccessBanner = this.getRequiredElement<HTMLDivElement>('adminSuccessBanner');
  private readonly adminLoadingBanner = this.getRequiredElement<HTMLDivElement>('adminLoadingBanner');

  private stations: Station[] = [];

  public async initialize(): Promise<void> {
    this.registerEventListeners();
    supabaseClient.auth.onAuthStateChange(() => {
      void this.syncAuthState();
    });
    await this.syncAuthState();
  }

  private registerEventListeners(): void {
    this.loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleSignIn();
    });

    this.logoutButton.addEventListener('click', async () => {
      await this.handleSignOut();
    });

    this.createStationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleCreateStation();
    });

    this.updateStationForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await this.handleUpdateStation();
    });

    this.stationSelect.addEventListener('change', () => {
      this.syncUpdateFormFromSelection();
    });
  }

  private async syncAuthState(): Promise<void> {
    try {
      this.setLoadingState(true);
      const session = await this.getAdminSessionUseCase.execute();

      if (!session?.user) {
        this.showLoginView();
        return;
      }

      this.showDashboardView(session.user.email ?? 'Authenticated admin');
      await this.refreshStationData();
    } catch (error: unknown) {
      this.showLoginView();
      this.handleError(error, 'Unable to verify the admin session.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async handleSignIn(): Promise<void> {
    try {
      this.setLoadingState(true);
      this.setLoginError('');
      this.setErrorState('');
      this.setSuccessState('');

      const formData = new FormData(this.loginForm);
      await this.signInAdminUseCase.execute(
        this.getRequiredString(formData, 'email'),
        this.getRequiredString(formData, 'password')
      );

      this.loginForm.reset();
      this.setSuccessState('Signed in successfully.');
      await this.syncAuthState();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Unable to sign in.';
      this.setLoginError(message);
      this.handleError(error, 'Unable to sign in.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async handleSignOut(): Promise<void> {
    try {
      this.setLoadingState(true);
      this.setErrorState('');
      this.setSuccessState('');
      await this.signOutAdminUseCase.execute();
      this.showLoginView();
      this.setSuccessState('Signed out successfully.');
    } catch (error: unknown) {
      this.handleError(error, 'Unable to sign out.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async handleCreateStation(): Promise<void> {
    try {
      this.assertAuthenticated();
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
      this.setSuccessState('New station created.');
      await this.refreshStationData();
    } catch (error: unknown) {
      this.handleError(error, 'Unable to create the station.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async handleUpdateStation(): Promise<void> {
    try {
      this.assertAuthenticated();
      this.setLoadingState(true);
      this.setErrorState('');
      this.setSuccessState('');

      const formData = new FormData(this.updateStationForm);
      await this.updateStationPricesUseCase.execute({
        stationId: this.getRequiredNumber(formData, 'stationId'),
        name: this.getRequiredString(formData, 'update_name'),
        town: this.getRequiredString(formData, 'update_town'),
        latitude: this.getRequiredNumber(formData, 'update_latitude'),
        longitude: this.getRequiredNumber(formData, 'update_longitude'),
        fuels: this.extractFuels(formData, 'update_'),
      });

      this.setSuccessState('Station updated.');
      await this.refreshStationData();
    } catch (error: unknown) {
      this.handleError(error, 'Unable to update the station.');
    } finally {
      this.setLoadingState(false);
    }
  }

  private async refreshStationData(): Promise<void> {
    this.stations = await this.getStationsUseCase.execute();

    this.stationSelect.innerHTML = this.stations.length === 0
      ? '<option value="">No stations found</option>'
      : this.stations
          .map((station) => `<option value="${station.id}">${this.escapeHtml(station.town)} · ${this.escapeHtml(station.name)}</option>`)
          .join('');

    this.stationTableBody.innerHTML = this.stations
      .map((station) => {
        const formatCell = (fuel: { price: number | null; availability: FuelAvailability }) => {
          if (fuel.availability === 'out_of_stock') return '<span class="status-pill status-pill--out">Out</span>';
          if (fuel.availability === 'no_data' || fuel.price === null) return '<span class="status-pill status-pill--muted">No data</span>';
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

    this.adminStats.textContent = `${this.stations.length} station${this.stations.length === 1 ? '' : 's'} loaded`;
    this.syncUpdateFormFromSelection();
  }

  private syncUpdateFormFromSelection(): void {
    const selectedStation = this.stations.find((station) => station.id === Number(this.stationSelect.value));
    if (!selectedStation) {
      return;
    }

    this.setFormValue(this.updateStationForm, 'stationId', String(selectedStation.id));
    this.setFormValue(this.updateStationForm, 'update_name', selectedStation.name);
    this.setFormValue(this.updateStationForm, 'update_town', selectedStation.town);
    this.setFormValue(this.updateStationForm, 'update_latitude', String(selectedStation.latitude));
    this.setFormValue(this.updateStationForm, 'update_longitude', String(selectedStation.longitude));
    this.setFormValue(this.updateStationForm, 'update_unleaded_price', selectedStation.fuels.unleaded.price?.toFixed(2) ?? '');
    this.setFormValue(this.updateStationForm, 'update_premium_price', selectedStation.fuels.premium.price?.toFixed(2) ?? '');
    this.setFormValue(this.updateStationForm, 'update_diesel_price', selectedStation.fuels.diesel.price?.toFixed(2) ?? '');
    this.setFormValue(this.updateStationForm, 'update_unleaded_status', selectedStation.fuels.unleaded.availability);
    this.setFormValue(this.updateStationForm, 'update_premium_status', selectedStation.fuels.premium.availability);
    this.setFormValue(this.updateStationForm, 'update_diesel_status', selectedStation.fuels.diesel.availability);
  }

  private setFormValue(form: HTMLFormElement, name: string, value: string): void {
    const field = form.elements.namedItem(name) as HTMLInputElement | HTMLSelectElement | null;
    if (field) {
      field.value = value;
    }
  }

  private showLoginView(): void {
    this.loginView.hidden = false;
    this.dashboardView.hidden = true;
    this.adminIdentity.textContent = 'Not signed in';
    this.adminStats.textContent = 'Awaiting admin authentication';
  }

  private showDashboardView(email: string): void {
    this.loginView.hidden = true;
    this.dashboardView.hidden = false;
    this.adminIdentity.textContent = email;
  }

  private async assertAuthenticated(): Promise<void> {
    const session = await this.getAdminSessionUseCase.execute();
    if (!session?.user) {
      this.showLoginView();
      throw new Error('Your session expired. Please sign in again.');
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

  private setLoginError(message: string): void {
    this.loginErrorBanner.textContent = message;
    this.loginErrorBanner.hidden = message.length === 0;
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
    console.error('[FuelPriceAdminApplication]', error);
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
}

const application = new FuelPriceAdminApplication();
void application.initialize();
