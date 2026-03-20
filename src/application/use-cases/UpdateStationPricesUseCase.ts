import type { Station, UpdateStationRequest } from '../../domain/entities/Station';
import type { StationRepository } from '../../domain/repositories/StationRepository';

export class UpdateStationPricesUseCase {
  public constructor(private readonly stationRepository: StationRepository) {}

  public async execute(request: UpdateStationRequest): Promise<Station> {
    return this.stationRepository.updateStation(request);
  }
}
