import type { CreateStationRequest, Station } from '../../domain/entities/Station';
import type { StationRepository } from '../../domain/repositories/StationRepository';

export class CreateStationUseCase {
  public constructor(private readonly stationRepository: StationRepository) {}

  public async execute(request: CreateStationRequest): Promise<Station> {
    return this.stationRepository.createStation(request);
  }
}
