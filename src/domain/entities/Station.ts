export type FuelType = 'unleaded' | 'premium' | 'diesel';
export type FuelAvailability = 'available' | 'no_data' | 'out_of_stock';
export type PriceLegendCategory = 'below_avg' | 'near_avg' | 'above_avg' | 'no_data' | 'out_of_stock';

export interface FuelPriceValue {
  price: number | null;
  availability: FuelAvailability;
}

export interface StationFuelData {
  unleaded: FuelPriceValue;
  premium: FuelPriceValue;
  diesel: FuelPriceValue;
}

export interface Station {
  id: number;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  fuels: StationFuelData;
}

export interface CreateStationRequest {
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  fuels: StationFuelData;
}

export interface UpdateStationRequest {
  stationId: number;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  fuels: StationFuelData;
}
