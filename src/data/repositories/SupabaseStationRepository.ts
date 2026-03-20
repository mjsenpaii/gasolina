import type {
  CreateStationRequest,
  FuelAvailability,
  Station,
  UpdateStationRequest,
} from '../../domain/entities/Station';
import type { StationRepository } from '../../domain/repositories/StationRepository';
import { supabaseClient } from '../../infrastructure/supabase/supabaseClient';

interface StationRecord {
  id: number;
  name: string;
  town: string;
  latitude: number;
  longitude: number;
  unleaded_price: number | null;
  premium_price: number | null;
  diesel_price: number | null;
  unleaded_status: FuelAvailability;
  premium_status: FuelAvailability;
  diesel_status: FuelAvailability;
}

export class SupabaseStationRepository implements StationRepository {
  public async getAllStations(): Promise<Station[]> {
    const { data, error } = await supabaseClient
      .from('stations')
.select(`
        id,
        name,
        town,
        latitude,
        longitude,
        unleaded_price,
        premium_price,
        diesel_price,
        unleaded_status,
        premium_status,
        diesel_status
      `)
      .returns<StationRecord[]>()
      .order('town', { ascending: true })
      .order('name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch stations from Supabase: ${error.message}`);
    }

    return (data ?? []).map((record) => this.mapRecordToStation(record));
  }

  public async createStation(request: CreateStationRequest): Promise<Station> {
    const { data, error } = await supabaseClient
      .from('stations')
      .insert(this.mapRequestToRecord(request))
.select(`
        id,
        name,
        town,
        latitude,
        longitude,
        unleaded_price,
        premium_price,
        diesel_price,
        unleaded_status,
        premium_status,
        diesel_status
      `)
      .single<StationRecord>();

    if (error) {
      throw new Error(`Failed to create station in Supabase: ${error.message}`);
    }

    return this.mapRecordToStation(data as StationRecord);
  }

  public async updateStation(request: UpdateStationRequest): Promise<Station> {
    const { data, error } = await supabaseClient
      .from('stations')
      .update(this.mapRequestToRecord(request))
      .eq('id', request.stationId)
.select(`
        id,
        name,
        town,
        latitude,
        longitude,
        unleaded_price,
        premium_price,
        diesel_price,
        unleaded_status,
        premium_status,
        diesel_status
      `)
      .single<StationRecord>();

    if (error) {
      throw new Error(`Failed to update station in Supabase: ${error.message}`);
    }

    return this.mapRecordToStation(data as StationRecord);
  }

  private mapRequestToRecord(request: CreateStationRequest | UpdateStationRequest) {
    return {
      name: request.name,
      town: request.town,
      latitude: request.latitude,
      longitude: request.longitude,
      unleaded_price: request.fuels.unleaded.price,
      premium_price: request.fuels.premium.price,
      diesel_price: request.fuels.diesel.price,
      unleaded_status: request.fuels.unleaded.availability,
      premium_status: request.fuels.premium.availability,
      diesel_status: request.fuels.diesel.availability,
    };
  }

  private mapRecordToStation(record: StationRecord): Station {
    return {
      id: record.id,
      name: record.name,
      town: record.town,
      latitude: record.latitude,
      longitude: record.longitude,
      fuels: {
        unleaded: {
          price: record.unleaded_price === null ? null : Number(record.unleaded_price),
          availability: record.unleaded_status,
        },
        premium: {
          price: record.premium_price === null ? null : Number(record.premium_price),
          availability: record.premium_status,
        },
        diesel: {
          price: record.diesel_price === null ? null : Number(record.diesel_price),
          availability: record.diesel_status,
        },
      },
    };
  }
}
