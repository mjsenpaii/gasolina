import type { Station } from '../../domain/entities/Station';
import type { StationRepository } from '../../domain/repositories/StationRepository';

export class GetStationsUseCase {
  public constructor(private readonly stationRepository: StationRepository) {}

  public async execute(): Promise<Station[]> {
    return this.stationRepository.getAllStations();
  }
}
