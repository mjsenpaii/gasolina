import type { CreateStationRequest, Station, UpdateStationRequest } from '../entities/Station';

export interface StationRepository {
  getAllStations(): Promise<Station[]>;
  createStation(request: CreateStationRequest): Promise<Station>;
  updateStation(request: UpdateStationRequest): Promise<Station>;
}
